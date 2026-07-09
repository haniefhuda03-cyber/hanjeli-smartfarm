import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PassThrough, Transform } from 'node:stream';
import { Repository, SelectQueryBuilder } from 'typeorm';
import {
  buildPaginationMeta,
  PaginatedResponse,
} from '../../common/dto/pagination.dto.js';
import { SensorTelemetry } from '../../entities/sensor-telemetry.entity.js';
import {
  SensorExportQueryDto,
  SensorHistoryQueryDto,
  SensorTrendQueryDto,
} from './dto/sensor-query.dto.js';

type SensorQueryParam =
  | 'ph'
  | 'ph_level'
  | 'soil_moisture'
  | 'soil_nitrogen'
  | 'soil_phosphorus'
  | 'soil_potassium'
  | 'soil_temperature';

interface SensorParamConfig {
  raw: string;
  avg: string;
  max: string;
  min: string;
  publicKey: string;
  label: string;
  unit: string;
}

export interface SensorReading {
  id: string;
  device_id: string;
  device: {
    id: string;
    code: string;
    name: string;
  };
  captured_at: string;
  /** Waktu pengiriman dari ESP32 — selalu terisi (NOT NULL di DB) */
  sent_at: string;
  ph_level: number | null;
  soil_moisture: number | null;
  soil_nitrogen: number | null;
  soil_phosphorus: number | null;
  soil_potassium: number | null;
  soil_temperature: number | null;
  /** Kondisi hujan saat data diambil (null = perangkat tidak melaporkan) */
  is_raining: boolean | null;
}

const SENSOR_PARAM_CONFIG: Record<SensorQueryParam, SensorParamConfig> = {
  ph: {
    raw: 'ph_level',
    avg: 'avg_ph',
    max: 'max_ph',
    min: 'min_ph',
    publicKey: 'ph',
    label: 'pH Tanah',
    unit: 'pH',
  },
  ph_level: {
    raw: 'ph_level',
    avg: 'avg_ph',
    max: 'max_ph',
    min: 'min_ph',
    publicKey: 'ph',
    label: 'pH Tanah',
    unit: 'pH',
  },
  soil_moisture: {
    raw: 'soil_moisture',
    avg: 'avg_moisture',
    max: 'max_moisture',
    min: 'min_moisture',
    publicKey: 'soil_moisture',
    label: 'Kelembaban Tanah',
    unit: '%',
  },
  soil_nitrogen: {
    raw: 'soil_nitrogen',
    avg: 'avg_nitrogen',
    max: 'max_nitrogen',
    min: 'min_nitrogen',
    publicKey: 'soil_nitrogen',
    label: 'Nitrogen (N)',
    unit: 'mg/kg',
  },
  soil_phosphorus: {
    raw: 'soil_phosphorus',
    avg: 'avg_phosphorus',
    max: 'max_phosphorus',
    min: 'min_phosphorus',
    publicKey: 'soil_phosphorus',
    label: 'Fosfor (P)',
    unit: 'mg/kg',
  },
  soil_potassium: {
    raw: 'soil_potassium',
    avg: 'avg_potassium',
    max: 'max_potassium',
    min: 'min_potassium',
    publicKey: 'soil_potassium',
    label: 'Kalium (K)',
    unit: 'mg/kg',
  },
  soil_temperature: {
    raw: 'soil_temperature',
    avg: 'avg_soil_temperature',
    max: 'max_soil_temperature',
    min: 'min_soil_temperature',
    publicKey: 'soil_temperature',
    label: 'Suhu Tanah',
    unit: '°C',
  },
};

/**
 * Status keseluruhan satu baris pembacaan sensor — KODE mesin (bukan teks).
 * Pelabelan bahasa ditangani frontend via i18n (monitoring.status*), sehingga
 * backend tetap netral-bahasa dan FE/BE selalu sinkron.
 */
export type ReadingStatus = 'optimal' | 'warning' | 'danger' | 'no_data';

/** Baris riwayat + status turunan yang dihitung backend (sumber tunggal logika) */
export type SensorHistoryRow = SensorTelemetry & { status: ReadingStatus };

