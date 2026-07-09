import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Device } from '../../entities/device.entity.js';
import { CreateDeviceDto } from './dto/create-device.dto.js';
import { UpdateDeviceDto } from './dto/update-device.dto.js';

@Injectable()
export class DevicesService {
  constructor(
    @InjectRepository(Device)
    private readonly devicesRepository: Repository<Device>,
  ) {}

  async create(userId: string, dto: CreateDeviceDto): Promise<Device> {
    const code = this.normalizeCode(dto.code);
    await this.assertCodeAvailable(code);

    const device = this.devicesRepository.create({
      user_id: userId,
      name: dto.name.trim(),
      code,
      type: dto.type,
      status: dto.status ?? 'offline',
      warning_message: dto.warning_message ?? null,
      last_seen_at: dto.status === 'online' ? new Date() : null,
    });

    return this.devicesRepository.save(device);
  }

  async findAll(userId: string): Promise<Device[]> {
    return this.devicesRepository.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });
  }

  async findOne(userId: string, id: string): Promise<Device> {
    const device = await this.devicesRepository.findOne({
      where: { id, user_id: userId },
    });

    if (!device) {
      throw new NotFoundException('Device tidak ditemukan');
    }

    return device;
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateDeviceDto,
  ): Promise<Device> {
    const device = await this.findOne(userId, id);

    if (dto.code !== undefined) {
      const code = this.normalizeCode(dto.code);
      if (code !== device.code) {
        await this.assertCodeAvailable(code);
        device.code = code;
      }
    }

    if (dto.name !== undefined) device.name = dto.name.trim();
    if (dto.type !== undefined) device.type = dto.type;
    if (dto.status !== undefined) {
      device.status = dto.status;
      if (dto.status === 'online') {
        device.last_seen_at = new Date();
      }
    }
    if (dto.warning_message !== undefined) {
      device.warning_message = dto.warning_message;
    }

    return this.devicesRepository.save(device);
  }

  async remove(userId: string, id: string): Promise<{ message: string }> {
    const device = await this.findOne(userId, id);

    /* Hard delete — FK CASCADE ikut menghapus seluruh riwayat telemetry. */
    await this.devicesRepository.remove(device);

    return { message: 'Device berhasil dihapus' };
  }

  private async assertCodeAvailable(code: string): Promise<void> {
    const existing = await this.devicesRepository.findOne({
      where: { code },
    });

    if (existing) {
      throw new ConflictException('Kode device sudah digunakan');
    }
  }

  private normalizeCode(code: string): string {
    return code.trim().replace(/^#/, '').toUpperCase();
  }
}
