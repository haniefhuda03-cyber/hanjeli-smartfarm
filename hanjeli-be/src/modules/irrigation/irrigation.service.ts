import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppCacheService } from '../../common/cache/app-cache.service.js';
import {
  buildPaginationMeta,
  PaginatedResponse,
} from '../../common/dto/pagination.dto.js';
import { IrrigationActivityLog } from '../../entities/irrigation-activity-log.entity.js';
import { IrrigationConfig } from '../../entities/irrigation-config.entity.js';
import { IrrigationSchedule } from '../../entities/irrigation-schedule.entity.js';
import {
  CreateIrrigationScheduleDto,
  IrrigationActivityQueryDto,
  UpdateIrrigationConfigDto,
  UpdateIrrigationScheduleDto,
} from './dto/irrigation.dto.js';

type ActivityType = 'success' | 'info' | 'warning';

const DEFAULT_WATER_MIN_THRESHOLD = 30;
const DEFAULT_WATER_MAX_THRESHOLD = 80;
const DEFAULT_NUTRIENT_MIN_THRESHOLD = 20;
const DEFAULT_NUTRIENT_MAX_THRESHOLD = 60;

@Injectable()
export class IrrigationService {
  private readonly logger = new Logger(IrrigationService.name);

  constructor(
    @InjectRepository(IrrigationConfig)
    private readonly configRepository: Repository<IrrigationConfig>,
    @InjectRepository(IrrigationSchedule)
    private readonly scheduleRepository: Repository<IrrigationSchedule>,
    @InjectRepository(IrrigationActivityLog)
    private readonly activityRepository: Repository<IrrigationActivityLog>,
    @Optional()
    private readonly cache?: AppCacheService,
  ) {}

  async getConfig(userId: string): Promise<IrrigationConfig> {
    let config = await this.configRepository.findOne({
      where: { user_id: userId },
    });

    if (!config) {
      config = this.configRepository.create({
        user_id: userId,
        active_mode: 'off',
        emergency_stop: false,
        auto_parameter: 'soil_moisture',
        auto_threshold_value: DEFAULT_WATER_MIN_THRESHOLD,
        auto_threshold_direction: 'below',
        water_min_threshold: DEFAULT_WATER_MIN_THRESHOLD,
        water_max_threshold: DEFAULT_WATER_MAX_THRESHOLD,
        npk_min_threshold: DEFAULT_NUTRIENT_MIN_THRESHOLD * 3,
        npk_max_threshold: DEFAULT_NUTRIENT_MAX_THRESHOLD * 3,
        nitrogen_min_threshold: DEFAULT_NUTRIENT_MIN_THRESHOLD,
        nitrogen_max_threshold: DEFAULT_NUTRIENT_MAX_THRESHOLD,
        phosphorus_min_threshold: DEFAULT_NUTRIENT_MIN_THRESHOLD,
        phosphorus_max_threshold: DEFAULT_NUTRIENT_MAX_THRESHOLD,
        potassium_min_threshold: DEFAULT_NUTRIENT_MIN_THRESHOLD,
        potassium_max_threshold: DEFAULT_NUTRIENT_MAX_THRESHOLD,
        manual_water_enabled: false,
        manual_fertilizer_enabled: false,
        manual_speed: 100,
        fertilizer_manual_speed: 100,
        scheduled_behavior: 'manual',
      });
      config = await this.configRepository.save(config);
      this.logger.log(`Created default irrigation config for user ${userId}`);
    }

    return config;
  }

