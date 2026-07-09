# Batch 5 - Completion Report

> Irrigation & Real-time | Status: COMPLETE
> Executed: 2026-06-09

## Summary

Batch 5 completes the irrigation, MQTT, and WebSocket realtime backend layer:

- Irrigation REST module supports config, schedule CRUD, and activity pagination.
- Irrigation engine evaluates incoming sensor telemetry against auto-mode thresholds and sends pump commands.
- MQTT core uses the `mqtt` npm package with manual exponential reconnect and single listener registration.
- MQTT sensor handler parses ESP32 telemetry, saves TimescaleDB telemetry rows, updates device status, broadcasts realtime data, and calls the irrigation engine.
- MQTT irrigation ACK handler resolves pending command timeouts, logs ACK activity, and broadcasts ACK events.
- WebSocket gateways now use namespace `/ws` with JWT authentication during handshake.
- Irrigation WebSocket events no longer trust `userId` from client payload; user identity comes from the verified access token.
- Commands include `request_id` and trigger warning logs when ESP32 ACK is not received within 10 seconds.

## Implemented Files

| Area | Files |
|------|-------|
| MQTT config | `hanjeli-be/src/config/mqtt.config.ts` |
| Irrigation module | `irrigation.module.ts`, `irrigation.controller.ts`, `irrigation.service.ts`, `irrigation.engine.ts`, `dto/irrigation.dto.ts` |
| MQTT module | `mqtt.module.ts`, `mqtt.service.ts`, `mqtt-sensor.handler.ts`, `mqtt-irrigation.handler.ts` |
| WebSocket module | `websocket.module.ts`, `websocket-auth.service.ts`, `sensor.gateway.ts`, `irrigation.gateway.ts` |
| Auth/export wiring | `hanjeli-be/src/modules/auth/auth.module.ts` |
| Config | `hanjeli-be/.env.example` |
| Tests | Irrigation service/engine specs, MQTT service/handler specs, irrigation gateway spec, updated root e2e mocks |

## REST API Surface

All endpoints are under `/api/v3` and require JWT:

- `GET /irrigation/config`
- `PUT /irrigation/config`
- `GET /irrigation/schedules`
- `POST /irrigation/schedules`
- `PUT /irrigation/schedules/:id`
- `DELETE /irrigation/schedules/:id`
- `GET /irrigation/activity?page=&limit=`

## MQTT Contract

Canonical topics follow the implementation plan:

- `hanjeli/sensor/{device_code}` for ESP32 sensor telemetry.
- `hanjeli/device/{device_code}/status` for device heartbeat.
- `hanjeli/irrigation/command` for backend-to-ESP32 pump commands.
- `hanjeli/irrigation/ack` for ESP32 command acknowledgements.

Compatibility handlers also accept:

- `hanjeli/{device_code}/sensor`
- `hanjeli/{device_code}/irrigation/ack`

Irrigation command payload includes:

- `action`: `START`, `STOP`, `EMERGENCY_STOP`, or `RESUME`
- `mode`: `auto`, `manual`, `scheduled`, or `off`
- `speed`
- `device_code` when available
- `user_id`
- `ts`
- `request_id`

## WebSocket Contract

Namespace: `/ws`

Server to client:

- `sensor:realtime`
- `device:status`
- `notification:new`
- `irrigation:status`
- `irrigation:emergency`
- `irrigation:ack`

Client to server:

- `irrigation:setMode`
- `irrigation:emergencyStop`
- `irrigation:resume`
- `irrigation:manualToggle`

WebSocket clients authenticate through handshake token:

- `handshake.auth.token`
- `?token=`
- `Authorization: Bearer <token>`

## Safety And Data Notes

- MQTT malformed JSON is logged and ignored; it cannot crash the server.
- MQTT reconnect uses a guarded timer, so reconnects do not spawn duplicate listeners.
- Registered handlers are keyed by topic pattern and resubscribed after reconnect.
- Emergency stop is idempotent at the config log layer and publishes an immediate `EMERGENCY_STOP` command.
- Auto-mode maps irrigation parameter `ph` to telemetry column `ph_level`.
- Schedule CRUD enforces `start_time < end_time` and at least one active day.
- Activity logs use the shared pagination meta shape.
- WebSocket broadcasts are scoped to `user:{userId}` rooms.
- `MQTT_ENABLED=false` by default in `.env.example` to avoid accidental broker connections during local tests.

## QA Coverage

| Requirement | Coverage |
|-------------|----------|
| Schedule CRUD validation | Unit tests reject no-day schedules and validate pagination |
| Auto threshold triggers irrigation | Unit test checks low soil moisture publishes `START` command |
| Emergency stop command | Unit tests check engine and WS publish `EMERGENCY_STOP` |
| MQTT sensor to realtime flow | Unit test checks telemetry save, engine call, and `sensor:realtime` broadcast |
| MQTT ACK timeout | Unit test checks timeout callback fires when no ACK arrives |
| MQTT ACK resolve | Unit test checks resolved ACK clears timeout |
| Malformed MQTT JSON safety | Unit test confirms handlers are not called |
| WS authenticated user source | Gateway tests use socket-authenticated user, not body `userId` |

## Verification

| Command | Result |
|---------|--------|
| `npm run test` | PASS - 16 suites, 41 tests |
| `npm run build` | PASS |
| `npm run test:e2e` | PASS - 1 suite, 1 test |
| `npm audit --omit=dev` | PASS - 0 vulnerabilities |

## Operational Notes

- Configure a real broker before IoT runtime use: set `MQTT_ENABLED=true` and `MQTT_BROKER_URL`.
- Root e2e smoke test mocks Auth, TypeORM, and Batch 5 realtime modules because it only validates the root HTTP check without a DB/MQTT broker.
- Real ESP32 devices should subscribe to `hanjeli/irrigation/command`, filter by `device_code` if needed, and publish ACK to `hanjeli/irrigation/ack` with the same `request_id`.
- Socket.IO clients should connect to `/ws` and enable their normal client-side reconnect behavior.