/** Bentuk minimal untuk menghitung status — cocok utk entity & raw stream row */
interface ReadingLike {
  ph_level: unknown;
  soil_moisture: unknown;
  soil_nitrogen: unknown;
  soil_phosphorus: unknown;
  soil_potassium: unknown;
  soil_temperature: unknown;
}

/** Label CSV yang dikirim frontend dari i18n (bahasa aktif pengguna) */
interface ExportLabels {
  header: string;
  status: Record<ReadingStatus, string>;
  rain: string;
  noRain: string;
}

const RANGE_CONFIG = {
  day: { view: 'sensor_hourly_stats', milliseconds: 24 * 60 * 60 * 1000 },
  week: { view: 'sensor_daily_stats', milliseconds: 7 * 24 * 60 * 60 * 1000 },
  month: {
    view: 'sensor_daily_stats',
    milliseconds: 30 * 24 * 60 * 60 * 1000,
  },
} as const;

/** Rentang optimal/diizinkan per parameter untuk status & skor kualitas */
const PARAM_HEALTH_RANGES: Partial<
  Record<SensorQueryParam, { optimal: { min: number; max: number }; allowed: { min: number; max: number } }>
> = {
  ph: { optimal: { min: 6, max: 7.5 }, allowed: { min: 5.5, max: 8 } },
  ph_level: { optimal: { min: 6, max: 7.5 }, allowed: { min: 5.5, max: 8 } },
  soil_moisture: { optimal: { min: 40, max: 70 }, allowed: { min: 30, max: 80 } },
  soil_nitrogen: { optimal: { min: 20, max: 60 }, allowed: { min: 10, max: 100 } },
  soil_phosphorus: { optimal: { min: 20, max: 60 }, allowed: { min: 10, max: 100 } },
  soil_potassium: { optimal: { min: 20, max: 60 }, allowed: { min: 10, max: 100 } },
  soil_temperature: { optimal: { min: 20, max: 30 }, allowed: { min: 15, max: 35 } },
};

@Injectable()
export class SensorsService {
  constructor(
    @InjectRepository(SensorTelemetry)
    private readonly telemetryRepository: Repository<SensorTelemetry>,
  ) {}

  async getLatest(userId: string): Promise<SensorReading[]> {
    const rows = await this.telemetryRepository.manager.query(
      `
        SELECT DISTINCT ON (device.id)
          telemetry.id::text AS id,
          telemetry.device_id AS device_id,
          device.id AS device_id_value,
          device.code AS device_code,
          device.name AS device_name,
          telemetry.captured_at AS captured_at,
          telemetry.sent_at AS sent_at,
          telemetry.ph_level AS ph_level,
          telemetry.soil_moisture AS soil_moisture,
          telemetry.soil_nitrogen AS soil_nitrogen,
          telemetry.soil_phosphorus AS soil_phosphorus,
          telemetry.soil_potassium AS soil_potassium,
          telemetry.soil_temperature AS soil_temperature,
          telemetry.is_raining AS is_raining
        FROM sensor_telemetry telemetry
        INNER JOIN devices device ON device.id = telemetry.device_id
        WHERE device.user_id = $1
        ORDER BY device.id, telemetry.captured_at DESC
      `,
      [userId],
    );

    return rows.map((row: Record<string, unknown>) => this.toReading(row));
  }

  async getOverview(userId: string) {
    const rows = await this.telemetryRepository.manager.query(
      `
        SELECT
          telemetry.id::text AS id,
          telemetry.device_id AS device_id,
          device.id AS device_id_value,
          device.code AS device_code,
          device.name AS device_name,
          telemetry.captured_at AS captured_at,
          telemetry.sent_at AS sent_at,
          telemetry.ph_level AS ph_level,
          telemetry.soil_moisture AS soil_moisture,
          telemetry.soil_nitrogen AS soil_nitrogen,
          telemetry.soil_phosphorus AS soil_phosphorus,
          telemetry.soil_potassium AS soil_potassium,
          telemetry.soil_temperature AS soil_temperature,
          telemetry.is_raining AS is_raining
        FROM sensor_telemetry telemetry
        INNER JOIN devices device ON device.id = telemetry.device_id
        WHERE device.user_id = $1
        ORDER BY telemetry.captured_at DESC
        LIMIT 1
      `,
      [userId],
    );

    if (rows.length === 0) {
      return null;
    }

    const reading = this.toReading(rows[0]);

    return {
      ...reading,
      parameters: [
        this.toParameterCard('ph', reading.ph_level),
        this.toParameterCard('soil_moisture', reading.soil_moisture),
        /* NPK = tiga nilai terpisah dalam satu kartu (tanpa nilai gabungan) */
        {
          key: 'npk',
          label: 'Kadar NPK (N, P, K)',
          unit: 'mg/kg',
          nitrogen: reading.soil_nitrogen,
          phosphorus: reading.soil_phosphorus,
          potassium: reading.soil_potassium,
          status: this.npkStatus(reading),
        },
        this.toParameterCard('soil_temperature', reading.soil_temperature),
      ],
    };
  }

