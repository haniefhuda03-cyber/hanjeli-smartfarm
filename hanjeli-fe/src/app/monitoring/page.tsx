"use client"

import { useState, useEffect, type CSSProperties } from "react"
import { useTranslation } from "react-i18next"
import {
  Thermometer,
  Droplets,
  Sun,
  Leaf,
  Gauge,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  Minus,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Activity,
  TrendingUp,
  TrendingDown,
  MoveRight,
  Download,
  LineChart,
  FlaskConical,
  Droplet,
  Flower2,
  Sprout,
  CloudRain,
  CloudSun,
  History,
} from "lucide-react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
  ReferenceLine,
} from "recharts"
import { cn } from "@/lib/utils"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/api/query-keys"
import { sensorsApi } from "@/lib/api/sensors"
import { useSensorSocket } from "@/hooks/useSensorSocket"
import { useMeasurementUnits } from "@/hooks/useMeasurementUnits"
import type { MeasurableParam } from "@/lib/units"
import { LoadingState } from "@/components/ui-states/loading-state"
import { EmptyState } from "@/components/ui-states/empty-state"
import { buildApiUrl } from "@/lib/runtime-config"
import { getAccessToken } from "@/lib/auth-session"


// Sensor cards overview initial template — empty-state sebelum data asli tiba
// Warna logo & aksen hover SEMUA kartu = hijau primary (#006c49), sama seperti
// kartu Soil pH — konsistensi visual antar sensor (lihat request desain).
const baseSensorOverview = [
  { id: 1, nameKey: "home.sensor_ph", key: "ph" as MeasurableParam, value: null as number | null, icon: FlaskConical, statusText: "", trend: "none", chartType: "progress", progressValue: 0, color: "linear-gradient(90deg, #f9bd22 0%, #10b981 100%)", iconColor: "#006c49", statusColor: "#006c49" },
  { id: 2, nameKey: "home.sensor_moist", key: "soil_moisture" as MeasurableParam, value: null as number | null, icon: Droplet, statusText: "", trend: "none", chartType: "progress", progressValue: 0, color: "#10b981", iconColor: "#006c49", statusColor: "#006c49" },
  { id: 3, nameKey: "home.sensor_npk", key: "soil_npk" as MeasurableParam, value: null as number | null, icon: Leaf, statusText: "", trend: "none", chartType: "npk-bars", npkValues: { n: 0, p: 0, k: 0 }, iconColor: "#006c49" },
  { id: 4, nameKey: "home.sensor_temp", key: "soil_temperature" as MeasurableParam, value: null as number | null, icon: Thermometer, statusText: "", trend: "none", chartType: "progress", progressValue: 0, color: "#ba1a1a", iconColor: "#006c49", statusColor: "#006c49" },
]

// Parameter options for dropdown — N, P, K adalah parameter TERPISAH
const parameterOptions = [
  { id: "ph", nameKey: "home.sensor_ph", icon: FlaskConical },
  { id: "soil_moisture", nameKey: "home.sensor_moist", icon: Droplet },
  { id: "soil_nitrogen", nameKey: "home.sensor_n", icon: Leaf },
  { id: "soil_phosphorus", nameKey: "home.sensor_p", icon: Sprout },
  { id: "soil_potassium", nameKey: "home.sensor_k", icon: Flower2 },
  { id: "soil_temperature", nameKey: "home.sensor_temp", icon: Thermometer },
]

/** Grup unit preferensi untuk tiap parameter query (N/P/K memakai grup 'soil_npk') */
const unitParamOf = (param: string): MeasurableParam => {
  if (param === "ph") return "ph"
  if (param === "soil_moisture") return "soil_moisture"
  if (param === "soil_temperature") return "soil_temperature"
  return "soil_npk"
}

/**
 * Meta status pembacaan — kode status berasal dari backend (getHistory),
 * label & warna dilokalkan di sini via i18n agar FE/BE selalu sinkron.
 */
const statusMeta: Record<string, { labelKey: string; pill: string }> = {
  optimal: { labelKey: "monitoring.statusSafe", pill: "bg-green-100 text-green-700" },
  warning: { labelKey: "monitoring.statusWarning", pill: "bg-amber-100 text-amber-700" },
  danger: { labelKey: "monitoring.statusDanger", pill: "bg-red-100 text-red-700" },
  no_data: { labelKey: "monitoring.statusNoData", pill: "bg-slate-100 text-slate-500" },
}

const xAxisInterval: Record<string, number> = { day: 3, week: 0, month: 4 }

const timeRangeKeys: Record<string, string> = {
  day: "monitoring.day",
  week: "monitoring.week",
  month: "monitoring.month",
}

