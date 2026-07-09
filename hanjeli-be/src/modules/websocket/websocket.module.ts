import { Module, forwardRef } from '@nestjs/common';
import { SensorGateway } from './sensor.gateway.js';
import { IrrigationGateway } from './irrigation.gateway.js';
import { MqttModule } from '../mqtt/mqtt.module.js';
import { IrrigationModule } from '../irrigation/irrigation.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { WebsocketAuthService } from './websocket-auth.service.js';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    forwardRef(() => MqttModule),
    forwardRef(() => IrrigationModule),
  ],
  providers: [WebsocketAuthService, SensorGateway, IrrigationGateway],
  exports: [SensorGateway, IrrigationGateway],
})
export class WebsocketModule {}