  async updateConfig(
    userId: string,
    dto: UpdateIrrigationConfigDto,
  ): Promise<IrrigationConfig> {
    const config = await this.getConfig(userId);
    const before = { ...config };
    const next = {
      ...config,
      water_min_threshold:
        config.water_min_threshold ?? DEFAULT_WATER_MIN_THRESHOLD,
      water_max_threshold:
        config.water_max_threshold ?? DEFAULT_WATER_MAX_THRESHOLD,
      nitrogen_min_threshold:
        config.nitrogen_min_threshold ?? DEFAULT_NUTRIENT_MIN_THRESHOLD,
      nitrogen_max_threshold:
        config.nitrogen_max_threshold ?? DEFAULT_NUTRIENT_MAX_THRESHOLD,
      phosphorus_min_threshold:
        config.phosphorus_min_threshold ?? DEFAULT_NUTRIENT_MIN_THRESHOLD,
      phosphorus_max_threshold:
        config.phosphorus_max_threshold ?? DEFAULT_NUTRIENT_MAX_THRESHOLD,
      potassium_min_threshold:
        config.potassium_min_threshold ?? DEFAULT_NUTRIENT_MIN_THRESHOLD,
      potassium_max_threshold:
        config.potassium_max_threshold ?? DEFAULT_NUTRIENT_MAX_THRESHOLD,
      manual_water_enabled: config.manual_water_enabled ?? false,
      manual_fertilizer_enabled: config.manual_fertilizer_enabled ?? false,
      manual_speed: config.manual_speed ?? 100,
      fertilizer_manual_speed: config.fertilizer_manual_speed ?? 100,
      ...dto,
    };

    this.assertThresholdRanges(next);
    this.assertManualPumpExclusivity(next);
    Object.assign(config, dto);
    config.water_min_threshold = next.water_min_threshold;
    config.water_max_threshold = next.water_max_threshold;
    config.nitrogen_min_threshold = next.nitrogen_min_threshold;
    config.nitrogen_max_threshold = next.nitrogen_max_threshold;
    config.phosphorus_min_threshold = next.phosphorus_min_threshold;
    config.phosphorus_max_threshold = next.phosphorus_max_threshold;
    config.potassium_min_threshold = next.potassium_min_threshold;
    config.potassium_max_threshold = next.potassium_max_threshold;
    config.manual_water_enabled = next.manual_water_enabled;
    config.manual_fertilizer_enabled = next.manual_fertilizer_enabled;
    config.manual_speed = next.manual_speed;
    config.fertilizer_manual_speed = next.fertilizer_manual_speed;
    config.npk_min_threshold =
      next.nitrogen_min_threshold +
      next.phosphorus_min_threshold +
      next.potassium_min_threshold;
    config.npk_max_threshold =
      next.nitrogen_max_threshold +
      next.phosphorus_max_threshold +
      next.potassium_max_threshold;
    config.auto_parameter =
      dto.auto_parameter ?? next.auto_parameter ?? 'soil_moisture';
    config.auto_threshold_direction =
      dto.auto_threshold_direction ?? next.auto_threshold_direction ?? 'below';
    config.auto_threshold_value =
      dto.auto_threshold_value ??
      next.auto_threshold_value ??
      config.water_min_threshold;

    const saved = await this.configRepository.save(config);

    await this.logConfigChanges(userId, before, saved, dto);
    await this.cache?.invalidate([`irrigation:config:${userId}`]);
    return saved;
  }

  async getSchedules(userId: string): Promise<IrrigationSchedule[]> {
    return this.scheduleRepository.find({
      where: { user_id: userId },
      order: { start_time: 'ASC', created_at: 'ASC' },
    });
  }

  async createSchedule(
    userId: string,
    dto: CreateIrrigationScheduleDto,
  ): Promise<IrrigationSchedule> {
    this.assertScheduleTime(dto.start_time, dto.end_time);
    this.assertAtLeastOneDay(dto);

    const schedule = this.scheduleRepository.create({
      ...dto,
      name: dto.name.trim(),
      active: dto.active ?? true,
      user_id: userId,
    });

    const saved = await this.scheduleRepository.save(schedule);
    await this.cache?.invalidate([`irrigation:schedules:${userId}`]);
    await this.logActivity(
      userId,
      `Jadwal irigasi "${saved.name}" ditambahkan untuk pukul ${saved.start_time}-${saved.end_time}.`,
      'info',
    );

    return saved;
  }