  async getQualityScore(userId: string) {
    const overview = await this.getOverview(userId);
    if (!overview) {
      return {
        score: 0,
        status: 'Tidak Ada Data',
        message: 'Data sensor belum tersedia',
      };
    }

    let score = 100;
    const reasons: string[] = [];

    score -= this.penalty(
      overview.ph_level,
      'ph',
      'pH tanah di luar rentang optimal',
      reasons,
    );
    score -= this.penalty(
      overview.soil_moisture,
      'soil_moisture',
      'Kelembaban tanah perlu perhatian',
      reasons,
    );
    score -= this.penalty(
      overview.soil_nitrogen,
      'soil_nitrogen',
      'Nitrogen (N) tanah perlu perhatian',
      reasons,
    );
    score -= this.penalty(
      overview.soil_phosphorus,
      'soil_phosphorus',
      'Fosfor (P) tanah perlu perhatian',
      reasons,
    );
    score -= this.penalty(
      overview.soil_potassium,
      'soil_potassium',
      'Kalium (K) tanah perlu perhatian',
      reasons,
    );
    score -= this.penalty(
      overview.soil_temperature,
      'soil_temperature',
      'Suhu tanah di luar rentang optimal',
      reasons,
    );

    score = Math.max(0, Math.round(score));

    let status = 'Sangat Baik';
    if (score < 60) status = 'Buruk';
    else if (score < 80) status = 'Cukup';
    else if (score < 90) status = 'Baik';

    return {
      score,
      status,
      reasons,
      captured_at: overview.captured_at,
      device: overview.device,
    };
  }

  async getTrend(userId: string, query: SensorTrendQueryDto) {
    const param = this.getParamConfig(query.param);
    const range = this.getRangeConfig(query.range);
    const deviceIds = await this.getOwnedDeviceIds(userId, query.device_id);

    if (deviceIds.length === 0) {
      return [];
    }

    const rows = await this.telemetryRepository.manager.query(
      `
        SELECT
          bucket AS label,
          AVG(${param.avg}) AS value
        FROM ${range.view}
        WHERE device_id = ANY($1::uuid[])
          AND bucket >= $2
        GROUP BY bucket
        ORDER BY bucket ASC
      `,
      [deviceIds, this.rangeStart(range.milliseconds)],
    );

    return rows.map((row: Record<string, unknown>) => ({
      label: this.toIsoString(row.label),
      value: this.toRoundedNumber(row.value),
    }));
  }

  async getStats(userId: string, query: SensorTrendQueryDto) {
    const param = this.getParamConfig(query.param);
    const range = this.getRangeConfig(query.range);
    const deviceIds = await this.getOwnedDeviceIds(userId, query.device_id);

    if (deviceIds.length === 0) {
      return {
        param: param.publicKey,
        range: query.range,
        min: null,
        max: null,
        avg: null,
        sample_count: 0,
      };
    }

    const rows = await this.telemetryRepository.manager.query(
      `
        SELECT
          MIN(${param.min}) AS min_value,
          MAX(${param.max}) AS max_value,
          AVG(${param.avg}) AS avg_value,
          COUNT(*)::int AS sample_count
        FROM ${range.view}
        WHERE device_id = ANY($1::uuid[])
          AND bucket >= $2
      `,
      [deviceIds, this.rangeStart(range.milliseconds)],
    );

    const row = rows[0] ?? {};

    return {
      param: param.publicKey,
      range: query.range,
      min: this.toRoundedNumber(row.min_value),
      max: this.toRoundedNumber(row.max_value),
      avg: this.toRoundedNumber(row.avg_value),
      sample_count: Number(row.sample_count ?? 0),
    };
  }

