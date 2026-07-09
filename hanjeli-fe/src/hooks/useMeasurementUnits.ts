"use client"

import { useCallback, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { preferencesApi } from "@/lib/api/preferences"
import { queryKeys } from "@/lib/api/query-keys"
import {
  CANONICAL_UNITS,
  UNIT_OPTIONS,
  convertSensorValue,
  convertToBaseUnit,
  formatSensorValue,
  type MeasurableParam,
} from "@/lib/units"

interface BackendUnitRow {
  parameter_key: string
  unit_value: string
}

/**
 * Unit pengukuran pilihan user dari GET /preferences, dengan fallback
 * kanonik. Menyediakan helper konversi + format untuk semua tampilan
 * nilai sensor.
 */
export function useMeasurementUnits() {
  const { data } = useQuery({
    queryKey: queryKeys.preferences.all,
    queryFn: preferencesApi.getPreferences,
    staleTime: 60_000,
  })

  const units = useMemo(() => {
    const map: Record<MeasurableParam, string> = { ...CANONICAL_UNITS }
    const rows = (data as { units?: BackendUnitRow[] } | undefined)?.units

    if (Array.isArray(rows)) {
      for (const row of rows) {
        const param = row.parameter_key as MeasurableParam
        if (param in map && UNIT_OPTIONS[param]?.includes(row.unit_value)) {
          map[param] = row.unit_value
        }
      }
    }

    return map
  }, [data])

  const getUnit = useCallback(
    (param: MeasurableParam) => units[param],
    [units],
  )

  const convertValue = useCallback(
    (param: MeasurableParam, value: number) =>
      convertSensorValue(value, param, units[param]),
    [units],
  )

  const formatValue = useCallback(
    (param: MeasurableParam, value: number | null | undefined, digits = 1) =>
      formatSensorValue(value, param, units[param], digits),
    [units],
  )

  /** Konversi balik dari unit tampilan user ke unit kanonik (base unit) */
  const convertToBase = useCallback(
    (param: MeasurableParam, displayValue: number) =>
      convertToBaseUnit(displayValue, param, units[param]),
    [units],
  )

  return { units, getUnit, convertValue, convertToBase, formatValue }
}