  async updateSchedule(
    userId: string,
    id: string,
    dto: UpdateIrrigationScheduleDto,
  ): Promise<IrrigationSchedule> {
    const schedule = await this.findSchedule(userId, id);
    const nextStart = dto.start_time ?? schedule.start_time;
    const nextEnd = dto.end_time ?? schedule.end_time;

    this.assertScheduleTime(nextStart, nextEnd);
    if (this.hasDayUpdate(dto)) {
      this.assertAtLeastOneDay({ ...schedule, ...dto });
    }

    Object.assign(schedule, dto);
    if (dto.name !== undefined) {
      schedule.name = dto.name.trim();
    }

    const saved = await this.scheduleRepository.save(schedule);
    await this.cache?.invalidate([`irrigation:schedules:${userId}`]);
    await this.logActivity(
      userId,
      `Jadwal irigasi "${saved.name}" diperbarui.`,
      'info',
    );

    return saved;
  }

  async deleteSchedule(
    userId: string,
    id: string,
  ): Promise<{ message: string }> {
    const schedule = await this.findSchedule(userId, id);
    await this.scheduleRepository.remove(schedule);
    await this.cache?.invalidate([`irrigation:schedules:${userId}`]);
    await this.logActivity(
      userId,
      `Jadwal irigasi "${schedule.name}" dihapus.`,
      'warning',
    );

    return { message: 'Jadwal irigasi berhasil dihapus' };
  }