export default function MonitoringPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [selectedParameter, setSelectedParameter] = useState("ph")
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [filterDateFrom, setFilterDateFrom] = useState("")
  const [filterDateTo, setFilterDateTo] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [timeRange, setTimeRange] = useState("day")
  const [lockedPoint, setLockedPoint] = useState<{ payload: any; label: string; coord: { x: number, y: number } } | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState("")

  // Fetch APIs
  const { data: trendData, isLoading: trendLoading } = useQuery({
    queryKey: queryKeys.sensors.trend(selectedParameter, timeRange),
    queryFn: () => sensorsApi.getTrend(selectedParameter, timeRange)
  })
  
  const { data: statsData } = useQuery({
    queryKey: queryKeys.sensors.stats(selectedParameter, timeRange),
    queryFn: () => sensorsApi.getStats(selectedParameter, timeRange)
  })

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: queryKeys.sensors.history({ page: currentPage, limit: 5, from: filterDateFrom, to: filterDateTo }),
    queryFn: () => sensorsApi.getHistory({ page: currentPage, limit: 5, from: filterDateFrom, to: filterDateTo })
  })

  const { data: overviewData } = useQuery({
    queryKey: queryKeys.sensors.overview,
    queryFn: sensorsApi.getOverview,
    refetchInterval: 60000
  })

  // Real-time
  const { sensorData } = useSensorSocket()

  // Unit pengukuran sesuai preferensi user (konversi tampilan)
  const { getUnit, convertValue, formatValue } = useMeasurementUnits()

  const [sensorOverview, setSensorOverview] = useState(baseSensorOverview)

  // Update chart trend data with real-time websocket values
  useEffect(() => {
    if (sensorData && timeRange === 'day' && trendData) {
      const parameterKeyMap: Record<string, keyof import("@/hooks/useSensorSocket").RealtimeSensorPayload> = {
        'ph': 'ph',
        'soil_moisture': 'soil_moisture',
        'soil_temperature': 'soil_temperature',
        'soil_nitrogen': 'nitrogen',
        'soil_phosphorus': 'phosphorus',
        'soil_potassium': 'potassium',
      };

      const key = parameterKeyMap[selectedParameter];
      if (key && sensorData[key] !== undefined) {
         const date = new Date(sensorData.ts || Date.now());
         const newPoint = { label: date.toISOString(), value: sensorData[key] };
         
         const lastPoint = trendData[trendData.length - 1];
         // Append if the timestamp is newer to create a smooth sliding chart animation
         if (!lastPoint || new Date(lastPoint.label).getTime() < date.getTime()) {
            const updatedTrend = [...trendData, newPoint];
            if (updatedTrend.length > 50) updatedTrend.shift(); // Keep curve length steady
            
            // Optimistically update React Query cache for the trend data
            queryClient.setQueryData(queryKeys.sensors.trend(selectedParameter, timeRange), updatedTrend);
         }
      }
    }
  }, [sensorData, selectedParameter, timeRange, trendData, queryClient]);

  useEffect(() => {
    setSensorOverview(prev => {
      const newSensors = prev.map(sensor => ({ ...sensor }));
      const byKey = (key: MeasurableParam) => newSensors.find(s => s.key === key);

      if (overviewData?.parameters) {
        overviewData.parameters.forEach((param: any) => {
          const card = byKey(
            (param.key === 'npk' ? 'soil_npk' : param.key) as MeasurableParam,
          );
          if (!card) return;

          card.value = param.value ?? null;
          card.statusText = param.status === 'optimal' ? t('monitoring.statusSafe', 'Aman') : param.status === 'warning' ? t('monitoring.statusWarning', 'Perhatian') : t('monitoring.statusDanger', 'Bahaya');
          card.statusColor = param.status === 'optimal' ? '#006c49' : param.status === 'warning' ? '#795900' : '#ba1a1a';
          if (param.key === 'npk') {
            card.npkValues = {
              n: param.nitrogen ?? 0,
              p: param.phosphorus ?? 0,
              k: param.potassium ?? 0,
            };
          }
        });
      }

      if (sensorData) {
        const realtime: Array<[MeasurableParam, number | undefined]> = [
          ['ph', sensorData.ph],
          ['soil_moisture', sensorData.soil_moisture],
          ['soil_temperature', sensorData.soil_temperature],
        ];
        for (const [key, value] of realtime) {
          const card = byKey(key);
          if (card && value !== undefined) card.value = value;
        }
        if (sensorData.nitrogen !== undefined && sensorData.phosphorus !== undefined && sensorData.potassium !== undefined) {
          const card = byKey('soil_npk');
          if (card) card.npkValues = { n: sensorData.nitrogen, p: sensorData.phosphorus, k: sensorData.potassium };
        }
      }

      return newSensors;
    });
  }, [overviewData, sensorData, t]);

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent | TouchEvent) => {
      if (!(e.target as Element).closest('.recharts-wrapper')) {
        setLockedPoint(null)
      }
    }
    document.addEventListener('click', handleGlobalClick)
    document.addEventListener('touchstart', handleGlobalClick)
    return () => {
      document.removeEventListener('click', handleGlobalClick)
      document.removeEventListener('touchstart', handleGlobalClick)
    }
  }, [])

  const selectedParam = parameterOptions.find(p => p.id === selectedParameter)
  const selectedUnitParam = unitParamOf(selectedParameter)
  const displayUnit = selectedUnitParam === 'ph' ? 'pH' : getUnit(selectedUnitParam)
  const summary = {
    max: formatValue(selectedUnitParam, statsData?.max ?? null),
    min: formatValue(selectedUnitParam, statsData?.min ?? null),
    avg: formatValue(selectedUnitParam, statsData?.avg ?? null),
  }
  const totalHistoryPages = historyData?.meta?.total_pages ?? historyData?.meta?.lastPage ?? 1

  const handleExport = async () => {
    setIsExporting(true)
    setExportError("")

    try {
      const token = getAccessToken()
      if (!token) {
        throw new Error(t("auth.sessionExpiredNotice"))
      }

      const params = new URLSearchParams({ format: "csv" })
      if (filterDateFrom) params.set("from", filterDateFrom)
      if (filterDateTo) params.set("to", filterDateTo)

      // Bahasa file (header + label status/kondisi) mengikuti i18n aktif —
      // backend netral-bahasa dan hanya menuliskan label yang dikirim di sini.
      params.set("header", [
        t("monitoring.timestamp"),
        t("monitoring.sentAt"),
        t("home.sensor_ph"),
        t("home.sensor_moist"),
        "N",
        "P",
        "K",
        t("home.sensor_temp"),
        t("monitoring.rainCondition"),
        t("monitoring.status"),
      ].join(","))
      params.set("statusOptimal", t("monitoring.statusSafe"))
      params.set("statusWarning", t("monitoring.statusWarning"))
      params.set("statusDanger", t("monitoring.statusDanger"))
      params.set("statusNoData", t("monitoring.statusNoData"))
      params.set("conditionRain", t("monitoring.rain"))
      params.set("conditionNoRain", t("monitoring.noRain"))

      const response = await fetch(buildApiUrl(`/sensors/export?${params.toString()}`), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error(t("monitoring.exportFailed"))
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = "sensor_history.csv"
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      setExportError(err?.message || t("monitoring.exportFailed"))
    } finally {
      setIsExporting(false)
    }
  }
  
  // Format trend data for Recharts — nilai dikonversi ke unit preferensi user
  const formattedTrendData = trendData?.map((d: any) => {
     const date = new Date(d.label);
     let label = d.label;
     if (timeRange === 'day') label = date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
     else if (timeRange === 'week') label = date.toLocaleDateString([], {weekday: 'short'});
     else label = date.getDate().toString().padStart(2, '0');
     const value = typeof d.value === 'number' ? Math.round(convertValue(selectedUnitParam, d.value) * 100) / 100 : d.value;
     return { label, value };
  }) || [];

  return (
    <div className="relative min-h-screen w-full bg-page">
      {/* Header */}
      <div className="bg-linear-to-b from-surface-sage-soft to-surface-sage px-5 md:px-6 lg:px-8 pt-14 lg:pt-6 pb-4 sticky top-0 z-30 neu-header border-b border-white/50">
        <h1 className="text-xl md:text-2xl font-extrabold bg-linear-to-r from-primary to-foreground bg-clip-text text-transparent font-(family-name:--font-jakarta)">{t('monitoring.title')}</h1>
        <p className="text-sm md:text-base text-foreground/50 font-medium tracking-wide">{t('monitoring.subtitle')}</p>
      </div>

      <div className="px-5 md:px-6 lg:px-8 pt-4 pb-28 lg:pb-8">
        {/* 1. Sensor Cards Overview - Grid */}
        <section className="mb-6" aria-labelledby="sensor-overview-heading">
          <h2 id="sensor-overview-heading" className="text-base md:text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
            <Activity className="h-5 w-5 md:h-6 md:w-6 text-primary" aria-hidden="true" />
            {t('monitoring.sensorOverview')}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5" role="list" aria-label={t('monitoring.sensorOverview')}>
            {sensorOverview.map((sensor) => {
              const cardUnit = sensor.key === 'ph' ? 'pH' : getUnit(sensor.key)
              return (
              <div
                key={sensor.id}
                role="listitem"
                aria-label={`${t(sensor.nameKey)}: ${formatValue(sensor.key, sensor.value)}${cardUnit}${sensor.statusText ? `, ${sensor.statusText}` : ''}`}
                style={{ "--accent": sensor.iconColor } as CSSProperties}
                className={cn(
                  "rounded-2xl p-4 h-[160px] flex flex-col transition-all duration-300 border border-white/70 neu-raised",
                  "group cursor-pointer hover:-translate-y-1.5 neu-raised-hover",
                  sensor.statusColor === '#ba1a1a'
                    ? "bg-red-50/50 hover:bg-red-50 border-red-200/50 shadow-[inset_0_0_20px_rgba(239,68,68,0.05)]"
                    : sensor.statusColor === '#795900'
                      ? "bg-amber-50/50 hover:bg-amber-50 border-amber-200/50 shadow-[inset_0_0_20px_rgba(245,158,11,0.05)]"
                      : "bg-surface-sage hover:bg-surface-leaf"
                )}
              >
                <div className="flex items-start justify-between mb-auto">
                  {/* Logo dgn background hijau (bg-success/20) — seragam dgn kartu Beranda */}
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-success/20 transition-all duration-300 neu-inset neu-icon-raise group-hover:bg-(--accent)">
                    <sensor.icon className="h-6 w-6 transition-colors duration-300 text-(--accent) group-hover:text-white" />
                  </div>
                  {sensor.statusText && (
                    <div className="flex items-center gap-1 mt-1" style={{ color: sensor.statusColor }}>
                      {sensor.trend === "up" && <TrendingUp className="h-3.5 w-3.5" />}
                      {sensor.trend === "down" && <TrendingDown className="h-3.5 w-3.5" />}
                      {sensor.trend === "stable" && <MoveRight className="h-3.5 w-3.5" />}
                      <span className="text-xs font-semibold">{sensor.statusText}</span>
                    </div>
                  )}
                </div>

                <div className="mt-1">
                  <p className="text-xs md:text-sm font-medium mb-1 text-foreground/70">{t(sensor.nameKey)}</p>

                  {sensor.chartType === "npk-bars" ? (
                    <div className="flex items-end justify-between gap-1 mt-1">
                      {[
                        { key: "N", val: Math.round(convertValue(sensor.key, sensor.npkValues?.n ?? 0)), color: "#006c49" },
                        { key: "P", val: Math.round(convertValue(sensor.key, sensor.npkValues?.p ?? 0)), color: "#795900" },
                        { key: "K", val: Math.round(convertValue(sensor.key, sensor.npkValues?.k ?? 0)), color: "#446900" },
                      ].map((row) => (
                        <div key={row.key} className="flex flex-col leading-none">
                          <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider mb-0.5" style={{ color: row.color }}>{row.key}</span>
                          <span className="text-xl md:text-2xl font-bold text-foreground tabular-nums">{row.val}</span>
                        </div>
                      ))}
                      <span className="text-[10px] md:text-xs font-medium text-foreground/40 pb-0.5">{cardUnit}</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-1 mb-3">
                        <span className="text-2xl font-bold text-foreground tracking-tight">{formatValue(sensor.key, sensor.value)}</span>
                        <span className="text-xs font-medium text-foreground/60">{cardUnit}</span>
                      </div>

                      {/* Chart Areas */}
                      <div className="h-[6px] w-full relative">
                        {sensor.chartType === "progress" && (
                          <div className="absolute inset-0 rounded-full bg-transparent neu-progress-inset">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${sensor.progressValue}%`,
                                background: sensor.color
                              }}
                            />
                          </div>
                        )}

                      </div>
                    </>
                  )}
                </div>
              </div>
              )
            })}
          </div>
        </section>

        {/* Data Analysis Section — Parameter selector */}
        <section className="mb-4" aria-labelledby="data-analysis-heading">
          <h2 id="data-analysis-heading" className="text-base md:text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
            <LineChart className="h-5 w-5 md:h-6 md:w-6 text-primary" aria-hidden="true" />
            {t('monitoring.dataAnalysis')}
          </h2>
          <div className="relative">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              aria-expanded={isDropdownOpen}
              aria-haspopup="listbox"
              aria-label={`${t('monitoring.dataAnalysis')}: ${selectedParam ? t(selectedParam.nameKey) : ''}`}
              className="group w-full flex items-center justify-between rounded-2xl bg-surface-sage border border-white/60 px-4 py-3 neu-raised transition-all duration-300 hover:bg-surface-leaf hover:-translate-y-0.5 neu-raised-hover active:translate-y-0 active:scale-[0.99] neu-selector-press"
            >
              <div className="flex items-center gap-3">
                {selectedParam && (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/20 transition-all duration-300 neu-inset neu-icon-raise group-hover:bg-primary">
                    <selectedParam.icon className="h-5 w-5 text-primary transition-colors duration-300 group-hover:text-white" />
                  </div>
                )}
                <span className="font-medium text-foreground text-sm md:text-base transition-colors duration-300 group-hover:text-primary">{selectedParam ? t(selectedParam.nameKey) : ''}</span>
              </div>
              <ChevronDown className={cn(
                "h-5 w-5 text-foreground/50 transition-all duration-300 group-hover:text-primary",
                isDropdownOpen && "rotate-180"
              )} />
            </button>
            {isDropdownOpen && (
              <>
                <div className="fixed inset-0 z-0" onClick={() => setIsDropdownOpen(false)} aria-hidden="true" />
                <div className="absolute top-full left-0 right-0 mt-3 rounded-2xl neu-dropdown z-20 overflow-hidden bg-surface-sage border border-white/60" role="listbox" aria-label={t('monitoring.dataAnalysis')}>
                  <div className="max-h-[156px] overflow-y-auto">
                    {parameterOptions.map((param) => {
                      const isSelected = selectedParameter === param.id
                      return (
                        <button
                          key={param.id}
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => {
                            setSelectedParameter(param.id)
                            setIsDropdownOpen(false)
                          }}
                          className={cn(
                            "group w-full px-4 py-3 text-left transition-all duration-300 flex items-center gap-3",
                            isSelected
                              ? "bg-primary/12 neu-dropdown-selected cursor-pointer"
                              : "hover:bg-primary/10 active:bg-primary/15 neu-dropdown-press cursor-pointer"
                          )}
                        >
                          <div className={cn(
                            "flex h-7 w-7 items-center justify-center rounded-lg transition-all duration-300",
                            isSelected
                              ? "bg-primary neu-icon-selected"
                              : "bg-transparent neu-inset neu-icon-raise group-hover:bg-primary"
                          )}>
                            <param.icon className={cn(
                              "h-3.5 w-3.5 transition-colors duration-300",
                              isSelected ? "text-white" : "text-primary group-hover:text-white"
                            )} />
                          </div>
                          <span className={cn(
                            "font-medium text-sm md:text-base transition-colors duration-300",
                            isSelected ? "text-primary-dark font-semibold" : "text-foreground group-hover:text-primary-dark"
                          )}>{t(param.nameKey)}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </section>

        {/* Trend Graph + Summary Cards — side by side on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4 mb-6">
          {/* Trend Graph (left, larger) */}
          <div className="rounded-2xl bg-surface-sage border border-white/60 p-4 md:p-5 neu-raised neu-raised-hover transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <h3 id="trend-graph-heading" className="font-semibold text-foreground text-sm md:text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                {t('monitoring.trendGraph')}
              </h3>
              <div className="flex gap-1 rounded-2xl bg-transparent neu-inset p-1" role="tablist" aria-label={t('monitoring.trendGraph')}>
                {["day", "week", "month"].map((range) => (
                  <button
                    key={range}
                    role="tab"
                    aria-selected={timeRange === range}
                    aria-label={t(timeRangeKeys[range])}
                    onClick={() => {
                      setTimeRange(range)
                      setLockedPoint(null)
                    }}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-[10px] md:text-xs font-semibold capitalize transition-all duration-300",
                      timeRange === range
                        ? "bg-primary text-white neu-seg-active"
                        : "text-foreground/60 hover:text-primary hover:bg-surface-leaf neu-seg-idle"
                    )}
                  >
                    {t(timeRangeKeys[range])}
                  </button>
                ))}
              </div>
            </div>
            <div className="relative h-52 lg:h-72 w-full" role="img" aria-label={`${t('monitoring.trendGraph')} — ${selectedParam ? t(selectedParam.nameKey) : ''}, ${t(timeRangeKeys[timeRange])}`}>
              {trendLoading ? (
                <div className="absolute inset-0 flex items-center justify-center"><LoadingState title={t('monitoring.trendLoading', 'Memuat grafik tren...')} /></div>
              ) : !formattedTrendData || formattedTrendData.length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center"><EmptyState icon={<TrendingUp width={30} height={30} />} title={t('monitoring.trendEmptyTitle', 'Belum ada data')} description={t('monitoring.trendEmptyDesc', 'Tidak ada data tren pada rentang waktu ini')} className="border-none bg-transparent" /></div>
              ) : (
              <>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart 
                  data={formattedTrendData} 
                  margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
                  onClick={(e: any) => {
                    if (e && e.activePayload && e.activeCoordinate) {
                      setLockedPoint({ 
                        payload: e.activePayload, 
                        label: e.activeLabel,
                        coord: { x: e.activeCoordinate.x, y: e.activeCoordinate.y }
                      })
                    } else {
                      setLockedPoint(null)
                    }
                  }}
                >
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#006c49" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e3d7" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: "#1b1c1599" }}
                    axisLine={{ stroke: "#e4e3d7" }}
                    tickLine={false}
                    interval={xAxisInterval[timeRange]}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#1b1c1599" }}
                    axisLine={false}
                    tickLine={false}
                    domain={["dataMin - 2", "dataMax + 2"]}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="rounded-lg bg-surface-muted border border-white px-2 py-1 shadow-sm z-50 flex flex-col items-center justify-center min-w-10">
                            <p className="text-[9px] text-foreground/70 leading-tight">{label}</p>
                            <p className="text-xs font-bold text-foreground leading-tight">
                              {payload[0].value}{displayUnit}
                            </p>
                          </div>
                        )
                      }
                      return null
                    }}
                    cursor={{ stroke: "#1b1c15", strokeWidth: 1, strokeDasharray: "3 3", opacity: 0.3 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#006c49"
                    strokeWidth={2.5}
                    fill="url(#colorValue)"
                    dot={false}
                    activeDot={{
                      r: 5,
                      fill: "#e4e3d7",
                      stroke: "#006c49",
                      strokeWidth: 2.5,
                    }}
                    animationDuration={500}
                  />
                  {lockedPoint && (
                    <ReferenceLine 
                      x={lockedPoint.label} 
                      stroke="#006c49" 
                      strokeDasharray="4 4" 
                      opacity={0.6} 
                    />
                  )}
                  {lockedPoint && (
                    <ReferenceDot 
                      x={lockedPoint.label} 
                      y={lockedPoint.payload[0].value} 
                      r={6} fill="#006c49" stroke="#10b981" strokeWidth={3} 
                      isFront 
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
              
              {lockedPoint && (
                <div 
                  className="absolute z-10 pointer-events-none flex flex-col items-center justify-center rounded-lg bg-primary px-2 py-1 shadow-md min-w-10"
                  style={{ 
                    left: lockedPoint.coord.x, 
                    top: lockedPoint.coord.y, 
                    transform: 'translate(-50%, -100%)', 
                    marginTop: '-12px' 
                  }}
                >
                  <p className="text-[9px] text-white/80 leading-tight">{lockedPoint.label}</p>
                  <p className="text-xs font-bold text-white leading-tight">
                    {lockedPoint.payload[0].value}{displayUnit}
                  </p>
                </div>
              )}
              </>
              )}
            </div>
          </div>

          {/* Summary Cards (right, narrower) */}
          <div className="grid grid-cols-3 lg:grid-cols-1 gap-3 lg:gap-4">
            {/* Maksimum */}
            <div
              style={{ "--accent": "#006c49", "--accent-soft": "#10b981" } as CSSProperties}
              className="group rounded-2xl bg-surface-sage border border-white/60 p-4 neu-raised transition-all duration-300 cursor-pointer hover:-translate-y-1 hover:bg-(--accent-soft)/15 neu-raised-hover flex items-center justify-between"
            >
              <div>
                <p className="text-xs md:text-sm text-foreground/60 mb-1">{t('monitoring.maximum')}</p>
                <p className="text-2xl lg:text-3xl font-bold text-foreground">{summary.max}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-(--accent-soft)/20 transition-all duration-300 neu-inset neu-icon-raise group-hover:bg-(--accent)">
                <TrendingUp className="h-5 w-5 text-(--accent) transition-colors duration-300 group-hover:text-white" />
              </div>
            </div>
            {/* Rata-rata */}
            <div
              style={{ "--accent": "#795900", "--accent-soft": "#f9bd22" } as CSSProperties}
              className="group rounded-2xl bg-surface-sage border border-white/60 p-4 neu-raised transition-all duration-300 cursor-pointer hover:-translate-y-1 hover:bg-(--accent-soft)/15 neu-raised-hover flex items-center justify-between"
            >
              <div>
                <p className="text-xs md:text-sm text-foreground/60 mb-1">{t('monitoring.average')}</p>
                <p className="text-2xl lg:text-3xl font-bold text-foreground">{summary.avg}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-(--accent-soft)/20 transition-all duration-300 neu-inset neu-icon-raise group-hover:bg-(--accent)">
                <MoveRight className="h-5 w-5 text-(--accent) transition-colors duration-300 group-hover:text-white" />
              </div>
            </div>
            {/* Minimum */}
            <div
              style={{ "--accent": "#ba1a1a", "--accent-soft": "#ef4444" } as CSSProperties}
              className="group rounded-2xl bg-surface-sage border border-white/60 p-4 neu-raised transition-all duration-300 cursor-pointer hover:-translate-y-1 hover:bg-(--accent-soft)/15 neu-raised-hover flex items-center justify-between"
            >
              <div>
                <p className="text-xs md:text-sm text-foreground/60 mb-1">{t('monitoring.minimum')}</p>
                <p className="text-2xl lg:text-3xl font-bold text-foreground">{summary.min}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-(--accent-soft)/20 transition-all duration-300 neu-inset neu-icon-raise group-hover:bg-(--accent)">
                <TrendingDown className="h-5 w-5 text-(--accent) transition-colors duration-300 group-hover:text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* 5. History Section */}
        <div className="rounded-2xl bg-surface-sage border border-white/60 p-4 md:p-5 mb-6 neu-raised neu-raised-hover transition-all duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h3 id="history-heading" className="font-semibold text-foreground text-sm md:text-base flex items-center gap-2">
              <History className="h-4 w-4 md:h-5 md:w-5 text-primary" />
              {t('monitoring.history')}
            </h3>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-2xl bg-surface-sage neu-inset-deep px-3 py-2">
                <CalendarDays className="h-4 w-4 text-foreground/50 shrink-0" />
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  aria-label={t('monitoring.dateFrom', 'Dari tanggal')}
                  className="bg-transparent text-xs md:text-sm text-foreground focus:outline-none cursor-pointer"
                />
                <span className="text-xs text-foreground/40">—</span>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  aria-label={t('monitoring.dateTo', 'Sampai tanggal')}
                  className="bg-transparent text-xs md:text-sm text-foreground focus:outline-none cursor-pointer"
                />
              </div>
              <button type="button" onClick={handleExport} disabled={isExporting} aria-label={t('monitoring.exportData')} className="flex items-center gap-1.5 rounded-2xl bg-primary px-3.5 py-2 text-xs md:text-sm font-semibold text-white neu-btn-primary transition-all duration-300 hover:bg-success active:bg-primary-shade active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed">
                <Download className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">{isExporting ? t('monitoring.exporting') : t('monitoring.exportData')}</span>
              </button>
            </div>
          </div>

          {exportError && (
            <p className="mb-3 rounded-2xl border border-error/30 bg-error-container/50 px-3 py-2 text-xs font-medium text-on-error-container">
              {exportError}
            </p>
          )}

          {(() => {
            const historyRows = historyData?.data || [];
            return (
              <>
                {/* ═══ DESKTOP / TABLET TABLE (md and up) ═══ */}
                <div className="hidden md:block overflow-x-auto rounded-2xl bg-transparent neu-inset border border-white/40 scrollbar-hide">
                  <table className="w-full min-w-[860px]" aria-labelledby="history-heading">
                    <thead className="bg-primary">
                      <tr>
                        <th scope="col" className="px-3 py-2.5 text-left text-xs md:text-sm font-medium text-white whitespace-nowrap">{t('monitoring.timestamp')}</th>
                        <th scope="col" className="px-3 py-2.5 text-left text-xs md:text-sm font-medium text-white whitespace-nowrap">{t('monitoring.sentAt')}</th>
                        <th scope="col" className="px-3 py-2.5 text-left text-xs md:text-sm font-medium text-white whitespace-nowrap">{t('home.sensor_ph')}</th>
                        <th scope="col" className="px-3 py-2.5 text-left text-xs md:text-sm font-medium text-white whitespace-nowrap">{t('home.sensor_moist')}</th>
                        <th scope="col" className="px-3 py-2.5 text-left text-xs md:text-sm font-medium text-white whitespace-nowrap">N</th>
                        <th scope="col" className="px-3 py-2.5 text-left text-xs md:text-sm font-medium text-white whitespace-nowrap">P</th>
                        <th scope="col" className="px-3 py-2.5 text-left text-xs md:text-sm font-medium text-white whitespace-nowrap">K</th>
                        <th scope="col" className="px-3 py-2.5 text-left text-xs md:text-sm font-medium text-white whitespace-nowrap">{t('home.sensor_temp')}</th>
                        <th scope="col" className="px-3 py-2.5 text-left text-xs md:text-sm font-medium text-white whitespace-nowrap">{t('monitoring.rainCondition', 'Kondisi')}</th>
                        <th scope="col" className="px-3 py-2.5 text-left text-xs md:text-sm font-medium text-white whitespace-nowrap">{t('monitoring.status')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyLoading ? (
                        <tr><td colSpan={10} className="py-8"><LoadingState title={t('monitoring.historyLoading', 'Memuat riwayat...')} className="max-w-sm mx-auto" /></td></tr>
                      ) : historyRows.length === 0 ? (
                        <tr><td colSpan={10} className="py-8"><EmptyState icon={<History width={30} height={30} />} title={t('monitoring.historyEmptyTitle', 'Belum ada riwayat')} description={t('monitoring.historyEmptyDesc', 'Data historis tidak ditemukan')} className="border-none bg-transparent" /></td></tr>
                      ) : historyRows.map((row: any) => {
                        const meta = statusMeta[row.status] ?? statusMeta.no_data
                        return (
                        <tr key={row.id} className="border-t border-white/30 hover:bg-surface-leaf transition-colors">
                          <td className="px-3 py-2.5 text-xs md:text-sm text-foreground whitespace-nowrap">{row.captured_at ? new Date(row.captured_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</td>
                          <td className="px-3 py-2.5 text-xs md:text-sm text-foreground whitespace-nowrap">{row.sent_at ? new Date(row.sent_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</td>
                          <td className="px-3 py-2.5 text-xs md:text-sm font-medium text-foreground whitespace-nowrap">{row.ph_level ?? '—'}</td>
                          <td className="px-3 py-2.5 text-xs md:text-sm font-medium text-foreground whitespace-nowrap">{formatValue('soil_moisture', row.soil_moisture)}</td>
                          <td className="px-3 py-2.5 text-xs md:text-sm font-medium text-foreground whitespace-nowrap">{formatValue('soil_npk', row.soil_nitrogen)}</td>
                          <td className="px-3 py-2.5 text-xs md:text-sm font-medium text-foreground whitespace-nowrap">{formatValue('soil_npk', row.soil_phosphorus)}</td>
                          <td className="px-3 py-2.5 text-xs md:text-sm font-medium text-foreground whitespace-nowrap">{formatValue('soil_npk', row.soil_potassium)}</td>
                          <td className="px-3 py-2.5 text-xs md:text-sm font-medium text-foreground whitespace-nowrap">{formatValue('soil_temperature', row.soil_temperature)}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            {row.is_raining === true ? (
                              <span className="inline-flex items-center gap-1 text-xs md:text-sm px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                                <CloudRain className="h-3.5 w-3.5" />
                                {t('monitoring.rain', 'Hujan')}
                              </span>
                            ) : row.is_raining === false ? (
                              <span className="inline-flex items-center gap-1 text-xs md:text-sm px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                                <CloudSun className="h-3.5 w-3.5" />
                                {t('monitoring.noRain', 'Tidak Hujan')}
                              </span>
                            ) : (
                              <span className="text-xs md:text-sm text-foreground/40">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span className={cn("inline-flex items-center text-xs md:text-sm px-2 py-0.5 rounded-full font-medium", meta.pill)}>
                              {t(meta.labelKey)}
                            </span>
                          </td>
                        </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* ═══ MOBILE CARD STACK (< md) ═══ */}
                <div className="md:hidden space-y-3">
                  {historyLoading ? (
                    <div className="py-8"><LoadingState title={t('monitoring.historyLoading', 'Memuat riwayat...')} className="max-w-sm mx-auto" /></div>
                  ) : historyRows.length === 0 ? (
                    <EmptyState icon={<History width={30} height={30} />} title={t('monitoring.historyEmptyTitle', 'Belum ada riwayat')} description={t('monitoring.historyEmptyDesc', 'Data historis tidak ditemukan')} className="border-none bg-transparent" />
                  ) : historyRows.map((row: any) => {
                    const meta = statusMeta[row.status] ?? statusMeta.no_data
                    return (
                    <div
                      key={row.id}
                      className="rounded-2xl bg-white/80 border border-white/60 p-3.5 neu-raised-sm"
                    >
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-foreground/70">{row.captured_at ? new Date(row.captured_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</p>
                          <p className="text-[10px] text-foreground/45 mt-0.5">{t('monitoring.sentAt')}: {row.sent_at ? new Date(row.sent_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className={cn("inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full", meta.pill)}>
                            {t(meta.labelKey)}
                          </span>
                          {row.is_raining === true ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                              <CloudRain className="h-3 w-3" />
                              {t('monitoring.rain', 'Hujan')}
                            </span>
                          ) : row.is_raining === false ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                              <CloudSun className="h-3 w-3" />
                              {t('monitoring.noRain', 'Tidak Hujan')}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-2xl bg-surface-sage/60 px-2.5 py-2">
                          <p className="text-[10px] uppercase tracking-wide text-foreground/50 mb-0.5">{t('home.sensor_ph')}</p>
                          <p className="text-sm font-semibold text-foreground">{row.ph_level ?? '—'}</p>
                        </div>
                        <div className="rounded-2xl bg-surface-sage/60 px-2.5 py-2">
                          <p className="text-[10px] uppercase tracking-wide text-foreground/50 mb-0.5">{t('home.sensor_moist')}</p>
                          <p className="text-sm font-semibold text-foreground">{formatValue('soil_moisture', row.soil_moisture)}</p>
                        </div>
                        <div className="rounded-2xl bg-surface-sage/60 px-2.5 py-2">
                          <p className="text-[10px] uppercase tracking-wide text-foreground/50 mb-0.5">{t('home.sensor_npk')}</p>
                          <p className="text-sm font-semibold text-foreground">
                            N {formatValue('soil_npk', row.soil_nitrogen)} · P {formatValue('soil_npk', row.soil_phosphorus)} · K {formatValue('soil_npk', row.soil_potassium)}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-surface-sage/60 px-2.5 py-2">
                          <p className="text-[10px] uppercase tracking-wide text-foreground/50 mb-0.5">{t('home.sensor_temp')}</p>
                          <p className="text-sm font-semibold text-foreground">{formatValue('soil_temperature', row.soil_temperature)}</p>
                        </div>
                      </div>
                    </div>
                    )
                  })}
                </div>
              </>
            );
          })()}

          <nav className="flex items-center justify-between mt-4" aria-label={t('monitoring.history')}>
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              aria-label={t('monitoring.prev')}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-sage neu-inset-deep text-xs md:text-sm font-medium text-foreground transition-all duration-300 hover:bg-primary/25 hover:text-primary-shade hover:font-semibold active:scale-[0.97] active:bg-primary/20 disabled:opacity-40 disabled:hover:bg-surface-sage disabled:hover:text-foreground disabled:hover:font-medium"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              {t('monitoring.prev')}
            </button>
            <span className="text-xs md:text-sm text-foreground/60" aria-live="polite">{t('monitoring.pageOf', { current: currentPage, total: totalHistoryPages })}</span>
            <button
              onClick={() => setCurrentPage(Math.min(totalHistoryPages, currentPage + 1))}
              disabled={currentPage >= totalHistoryPages}
              aria-label={t('monitoring.next')}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-sage neu-inset-deep text-xs md:text-sm font-medium text-foreground transition-all duration-300 hover:bg-primary/25 hover:text-primary-shade hover:font-semibold active:scale-[0.97] active:bg-primary/20 disabled:opacity-40 disabled:hover:bg-surface-sage disabled:hover:text-foreground disabled:hover:font-medium"
            >
              {t('monitoring.next')}
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </nav>
        </div>

      </div>


    </div>
  )
}
