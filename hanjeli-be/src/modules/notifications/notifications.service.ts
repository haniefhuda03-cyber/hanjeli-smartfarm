import {
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  NotificationCategory,
  NotificationType,
} from '../../common/constants/domain.constants.js';
import {
  buildPaginationMeta,
  PaginatedResponse,
} from '../../common/dto/pagination.dto.js';
import { Notification } from '../../entities/notification.entity.js';
import { SensorGateway } from '../websocket/sensor.gateway.js';
import { QueryNotificationsDto } from './dto/query-notifications.dto.js';

export interface CreateNotificationInput {
  title: string;
  description?: string | null;
  type: NotificationType;
  category: NotificationCategory;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationsRepository: Repository<Notification>,
    @Inject(forwardRef(() => SensorGateway))
    private readonly sensorGateway: SensorGateway,
  ) {}

  /**
   * Simpan notifikasi baru lalu push realtime lewat event `notification:new`
   * — shape payload harus sama dengan `BackendNotification` yang dibaca
   * frontend (notification-context).
   */
  async createAndBroadcast(
    userId: string,
    input: CreateNotificationInput,
  ): Promise<Notification> {
    const notification = await this.notificationsRepository.save(
      this.notificationsRepository.create({
        user_id: userId,
        title: input.title,
        description: input.description ?? null,
        type: input.type,
        category: input.category,
        read: false,
      }),
    );

    this.sensorGateway.broadcastNotification(userId, {
      id: notification.id,
      title: notification.title,
      description: notification.description,
      type: notification.type,
      category: notification.category,
      read: notification.read,
      created_at: notification.created_at.toISOString(),
    });

    return notification;
  }

  async findAll(
    userId: string,
    query: QueryNotificationsDto,
  ): Promise<PaginatedResponse<Notification>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const builder = this.notificationsRepository
      .createQueryBuilder('notification')
      .where('notification.user_id = :userId', { userId })
      .orderBy('notification.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.read !== undefined) {
      builder.andWhere('notification.read = :read', {
        read: query.read === 'true',
      });
    }

    const [data, total] = await builder.getManyAndCount();

    return {
      data,
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async markAsRead(userId: string, id: string): Promise<Notification> {
    const notification = await this.findOwnedNotification(userId, id);
    notification.read = true;
    return this.notificationsRepository.save(notification);
  }

  async markAllAsRead(
    userId: string,
  ): Promise<{ message: string; updated: number }> {
    const result = await this.notificationsRepository.update(
      { user_id: userId, read: false },
      { read: true },
    );

    return {
      message: 'Semua notifikasi berhasil ditandai sudah dibaca',
      updated: result.affected ?? 0,
    };
  }

  async remove(userId: string, id: string): Promise<{ message: string }> {
    const notification = await this.findOwnedNotification(userId, id);
    await this.notificationsRepository.remove(notification);

    return { message: 'Notifikasi berhasil dihapus' };
  }

  async removeAll(
    userId: string,
  ): Promise<{ message: string; deleted: number }> {
    const result = await this.notificationsRepository.delete({
      user_id: userId,
    });

    return {
      message: 'Semua notifikasi berhasil dihapus',
      deleted: result.affected ?? 0,
    };
  }

  private async findOwnedNotification(
    userId: string,
    id: string,
  ): Promise<Notification> {
    const notification = await this.notificationsRepository.findOne({
      where: { id, user_id: userId },
    });

    if (!notification) {
      throw new NotFoundException('Notifikasi tidak ditemukan');
    }

    return notification;
  }
}
