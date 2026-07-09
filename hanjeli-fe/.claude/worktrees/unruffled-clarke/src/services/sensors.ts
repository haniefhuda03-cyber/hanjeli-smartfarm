import { sensorFixtures, type SensorReading } from "@/lib/mock/sensor-fixtures";

const SIMULATED_LATENCY_MS = 900;

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export async function fetchSensorReadings(): Promise<SensorReading[]> {
  await delay(SIMULATED_LATENCY_MS);
  return sensorFixtures;
}

export async function fetchSensorReadingsEmpty(): Promise<SensorReading[]> {
  await delay(SIMULATED_LATENCY_MS);
  return [];
}

export async function fetchSensorReadingsFailing(): Promise<SensorReading[]> {
  await delay(SIMULATED_LATENCY_MS);
  throw new Error("Sensor gateway is unreachable");
}

export type { SensorReading };
