/**
 * Konversi unit pengukuran sensor.
 *
 * Nilai kanonik dari backend selalu: suhu °C, kelembapan %, pH, NPK mg/kg.
 * Konversi tampilan dilakukan di frontend berdasarkan preferensi user
 * (GET /preferences → units).
 */

export type MeasurableParam =
  | "soil_temperature"
  | "soil_moisture"
  | "ph"
  | "soil_npk"

export const CANONICAL_UNITS: Record<MeasurableParam, string> = {
  soil_temperature: "°C",
  soil_moisture: "%",
  ph: "pH",
  soil_npk: "mg/kg",
}

/** Hanya unit yang benar-benar bisa dikonversi dari nilai kanonik.
 *  'soil_npk' = grup unit bersama untuk ketiga nilai N, P, K. */
export const UNIT_OPTIONS: Record<MeasurableParam, readonly string[]> = {
  soil_temperature: ["°C", "°F"],
  soil_moisture: ["%"],
  ph: ["pH"],
  soil_npk: ["mg/kg", "ppm"],
}

/** Konversi nilai kanonik ke unit target. mg/kg ↔ ppm identik (1:1). */
export function convertSensorValue(
  value: number,
  param: MeasurableParam,
  targetUnit: string,
): number {
  if (param === "soil_temperature" && targetUnit === "°F") {
    return (value * 9) / 5 + 32
  }
  return value
}

/**
 * Konversi BALIK dari unit tampilan ke unit kanonik (base unit).
 * Kebalikan dari `convertSensorValue`:
 *   °F → °C:  (value − 32) × 5 / 9
 *   ppm → mg/kg: identik (1:1)
 */
export function convertToBaseUnit(
  value: number,
  param: MeasurableParam,
  displayUnit: string,
): number {
  if (param === "soil_temperature" && displayUnit === "°F") {
    return ((value - 32) * 5) / 9
  }
  return value
}

/** Format nilai + konversi; null/undefined menjadi "—". */
export function formatSensorValue(
  value: number | null | undefined,
  param: MeasurableParam,
  targetUnit: string,
  fractionDigits = 1,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—"
  }

  const converted = convertSensorValue(value, param, targetUnit)
  const rounded =
    Math.round(converted * 10 ** fractionDigits) / 10 ** fractionDigits
  return `${rounded}`
}