  async getActivityLogs(
    userId: string,
    query: IrrigationActivityQueryDto,
  ): Promise<PaginatedResponse<IrrigationActivityLog>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [data, total] = await this.activityRepository.findAndCount({
      where: { user_id: userId },
      order: { executed_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data,
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async logActivity(
    userId: string,
    description: string,
    type: ActivityType,
  ): Promise<IrrigationActivityLog> {
    const log = this.activityRepository.create({
      user_id: userId,
      description,
      type,
    });

    const saved = await this.activityRepository.save(log);
    await this.cache?.invalidate([`irrigation:activity:${userId}:*`]);
    return saved;
  }

  private async findSchedule(
    userId: string,
    id: string,
  ): Promise<IrrigationSchedule> {
    const schedule = await this.scheduleRepository.findOne({
      where: { id, user_id: userId },
    });

    if (!schedule) {
      throw new NotFoundException('Jadwal irigasi tidak ditemukan');
    }

    return schedule;
  }

  private async logConfigChanges(
    userId: string,
    before: IrrigationConfig,
    after: IrrigationConfig,
    dto: UpdateIrrigationConfigDto,
  ): Promise<void> {
    if (
      dto.active_mode !== undefined &&
      before.active_mode !== after.active_mode
    ) {
      await this.logActivity(
        userId,
        `Mode irigasi diubah menjadi ${after.active_mode}.`,
        'info',
      );
    }

    if (
      dto.emergency_stop !== undefined &&
      before.emergency_stop !== after.emergency_stop
    ) {
      await this.logActivity(
        userId,
        after.emergency_stop
          ? 'Emergency stop diaktifkan. Pompa diminta berhenti segera.'
          : 'Emergency stop dinonaktifkan. Sistem irigasi dapat berjalan kembali.',
        after.emergency_stop ? 'warning' : 'success',
      );
    }

    if (
      dto.manual_speed !== undefined &&
      before.manual_speed !== after.manual_speed
    ) {
      await this.logActivity(
        userId,
        `Kecepatan manual irigasi diubah menjadi ${after.manual_speed}%.`,
        'info',
      );
    }

    const thresholdRangeKeys: Array<keyof UpdateIrrigationConfigDto> = [
      'water_min_threshold',
      'water_max_threshold',
      'nitrogen_min_threshold',
      'nitrogen_max_threshold',
      'phosphorus_min_threshold',
      'phosphorus_max_threshold',
      'potassium_min_threshold',
      'potassium_max_threshold',
    ];
    const rangeChanged = thresholdRangeKeys.some(
      (key) => dto[key] !== undefined && before[key] !== after[key],
    );

    if (rangeChanged) {
      await this.logActivity(
        userId,
        `Rentang otomatis diperbarui: air ${after.water_min_threshold}-${after.water_max_threshold}%, N ${after.nitrogen_min_threshold}-${after.nitrogen_max_threshold}, P ${after.phosphorus_min_threshold}-${after.phosphorus_max_threshold}, K ${after.potassium_min_threshold}-${after.potassium_max_threshold} mg/kg.`,
        'info',
      );
    }

    const manualPumpKeys: Array<keyof UpdateIrrigationConfigDto> = [
      'manual_water_enabled',
      'manual_fertilizer_enabled',
      'fertilizer_manual_speed',
    ];
    const manualPumpChanged = manualPumpKeys.some(
      (key) => dto[key] !== undefined && before[key] !== after[key],
    );

    if (manualPumpChanged) {
      await this.logActivity(
        userId,
        `Konfigurasi manual diperbarui: pompa air ${after.manual_water_enabled ? 'aktif' : 'nonaktif'}, pompa pupuk ${after.manual_fertilizer_enabled ? 'aktif' : 'nonaktif'}.`,
        'info',
      );
    }
  }

  private assertThresholdRanges(
    config: Pick<
      IrrigationConfig,
      | 'water_min_threshold'
      | 'water_max_threshold'
      | 'nitrogen_min_threshold'
      | 'nitrogen_max_threshold'
      | 'phosphorus_min_threshold'
      | 'phosphorus_max_threshold'
      | 'potassium_min_threshold'
      | 'potassium_max_threshold'
    >,
  ): void {
    if (
      Number(config.water_min_threshold) >= Number(config.water_max_threshold)
    ) {
      throw new BadRequestException(
        'Rentang kelembaban tanah tidak valid: batas bawah harus lebih kecil dari batas atas',
      );
    }

    this.assertRange(
      config.nitrogen_min_threshold,
      config.nitrogen_max_threshold,
      'nitrogen',
    );
    this.assertRange(
      config.phosphorus_min_threshold,
      config.phosphorus_max_threshold,
      'fosfor',
    );
    this.assertRange(
      config.potassium_min_threshold,
      config.potassium_max_threshold,
      'kalium',
    );
  }

  private assertRange(min: number, max: number, label: string): void {
    if (Number(min) >= Number(max)) {
      throw new BadRequestException(
        `Rentang ${label} tanah tidak valid: batas bawah harus lebih kecil dari batas atas`,
      );
    }
  }

  private assertManualPumpExclusivity(
    config: Pick<
      IrrigationConfig,
      'manual_water_enabled' | 'manual_fertilizer_enabled'
    >,
  ): void {
    if (config.manual_water_enabled && config.manual_fertilizer_enabled) {
      throw new BadRequestException(
        'Pompa air dan pompa pupuk manual tidak bisa aktif bersamaan',
      );
    }
  }

  private assertScheduleTime(startTime: string, endTime: string): void {
    if (startTime >= endTime) {
      throw new BadRequestException(
        'Waktu mulai harus lebih awal dari waktu selesai',
      );
    }
  }

  private assertAtLeastOneDay(
    dto: Pick<
      CreateIrrigationScheduleDto,
      'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
    >,
  ): void {
    if (
      !dto.mon &&
      !dto.tue &&
      !dto.wed &&
      !dto.thu &&
      !dto.fri &&
      !dto.sat &&
      !dto.sun
    ) {
      throw new BadRequestException('Pilih minimal satu hari untuk jadwal');
    }
  }

  private hasDayUpdate(dto: UpdateIrrigationScheduleDto): boolean {
    return ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].some(
      (key) => dto[key as keyof UpdateIrrigationScheduleDto] !== undefined,
    );
  }
}
