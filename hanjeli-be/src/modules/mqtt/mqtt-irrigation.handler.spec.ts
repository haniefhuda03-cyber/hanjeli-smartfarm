jest.mock('../websocket/websocket-auth.service.js', () => ({
  WebsocketAuthService: class MockWebsocketAuthService {},
}));

import { MqttIrrigationHandler } from './mqtt-irrigation.handler.js';

describe('MqttIrrigationHandler', () => {
  it('resolves irrigation ACK, logs activity, and broadcasts to user room', async () => {
    const mqttService = {
      getTopicConfig: jest.fn(() => ({
        irrigationAck: 'hanjeli/irrigation/ack',
        legacyIrrigationAck: 'hanjeli/+/irrigation/ack',
      })),
      registerHandler: jest.fn(),
      resolveIrrigationAck: jest.fn(() => true),
    };
    const deviceRepository = {
      findOne: jest.fn(async () => ({
        id: 'device-1',
        user_id: 'user-1',
        code: 'WS004',
      })),
    };
    const activityRepository = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
    };
    const irrigationGateway = {
      broadcastIrrigationAck: jest.fn(),
    };
    const handler = new MqttIrrigationHandler(
      mqttService as never,
      deviceRepository as never,
      activityRepository as never,
      irrigationGateway as never,
    );

    await handler.handleIrrigationAck('hanjeli/irrigation/ack', {
      code: '#WS004',
      action: 'START',
      status: 'success',
      request_id: 'request-1',
    });

    expect(mqttService.resolveIrrigationAck).toHaveBeenCalledWith('request-1');
    expect(activityRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        type: 'success',
      }),
    );
    expect(irrigationGateway.broadcastIrrigationAck).toHaveBeenCalledWith(
      'user-1',
      'WS004',
      expect.objectContaining({
        matched_request: true,
        request_id: 'request-1',
      }),
    );
  });
});
