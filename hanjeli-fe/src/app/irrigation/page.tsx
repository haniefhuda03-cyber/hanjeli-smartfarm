"use client"

import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import {
  Droplet,
  Clock,
  Settings,
  Calendar,
  Zap,
  Timer,
  ToggleRight,
  AlertOctagon,
  ShieldAlert,
  Plus,
  Minus,
  Trash2,
  X,
  Leaf,
  Sprout,
  Flower2,
  History,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Switch } from "@/components/ui/switch"
import { useNotifications } from "@/contexts/notification-context"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/api/query-keys"
import { irrigationApi } from "@/lib/api/irrigation"
import { preferencesApi } from "@/lib/api/preferences"
import { useIrrigationSocket } from '@/hooks/useIrrigationSocket'
import { LoadingState } from "@/components/ui-states/loading-state"
import { EmptyState } from "@/components/ui-states/empty-state"
// Modal di-portal ke <body>: kartu <main> dashboard memakai backdrop-filter yang
// menjebak elemen `fixed` di dalam area scroll, membuat modal ikut ter-scroll.
import { ModalPortal } from "@/components/modal-portal"

const daysOfWeek = [
  { id: 'mon' }, { id: 'tue' }, { id: 'wed' }, { id: 'thu' }, { id: 'fri' }, { id: 'sat' }, { id: 'sun' },
]

type ScheduleEntry = {
  id: number
  name: string
  days: string[]
  startTime: string
  endTime: string
  active?: boolean
}

const DEFAULT_WATER_MIN_THRESHOLD = 30
const DEFAULT_WATER_MAX_THRESHOLD = 80
const DEFAULT_NUTRIENT_MIN_THRESHOLD = 20
const DEFAULT_NUTRIENT_MAX_THRESHOLD = 60

type ThresholdRangeControlProps = {
  title: string
  description: string
  icon: LucideIcon
  minValue: number
  maxValue: number
  unit: string
  upperBound: number
  onMinChange: (value: number) => void
  onMaxChange: (value: number) => void
}

