export type SensorReading = {
  id: string;
  zone: string;
  temperatureC: number;
  humidityPct: number;
  soilMoisturePct: number;
  lightLux: number;
  capturedAt: string;
};

export const sensorFixtures: SensorReading[] = [
  {
    id: "zn-01",
    zone: "Greenhouse A",
    temperatureC: 28.4,
    humidityPct: 72,
    soilMoisturePct: 41,
    lightLux: 18420,
    capturedAt: "2026-04-15T07:12:00+07:00",
  },
  {
    id: "zn-02",
    zone: "Greenhouse B",
    temperatureC: 33.7,
    humidityPct: 58,
    soilMoisturePct: 22,
    lightLux: 22310,
    capturedAt: "2026-04-15T07:12:00+07:00",
  },
  {
    id: "zn-03",
    zone: "Outdoor Plot",
    temperatureC: 30.1,
    humidityPct: 65,
    soilMoisturePct: 35,
    lightLux: 41200,
    capturedAt: "2026-04-15T07:12:00+07:00",
  },
];
