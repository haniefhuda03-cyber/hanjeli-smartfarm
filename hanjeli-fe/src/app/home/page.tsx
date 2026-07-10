"use client"

import { useState, useEffect, useRef, type CSSProperties } from "react"
import { useNotifications } from "@/contexts/notification-context"
import { useTranslation } from "react-i18next"
import Image from "next/image"
import Link from "next/link"
import {
  Bell,
  Thermometer,
  Droplets,
  Sun,
  Leaf,
  Gauge,
  CheckCircle2,
  CheckCheck,
  Wifi,
  Camera,
  Droplet,
  Trash2,
  X,
  AlertTriangle,
  Info,
  Activity,
  Sprout,
  Router,
  ChevronRight,
  Shield,
  TrendingUp,
  FlaskConical,
  Cpu,
  History,
  Clock,
  Cloud,
  CloudSun,
  CloudRain,
  CloudLightning,
  CloudFog,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useCurrentUser } from "@/lib/hooks/useCurrentUser"
import { UserAvatar } from "@/components/user-avatar"
import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/api/query-keys"
import { sensorsApi } from "@/lib/api/sensors"
import { weatherApi } from "@/lib/api/weather"
import { devicesApi } from "@/lib/api/devices"
import { useSensorSocket } from "@/hooks/useSensorSocket"
import { useMeasurementUnits } from "@/hooks/useMeasurementUnits"
import type { MeasurableParam } from "@/lib/units"
import { LoadingState } from "@/components/ui-states/loading-state"
import { EmptyState } from "@/components/ui-states/empty-state"

// Sensor data with status info
type SensorCard = {
  id: number
  param: MeasurableParam
  nameKey: string
  value: number | null
  icon: LucideIcon
  statusKey: string
  statusColor: string
  npk?: { n: number; p: number; k: number }
  disabled?: boolean
}

// Empty-state awal sebelum data asli (REST/WebSocket) tiba — bukan data dummy
const baseSensors: SensorCard[] = [
  { id: 1, param: "ph", nameKey: "sensor_ph", value: null, icon: FlaskConical, statusKey: "no_data", statusColor: "disabled" },
  { id: 2, param: "soil_moisture", nameKey: "sensor_moist", value: null, icon: Droplet, statusKey: "no_data", statusColor: "disabled" },
  { id: 3, param: "soil_npk", nameKey: "sensor_npk", value: null, icon: Leaf, statusKey: "no_data", statusColor: "disabled", npk: { n: 0, p: 0, k: 0 } },
  { id: 4, param: "soil_temperature", nameKey: "sensor_temp", value: null, icon: Thermometer, statusKey: "no_data", statusColor: "disabled" },
]

// Status mapping helper
const mapStatusToColor = (status: string) => {
  if (status === 'optimal') return 'green';
  if (status === 'warning') return 'amber';
  return 'disabled';
}

const statusStyles: Record<string, { bg: string; text: string; iconBg: string; iconHover: string; cardHover: string }> = {
  green: { bg: "bg-success/15", text: "text-primary", iconBg: "bg-success/20", iconHover: "group-hover:bg-primary", cardHover: "hover:bg-surface-sage" },
  amber: { bg: "bg-warning/15", text: "text-secondary", iconBg: "bg-warning/20", iconHover: "group-hover:bg-secondary", cardHover: "hover:bg-surface-warm" },
  red: { bg: "bg-destructive/10", text: "text-destructive", iconBg: "bg-destructive/10", iconHover: "group-hover:bg-destructive", cardHover: "hover:bg-surface-blush" },
  disabled: { bg: "bg-foreground/8", text: "text-foreground/35", iconBg: "bg-foreground/8", iconHover: "", cardHover: "" },
}

// ── Donut "Fokus Monitoring" ─────────────────────────────────────────────────
// Geometry constants for the status donut. The chart is drawn with a single SVG
// <circle> per segment using stroke-dash; computing the math here (instead of
// hardcoded dash strings) keeps the arcs exact and easy to tune.
const DONUT_RADIUS = 42
const DONUT_STROKE = 9
const DONUT_STROKE_HOVER = 11
// Gap (in path units) between segments. MUST stay larger than the stroke width —
// otherwise the rounded line-caps of neighbouring segments overlap each other,
// which was the cause of the messy-looking pie chart.
const DONUT_GAP = 12
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS

// Status buckets shown in the donut. Counts are derived from the live `sensors`
// array so the chart, legend and percentages can never drift out of sync with
// the sensor grid rendered above.
const STATUS_CATEGORIES = [
  { key: "optimal", statusColor: "green", color: "#10b981", labelKey: "home.pieOptimal", fallback: "Optimal" },
  { key: "warning", statusColor: "amber", color: "#f9bd22", labelKey: "home.pieWarning", fallback: "Perhatian" },
  { key: "nonaktif", statusColor: "disabled", color: "#a39e8c", labelKey: "home.pieOffline", fallback: "Nonaktif" },
] as const

// ── Date & Time Helpers ─────────────────────────────────────────────────────
const dayKeys = ['home.sunday', 'home.monday', 'home.tuesday', 'home.wednesday', 'home.thursday', 'home.friday', 'home.saturday']
const monthKeys = ['home.january', 'home.february', 'home.march', 'home.april', 'home.may', 'home.june', 'home.july', 'home.august', 'home.september', 'home.october', 'home.november', 'home.december']

