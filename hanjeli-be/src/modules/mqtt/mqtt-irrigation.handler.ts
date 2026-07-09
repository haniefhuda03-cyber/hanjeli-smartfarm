import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  Optional,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppCacheService } from '../../common/cache/app-cache.service.js';
import { Device } from '../../entities/device.entity.js';
import { IrrigationActivityLog } from '../../entities/irrigation-activity-log.entity.js';
import { IrrigationGateway } from '../websocket/irrigation.gateway.js';
import { MqttService } from './mqtt.service.js';

@Injectable()
export class MqttIrrigationHandler implements OnModuleInit {
  private readonly logger = new Logger(MqttIrrigationHandler.name);

  constructor(
    private readonly mqttService: MqttService,
    @InjectRepository(Device)
    private readonly deviceRepository: Repository<Device>,
    @InjectRepository(IrrigationActivityLog)
    private readonly activityRepository: Repository<IrrigationActivityLog>,
    @Inject(forwardRef(() => IrrigationGateway))
    private readonly irrigationGateway: IrrigationGateway,
    @Optional()
    private readonly cache?: AppCacheService,
  ) {}

  onModuleInit(): void {
    const topics = this.mqttService.getTopicConfig();
    this.mqttService.registerHandler(
      topics.irrigationAck,
      this.handleIrrigationAck.bind(this),
    );
    this.mqttService.registerHandler(
      topics.legacyIrrigationAck,
      this.handleIrrigationAck.bind(this),
    );
  }

  async handleIrrigationAck(
    topic: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const deviceCode = this.extractDeviceCode(topic, payload);
    if (!deviceCode) {
      this.logger.warn(`Irrigation ACK without device code ignored: ${topic}`);
      return;
    }

    const device = await this.deviceRepository.findOne({
      where: { code: deviceCode },
    });
    if (!device) {
      this.logger.warn(`ACK for unknown device code ignored: ${deviceCode}`);
      return;
    }

    const requestId =
      typeof payload.request_id === 'string' ? payload.request_id : undefined;
    const matched = this.mqttService.resolveIrrigationAck(requestId);
    const action = String(payload.action ?? 'UNKNOWN').toUpperCase();
    const success =
      payload.status === 'success' ||
      payload.status === 'ok' ||
      payload.success === true;
    const description = matched
      ? `ESP32 ${deviceCode} mengonfirmasi perintah irigasi ${action}: ${success ? 'berhasil' : 'gagal'}.`
      : `ESP32 ${deviceCode} mengirim ACK irigasi ${action} tanpa request aktif.`;

    const log = this.activityRepository.create({
      user_id: device.user_id,
      description,
      type: success ? 'success' : 'warning',
    });
    await this.activityRepository.save(log);
    await this.cache?.invalidate([`irrigation:activity:${device.user_id}:*`]);

    this.irrigationGateway.broadcastIrrigationAck(device.user_id, device.code, {
      ...payload,
      matched_request: matched,
    });
  }

  private extractDeviceCode(
    topic: string,
    payload: Record<string, unknown>,
  ): string | null {
    const parts = topic.split('/');
    const legacyCode = parts[1] !== 'irrigation' ? parts[1] : undefined;
    const value = String(
      payload.code ?? payload.device_code ?? legacyCode ?? '',
    );
    const code = value.trim().replace(/^#/, '').toUpperCase();
    return code || null;
  }
}