  async getHistory(
    userId: string,
    query: SensorHistoryQueryDto,
  ): Promise<PaginatedResponse<SensorHistoryRow>> {
    this.assertDateRange(query);

    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const [rows, total] = await this.buildHistoryQuery(userId, query)
      .orderBy('telemetry.captured_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const data: SensorHistoryRow[] = rows.map((row) => ({
      ...row,
      status: this.readingStatus(row),
    }));

    return {
      data,
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  /**
   * Stream CSV riwayat sensor.
   *
   * Backend TIDAK menyimpan teks bahasa apa pun: seluruh label (header kolom,
   * label status, label kondisi hujan) DIKIRIM oleh frontend dari i18n lewat
   * query (`ExportLabels`). Dengan begitu bahasa file selalu mengikuti bahasa
   * yang dipilih pengguna, dan FE/BE tetap sinkron. Bila label tidak dikirim,
   * dipakai fallback netral (kode mentah) sebagai pengaman.
   *
   * Kolom: Waktu Data, Waktu Pengiriman, pH, Kelembaban, N, P, K, Suhu,
   * Kondisi, Status.
   */
  async getExportStream(userId: string, query: SensorExportQueryDto) {
    this.assertDateRange(query);

    const labels = this.resolveExportLabels(query);
    const source = await this.buildExportQuery(userId, query).stream();
    const output = new PassThrough();
    const transformer = new Transform({
      objectMode: true,
      transform: (row: Record<string, unknown>, _encoding, callback) => {
        callback(null, this.toCsvLine(row, labels));
      },
    });

    output.write(labels.header + '\n');

    source.on('error', (error) => output.destroy(error));
    transformer.on('error', (error) => output.destroy(error));
    transformer.on('end', () => output.end());

    source.pipe(transformer).pipe(output, { end: false });

    return output;
  }

  private buildHistoryQuery(
    userId: string,
    query: SensorHistoryQueryDto,
  ): SelectQueryBuilder<SensorTelemetry> {
    const builder = this.telemetryRepository
      .createQueryBuilder('telemetry')
      .innerJoinAndSelect('telemetry.device', 'device')
      .where('device.user_id = :userId', { userId });

    if (query.device_id) {
      builder.andWhere('device.id = :deviceId', { deviceId: query.device_id });
    }

    if (query.from) {
      builder.andWhere('telemetry.captured_at >= :from', {
        from: this.inclusiveFrom(query.from),
      });
    }

    if (query.to) {
      builder.andWhere('telemetry.captured_at <= :to', {
        to: this.inclusiveTo(query.to),
      });
    }

    return builder;
  }

  private buildExportQuery(userId: string, query: SensorHistoryQueryDto) {
    const builder = this.telemetryRepository
      .createQueryBuilder('telemetry')
      .innerJoin('telemetry.device', 'device')
      .select('telemetry.captured_at', 'captured_at')
      .addSelect('telemetry.sent_at', 'sent_at')
      .addSelect('telemetry.device_id', 'device_id')
      .addSelect('device.code', 'device_code')
      .addSelect('device.name', 'device_name')
      .addSelect('telemetry.ph_level', 'ph_level')
      .addSelect('telemetry.soil_moisture', 'soil_moisture')
      .addSelect('telemetry.soil_nitrogen', 'soil_nitrogen')
      .addSelect('telemetry.soil_phosphorus', 'soil_phosphorus')
      .addSelect('telemetry.soil_potassium', 'soil_potassium')
      .addSelect('telemetry.soil_temperature', 'soil_temperature')
      .addSelect('telemetry.is_raining', 'is_raining')
      .where('device.user_id = :userId', { userId })
      .orderBy('telemetry.captured_at', 'DESC');

    if (query.device_id) {
      builder.andWhere('device.id = :deviceId', { deviceId: query.device_id });
    }

    if (query.from) {
      builder.andWhere('telemetry.captured_at >= :from', {
        from: this.inclusiveFrom(query.from),
      });
    }

    if (query.to) {
      builder.andWhere('telemetry.captured_at <= :to', {
        to: this.inclusiveTo(query.to),
      });
    }

    return builder;
  }

  private async getOwnedDeviceIds(
    userId: string,
    requestedDeviceId?: string,
  ): Promise<string[]> {
    const params = requestedDeviceId ? [userId, requestedDeviceId] : [userId];
    const rows = await this.telemetryRepository.manager.query(
      `
        SELECT id
        FROM devices
        WHERE user_id = $1
          ${requestedDeviceId ? 'AND id = $2' : ''}
        ORDER BY created_at ASC
      `,
      params,
    );

    if (requestedDeviceId && rows.length === 0) {
      throw new NotFoundException('Device sensor tidak ditemukan');
    }

    return rows.map((row: { id: string }) => row.id);
  }

  private getParamConfig(param: SensorQueryParam): SensorParamConfig {
    return SENSOR_PARAM_CONFIG[param];
  }

  private getRangeConfig(range: SensorTrendQueryDto['range']) {
    return RANGE_CONFIG[range];
  }

  private rangeStart(milliseconds: number): Date {
    return new Date(Date.now() - milliseconds);
  }

  private toReading(row: Record<string, unknown>): SensorReading {
    return {
      id: String(row.id),
      device_id: String(row.device_id),
      device: {
        id: String(row.device_id_value ?? row.device_id),
        code: String(row.device_code),
        name: String(row.device_name),
      },
      captured_at: this.toIsoString(row.captured_at),
      sent_at: this.toIsoString(row.sent_at),
      ph_level: this.toRoundedNumber(row.ph_level),
      soil_moisture: this.toRoundedNumber(row.soil_moisture),
      soil_nitrogen: this.toRoundedNumber(row.soil_nitrogen),
      soil_phosphorus: this.toRoundedNumber(row.soil_phosphorus),
      soil_potassium: this.toRoundedNumber(row.soil_potassium),
      soil_temperature: this.toRoundedNumber(row.soil_temperature),
      is_raining:
        row.is_raining === null || row.is_raining === undefined
          ? null
          : Boolean(row.is_raining),
    };
  }

  private toParameterCard(param: SensorQueryParam, value: number | null) {
    const config = this.getParamConfig(param);
    return {
      key: config.publicKey,
      label: config.label,
      value,
      unit: config.unit,
      status: this.sensorStatus(param, value),
    };
  }

  /** Status kartu NPK: warning bila salah satu N/P/K di luar rentang optimal */
  private npkStatus(reading: SensorReading): string {
    const statuses = [
      this.sensorStatus('soil_nitrogen', reading.soil_nitrogen),
      this.sensorStatus('soil_phosphorus', reading.soil_phosphorus),
      this.sensorStatus('soil_potassium', reading.soil_potassium),
    ];
    if (statuses.every((s) => s === 'no_data')) return 'no_data';
    if (statuses.includes('warning')) return 'warning';
    return 'optimal';
  }

  private sensorStatus(param: SensorQueryParam, value: number | null): string {
    if (value === null) return 'no_data';

    const range = PARAM_HEALTH_RANGES[param];
    if (!range) return 'normal';
    return value >= range.optimal.min && value <= range.optimal.max
      ? 'optimal'
      : 'warning';
  }

  private penalty(
    value: number | null,
    param: SensorQueryParam,
    reason: string,
    reasons: string[],
  ): number {
    const range = PARAM_HEALTH_RANGES[param];
    if (!range) return 0;

    if (value === null) {
      reasons.push(`${reason}: data belum tersedia`);
      return 6;
    }

    if (value < range.allowed.min || value > range.allowed.max) {
      reasons.push(reason);
      return 16;
    }

    if (value < range.optimal.min || value > range.optimal.max) {
      reasons.push(reason);
      return 8;
    }

    return 0;
  }

  private assertDateRange(query: SensorHistoryQueryDto): void {
    if (!query.from || !query.to) return;

    if (new Date(query.from).getTime() > new Date(query.to).getTime()) {
      throw new BadRequestException(
        'Tanggal awal tidak boleh setelah tanggal akhir',
      );
    }
  }

  private toRoundedNumber(value: unknown): number | null {
    if (value === null || value === undefined) return null;

    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;

    return Math.round(parsed * 100) / 100;
  }

  private toIsoString(value: unknown): string {
    if (value instanceof Date) return value.toISOString();
    return new Date(String(value)).toISOString();
  }

  private toCsvLine(row: Record<string, unknown>, labels: ExportLabels): string {
    const status = this.readingStatus(row as unknown as ReadingLike);
    return (
      [
        this.toCsvValue(row.captured_at),
        this.toCsvValue(row.sent_at),
        this.toCsvValue(row.ph_level),
        this.toCsvValue(row.soil_moisture),
        this.toCsvValue(row.soil_nitrogen),
        this.toCsvValue(row.soil_phosphorus),
        this.toCsvValue(row.soil_potassium),
        this.toCsvValue(row.soil_temperature),
        this.toCsvValue(this.conditionLabel(row.is_raining, labels)),
        this.toCsvValue(labels.status[status]),
      ].join(',') + '\n'
    );
  }

  private toCsvValue(value: unknown): string {
    if (value === null || value === undefined) return '';

    const text = value instanceof Date ? value.toISOString() : String(value);
    if (!/[",\r\n]/.test(text)) return text;

    return `"${text.replace(/"/g, '""')}"`;
  }

  /**
   * Status keseluruhan satu pembacaan = kondisi TERBURUK di antara 6 parameter.
   * Dipakai bersama oleh riwayat (JSON) dan ekspor (CSV) → satu sumber logika.
   */
  private readingStatus(reading: ReadingLike): ReadingStatus {
    const statuses: ReadingStatus[] = [
      this.paramStatus('ph_level', reading.ph_level),
      this.paramStatus('soil_moisture', reading.soil_moisture),
      this.paramStatus('soil_nitrogen', reading.soil_nitrogen),
      this.paramStatus('soil_phosphorus', reading.soil_phosphorus),
      this.paramStatus('soil_potassium', reading.soil_potassium),
      this.paramStatus('soil_temperature', reading.soil_temperature),
    ];

    if (statuses.every((s) => s === 'no_data')) return 'no_data';
    if (statuses.includes('danger')) return 'danger';
    if (statuses.includes('warning')) return 'warning';
    return 'optimal';
  }

  /** Status satu parameter berdasarkan rentang optimal/diizinkan. */
  private paramStatus(param: SensorQueryParam, value: unknown): ReadingStatus {
    if (value === null || value === undefined) return 'no_data';

    const num = Number(value);
    if (!Number.isFinite(num)) return 'no_data';

    const range = PARAM_HEALTH_RANGES[param];
    if (!range) return 'optimal';

    if (num < range.allowed.min || num > range.allowed.max) return 'danger';
    if (num < range.optimal.min || num > range.optimal.max) return 'warning';
    return 'optimal';
  }

  private conditionLabel(value: unknown, labels: ExportLabels): string {
    if (value === null || value === undefined) return '';
    return value ? labels.rain : labels.noRain;
  }

  /**
   * Rangkai label ekspor dari query (i18n frontend). Fallback = kode mentah
   * agar backend tetap netral-bahasa saat label tidak dikirim.
   */
  private resolveExportLabels(query: SensorExportQueryDto): ExportLabels {
    return {
      header:
        query.header ??
        'Timestamp,Sent At,Soil pH,Soil Moisture,N,P,K,Soil Temperature,Condition,Status',
      status: {
        optimal: query.statusOptimal ?? 'optimal',
        warning: query.statusWarning ?? 'warning',
        danger: query.statusDanger ?? 'danger',
        no_data: query.statusNoData ?? 'no_data',
      },
      rain: query.conditionRain ?? 'rain',
      noRain: query.conditionNoRain ?? 'no_rain',
    };
  }

  /** Batas bawah inklusif: date-only (YYYY-MM-DD) → awal hari. */
  private inclusiveFrom(value: string): string {
    return this.isDateOnly(value) ? `${value}T00:00:00.000` : value;
  }

  /** Batas atas inklusif: date-only → akhir hari, agar hari-`to` ikut terekspor. */
  private inclusiveTo(value: string): string {
    return this.isDateOnly(value) ? `${value}T23:59:59.999` : value;
  }

  private isDateOnly(value: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(value);
  }
}