function formatDate(now: Date, t: (key: string) => string) {
  return `${t(dayKeys[now.getDay()])}, ${now.getDate()} ${t(monthKeys[now.getMonth()])} ${now.getFullYear()} • ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
}

function getTimeGreeting(t: (key: string, defaultValue: string) => string) {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 11) return t('home.goodMorning', 'Selamat Pagi')
  if (hour >= 11 && hour < 15) return t('home.goodAfternoon', 'Selamat Siang')
  if (hour >= 15 && hour < 18) return t('home.goodEvening', 'Selamat Sore')
  return t('home.goodNight', 'Selamat Malam')
}

export default function HomePage() {
  const { t } = useTranslation()
  const { name, avatarUrl } = useCurrentUser()
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll, isRinging, removeNotification } = useNotifications()
  const [showNotifications, setShowNotifications] = useState(false)
  const notifPanelRef = useRef<HTMLDivElement>(null)
  const notifButtonRef = useRef<HTMLDivElement>(null)
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)

  // Jam di header ter-update otomatis tiap 30 detik (sebelumnya statis)
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  // API Fetches — cuaca di-refresh tiap menit (cache backend 15 menit)
  const { data: overviewData } = useQuery({ queryKey: queryKeys.sensors.overview, queryFn: sensorsApi.getOverview, refetchInterval: 60000 })
  const { data: qualityData } = useQuery({ queryKey: queryKeys.sensors.qualityScore, queryFn: sensorsApi.getQualityScore, refetchInterval: 60000 })
  const { data: weatherData } = useQuery({ queryKey: queryKeys.weather.current, queryFn: weatherApi.getCurrent, refetchInterval: 60000 })
  const { data: devicesData, isLoading: devicesLoading } = useQuery({ queryKey: queryKeys.devices.all, queryFn: devicesApi.getAll, refetchInterval: 60000 })
  const { data: historyData, isLoading: historyLoading, error: historyError } = useQuery({ queryKey: queryKeys.sensors.history({ limit: 5 }), queryFn: () => sensorsApi.getHistory({ limit: 5 }), refetchInterval: 60000 })
  
  // Real-time WebSockets
  const { sensorData, isConnected } = useSensorSocket()

  // Unit pengukuran sesuai preferensi user (konversi tampilan)
  const { getUnit, formatValue, convertValue } = useMeasurementUnits()

  // State to hold active parameters merged with realtime
  const [sensors, setSensors] = useState<SensorCard[]>(baseSensors)

  useEffect(() => {
    setSensors(prev => {
      const newSensors = prev.map(sensor => ({ ...sensor }));
      const byParam = (param: MeasurableParam) =>
        newSensors.find(s => s.param === param);

      // Merge with overview from REST — kartu 'npk' membawa tiga nilai N/P/K
      if (overviewData?.parameters) {
        overviewData.parameters.forEach((param: any) => {
          const card = byParam(
            (param.key === 'npk' ? 'soil_npk' : param.key) as MeasurableParam,
          );
          if (!card) return;

          card.value = param.value ?? null;
          card.statusKey = param.status || 'no_data';
          card.statusColor = mapStatusToColor(param.status);
          if (param.key === 'npk') {
            card.npk = {
              n: param.nitrogen ?? 0,
              p: param.phosphorus ?? 0,
              k: param.potassium ?? 0,
            };
          }
        });
      }

      // Merge with realtime from WebSockets (key sama dengan broadcast backend)
      if (sensorData) {
        const realtime: Array<[MeasurableParam, number | undefined]> = [
          ['ph', sensorData.ph],
          ['soil_moisture', sensorData.soil_moisture],
          ['soil_temperature', sensorData.soil_temperature],
        ];
        for (const [param, value] of realtime) {
          const card = byParam(param);
          if (card && value !== undefined) {
            card.value = value;
            card.statusKey = 'optimal';
            card.statusColor = 'green';
          }
        }
        if (
          sensorData.nitrogen !== undefined &&
          sensorData.phosphorus !== undefined &&
          sensorData.potassium !== undefined
        ) {
          const card = byParam('soil_npk');
          if (card) {
            /* N, P, K tiga nilai terpisah — tidak ada nilai gabungan */
            card.npk = {
              n: sensorData.nitrogen,
              p: sensorData.phosphorus,
              k: sensorData.potassium,
            };
            card.statusKey = 'optimal';
            card.statusColor = 'green';
          }
        }
      }

      return newSensors;
    });
  }, [overviewData, sensorData]);

  const activeSensors = sensors.filter(s => !s.disabled)

  const statusDistribution = STATUS_CATEGORIES.map((cat) => ({
    ...cat,
    count: activeSensors.filter((s) => s.statusColor === cat.statusColor).length,
  }))

  // Build donut segments from live data. Geometry (dash array/offset) is computed
  // so the arcs always match the real counts; a per-segment gap keeps the rounded
  // caps from overlapping. Hovering a segment/legend item highlights it.
  const totalSensors = statusDistribution.reduce((sum, c) => sum + c.count, 0)
  const donutSegments = statusDistribution.map((cat, i) => {
    const fraction = totalSensors > 0 ? cat.count / totalSensors : 0
    const startFraction = statusDistribution
      .slice(0, i)
      .reduce((sum, c) => sum + (totalSensors > 0 ? c.count / totalSensors : 0), 0)
    const arc = fraction * DONUT_CIRCUMFERENCE
    return {
      key: cat.key,
      color: cat.color,
      count: cat.count,
      label: t(cat.labelKey, cat.fallback),
      percentage: Math.round(fraction * 100),
      dashArray: `${Math.max(arc - DONUT_GAP, 0)} ${DONUT_CIRCUMFERENCE}`,
      dashOffset: -(startFraction * DONUT_CIRCUMFERENCE + DONUT_GAP / 2),
    }
  })
  const activeSegment = donutSegments.find((s) => s.key === hoveredKey) ?? null
  const optimalCount = statusDistribution.find((c) => c.key === "optimal")?.count ?? 0

  // Close notification panel when clicking outside (on main content)
  useEffect(() => {
    if (!showNotifications) return
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        notifPanelRef.current && !notifPanelRef.current.contains(target) &&
        notifButtonRef.current && !notifButtonRef.current.contains(target)
      ) {
        setShowNotifications(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showNotifications])

  return (
    <div className="relative min-h-screen w-full bg-page">
      {/* ═══════════ Header Hero Card ═══════════ */}
      <div className="relative px-5 md:px-6 lg:px-8 pt-16 lg:pt-6 pb-2">
        <div className="relative w-full overflow-hidden rounded-2xl shadow-[0_8px_30px_rgba(16,185,129,0.1)]">
          {/* Background Image */}
          <Image
            src="https://images.unsplash.com/photo-1559628233-100c798642d4?w=1200&q=80"
            alt="Farm landscape"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/30 to-black/10" />

          {/* Content */}
          <div className="relative z-10 flex items-end justify-between p-6 md:p-8 min-h-[180px] sm:min-h-[220px] md:min-h-[260px]">
            <div className="flex-1">
              <p className="text-xs md:text-sm text-white/70 font-medium mb-2">{formatDate(now, t)}</p>
              <p className="text-lg sm:text-xl md:text-2xl font-bold text-white/90 mb-0.5">{t('home.helloWave', 'Halo 👋')}</p>
              <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-white">
                {getTimeGreeting(t)}{name ? `, ${name}` : ""}
              </h1>
            </div>
            <div className="flex items-center gap-3 md:gap-4 shrink-0 ml-4 mb-1 md:mb-1.5">
              {/* Weather Badge — glassmorphism, height matches icons */}
              <div className="hidden sm:flex items-center justify-center gap-2.5 rounded-full bg-white/15 backdrop-blur-md border border-white/25 px-4 md:px-5 h-12 md:h-14 pb-[2px]">
                {(() => {
                  const condition = weatherData?.condition?.toLowerCase() || '';
                  let WeatherIcon = Sun;
                  let colorClass = "text-warning";
                  let localizedCondition = weatherData?.condition ?? '';
                  
                  if (condition.includes('hujan') || condition.includes('gerimis')) { 
                    WeatherIcon = CloudRain; colorClass = "text-blue-300"; localizedCondition = t('home.weatherRain', 'Hujan'); 
                  }
                  else if (condition.includes('petir')) { 
                    WeatherIcon = CloudLightning; colorClass = "text-yellow-400"; localizedCondition = t('home.weatherStorm', 'Hujan Badai'); 
                  }
                  else if (condition.includes('kabut')) { 
                    WeatherIcon = CloudFog; colorClass = "text-gray-300"; localizedCondition = t('home.weatherFog', 'Kabut'); 
                  }
                  else if (condition.includes('cerah berawan')) { 
                    WeatherIcon = CloudSun; colorClass = "text-orange-300"; localizedCondition = t('home.weatherPartlyCloudy', 'Cerah Berawan'); 
                  }
                  else if (condition.includes('berawan')) { 
                    WeatherIcon = Cloud; colorClass = "text-gray-200"; localizedCondition = t('home.weatherCloudy', 'Berawan'); 
                  }
                  else if (condition.includes('cerah')) { 
                    WeatherIcon = Sun; colorClass = "text-warning"; localizedCondition = t('home.weatherClear', 'Cerah'); 
                  }
                  
                  return (
                    <>
                      <WeatherIcon className={cn("h-5 w-5 md:h-[22px] md:w-[22px] shrink-0", colorClass)} />
                      <span className="text-sm md:text-base font-bold text-white whitespace-nowrap leading-none">
                        {weatherData?.temperature != null
                          ? `${weatherData.temperature}°C, ${localizedCondition}`
                          : t('home.weatherUnavailable', 'Cuaca tidak tersedia')}
                      </span>
                    </>
                  );
                })()}
              </div>
              {/* Notification Bell */}
              <div className="relative" ref={notifButtonRef}>
                <button
                  onClick={() => setShowNotifications((prev) => !prev)}
                  aria-label={t('home.notifications', 'Notifikasi')}
                  aria-expanded={showNotifications}
                  aria-haspopup="dialog"
                  className={cn(
                    "home-notif-button group flex h-12 w-12 md:h-14 md:w-14 items-center justify-center rounded-full backdrop-blur-xl transition-all duration-300 border border-white/20 active:scale-95",
                    isRinging ? "bg-white/20 shadow-[0_0_15px_rgba(255,255,255,0.3)]" : ""
                  )}
                >
                  <Bell className={cn("h-5 w-5 md:h-6 md:w-6 text-white/90 transition-colors duration-300 group-hover:text-white", isRinging && "animate-[bell-ring_1s_ease-in-out_infinite]")} />
                </button>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 md:h-6 md:w-6 items-center justify-center rounded-full bg-destructive text-[10px] md:text-xs font-bold text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </div>
              {/* Avatar */}
              <UserAvatar
                src={avatarUrl}
                name={name}
                className="h-12 w-12 md:h-14 md:w-14 ring-2 ring-white/30 shadow-lg"
                iconClassName="h-5 w-5 md:h-6 md:w-6 text-sm md:text-base text-white"
              />
            </div>
          </div>
        </div>

        {/* Notification Panel — anchored below greeting card, no backdrop dimming.
            Positioned absolutely within the header container so it follows scroll naturally.
            Clicking on main content (outside) closes it via the useEffect listener above. */}
        {showNotifications && (
          <div
            ref={notifPanelRef}
            role="dialog"
            aria-labelledby="notification-panel-title"
            className="absolute top-full right-5 md:right-6 lg:right-8 z-50 w-[calc(100vw-2.5rem)] sm:w-96 max-w-md rounded-2xl bg-white shadow-[0_20px_50px_rgba(0,0,0,0.15),0_4px_12px_rgba(0,0,0,0.08)] border border-surface-muted/70 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-200 mt-1"
            style={{ maxHeight: 'min(60vh, 480px)' }}
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-surface-muted/80 bg-surface-elevated shrink-0 space-y-2">
              {/* Top row: title + close */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h3 id="notification-panel-title" className="font-semibold text-foreground text-sm md:text-base">
                    {t('home.notifications', 'Notifikasi')}
                  </h3>
                  {unreadCount > 0 && (
                    <span className="shrink-0 flex h-5 min-w-5 items-center justify-center px-1.5 rounded-full bg-primary/15 text-primary text-[10px] font-bold tabular-nums" aria-label={t('home.unreadCount', { count: unreadCount, defaultValue: '{{count}} belum dibaca' })}>
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setShowNotifications(false)}
                  aria-label={t('home.closeNotifications', 'Tutup notifikasi')}
                  title={t('home.closeNotifications', 'Tutup notifikasi')}
                  className="group/card-close flex h-7 w-7 items-center justify-center rounded-full bg-surface-sage-soft transition-all duration-200 hover:bg-red-200 active:scale-90 shrink-0"
                >
                  <X className="h-4 w-4 text-foreground/50 transition-colors duration-200 group-hover/card-close:text-red-700" aria-hidden="true" />
                </button>
              </div>
              {/* Action buttons row — only shown when there are notifications */}
              {(unreadCount > 0 || notifications.length > 0) && (
                <div className="flex items-center gap-1.5">
                  {unreadCount > 0 && (
                    <button
                      onClick={() => markAllAsRead()}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 text-primary transition-all duration-200 hover:bg-primary/20 active:scale-95"
                      aria-label={t('home.markAllAsRead', 'Tandai Semua Dibaca')}
                    >
                      <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                      <span className="text-[10px] font-bold">{t('home.markAllAsRead', 'Tandai Semua Dibaca')}</span>
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      onClick={() => clearAll()}
                      aria-label={t('home.clearAll', 'Bersihkan Semua')}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-600/12 text-red-700 transition-all duration-200 hover:bg-red-600/20 active:scale-95"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span className="text-[10px] font-bold">{t('home.clearAll', 'Bersihkan Semua')}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
            {/* Notification list */}
            <div className="overflow-y-auto flex-1 overscroll-contain">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-4 text-center py-12">
                  <div className="mb-3 rounded-full bg-surface-sage-soft p-4"><Bell className="h-6 w-6 text-foreground/30" /></div>
                  <p className="font-medium text-sm text-foreground/60">{t('home.noNotifications', 'Belum ada notifikasi')}</p>
                  <p className="text-xs text-foreground/40 mt-1 max-w-xs">{t('home.noNotificationsDesc', 'Ketika Anda menerima notifikasi, mereka akan muncul di sini.')}</p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={cn(
                      "group/notif relative flex items-start gap-3 px-4 py-3 border-b border-surface-muted/50 last:border-0 transition-colors duration-150 hover:bg-surface-soft",
                      !notif.read && "bg-primary/3"
                    )}
                  >
                    {/* Type icon */}
                    <div className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg shrink-0 mt-0.5 transition-colors duration-150",
                      notif.type === "warning" ? "bg-amber-100" : notif.type === "error" ? "bg-red-100" : notif.type === "success" ? "bg-emerald-100" : "bg-blue-100"
                    )}>
                      {notif.type === "warning" && <AlertTriangle className="h-4 w-4 text-amber-600" />}
                      {notif.type === "error" && <X className="h-4 w-4 text-red-500" />}
                      {notif.type === "success" && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                      {notif.type === "info" && <Info className="h-4 w-4 text-blue-500" />}
                    </div>
                    {/* Text */}
                    <div className="flex-1 min-w-0 pr-1">
                      <p className={cn("text-sm text-foreground", !notif.read ? "font-bold" : "font-medium")}>{notif.title}</p>
                      <p className="text-xs text-foreground/55 truncate">{notif.description || notif.title}</p>
                    </div>
                    {/* Right side: unread dot + time, swap to action buttons on hover */}
                    <div className="flex flex-col items-end gap-1 shrink-0 ml-1">
                      <div className="flex items-center gap-1.5">
                        {!notif.read && (
                          <button
                            onClick={(e) => { e.stopPropagation(); markAsRead(notif.id) }}
                            className="h-2 w-2 rounded-full bg-primary shadow-[0_0_4px_rgba(0,108,73,0.6)] transition-transform hover:scale-150"
                            aria-label={t('home.markAsRead', 'Tandai Dibaca')}
                            title={t('home.markAsRead', 'Tandai Dibaca')}
                          />
                        )}
                        <span className="text-[10px] text-foreground/35 whitespace-nowrap transition-opacity duration-200 group-hover/notif:opacity-0">
                          {new Date(notif.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                    {/* Per-notification close: appears on hover */}
                    <button
                      onClick={(e) => { e.stopPropagation(); removeNotification(notif.id); }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover/notif:opacity-100 transition-all duration-200 flex items-center justify-center h-6 w-6 rounded-full bg-red-200/50 border border-red-400/40 hover:bg-red-300/60 hover:border-red-500/50 active:scale-90 z-10"
                      aria-label={t('home.dismissNotification', 'Hapus Notifikasi')}
                      title={t('home.dismissNotification', 'Hapus Notifikasi')}
                    >
                      <X className="h-3.5 w-3.5 text-red-700" aria-hidden="true" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* ═══════════ Content Area ═══════════ */}
      <div className="px-5 md:px-6 lg:px-8 pt-5 pb-28 lg:pb-8 space-y-6">

        {/* ── Kondisi Lahan ── */}
        <section>
          <h2 className="text-lg md:text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <Sprout className="h-5 w-5 md:h-6 md:w-6 text-primary" />
            {t('home.fieldCondition', 'Kondisi Lahan')}
          </h2>

          {/* Kualitas Lahan Summary */}
          {(() => {
            const hasData = qualityData && qualityData.status !== 'Tidak Ada Data' && qualityData.score !== undefined && qualityData.score !== null;
            const totalScore = hasData ? qualityData.score : null;
            const isGood = hasData && totalScore >= 80;
            const isMedium = hasData && totalScore >= 60 && totalScore < 80;
            const isBad = hasData && totalScore < 60;
            
            const qualityLabel = !hasData ? t('home.quality_nodata', 'Menunggu Data') : isGood ? t('home.quality_baik', 'Baik') : isMedium ? t('home.quality_sedang', 'Sedang') : t('home.quality_buruk', 'Buruk')
            const qualityColor = !hasData ? '#8f8b78' : isGood ? '#10b981' : isMedium ? '#f9bd22' : '#ba1a1a'
            const qualityBg = !hasData ? 'bg-surface-sage-soft' : isGood ? 'bg-success/15' : isMedium ? 'bg-warning/15' : 'bg-destructive/10'
            const qualityText = !hasData ? 'text-foreground/40' : isGood ? 'text-primary' : isMedium ? 'text-secondary' : 'text-destructive'
            const qualityIconBg = !hasData ? 'bg-foreground/10' : isGood ? 'bg-success/20' : isMedium ? 'bg-warning/20' : 'bg-destructive/15'
            const optimalCount = activeSensors.filter(s => s.statusColor === 'green').length

            return (
              <div className="space-y-3 mb-4">
                <div
                  className="group bg-surface-sage rounded-2xl p-5 flex items-center gap-4 cursor-pointer border border-white/70 transition-all duration-300 neu-raised hover:-translate-y-0.5 hover:bg-surface-leaf-soft neu-raised-hover"
                  style={{ "--accent": qualityColor } as CSSProperties}
                >
                  <div
                    className={cn(
                      'flex h-12 w-12 items-center justify-center rounded-full shrink-0 transition-all duration-300',
                      qualityIconBg,
                      'neu-inset',
                      'neu-icon-raise group-hover:bg-(--accent)'
                    )}
                  >
                    <Shield className={cn('h-6 w-6 transition-colors duration-300 group-hover:text-white', qualityText)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-bold text-sm md:text-base text-foreground">
                        {t('home.landQuality', 'Kualitas Lahan')}
                      </p>
                      <span
                        className={cn('text-[10px] md:text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full neu-badge-inset', qualityBg, qualityText)}
                      >
                        {qualityLabel}
                      </span>
                    </div>
                    <div
                      className="w-full h-2.5 rounded-full bg-surface-muted/60 overflow-hidden neu-progress-track"
                    >
                      <div
                        className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{
                          width: `${hasData ? totalScore : 0}%`,
                          background: `linear-gradient(90deg, ${qualityColor}cc, ${qualityColor})`,
                          boxShadow: `0 0 8px ${qualityColor}40`
                        }}
                      />
                    </div>
                    <p className="text-[10px] md:text-xs text-foreground/50 mt-1.5">
                      {optimalCount}/{activeSensors.length} {t('home.parameterOptimal', 'parameter dalam kondisi optimal')}
                    </p>
                  </div>
                  <div className="text-right shrink-0 pl-3">
                    <span className="text-3xl md:text-4xl font-bold" style={{ color: qualityColor }}>{hasData ? totalScore : '—'}</span>
                    <p className="text-[10px] md:text-xs text-foreground/40 font-medium">{t('home.score', 'Skor')}</p>
                  </div>
                </div>
              </div>
            )
          })()}

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {sensors.map((sensor) => {
              const style = statusStyles[sensor.statusColor]
              const isDisabled = sensor.disabled === true
              return (
                <div
                  key={sensor.id}
                  style={{ "--accent": "#006c49" } as CSSProperties}
                  className={cn(
                    "relative bg-surface-sage rounded-2xl p-5 flex flex-col border border-white/70 transition-all duration-300",
                    "neu-raised",
                    isDisabled
                      ? "opacity-60 cursor-default"
                      : "group cursor-pointer hover:-translate-y-0.5 neu-raised-hover hover:bg-surface-leaf-soft"
                  )}
                >
                  {/* Icon + Status Row */}
                  <div className="flex items-start justify-between mb-4">
                    {/* Logo & hover hijau primary seragam (sama seperti Soil pH di Monitoring) */}
                    <div
                      className={cn(
                        "flex h-11 w-11 items-center justify-center rounded-full transition-all duration-300",
                        isDisabled ? "bg-foreground/8" : "bg-success/20",
                        "neu-inset",
                        !isDisabled && "neu-icon-raise group-hover:bg-(--accent)"
                      )}
                    >
                      <sensor.icon className={cn("h-6 w-6 transition-colors duration-300", isDisabled ? "text-foreground/30" : "text-primary group-hover:text-white")} />
                    </div>
                    <span
                      className={cn(
                        "text-[10px] md:text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full",
                        isDisabled
                          ? "bg-foreground/8 text-foreground/35 neu-badge-inset-light"
                          : cn("neu-badge-inset-light", style.bg, style.text)
                      )}
                    >
                      {isDisabled
                        ? t('home.status_nonaktif', 'Nonaktif')
                        : t(`home.status_${sensor.statusKey}`, sensor.statusKey.charAt(0).toUpperCase() + sensor.statusKey.slice(1))}
                    </span>
                  </div>
                  {/* Label */}
                  <p className={cn("text-xs md:text-sm font-medium mb-1", isDisabled ? "text-foreground/40" : "text-foreground/60")}>
                    {t(`home.${sensor.nameKey}`)}
                  </p>
                  {/* Value — NPK shows N/P/K; others show converted value + preferred unit */}
                  {sensor.npk ? (
                    <div className="flex items-end justify-between gap-1 mt-0.5">
                      {[
                        { key: "N", val: sensor.npk.n, color: "#006c49" },
                        { key: "P", val: sensor.npk.p, color: "#795900" },
                        { key: "K", val: sensor.npk.k, color: "#446900" },
                      ].map((row) => (
                        <div key={row.key} className="flex flex-col leading-none">
                          <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider mb-0.5" style={{ color: row.color }}>{row.key}</span>
                          <span className="text-lg md:text-xl font-bold text-foreground tabular-nums">{Math.round(convertValue(sensor.param, row.val))}</span>
                        </div>
                      ))}
                      <span className="text-[10px] md:text-xs font-medium text-foreground/40 pb-0.5">{getUnit(sensor.param)}</span>
                    </div>
                  ) : (
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl md:text-4xl font-bold text-foreground">{formatValue(sensor.param, sensor.value)}</span>
                      <span className="text-sm md:text-base text-foreground/40 font-medium">{sensor.param === 'ph' ? 'pH' : getUnit(sensor.param)}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Info Note */}
          <div
            className="bg-surface-sage rounded-2xl px-4 py-3 mt-4 flex items-start gap-2.5 border border-white/50 neu-inset-shallow"
          >
            <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-xs md:text-sm font-medium text-foreground/70">
                {sensors.filter(s => s.statusColor === 'green').length >= sensors.length
                  ? t('home.qualityNote_allGood', 'Semua parameter dalam batas aman')
                  : t('home.qualityNote_someIssue', 'Ada parameter di luar batas aman')}
              </p>
              <p className="text-[10px] md:text-xs text-foreground/40 mt-0.5">
                {t('home.qualityNoteRef', { count: activeSensors.length, defaultValue: `Berdasarkan analisis dari ${activeSensors.length} parameter sensor lahan` })}
              </p>
            </div>
          </div>
        </section>

        {/* ── Fokus Monitoring & Log Terbaru ── */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 my-8">
          {/* Card Fokus Monitoring (Donut Chart) */}
          <div className="col-span-12 lg:col-span-5 bg-surface-sage rounded-2xl p-5 border border-white/70 neu-raised flex flex-col">
            {/* Header */}
            <div className="flex items-start justify-between mb-1">
              <h3 className="text-base font-bold text-foreground">
                {t("home.focusMonitoring", "Fokus Monitoring")}
              </h3>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary neu-badge-inset-light">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                </span>
                Live
              </span>
            </div>
            <p className="text-xs text-foreground/50 mb-4">
              {t("home.focusDesc", "Distribusi status kondisi sensor pertanian")}
            </p>

            {/* Donut + Legend */}
            <div className="flex flex-1 flex-col items-center justify-center gap-5 py-1 sm:flex-row sm:justify-between">
              {/* Donut */}
              <div className="relative grid h-36 w-36 shrink-0 place-items-center rounded-full bg-surface-sage neu-inset">
                <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90 overflow-visible">
                  {/* Track ring */}
                  <circle cx="50" cy="50" r={DONUT_RADIUS} fill="none" stroke="rgba(143,139,120,0.18)" strokeWidth={DONUT_STROKE} />
                  {/* Status segments */}
                  {donutSegments.map((seg) => {
                    if (seg.count === 0) return null
                    const isActive = activeSegment?.key === seg.key
                    const isDimmed = activeSegment !== null && !isActive
                    return (
                      <circle
                        key={seg.key}
                        cx="50"
                        cy="50"
                        r={DONUT_RADIUS}
                        fill="none"
                        stroke={seg.color}
                        strokeWidth={isActive ? DONUT_STROKE_HOVER : DONUT_STROKE}
                        strokeDasharray={seg.dashArray}
                        strokeDashoffset={seg.dashOffset}
                        strokeLinecap="round"
                        className="cursor-pointer transition-all duration-300"
                        style={{
                          opacity: isDimmed ? 0.35 : 1,
                          filter: isActive ? `drop-shadow(0 1px 3px ${seg.color}66)` : "none",
                        }}
                        onMouseEnter={() => setHoveredKey(seg.key)}
                        onMouseLeave={() => setHoveredKey(null)}
                      />
                    )
                  })}
                </svg>
                {/* Center label */}
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-5 text-center">
                  <span className="text-[9px] font-bold uppercase leading-tight tracking-wider text-foreground/45">
                    {activeSegment ? activeSegment.label : t("home.sensorCount", "Jumlah Sensor")}
                  </span>
                  <span
                    className="mt-1 text-3xl font-black leading-none tabular-nums transition-colors duration-300"
                    style={activeSegment ? { color: activeSegment.color } : undefined}
                  >
                    {activeSegment ? activeSegment.count : totalSensors}
                  </span>
                  <span className="mt-1 text-[9px] font-semibold text-foreground/40">
                    {activeSegment ? `${activeSegment.percentage}%` : t("home.pieTotal", "Total Aktif")}
                  </span>
                </div>
              </div>

              {/* Legend */}
              <ul className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[148px]">
                {donutSegments.map((seg) => {
                  const isActive = activeSegment?.key === seg.key
                  return (
                    <li key={seg.key}>
                      <button
                        type="button"
                        onMouseEnter={() => setHoveredKey(seg.key)}
                        onMouseLeave={() => setHoveredKey(null)}
                        onFocus={() => setHoveredKey(seg.key)}
                        onBlur={() => setHoveredKey(null)}
                        aria-label={`${seg.label}: ${seg.count} sensor (${seg.percentage}%)`}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                          isActive ? "border-white/80 bg-white/50 shadow-sm" : "border-transparent hover:bg-white/25"
                        )}
                      >
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: seg.color }} />
                        <span className="flex-1 text-xs font-semibold text-foreground/80">{seg.label}</span>
                        <span className="text-sm font-bold text-foreground tabular-nums">{seg.count}</span>
                        <span className="w-8 text-right text-[10px] font-medium text-foreground/40 tabular-nums">{seg.percentage}%</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>

            {/* Footer summary */}
            <div className="mt-4 border-t border-white/30 pt-3.5">
              <p className="flex items-center justify-center gap-1.5 text-xs font-semibold text-foreground/70">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                {t("home.pieSummary", "{{optimal}} dari {{total}} sensor dalam kondisi optimal", { optimal: optimalCount, total: activeSensors.length })}
              </p>
              <p className="mt-1 text-center text-[10px] italic text-foreground/40">
                {t("home.pieInsight", "* Arahkan kursor ke grafik/legenda untuk detail")}
              </p>
            </div>
          </div>

          {/* Card Log Pembacaan Terbaru */}
          <div className="col-span-12 lg:col-span-7 bg-surface-sage rounded-2xl p-5 border border-white/70 neu-raised flex flex-col">
            {/* Header */}
            <div className="flex items-start justify-between mb-1">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <History className="h-4 w-4 text-primary" />
                {t("home.recentLogs", "Log Pembacaan Terbaru")}
              </h3>
              <div className="flex items-center gap-2 rounded-full neu-inset-shallow px-2.5 py-1">
                <span className="relative flex h-1.5 w-1.5">
                  {isConnected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />}
                  <span className={cn("relative inline-flex h-full w-full rounded-full", isConnected ? "bg-success shadow-[0_0_8px_rgba(16,185,129,0.8)]" : "bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.8)]")} />
                </span>
                <span className={cn("text-[10px] font-bold uppercase tracking-wider", isConnected ? "text-success" : "text-destructive/80")}>
                  {isConnected ? "Real-time" : "Offline"}
                </span>
              </div>
            </div>
            <p className="text-xs text-foreground/50 mb-4">
              {t("home.recentLogsDesc", "Riwayat aktivitas dan pembacaan sensor langsung")}
            </p>

            <div className="flex-1 space-y-2.5 overflow-y-auto pr-1">
              {historyLoading ? (
                <LoadingState title={t('home.logsLoading', 'Memuat log...')} />
              ) : historyError ? (
                <EmptyState icon={<History width={30} height={30} />} title={t('home.logsErrorTitle', 'Gagal Memuat Data')} description={t('home.logsErrorDesc', 'Gagal mengambil log terbaru dari server')} className="py-6 border-none bg-transparent" />
              ) : !historyData?.data || historyData.data.length === 0 ? (
                <EmptyState icon={<History width={30} height={30} />} title={t('home.logsEmptyTitle', 'Belum ada aktivitas')} description={t('home.logsEmptyDesc', 'Tidak ada aktivitas log terbaru')} className="py-6 border-none bg-transparent" />
              ) : historyData.data.map((log: any, index: number) => {
                // Determine what changed based on real logic or just mapping
                // Since this is generic history, let's just map it to an icon
                return (
                  <div
                    key={log.id}
                    className={cn(
                      "group/log relative flex gap-3 rounded-xl border bg-white/20 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] transition-all duration-300 hover:-translate-x-0.5 hover:bg-white/50",
                      index === 0 ? "border-white/70 ring-1 ring-primary/15" : "border-white/50"
                    )}
                    style={{ borderLeft: `4px solid #10b981` }}
                  >
                    <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl neu-inset-shallow transition-transform group-hover/log:scale-105", "bg-success/10")}>
                      <Activity className="h-4.5 w-4.5" style={{ color: "#10b981" }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-0.5 flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <p className="truncate text-xs md:text-sm font-bold text-foreground">
                            {t('home.logUpdateTitle', 'Pembaruan Sensor')}
                          </p>
                          {index === 0 && (
                            <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-primary">
                              {t("home.logsNew", "Baru")}
                            </span>
                          )}
                        </div>
                        <span className="shrink-0 whitespace-nowrap text-[9px] font-medium text-foreground/35">
                          {new Date(log.sent_at ?? log.captured_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-[10px] md:text-xs leading-normal text-foreground/50 line-clamp-1 transition-all duration-200 group-hover/log:line-clamp-none">
                        {t('home.logUpdateDesc', { device: log.device?.name || t('home.devicePlaceholder', 'Perangkat'), ph: log.ph_level ?? '—', temp: log.soil_temperature ?? '—', defaultValue: 'Tercatat data sensor terbaru dari {{device}}. pH: {{ph}}, Suhu: {{temp}}°C.' })}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Footer link → full history */}
            <Link
              href="/monitoring"
              className="mt-3 flex items-center justify-center gap-1 rounded-xl border border-white/50 bg-white/20 py-2 text-xs font-semibold text-primary transition-all duration-200 hover:bg-white/45"
            >
              {t("home.logsViewAll", "Lihat semua di Monitoring")}
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </section>


        {/* ── Perangkat IoT ── */}
        <section>
          <h2 className="text-lg md:text-xl font-semibold text-foreground mb-1 flex items-center gap-2">
            <Router className="h-5 w-5 md:h-6 md:w-6 text-primary" />
            {t('home.iotHardware', 'Perangkat IoT')}
          </h2>
          <p className="text-xs md:text-sm text-foreground/50 mb-4">{t('home.iotDesc', 'Status perangkat terhubung')}</p>
          <div
            className="rounded-2xl bg-surface-sage overflow-hidden border border-white/70 neu-raised-lg"
          >
            <div>
              {devicesLoading ? (
                <div className="py-8"><LoadingState title={t('home.devicesLoading', 'Memuat perangkat...')} /></div>
              ) : !devicesData || devicesData.length === 0 ? (
                <EmptyState icon={<Router width={30} height={30} />} title={t('home.devicesEmptyTitle', 'Belum ada perangkat')} description={t('home.devicesEmptyDesc', 'Tambahkan perangkat IoT untuk memonitor')} className="py-8 border-none bg-transparent" />
              ) : (
                devicesData.map((device: any) => (
                  <div
                    key={device.id}
                    className={cn(
                      "flex items-center justify-between p-4 md:p-5 transition-all duration-200 cursor-pointer group neu-device-hover",
                      device.status === "online" ? "hover:bg-success/8" :
                      device.status === "warning" ? "hover:bg-warning/8" :
                      "hover:bg-foreground/5"
                    )}
                    style={{ borderBottom: '1px solid rgba(163,158,140,0.15)' }}
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div
                        className={cn(
                          "flex h-11 w-11 items-center justify-center rounded-full shrink-0 transition-colors neu-inset-shallow",
                          device.status === "online" ? "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white" :
                          device.status === "warning" ? "bg-warning/15 text-secondary group-hover:bg-secondary group-hover:text-white" :
                          "bg-surface-muted text-foreground/40 group-hover:bg-foreground/20 group-hover:text-foreground/60"
                        )}
                      >
                        {device.type === "pump" && <Droplet className="h-5 w-5" />}
                        {device.type === "sensor" && <Activity className="h-5 w-5" />}
                        {device.type === "camera" && <Camera className="h-5 w-5" />}
                      </div>
                      <div className="min-w-0">
                        <p className={cn(
                          "font-semibold text-sm md:text-base truncate",
                          device.status === "offline" ? "text-foreground/40" : "text-foreground"
                        )}>{device.name}</p>
                        <p className="text-xs md:text-sm text-foreground/50">#{device.code}</p>
                        {device.warning_message && (
                          <p className="text-[10px] md:text-xs text-secondary mt-0.5 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> {device.warning_message}
                          </p>
                        )}
                      </div>
                    </div>
                    <div
                      className={cn(
                        "flex items-center gap-1.5 shrink-0 ml-3 px-3 py-1.5 rounded-full text-xs md:text-sm font-semibold capitalize neu-inset-shallow",
                        device.status === "online" ? "bg-success/15 text-primary" :
                        device.status === "warning" ? "bg-warning/15 text-secondary" :
                        "bg-foreground/8 text-foreground/40"
                      )}
                    >
                      <div className={cn(
                        "h-2 w-2 rounded-full shrink-0",
                        device.status === "online" ? "bg-success shadow-[0_0_8px_rgba(16,185,129,0.8)]" :
                        device.status === "warning" ? "bg-warning shadow-[0_0_8px_rgba(249,189,34,0.8)] animate-pulse" :
                        "bg-foreground/25 shadow-inner"
                      )} />
                      {t(`home.status_${device.status}`, device.status) as string}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

      </div>
    </div>
  )
}