function normalizeRangeNumber(value: unknown, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function ThresholdRangeControl({
  title,
  description,
  icon: Icon,
  minValue,
  maxValue,
  unit,
  upperBound,
  onMinChange,
  onMaxChange,
}: ThresholdRangeControlProps) {
  const applyMin = (value: number) => {
    onMinChange(Math.max(0, Math.min(value, maxValue - 1)))
  }

  const applyMax = (value: number) => {
    onMaxChange(Math.min(upperBound, Math.max(value, minValue + 1)))
  }

  return (
    <div className="rounded-2xl border border-white/60 bg-surface-sage p-3 neu-raised">
      <div className="mb-3 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-transparent neu-inset">
          <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground">{title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-foreground/60">{description}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="min-w-0">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-foreground/50">
            Min
          </p>
          <div className="flex h-11 items-center overflow-hidden rounded-2xl border border-white/60 bg-surface-sage neu-inset">
            <button
              type="button"
              onClick={() => applyMin(minValue - 1)}
              aria-label={`${title} min -1`}
              className="flex h-11 w-9 shrink-0 items-center justify-center text-foreground/50 transition-all duration-200 hover:bg-primary/20 hover:text-primary active:scale-90"
            >
              <Minus className="h-4 w-4" aria-hidden="true" />
            </button>
            <input
              type="number"
              min={0}
              max={maxValue - 1}
              value={minValue}
              onChange={(event) => applyMin(normalizeRangeNumber(event.target.value, minValue))}
              aria-label={`${title} minimum`}
              className="h-11 min-w-0 flex-1 bg-transparent px-1 text-center text-sm font-bold text-foreground focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <button
              type="button"
              onClick={() => applyMin(minValue + 1)}
              aria-label={`${title} min +1`}
              className="flex h-11 w-9 shrink-0 items-center justify-center text-foreground/50 transition-all duration-200 hover:bg-primary/20 hover:text-primary active:scale-90"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="min-w-0">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-foreground/50">
            Max
          </p>
          <div className="flex h-11 items-center overflow-hidden rounded-2xl border border-white/60 bg-surface-sage neu-inset">
            <button
              type="button"
              onClick={() => applyMax(maxValue - 1)}
              aria-label={`${title} max -1`}
              className="flex h-11 w-9 shrink-0 items-center justify-center text-foreground/50 transition-all duration-200 hover:bg-primary/20 hover:text-primary active:scale-90"
            >
              <Minus className="h-4 w-4" aria-hidden="true" />
            </button>
            <input
              type="number"
              min={minValue + 1}
              max={upperBound}
              value={maxValue}
              onChange={(event) => applyMax(normalizeRangeNumber(event.target.value, maxValue))}
              aria-label={`${title} maximum`}
              className="h-11 min-w-0 flex-1 bg-transparent px-1 text-center text-sm font-bold text-foreground focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <button
              type="button"
              onClick={() => applyMax(maxValue + 1)}
              aria-label={`${title} max +1`}
              className="flex h-11 w-9 shrink-0 items-center justify-center text-foreground/50 transition-all duration-200 hover:bg-primary/20 hover:text-primary active:scale-90"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      <p className="mt-2 rounded-xl bg-primary/10 px-3 py-2 text-center text-xs font-bold text-primary">
        {minValue}-{maxValue} {unit}
      </p>
    </div>
  )
}

export default function IrrigationPage() {
  const { t } = useTranslation()
  const { addNotification } = useNotifications()

  const { data: configData, isFetching: isConfigFetching } = useQuery({
    queryKey: queryKeys.irrigation.config,
    queryFn: irrigationApi.getConfig,
    // KRITIS (safety): selalu ambil status darurat terbaru dari server setiap
    // kali halaman dibuka — cache lama bisa "lupa" mode darurat setelah pindah
    // page. Kontrol dikunci sampai status ini benar-benar tersinkron.
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })
  
  const { data: preferencesData } = useQuery({
    queryKey: queryKeys.preferences.all,
    queryFn: preferencesApi.getPreferences
  })

  const moistureUnit = preferencesData?.units?.find((u: any) => u.parameter_key === 'soil_moisture')?.unit_value || '%'
  const npkUnit = preferencesData?.units?.find((u: any) => u.parameter_key === 'soil_npk')?.unit_value || 'mg/kg'
  
  const { data: schedulesData } = useQuery({
    queryKey: queryKeys.irrigation.schedules,
    queryFn: irrigationApi.getSchedules
  })

  const queryClient = useQueryClient()

  const createScheduleMutation = useMutation({
    mutationFn: irrigationApi.createSchedule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.irrigation.schedules })
      addNotification({ type: 'success', title: 'Jadwal penyiraman berhasil ditambahkan' })
    },
    onError: () => addNotification({ type: 'error', title: 'Gagal menambahkan jadwal' })
  })

  const updateScheduleMutation = useMutation({
    mutationFn: irrigationApi.updateSchedule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.irrigation.schedules })
      addNotification({ type: 'success', title: 'Jadwal penyiraman diperbarui' })
    },
    onError: () => addNotification({ type: 'error', title: 'Gagal memperbarui jadwal' })
  })

  const deleteScheduleMutation = useMutation({
    mutationFn: irrigationApi.deleteSchedule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.irrigation.schedules })
      addNotification({ type: 'success', title: 'Jadwal penyiraman dihapus' })
    },
    onError: () => addNotification({ type: 'error', title: 'Gagal menghapus jadwal' })
  })

  const updateConfigMutation = useMutation({
    mutationFn: irrigationApi.updateConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.irrigation.config })
      addNotification({ type: 'success', title: 'Konfigurasi irigasi diperbarui' })
    },
    onError: () => addNotification({ type: 'error', title: 'Gagal memperbarui konfigurasi' })
  })

  const { data: activityData, isLoading: activityLoading } = useQuery({
    queryKey: queryKeys.irrigation.activity({ limit: 5 }),
    queryFn: () => irrigationApi.getActivity({ limit: 5 }),
    refetchInterval: 60000
  })

  const {
    irrigationStatus,
    setMode,
    triggerEmergencyStop,
    resumeSystem,
    toggleManual
  } = useIrrigationSocket()

  const [autoMode, setAutoMode] = useState(false)
  const [manualMode, setManualMode] = useState(false)
  const [scheduledMode, setScheduledMode] = useState(false)
  const [emergencyStop, setEmergencyStop] = useState(false)

  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [activeSettingsTab, setActiveSettingsTab] = useState<'auto' | 'scheduled' | 'manual'>('auto')
  const [manualSpeed, setManualSpeed] = useState(100) // Frozen at 100 — PWM not available yet
  const [fertilizerManualSpeed, setFertilizerManualSpeed] = useState(100)
  const [manualWaterEnabled, setManualWaterEnabled] = useState(false)
  const [manualFertilizerEnabled, setManualFertilizerEnabled] = useState(false)
  const [scheduledBehavior, setScheduledBehavior] = useState<'manual' | 'auto'>('manual')

  const [waterMinThreshold, setWaterMinThreshold] = useState(DEFAULT_WATER_MIN_THRESHOLD)
  const [waterMaxThreshold, setWaterMaxThreshold] = useState(DEFAULT_WATER_MAX_THRESHOLD)
  const [nitrogenMinThreshold, setNitrogenMinThreshold] = useState(DEFAULT_NUTRIENT_MIN_THRESHOLD)
  const [nitrogenMaxThreshold, setNitrogenMaxThreshold] = useState(DEFAULT_NUTRIENT_MAX_THRESHOLD)
  const [phosphorusMinThreshold, setPhosphorusMinThreshold] = useState(DEFAULT_NUTRIENT_MIN_THRESHOLD)
  const [phosphorusMaxThreshold, setPhosphorusMaxThreshold] = useState(DEFAULT_NUTRIENT_MAX_THRESHOLD)
  const [potassiumMinThreshold, setPotassiumMinThreshold] = useState(DEFAULT_NUTRIENT_MIN_THRESHOLD)
  const [potassiumMaxThreshold, setPotassiumMaxThreshold] = useState(DEFAULT_NUTRIENT_MAX_THRESHOLD)

  useEffect(() => {
    if (irrigationStatus) {
      setAutoMode(irrigationStatus.mode === 'auto')
      setManualMode(irrigationStatus.mode === 'manual')
      setScheduledMode(irrigationStatus.mode === 'scheduled')
      setEmergencyStop(irrigationStatus.emergency)
      setManualSpeed(irrigationStatus.speed || 100)
      setFertilizerManualSpeed(irrigationStatus.fertilizer_speed ?? 100)
      setManualWaterEnabled(irrigationStatus.manual_water_enabled ?? false)
      setManualFertilizerEnabled(irrigationStatus.manual_fertilizer_enabled ?? false)
    } else if (configData) {
      setAutoMode(configData.active_mode === 'auto')
      setManualMode(configData.active_mode === 'manual')
      setScheduledMode(configData.active_mode === 'scheduled')
      setEmergencyStop(configData.emergency_stop)
      setManualSpeed(configData.manual_speed || 100)
      setFertilizerManualSpeed(configData.fertilizer_manual_speed || 100)
      setManualWaterEnabled(configData.manual_water_enabled ?? false)
      setManualFertilizerEnabled(configData.manual_fertilizer_enabled ?? false)
    }
  }, [irrigationStatus, configData])

  useEffect(() => {
    if (configData) {
      setWaterMinThreshold(normalizeRangeNumber(
        configData.water_min_threshold ?? configData.auto_threshold_value,
        DEFAULT_WATER_MIN_THRESHOLD,
      ))
      setWaterMaxThreshold(normalizeRangeNumber(configData.water_max_threshold, DEFAULT_WATER_MAX_THRESHOLD))
      setNitrogenMinThreshold(normalizeRangeNumber(configData.nitrogen_min_threshold, DEFAULT_NUTRIENT_MIN_THRESHOLD))
      setNitrogenMaxThreshold(normalizeRangeNumber(configData.nitrogen_max_threshold, DEFAULT_NUTRIENT_MAX_THRESHOLD))
      setPhosphorusMinThreshold(normalizeRangeNumber(configData.phosphorus_min_threshold, DEFAULT_NUTRIENT_MIN_THRESHOLD))
      setPhosphorusMaxThreshold(normalizeRangeNumber(configData.phosphorus_max_threshold, DEFAULT_NUTRIENT_MAX_THRESHOLD))
      setPotassiumMinThreshold(normalizeRangeNumber(configData.potassium_min_threshold, DEFAULT_NUTRIENT_MIN_THRESHOLD))
      setPotassiumMaxThreshold(normalizeRangeNumber(configData.potassium_max_threshold, DEFAULT_NUTRIENT_MAX_THRESHOLD))
      setManualWaterEnabled(configData.manual_water_enabled ?? false)
      setManualFertilizerEnabled(configData.manual_fertilizer_enabled ?? false)
      setFertilizerManualSpeed(normalizeRangeNumber(configData.fertilizer_manual_speed, 100))
      if (configData.scheduled_behavior) setScheduledBehavior(configData.scheduled_behavior)
    }
  }, [configData])

  const [schedules, setSchedules] = useState<ScheduleEntry[]>([
    { id: 1, name: 'Penyiraman Pagi', days: ['mon', 'wed', 'fri'], startTime: '06:00', endTime: '06:30', active: true }
  ])

  useEffect(() => {
    if (schedulesData && Array.isArray(schedulesData)) {
      setSchedules(schedulesData)
    }
  }, [schedulesData])

  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false)
  const [editingScheduleId, setEditingScheduleId] = useState<number | null>(null)
  const [isAddingNew, setIsAddingNew] = useState(false)
  const [pendingSchedule, setPendingSchedule] = useState<ScheduleEntry | null>(null)

  const openScheduleModal = (id?: number) => {
    if (id !== undefined) {
      // Edit existing
      const existing = schedules.find(s => s.id === id)
      setEditingScheduleId(id)
      setIsAddingNew(false)
      setPendingSchedule(existing ? { ...existing } : null)
      setIsScheduleModalOpen(true)
    } else {
      // Add new - don't add to schedules yet
      const newId = schedules.length > 0 ? Math.max(...schedules.map(s => s.id)) + 1 : 1
      const newSchedule: ScheduleEntry = { id: newId, name: `Jadwal ${newId}`, days: [], startTime: '07:00', endTime: '07:30', active: true }
      setPendingSchedule(newSchedule)
      setEditingScheduleId(newId)
      setIsAddingNew(true)
      setIsScheduleModalOpen(true)
    }
  }

  const closeScheduleModal = () => {
    // If adding new and not saved, discard
    setPendingSchedule(null)
    setIsAddingNew(false)
    setEditingScheduleId(null)
    setIsScheduleModalOpen(false)
  }

  const saveSchedule = () => {
    if (isAddingNew && pendingSchedule) {
      createScheduleMutation.mutate({
        name: pendingSchedule.name,
        days: pendingSchedule.days,
        startTime: pendingSchedule.startTime,
        endTime: pendingSchedule.endTime,
        active: pendingSchedule.active
      })
    } else if (editingScheduleId !== null && pendingSchedule) {
      updateScheduleMutation.mutate({
        id: String(editingScheduleId),
        data: {
          name: pendingSchedule.name,
          days: pendingSchedule.days,
          startTime: pendingSchedule.startTime,
          endTime: pendingSchedule.endTime,
          active: pendingSchedule.active
        }
      })
    }
    setPendingSchedule(null)
    setIsAddingNew(false)
    setEditingScheduleId(null)
    setIsScheduleModalOpen(false)
  }

  // Activity data fetched via SWR

  // Status sistem baru dianggap "diketahui" bila ada status realtime (socket)
  // ATAU config yang sudah selesai di-fetch (bukan cache basi yang masih
  // divalidasi setelah pindah page). Selama belum diketahui, kontrol DIKUNCI —
  // ini menutup celah "mode darurat sempat hilang lalu irigasi bisa dinyalakan".
  const systemStateKnown = irrigationStatus != null || (configData != null && !isConfigFetching)
  const controlsLocked = emergencyStop || !systemStateKnown

  const handleModeChange = (mode: 'auto' | 'scheduled' | 'manual', checked: boolean) => {
    if (controlsLocked) return
    if (checked) {
      setMode(mode, mode === 'manual' ? {
        manual_speed: manualSpeed,
        fertilizer_manual_speed: fertilizerManualSpeed,
        manual_water_enabled: manualFertilizerEnabled ? false : manualWaterEnabled,
        manual_fertilizer_enabled: manualFertilizerEnabled,
      } : mode === 'auto' ? {
        water_min_threshold: waterMinThreshold,
        water_max_threshold: waterMaxThreshold,
        nitrogen_min_threshold: nitrogenMinThreshold,
        nitrogen_max_threshold: nitrogenMaxThreshold,
        phosphorus_min_threshold: phosphorusMinThreshold,
        phosphorus_max_threshold: phosphorusMaxThreshold,
        potassium_min_threshold: potassiumMinThreshold,
        potassium_max_threshold: potassiumMaxThreshold,
      } : undefined)
    } else {
      setManualWaterEnabled(false)
      setManualFertilizerEnabled(false)
      setMode('off', {
        manual_water_enabled: false,
        manual_fertilizer_enabled: false,
      })
    }
  }

  const handleManualWaterToggle = (checked: boolean) => {
    if (controlsLocked) return
    if (checked) {
      setManualFertilizerEnabled(false)
    }

    setManualWaterEnabled(checked)
    if (manualMode) {
      toggleManual(checked, checked ? manualSpeed : 0, 'water')
    }
  }

  const handleManualFertilizerToggle = (checked: boolean) => {
    if (controlsLocked) return
    if (checked) {
      setManualWaterEnabled(false)
    }

    setManualFertilizerEnabled(checked)
    if (manualMode) {
      toggleManual(checked, checked ? fertilizerManualSpeed : 0, 'fertilizer')
    }
  }

  const toggleDay = (scheduleId: number, dayId: string) => {
    setPendingSchedule(prev => prev ? { ...prev, days: prev.days.includes(dayId) ? prev.days.filter(d => d !== dayId) : [...prev.days, dayId] } : null)
  }

  const updateSchedule = (scheduleId: number, field: keyof ScheduleEntry, value: string) => {
    setPendingSchedule(prev => prev ? { ...prev, [field]: value } : null)
  }

  const addSchedule = () => {
    openScheduleModal()
  }

  const handleTimeChange = (scheduleId: number, field: 'startTime' | 'endTime', value: string) => {
    setPendingSchedule(prev => {
      if (!prev) return null;
      
      const newStart = field === 'startTime' ? value : prev.startTime;
      let newEnd = field === 'endTime' ? value : prev.endTime;

      if (field === 'startTime') {
        if (newEnd && newStart > newEnd) {
          newEnd = newStart;
        }
      } else if (field === 'endTime') {
        if (newStart && newEnd < newStart) {
          newEnd = newStart;
        }
      }

      return { ...prev, startTime: newStart, endTime: newEnd };
    })
  }

  const formatSelectedDays = (selectedDays: string[], t: any) => {
    if (selectedDays.length === 0) return t('irrigation.noDaySelected', { defaultValue: 'Tak ada hari' });
    if (selectedDays.length === 7) return t('irrigation.allDays', { defaultValue: 'Semuanya' });

    const orderedIds = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    
    // Sort selected indices based on proper day order
    const indices = selectedDays
      .map(day => orderedIds.indexOf(day))
      .filter(idx => idx !== -1)
      .sort((a, b) => a - b);

    if (indices.length === 0) return '';

    const groups: number[][] = [];
    let currentGroup = [indices[0]];

    for (let i = 1; i < indices.length; i++) {
      if (indices[i] === indices[i - 1] + 1) {
        currentGroup.push(indices[i]);
      } else {
        groups.push(currentGroup);
        currentGroup = [indices[i]];
      }
    }
    groups.push(currentGroup);

    const parts = groups.map(g => {
      if (g.length > 2) {
        return `${t(`days.${orderedIds[g[0]]}`)}-${t(`days.${orderedIds[g[g.length - 1]]}`)}`;
      } else {
        return g.map(idx => t(`days.${orderedIds[idx]}`)).join(', ');
      }
    });

    return parts.join(', ');
  }

  const removeSchedule = (id: number) => {
    deleteScheduleMutation.mutate(String(id))
  }
  
  const handleEmergencyStop = () => { 
    triggerEmergencyStop();
  }

  const handleResumeSystem = () => {
    resumeSystem();
  }

  // Lock body scroll when settings or schedule modal is open
  useEffect(() => {
    const shouldLock = isSettingsOpen || isScheduleModalOpen
    document.documentElement.classList.toggle('modal-open', shouldLock)
    document.body.classList.toggle('modal-open', shouldLock)

    return () => {
      document.documentElement.classList.remove('modal-open')
      document.body.classList.remove('modal-open')
    }
  }, [isSettingsOpen, isScheduleModalOpen])

  return (
    <div className="relative min-h-screen w-full bg-page">
      {/* Header */}
      <div className="bg-linear-to-b from-surface-sage-soft to-surface-sage px-5 md:px-6 lg:px-8 pt-14 lg:pt-6 pb-4 sticky top-0 z-30 neu-header border-b border-white/50">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold bg-linear-to-r from-primary to-foreground bg-clip-text text-transparent font-(family-name:--font-jakarta)">{t('irrigation.title')}</h1>
            <p className="text-sm md:text-base text-foreground/50 font-medium tracking-wide">{t('irrigation.subtitle')}</p>
          </div>
          <button
            onClick={() => { setActiveSettingsTab('auto'); setIsSettingsOpen(true) }}
            aria-label={t('irrigation.settingsTitle')}
            className="flex h-10 w-10 md:h-11 md:w-11 items-center justify-center rounded-full bg-surface-muted neu-inset-deep transition-all duration-300 hover:bg-primary hover:text-white hover:neu-btn-primary active:scale-90 active:bg-primary-shade [&:hover_svg]:text-white"
          >
            <Settings className="h-5 w-5 text-primary" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="px-5 md:px-6 lg:px-8 pt-4 pb-28 lg:pb-8">
        {/* Emergency Banner — neumorphic card with dramatic red effect */}
        {emergencyStop && (
          <div
            role="alert"
            aria-live="assertive"
            className="relative rounded-2xl bg-surface-sage p-5 md:p-6 mb-6 border-2 border-destructive/25 overflow-hidden neu-raised-lg"
          >
            {/* Red accent bar on top */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-destructive via-red-500 to-destructive animate-pulse" />
            <div className="flex items-center gap-4 mb-4 mt-1">
              <div
                className="relative flex h-12 w-12 items-center justify-center rounded-full bg-destructive/12 shrink-0 neu-inset-shallow"
              >
                <ShieldAlert className="h-6 w-6 text-destructive animate-pulse" />
                <span className="absolute -top-1 -right-1 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-destructive"></span></span>
              </div>
              <div className="flex-1">
                <p className="font-bold text-destructive text-sm md:text-base">{t('irrigation.emergencyActive')}</p>
                <p className="text-xs md:text-sm text-foreground/50">{t('irrigation.emergencyDesc')}</p>
              </div>
              <span
                className="px-3 py-1.5 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-wider bg-destructive/12 text-destructive shrink-0 animate-pulse neu-badge-inset"
              >
                DARURAT
              </span>
            </div>
            <button onClick={handleResumeSystem} aria-label={t('irrigation.resumeSystem')} className="w-full rounded-2xl bg-primary py-3 text-sm md:text-base font-bold text-white transition-all active:scale-[0.98] hover:bg-primary-dark neu-btn-resume">{t('irrigation.resumeSystem')}</button>
          </div>
        )}

        {/* Irrigation Cards Header + Emergency Button */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base md:text-lg font-semibold text-foreground flex items-center gap-2">
            <Droplet className="h-5 w-5 md:h-6 md:w-6 text-primary" />
            {t('irrigation.title')}
          </h2>
          {!emergencyStop && (
            <button 
              onClick={handleEmergencyStop} 
              aria-label={t('irrigation.emergencyStop')} 
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-destructive/10 text-destructive border border-destructive/30 shadow-[inset_0_0_10px_rgba(239,68,68,0.15),0_4px_12px_rgba(239,68,68,0.1)] backdrop-blur-sm text-xs md:text-sm font-bold transition-all duration-300 hover:bg-destructive/20 hover:shadow-[inset_0_0_15px_rgba(239,68,68,0.2),0_6px_15px_rgba(239,68,68,0.15)] active:scale-95"
            >
              <AlertOctagon className="h-4 w-4" aria-hidden="true" />
              <span>{t('irrigation.emergencyStop')}</span>
            </button>
          )}
        </div>

        {/* 3 Irrigation Mode Cards — Horizontal Grid.
            Dikunci saat mode darurat ATAU saat status sistem belum tersinkron
            (mencegah irigasi dinyalakan di celah sebelum status darurat termuat). */}
        <div className={cn("grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5 mb-6 transition-opacity", controlsLocked && "opacity-50 pointer-events-none")}>
          {/* Auto Irrigation Card */}
          <div className="group rounded-2xl bg-surface-sage p-5 flex flex-col border border-white/70 neu-raised transition-all duration-300 hover:-translate-y-1.5 hover:bg-surface-leaf neu-raised-hover">
            <div className="flex items-start justify-between mb-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-transparent neu-inset transition-all duration-300 group-hover:bg-primary neu-icon-raise">
                <Zap className="h-5 w-5 text-primary transition-colors duration-300 group-hover:text-white" />
              </div>
            </div>
            <h3 className="font-semibold text-foreground text-sm md:text-base mb-1">{t('irrigation.autoIrrigation')}</h3>
            <p className="text-xs text-foreground/60 mb-4 grow">{t('irrigation.autoDesc')}</p>
            <div className="flex items-center justify-between rounded-2xl bg-transparent neu-inset px-3 py-2.5">
              <span className={cn("text-[10px] md:text-xs font-bold uppercase tracking-wider", autoMode ? "text-primary" : "text-foreground/40")}>{autoMode ? t('irrigation.statusActive', { defaultValue: 'STATUS: ACTIVE' }) : t('irrigation.statusIdle', { defaultValue: 'STATUS: IDLE' })}</span>
              <Switch checked={autoMode} onCheckedChange={(checked: boolean) => handleModeChange('auto', checked)} className="data-[state=checked]:bg-primary" aria-label={t('irrigation.autoIrrigation')} />
            </div>
            {autoMode && (
              <div className="mt-3 flex items-center gap-2 rounded-2xl bg-primary/10 px-3 py-2">
                <Timer className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="text-[10px] md:text-xs text-primary">
                  {t('irrigation.rangeSummary', {
                    waterMin: waterMinThreshold,
                    waterMax: waterMaxThreshold,
                    nMin: nitrogenMinThreshold,
                    nMax: nitrogenMaxThreshold,
                    pMin: phosphorusMinThreshold,
                    pMax: phosphorusMaxThreshold,
                    kMin: potassiumMinThreshold,
                    kMax: potassiumMaxThreshold,
                  })}
                </span>
              </div>
            )}
          </div>

          {/* Scheduled Irrigation Card */}
          <div className="group rounded-2xl bg-surface-sage p-5 flex flex-col border border-white/70 neu-raised transition-all duration-300 hover:-translate-y-1.5 hover:bg-surface-leaf neu-raised-hover">
            <div className="flex items-start justify-between mb-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-transparent neu-inset transition-all duration-300 group-hover:bg-secondary neu-icon-raise">
                <Calendar className="h-5 w-5 text-secondary transition-colors duration-300 group-hover:text-white" />
              </div>
            </div>
            <h3 className="font-semibold text-foreground text-sm md:text-base mb-1">{t('irrigation.scheduledIrrigation')}</h3>
            <p className="text-xs text-foreground/60 mb-4 grow">{t('irrigation.scheduledDesc')}</p>
            <div className="flex items-center justify-between rounded-2xl bg-transparent neu-inset px-3 py-2.5">
              <span className={cn("text-[10px] md:text-xs font-bold uppercase tracking-wider", scheduledMode ? "text-secondary" : "text-foreground/40")}>{scheduledMode ? t('irrigation.statusActive', { defaultValue: 'STATUS: ACTIVE' }) : t('irrigation.statusIdle', { defaultValue: 'STATUS: IDLE' })}</span>
              <Switch checked={scheduledMode} onCheckedChange={(checked: boolean) => handleModeChange('scheduled', checked)} className="data-[state=checked]:bg-primary" aria-label={t('irrigation.scheduledIrrigation')} />
            </div>
            {scheduledMode && (
              <div className="mt-3 flex justify-end">
                <button onClick={() => openScheduleModal()} aria-label={t('irrigation.addSchedule', { defaultValue: 'Tambah Jadwal' })} className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-sage text-primary neu-inset-deep transition-all duration-200 hover:bg-primary/20 hover:text-primary-shade active:scale-90 active:bg-primary/30">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            )}
            {scheduledMode && schedules.length > 0 && (
              <div className="mt-3 space-y-2">
                {schedules.map((schedule) => (
                  <div key={schedule.id} onClick={() => openScheduleModal(schedule.id)} className="flex items-center justify-between rounded-2xl bg-transparent neu-inset px-3 py-2 cursor-pointer hover:bg-surface-leaf transition-all">
                    <div>
                      <p className="text-xs font-bold text-foreground">{schedule.startTime} - {schedule.endTime}</p>
                      <p className="text-[10px] text-foreground/50">{formatSelectedDays(schedule.days, t)}</p>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <Switch checked={schedule.active ?? false} onCheckedChange={(checked) => updateSchedule(schedule.id, 'active', checked as any)} className="data-[state=checked]:bg-primary scale-75" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Manual Irrigation Card */}
          <div className="group rounded-2xl bg-surface-sage p-5 flex flex-col border border-white/70 neu-raised transition-all duration-300 hover:-translate-y-1.5 hover:bg-surface-leaf neu-raised-hover">
            <div className="flex items-start justify-between mb-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-transparent neu-inset transition-all duration-300 group-hover:bg-primary neu-icon-raise">
                <ToggleRight className="h-5 w-5 text-primary transition-colors duration-300 group-hover:text-white" />
              </div>
            </div>
            <h3 className="font-semibold text-foreground text-sm md:text-base mb-1">{t('irrigation.manualIrrigation')}</h3>
            <p className="text-xs text-foreground/60 mb-4 grow">{t('irrigation.manualDesc')}</p>
            
            <div className="mt-auto flex flex-col gap-3">
              <div className="flex items-center justify-between rounded-2xl bg-transparent neu-inset px-3 py-2.5">
                <span className={cn("text-[10px] md:text-xs font-bold uppercase tracking-wider", manualMode ? "text-primary" : "text-foreground/40")}>
                  {manualMode ? t('irrigation.statusActive', { defaultValue: 'STATUS: ACTIVE' }) : t('irrigation.statusIdle', { defaultValue: 'STATUS: IDLE' })}
                </span>
                <Switch 
                  checked={manualMode} 
                  onCheckedChange={(checked: boolean) => handleModeChange('manual', checked)} 
                  className="data-[state=checked]:bg-primary" 
                  aria-label={t('irrigation.manualIrrigation')} 
                />
              </div>

              {/* Button "Siram Sekarang" removed per user request, switch handles state */}
            </div>
          </div>
        </div>

        {/* Recent Activity — IoT Device List Style */}
        <div className="mb-6">
          <h2 className="text-base md:text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <History className="h-5 w-5 md:h-6 md:w-6 text-primary" />
            {t('irrigation.recentActivity')}
          </h2>
          <div
            className="rounded-2xl bg-surface-sage overflow-hidden border border-white/70 neu-raised-lg"
          >
            <div>
              {activityLoading ? (
                <div className="py-8"><LoadingState title={t('irrigation.activityLoading', { defaultValue: 'Loading history...' }) as string} /></div>
              ) : !activityData?.data || activityData.data.length === 0 ? (
                <EmptyState icon={<History width={30} height={30} />} title={t('irrigation.noActivity', { defaultValue: 'No activity yet' }) as string} description={t('irrigation.noActivityDesc', { defaultValue: 'Activity logs will appear here' }) as string} className="py-8 border-none bg-transparent" />
              ) : (
                activityData.data.map((activity: any) => (
                  <div
                    key={activity.id}
                    className={cn(
                      "flex items-center justify-between p-4 md:p-5 transition-all duration-200 group neu-device-hover",
                      activity.type === "success" ? "hover:bg-success/8" :
                      activity.type === "info" ? "hover:bg-blue-500/5" :
                      "hover:bg-warning/8"
                    )}
                    style={{ borderBottom: '1px solid rgba(163,158,140,0.15)' }}
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div
                        className={cn(
                          "flex h-11 w-11 items-center justify-center rounded-full shrink-0 transition-colors neu-inset-shallow",
                          activity.type === "success" ? "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white" :
                          activity.type === "info" ? "bg-blue-500/10 text-blue-600 group-hover:bg-blue-600 group-hover:text-white" :
                          "bg-warning/15 text-secondary group-hover:bg-secondary group-hover:text-white"
                        )}
                      >
                        {activity.type === "success" ? <Droplet className="h-5 w-5" /> : activity.type === "info" ? <Clock className="h-5 w-5" /> : <AlertOctagon className="h-5 w-5" />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm md:text-base text-foreground truncate">{activity.description}</p>
                        <p className="text-xs md:text-sm text-foreground/50">{new Date(activity.executed_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <ModalPortal>
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="settings-modal-title">
          <div className="absolute inset-0 bg-black/50 transition-opacity" onClick={() => setIsSettingsOpen(false)} aria-hidden="true" />
          <div className="relative w-full max-w-[90vw] sm:max-w-md max-h-[90vh] bg-surface-sage rounded-2xl border-[3px] border-white/60 animate-in zoom-in-95 overflow-hidden flex flex-col neu-modal">
            <div className="overflow-y-auto w-full p-5 md:p-6" style={{ maxHeight: 'calc(90vh - 2rem)' }}>
              <div className="flex items-center justify-between mb-5">
                <h2 id="settings-modal-title" className="text-xl font-bold text-foreground">{t('irrigation.settingsTitle')}</h2>
                <button onClick={() => setIsSettingsOpen(false)} aria-label={t('irrigation.closeSettings', { defaultValue: 'Tutup pengaturan' })} className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-sage text-foreground/60 neu-inset-deep transition-all duration-200 hover:bg-red-300 hover:text-red-800 active:scale-75 active:bg-red-400 active:text-red-900">
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

            {/* Tab Switcher — Otomatis / Terjadwal / Manual */}
            <div role="tablist" aria-label={t('irrigation.settingsTitle')} className="flex gap-1 rounded-full bg-transparent p-1 neu-inset mb-3">
              {([
                { id: 'auto' as const, label: t('irrigation.tabAuto'), active: autoMode },
                { id: 'scheduled' as const, label: t('irrigation.tabScheduled'), active: scheduledMode },
                { id: 'manual' as const, label: t('irrigation.tabManual'), active: manualMode },
              ]).map((tab) => (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={activeSettingsTab === tab.id}
                  onClick={() => setActiveSettingsTab(tab.id)}
                  className={cn(
                    "flex-1 py-2 px-3 rounded-full text-xs md:text-sm font-semibold transition-all duration-300 relative",
                    activeSettingsTab === tab.id
                      ? "bg-primary text-white neu-seg-active"
                      : "text-foreground/60 hover:text-primary hover:bg-surface-leaf neu-seg-idle"
                  )}
                >
                  {tab.label}
                  {tab.active && activeSettingsTab !== tab.id && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-60 animate-ping" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Status pointer */}
            <p className="text-center text-xs md:text-sm text-foreground/60 mb-3">
              {t('irrigation.nowShowing')}{' '}
              <span className="font-bold text-foreground">
                {activeSettingsTab === 'auto'
                  ? t('irrigation.autoIrrigation')
                  : activeSettingsTab === 'scheduled'
                    ? t('irrigation.scheduledIrrigation')
                    : t('irrigation.manualIrrigation')}
              </span>
            </p>

            {/* Active tab card */}
            <div className="space-y-4">
              {activeSettingsTab === 'auto' && (
                /* Card Irigasi Otomatis */
                <div className={`rounded-2xl border border-white/60 p-4 bg-surface-sage neu-inset transition-all duration-200 overflow-visible relative`}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-transparent neu-inset"><Zap className="h-5 w-5 text-primary" /></div>
                    <h3 className="font-semibold text-foreground text-sm md:text-base">{t('irrigation.autoIrrigation')}</h3>
                  </div>

                  <div className="space-y-4">
                    <ThresholdRangeControl
                      title={t('irrigation.waterRangeTitle')}
                      description={t('irrigation.waterRangeDesc')}
                      icon={Droplet}
                      minValue={waterMinThreshold}
                      maxValue={waterMaxThreshold}
                      unit={moistureUnit}
                      upperBound={100}
                      onMinChange={setWaterMinThreshold}
                      onMaxChange={setWaterMaxThreshold}
                    />

                    <ThresholdRangeControl
                      title={t('irrigation.nitrogenRangeTitle')}
                      description={t('irrigation.nitrogenRangeDesc')}
                      icon={Leaf}
                      minValue={nitrogenMinThreshold}
                      maxValue={nitrogenMaxThreshold}
                      unit={npkUnit}
                      upperBound={1000}
                      onMinChange={setNitrogenMinThreshold}
                      onMaxChange={setNitrogenMaxThreshold}
                    />

                    <ThresholdRangeControl
                      title={t('irrigation.phosphorusRangeTitle')}
                      description={t('irrigation.phosphorusRangeDesc')}
                      icon={Sprout}
                      minValue={phosphorusMinThreshold}
                      maxValue={phosphorusMaxThreshold}
                      unit={npkUnit}
                      upperBound={1000}
                      onMinChange={setPhosphorusMinThreshold}
                      onMaxChange={setPhosphorusMaxThreshold}
                    />

                    <ThresholdRangeControl
                      title={t('irrigation.potassiumRangeTitle')}
                      description={t('irrigation.potassiumRangeDesc')}
                      icon={Flower2}
                      minValue={potassiumMinThreshold}
                      maxValue={potassiumMaxThreshold}
                      unit={npkUnit}
                      upperBound={1000}
                      onMinChange={setPotassiumMinThreshold}
                      onMaxChange={setPotassiumMaxThreshold}
                    />
                  </div>
                </div>
              )}

              {activeSettingsTab === 'scheduled' && (
                /* Card Irigasi Penjadwalan */
                <div className="rounded-2xl border border-white/60 p-4 bg-surface-sage neu-inset">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-transparent neu-inset"><Calendar className="h-5 w-5 text-secondary" /></div>
                    <h3 className="font-semibold text-foreground text-sm md:text-base">{t('irrigation.scheduledIrrigation')}</h3>
                  </div>
                  <div>
                    <p className="text-xs md:text-sm font-semibold text-foreground/70 mb-2 uppercase tracking-wider">{t('irrigation.behaviorLabel')}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setScheduledBehavior('manual')}
                        className={cn("flex-1 py-2 md:py-2.5 px-3 rounded-2xl text-xs md:text-sm font-bold transition-all duration-200 text-center", scheduledBehavior === 'manual' ? "bg-primary text-white neu-btn-primary" : "bg-surface-sage text-foreground/50 neu-inset hover:bg-primary/20 hover:text-primary-shade active:scale-95 active:bg-primary/30")}
                      >
                        {t('irrigation.behaviorManual')}
                      </button>
                      <button
                        onClick={() => setScheduledBehavior('auto')}
                        className={cn("flex-1 py-2 md:py-2.5 px-3 rounded-2xl text-xs md:text-sm font-bold transition-all duration-200 text-center", scheduledBehavior === 'auto' ? "bg-primary text-white neu-btn-primary" : "bg-surface-sage text-foreground/50 neu-inset hover:bg-primary/20 hover:text-primary-shade active:scale-95 active:bg-primary/30")}
                      >
                        {t('irrigation.behaviorAuto')}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeSettingsTab === 'manual' && (
                /* Card Irigasi Manual — Slider disabled (no PWM) */
                <div className="rounded-2xl border border-white/60 p-4 bg-surface-sage neu-inset">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-transparent neu-inset"><ToggleRight className="h-5 w-5 text-primary" /></div>
                    <h3 className="font-semibold text-foreground text-sm md:text-base">{t('irrigation.manualIrrigation')}</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/60 bg-surface-sage px-3 py-3 neu-raised">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-transparent neu-inset">
                            <Droplet className="h-4 w-4 text-primary" aria-hidden="true" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-foreground">{t('irrigation.manualWaterPump')}</p>
                            <p className="text-[11px] text-foreground/55">
                              {manualWaterEnabled ? t('irrigation.enabled') : t('irrigation.disabled')}
                            </p>
                          </div>
                        </div>
                        <Switch
                          checked={manualWaterEnabled}
                          onCheckedChange={handleManualWaterToggle}
                          className="data-[state=checked]:bg-primary"
                          aria-label={t('irrigation.manualWaterPump')}
                        />
                      </div>

                      <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/60 bg-surface-sage px-3 py-3 neu-raised">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-transparent neu-inset">
                            <Leaf className="h-4 w-4 text-primary" aria-hidden="true" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-foreground">{t('irrigation.manualFertilizerPump')}</p>
                            <p className="text-[11px] text-foreground/55">{manualFertilizerEnabled ? t('irrigation.enabled') : t('irrigation.disabled')}</p>
                          </div>
                        </div>
                        <Switch
                          checked={manualFertilizerEnabled}
                          onCheckedChange={handleManualFertilizerToggle}
                          className="data-[state=checked]:bg-primary"
                          aria-label={t('irrigation.manualFertilizerPump')}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs md:text-sm font-semibold text-foreground/70 uppercase tracking-wider">{t('irrigation.speedLabel')}</span>
                        <span className="text-xs md:text-sm font-bold text-foreground/35">{manualSpeed}%</span>
                      </div>
                      <div className="relative w-full h-3.5 bg-surface-muted rounded-full mt-4 mb-4 neu-slider-track opacity-40 pointer-events-none">
                        <div
                          className="absolute top-0 left-0 h-full bg-foreground/30 rounded-full pointer-events-none"
                          style={{ width: `calc(${manualSpeed}% + ${8 - manualSpeed * 0.16}px)` }}
                        />
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="1"
                          value={manualSpeed}
                          disabled
                          aria-label={t('irrigation.speedLabel')}
                          aria-valuenow={manualSpeed}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          className="absolute top-0 left-0 w-full h-full opacity-0 cursor-not-allowed z-10"
                        />
                        <div
                          className="absolute top-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-white border-foreground/30 shadow-md shadow-foreground/10 pointer-events-none"
                          style={{ left: `calc(${manualSpeed}% - ${manualSpeed * 0.16}px)`, borderWidth: '3px' }}
                        />
                      </div>
                    </div>
                    <div className="rounded-xl bg-amber-50 border border-amber-200/60 px-3 py-2">
                      <p className="text-[10px] md:text-xs text-amber-700 leading-relaxed">
                        <span className="font-bold">{t('irrigation.manualNote', { defaultValue: 'Note' })}:</span> {t('irrigation.manualOnOffDesc', { defaultValue: 'Manual mode only sends ON (100%) or OFF (0%) signals. Speed control (PWM) will be available in an upcoming update.' })}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            
            <div className="mt-6">
              <button
                onClick={() => {
                  // Save config values only — do NOT change active_mode here.
                  // Mode on/off is controlled exclusively by the per-card toggles.
                  // Likewise we don't toggle manual_*_enabled from the settings save;
                  // those are runtime states owned by the Manual card switches.
                  updateConfigMutation.mutate({
                    auto_parameter: 'soil_moisture',
                    auto_threshold_value: waterMinThreshold,
                    auto_threshold_direction: 'below',
                    water_min_threshold: waterMinThreshold,
                    water_max_threshold: waterMaxThreshold,
                    npk_min_threshold: nitrogenMinThreshold + phosphorusMinThreshold + potassiumMinThreshold,
                    npk_max_threshold: nitrogenMaxThreshold + phosphorusMaxThreshold + potassiumMaxThreshold,
                    nitrogen_min_threshold: nitrogenMinThreshold,
                    nitrogen_max_threshold: nitrogenMaxThreshold,
                    phosphorus_min_threshold: phosphorusMinThreshold,
                    phosphorus_max_threshold: phosphorusMaxThreshold,
                    potassium_min_threshold: potassiumMinThreshold,
                    potassium_max_threshold: potassiumMaxThreshold,
                    manual_speed: manualSpeed,
                    fertilizer_manual_speed: fertilizerManualSpeed,
                    scheduled_behavior: scheduledBehavior
                  });
                  setIsSettingsOpen(false);
                }}
                disabled={updateConfigMutation.isPending}
                className="w-full rounded-2xl bg-primary py-3.5 text-sm md:text-base font-bold text-white transition-all neu-btn-primary active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2"
              >
                {updateConfigMutation.isPending && <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                {t('irrigation.save')}
              </button>
            </div>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
      {/* Schedule Edit/Add Modal */}
      {isScheduleModalOpen && editingScheduleId !== null && (
        <ModalPortal>
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="schedule-modal-title">
          <div className="absolute inset-0 bg-black/50 transition-opacity" onClick={closeScheduleModal} aria-hidden="true" />
          <div className="relative w-full max-w-[90vw] sm:max-w-md bg-surface-sage rounded-2xl border-[3px] border-white/60 animate-in zoom-in-95 overflow-hidden flex flex-col" style={{ boxShadow: 'inset 3px 3px 6px rgba(255,255,255,0.9), inset -3px -3px 6px rgba(143,139,120,0.4)' }}>
            {(() => {
              const schedule = isAddingNew ? pendingSchedule : schedules.find(s => s.id === editingScheduleId);
              if (!schedule) return null;

              const updateField = (field: keyof ScheduleEntry, value: string) => {
                if (isAddingNew) {
                  setPendingSchedule(prev => prev ? { ...prev, [field]: value } : prev)
                } else {
                  updateSchedule(schedule.id, field, value)
                }
              }

              const toggleDayLocal = (dayId: string) => {
                if (isAddingNew) {
                  setPendingSchedule(prev => prev ? { ...prev, days: prev.days.includes(dayId) ? prev.days.filter(d => d !== dayId) : [...prev.days, dayId] } : prev)
                } else {
                  toggleDay(schedule.id, dayId)
                }
              }

              return (
                <div className="p-5 md:p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 id="schedule-modal-title" className="text-xl font-bold text-foreground">{isAddingNew ? t('irrigation.addSchedule', { defaultValue: 'Add Schedule' }) : t('irrigation.editSchedule', { defaultValue: 'Edit Schedule' })}</h2>
                    <button onClick={closeScheduleModal} aria-label={t('irrigation.closeSchedule', { defaultValue: 'Close schedule' })} className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-sage text-foreground/60 neu-inset-deep transition-all duration-200 hover:bg-red-300 hover:text-red-800 active:scale-75 active:bg-red-400 active:text-red-900">
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                 
                  {/* Name */}
                  <div>
                    <label className="text-xs md:text-sm font-semibold text-foreground/70 block mb-2">{t('irrigation.scheduleName', { defaultValue: 'Nama Jadwal' })}</label>
                    <input type="text" value={schedule.name} onChange={(e) => updateField('name', e.target.value)} className="w-full rounded-2xl bg-surface-sage border border-white/60 px-4 py-2.5 text-sm md:text-base font-medium text-foreground neu-inset-shallow focus:outline-none transition-shadow duration-300" />
                  </div>

                  {/* Day selector */}
                  <div>
                    <label className="text-xs md:text-sm font-semibold text-foreground/70 block mb-2">{t('irrigation.selectDays')}</label>
                    <div className="flex gap-1.5 justify-between">
                      {daysOfWeek.map((day) => (
                        <button key={day.id} onClick={() => toggleDayLocal(day.id)} className={cn("flex-1 h-9 rounded-2xl text-[10px] md:text-xs font-semibold transition-all duration-200 active:scale-90", schedule.days.includes(day.id) ? "bg-primary text-white neu-seg-active" : "bg-surface-sage text-foreground/60 neu-inset hover:text-primary hover:bg-surface-leaf neu-seg-idle")}>
                          {t(`days.${day.id}`).substring(0, 3)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Time Range */}
                  <div>
                    <label className="text-xs md:text-sm font-semibold text-foreground/70 block mb-2">{t('irrigation.timeRange')}</label>
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <label className="text-[10px] md:text-xs text-foreground/40 mb-1 block">{t('irrigation.from')}</label>
                        <div className="relative">
                          <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/60" />
                          <input type="time" value={schedule.startTime} onChange={(e) => updateField('startTime', e.target.value)} className="w-full rounded-2xl bg-surface-sage border border-white/60 px-3 py-2 pl-9 text-sm md:text-base font-bold text-primary neu-inset-shallow focus:outline-none transition-shadow duration-300" />
                        </div>
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] md:text-xs text-foreground/40 mb-1 block">{t('irrigation.to')}</label>
                        <div className="relative">
                          <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/60" />
                          <input type="time" min={schedule.startTime} value={schedule.endTime} onChange={(e) => updateField('endTime', e.target.value)} className="w-full rounded-2xl bg-surface-sage border border-white/60 px-3 py-2 pl-9 text-sm md:text-base font-bold text-primary neu-inset-shallow focus:outline-none transition-shadow duration-300" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-1">
                    {!isAddingNew && schedules.length > 1 && (
                      <button onClick={() => { removeSchedule(schedule.id); closeScheduleModal(); }} aria-label={t('irrigation.deleteSchedule', { defaultValue: 'Hapus jadwal' })} className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-sage text-destructive/70 neu-inset-deep transition-all duration-200 hover:bg-red-300 hover:text-red-800 active:scale-90 active:bg-red-400 active:text-red-900 shrink-0">
                        <Trash2 className="h-5 w-5" aria-hidden="true" />
                      </button>
                    )}
                    <button onClick={saveSchedule} className="flex-1 rounded-2xl bg-primary py-3 text-sm md:text-base font-bold text-white transition-all duration-200 neu-btn-primary active:scale-[0.98]">
                      {t('irrigation.save', { defaultValue: 'Simpan Pengaturan' })}
                    </button>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  )
}
