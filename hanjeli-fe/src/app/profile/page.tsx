"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { useNotifications } from "@/contexts/notification-context"
import { formatDistanceToNow } from "date-fns"
import { id as idLocale, enUS as enLocale } from "date-fns/locale"
import Link from "next/link"
import {
  User,
  Globe,
  Bell,
  Cpu,
  Ruler,
  Settings,
  Lock,
  Shield,
  Pencil,
  LogOut,
  ChevronRight,
  ChevronDown,
  Check,
  ChevronLeft,
  Eye,
  EyeOff,
  Trash2,
  AlertTriangle,
  Wifi,
  Activity,
  Camera,
  Droplet,
  Thermometer,
  Plus,
  Mail,
  Copy,
  CheckCircle2,
  X,
  XCircle,
  ArrowRight,
  RefreshCw,
  Loader2,
  Gauge,
  Leaf,
  Sprout,
  Flower2,
  FlaskConical,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { convertSensorValue, convertToBaseUnit, type MeasurableParam } from "@/lib/units"
import { NeuInput } from "@/components/ui/neu-input"
import { PasswordStrength } from "@/components/ui/password-strength"
import { isPasswordStrong, isValidEmail } from "@/lib/password"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { apiClient } from "@/lib/api/client"
import { getApiErrorMessage } from "@/lib/api/errors"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/api/query-keys"
import { preferencesApi } from "@/lib/api/preferences"
import { usersApi } from "@/lib/api/users"
import { devicesApi } from "@/lib/api/devices"
import { authApi } from "@/lib/api/auth"
import { useCurrentUser } from "@/lib/hooks/useCurrentUser"
import { UserAvatar } from "@/components/user-avatar"
import { ModalPortal } from "@/components/modal-portal"
import { clearAuthSession, getStoredUser, storeCurrentUser } from "@/lib/auth-session"
import { QRCodeSVG } from "qrcode.react"

// Language options for internal i18n
const languageOptions = [
  { code: 'id', label: 'Bahasa Indonesia', flag: '🇮🇩' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
]

// IoT Devices data
type ProfileDevice = {
  id: string
  name: string
  code: string
  status: string
  type: string
  lastSeen: string
  warning?: string
}

type BackendDevice = {
  id: string
  name: string
  code: string
  status?: string
  type?: string
  last_seen_at?: string | null
  warning_message?: string | null
}

type SensorThresholdResponse = {
  parameter_key: string
  min_value?: number | null
  max_value?: number | null
}

type PreferencesResponse = {
  sensor_thresholds?: SensorThresholdResponse[]
}

type CurrentUserSecurity = {
  two_factor_enabled?: boolean
}

const DEFAULT_IOT_DEVICES: ProfileDevice[] = [
  { id: "1", name: "Main Irrigation Pump", code: "#PMP01", status: "online", type: "pump", lastSeen: "Just now" },
  { id: "2", name: "JLNew H10: Soil Moisture Sensor", code: "#WS004", status: "online", type: "sensor", lastSeen: "2 min ago" },
  { id: "3", name: "ACE Temperature & Humidity Sensor", code: "#TH011", status: "warning", type: "sensor", lastSeen: "5 min ago", warning: "Signal issue since 08:02 AM" },
  { id: "4", name: "Field Camera A", code: "#CAM01", status: "offline", type: "camera", lastSeen: "3 hours ago" },
]

function mapBackendDevice(device: BackendDevice, t: any): ProfileDevice {
  return {
    id: String(device.id),
    name: device.name,
    code: String(device.code || "").startsWith("#") ? device.code : `#${device.code}`,
    status: device.status || "offline",
    type: device.type || "sensor",
    lastSeen: device.last_seen_at ? new Date(device.last_seen_at).toLocaleString() : t('profile.deviceNeverOnline', 'Belum pernah online'),
    warning: device.warning_message ?? undefined,
  }
}

// Measurement unit options — hanya unit yang benar-benar terkonversi dari
// nilai kanonik sensor (selaras dengan MEASUREMENT_UNIT_OPTIONS backend)
const measurementUnits = [
  { id: 'soil_temperature', labelKey: 'home.sensor_temp', options: ['°C', '°F'], icon: Thermometer },
  { id: 'soil_moisture', labelKey: 'home.sensor_moist', options: ['%'], icon: Droplet },
  { id: 'ph', labelKey: 'home.sensor_ph', options: ['pH'], icon: Gauge },
  /* Grup unit bersama untuk ketiga nilai N, P, K */
  { id: 'soil_npk', labelKey: 'home.sensor_npk', options: ['mg/kg', 'ppm'], icon: Leaf },
]



type PanelType = 'main' | 'language' | 'password' | 'editProfile' | '2fa' | 'iotStatus' | 'units' | 'deleteAccount' | 'addDevice' | 'forgotPassword'

// ─── Reusable Sub-page Header (defined outside component to avoid recreation on every render) ───
function SubPageHeader({ title, subtitle, onBack, icon: Icon }: { title: string; subtitle: string; onBack: () => void; icon?: React.ElementType }) {
  return (
    <>
      {/* Mobile Header */}
      <div
        className="md:hidden bg-linear-to-b from-surface-sage-soft to-surface-sage px-5 pb-4 neu-header border-b border-white/50"
        style={{ paddingTop: 'max(56px, calc(env(safe-area-inset-top, 0px) + 32px))' }}
      >
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack} 
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-surface-sage neu-raised transition-all hover:bg-surface-muted/70 active:scale-95"
          >
            <ChevronLeft className="h-5 w-5 text-primary" />
          </button>
          <div>
            <h1 className="text-xl font-extrabold bg-linear-to-r from-primary to-foreground bg-clip-text text-transparent font-(family-name:--font-jakarta)">{title}</h1>
            <p className="text-sm text-foreground/50 font-medium tracking-wide">{subtitle}</p>
          </div>
        </div>
      </div>

      {/* Desktop Modal Header */}
      <div className="hidden md:flex items-center justify-between px-6 pt-6 mb-1">
        <div>
          <h3 className="text-lg md:text-xl font-bold text-foreground flex items-center gap-2">
            {Icon && <Icon className="h-5 w-5 text-primary" />}
            {title}
          </h3>
          <p className="text-xs md:text-sm text-foreground/60 mt-0.5">
            {subtitle}
          </p>
        </div>
        <button
          onClick={onBack}
          aria-label="Tutup"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-sage text-foreground/60 neu-inset-deep transition-all duration-200 hover:bg-red-300 hover:text-red-800 active:scale-75 active:bg-red-400 active:text-red-900"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </>
  )
}

export default function ProfilePage() {
  const router = useRouter()
  const { t, i18n } = useTranslation()
  const { addNotification } = useNotifications()
  const { user: currentUser, isAdmin } = useCurrentUser()
  const userName = currentUser?.name ?? ""
  const userEmail = currentUser?.email ?? ""
  const userRole = currentUser?.role ?? "Guest"
  const userAvatarUrl = currentUser?.avatar_url ?? null
  const passwordUpdatedAt = currentUser?.password_updated_at ?? null
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [activePanel, setActivePanel] = useState<PanelType>('main')
  const [showEditModal, setShowEditModal] = useState(false)
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches)
  const [iotDevices, setIotDevices] = useState(DEFAULT_IOT_DEVICES)
  const queryClient = useQueryClient()
  const selectedLang = i18n.language || 'id'
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [confirmPassword, setConfirmPassword] = useState('')
  const [capsLockOn, setCapsLockOn] = useState(false)
  const detectCapsLock = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLockOn(e.getModifierState('CapsLock'))
  }

  const [editName, setEditName] = useState(userName)
  const [editEmail, setEditEmail] = useState(userEmail)

  // Avatar upload
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarError, setAvatarError] = useState<string | null>(null)

  // Discard-changes confirmation
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)

  // Granular notification preferences
  type NotifChannel = 'push' | 'email'
  type NotifCategory = 'irrigation' | 'sensor' | 'system'
  const [notificationPrefs, setNotificationPrefs] = useState<Record<NotifCategory, Record<NotifChannel, boolean>>>({
    irrigation: { push: true, email: false },
    sensor: { push: true, email: false },
    system: { push: true, email: false },
  })

  // Sensor threshold ranges for notifications — N, P, K terpisah
  // State selalu menyimpan nilai dalam BASE UNIT (°C, mg/kg) — konversi
  // ke/dari unit tampilan dilakukan saat render & save saja.
  type SensorThreshold = { min: number; max: number; unit: string }
  type SensorParam = 'soil_temperature' | 'soil_moisture' | 'ph' | 'soil_nitrogen' | 'soil_phosphorus' | 'soil_potassium'

  /**
   * Map SensorParam → MeasurableParam untuk konversi unit.
   * N/P/K masing-masing terpisah di threshold tapi grup unit-nya tetap 'soil_npk'.
   */
  const toMeasurableParam = (key: SensorParam): MeasurableParam => {
    if (key === 'soil_nitrogen' || key === 'soil_phosphorus' || key === 'soil_potassium') return 'soil_npk'
    return key as MeasurableParam
  }

  /** Konversi nilai base unit → unit tampilan user */
  const toDisplayValue = (value: number, paramKey: SensorParam): number => {
    const mp = toMeasurableParam(paramKey)
    const unitKey = mp === 'soil_npk' ? 'soil_npk' : paramKey
    const displayUnit = selectedUnits[unitKey] || ''
    return Math.round(convertSensorValue(value, mp, displayUnit) * 10) / 10
  }

  /** Konversi nilai unit tampilan → base unit (untuk disimpan ke DB) */
  const fromDisplayValue = (value: number, paramKey: SensorParam): number => {
    const mp = toMeasurableParam(paramKey)
    const unitKey = mp === 'soil_npk' ? 'soil_npk' : paramKey
    const displayUnit = selectedUnits[unitKey] || ''
    return Math.round(convertToBaseUnit(value, mp, displayUnit) * 10) / 10
  }

  /** Konversi slider range (base unit) → display unit */
  const getDisplayRange = (paramKey: SensorParam, rangeMin: number, rangeMax: number) => {
    return {
      min: Math.round(toDisplayValue(rangeMin, paramKey)),
      max: Math.round(toDisplayValue(rangeMax, paramKey)),
    }
  }
  const [sensorThresholds, setSensorThresholds] = useState<Record<SensorParam, SensorThreshold>>({
    soil_temperature: { min: 20, max: 35, unit: '°C' },
    soil_moisture: { min: 30, max: 80, unit: '%' },
    ph: { min: 5.5, max: 7.5, unit: 'pH' },
    soil_nitrogen: { min: 20, max: 60, unit: 'mg/kg' },
    soil_phosphorus: { min: 20, max: 60, unit: 'mg/kg' },
    soil_potassium: { min: 20, max: 60, unit: 'mg/kg' },
  })
  const sensorParamConfig: { key: SensorParam; labelKey: string; step: number; rangeMin: number; rangeMax: number; icon: React.ElementType; unitKey: string }[] = [
    { key: 'soil_temperature', labelKey: 'home.sensor_temp', step: 1, rangeMin: -10, rangeMax: 60, icon: Thermometer, unitKey: 'soil_temperature' },
    { key: 'soil_moisture', labelKey: 'home.sensor_moist', step: 1, rangeMin: 0, rangeMax: 100, icon: Droplet, unitKey: 'soil_moisture' },
    { key: 'ph', labelKey: 'home.sensor_ph', step: 0.1, rangeMin: 0, rangeMax: 14, icon: FlaskConical, unitKey: 'ph' },
    { key: 'soil_nitrogen', labelKey: 'home.sensor_n', step: 1, rangeMin: 0, rangeMax: 150, icon: Leaf, unitKey: 'soil_npk' },
    { key: 'soil_phosphorus', labelKey: 'home.sensor_p', step: 1, rangeMin: 0, rangeMax: 150, icon: Sprout, unitKey: 'soil_npk' },
    { key: 'soil_potassium', labelKey: 'home.sensor_k', step: 1, rangeMin: 0, rangeMax: 150, icon: Flower2, unitKey: 'soil_npk' },
  ]

  // 2FA state
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)
  const [twoFactorStep, setTwoFactorStep] = useState<'idle' | 'qr' | 'verify'>('idle')
  const [twoFactorVerified, setTwoFactorVerified] = useState(false)
  const [totpCode, setTotpCode] = useState('')
  const [twoFactorCopied, setTwoFactorCopied] = useState(false)
  const [twoFactorSecret, setTwoFactorSecret] = useState('')
  const [twoFactorOtpauthUri, setTwoFactorOtpauthUri] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])

  // Email confirmation state
  const [emailToken, setEmailToken] = useState('')
  const [emailTokenSent, setEmailTokenSent] = useState(false)
  const [emailConfirmed, setEmailConfirmed] = useState(false)
  const [emailVerifying, setEmailVerifying] = useState(false)
  const [emailSending, setEmailSending] = useState(false)
  const [emailResendCooldown, setEmailResendCooldown] = useState(0)

  // Forgot password state (in-app)
  const [forgotEmail, setForgotEmail] = useState(userEmail)
  const [forgotSubmitted, setForgotSubmitted] = useState(false)
  const [forgotLoading, setForgotLoading] = useState(false)

  // Loading states
  const [savingPassword, setSavingPassword] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [verifying2FA, setVerifying2FA] = useState(false)

  // Inline validation
  const [passwordError, setPasswordError] = useState('')

  // 2FA disable confirmation
  const [showDisable2FAConfirm, setShowDisable2FAConfirm] = useState(false)

  // Add device state
  const [newDeviceName, setNewDeviceName] = useState('')
  const [newDeviceCode, setNewDeviceCode] = useState('')
  const [newDeviceType, setNewDeviceType] = useState('sensor')
  const [savingDevice, setSavingDevice] = useState(false)
  
  // IoT Delete State
  const [deviceToDelete, setDeviceToDelete] = useState<{id: string, name: string} | null>(null)

  // Delete account state
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deletePassword, setDeletePassword] = useState('')
  const [showDeletePassword, setShowDeletePassword] = useState(false)
  const [delete2FACode, setDelete2FACode] = useState('')
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const [selectedUnits, setSelectedUnits] = useState<Record<string, string>>({
    'soil_temperature': '°C',
    'soil_moisture': '%',
    'ph': 'pH',
    'soil_npk': 'mg/kg'
  })
  const [savingUnits, setSavingUnits] = useState(false)

  // Fetch preferences on mount
  const { data: preferencesData } = useQuery({ queryKey: queryKeys.preferences.all, queryFn: preferencesApi.getPreferences })
  useEffect(() => {
    if (preferencesData?.units) {
      setSelectedUnits(prev => {
        const next = { ...prev }
        preferencesData.units.forEach((unit: any) => {
          if (next[unit.parameter_key] !== undefined) {
            next[unit.parameter_key] = unit.unit_value
          }
        })
        return next
      })
    }
    if (preferencesData?.sensor_thresholds) {
      const thresholds = preferencesData.sensor_thresholds
      setSensorThresholds(prev => {
        const next = { ...prev }
        thresholds.forEach((th: any) => {
          const key = th.parameter_key as SensorParam
          if (next[key]) {
            next[key] = {
              ...next[key],
              min: th.min_value !== undefined ? Number(th.min_value) : next[key].min,
              max: th.max_value !== undefined ? Number(th.max_value) : next[key].max
            }
          }
        })
        return next
      })
    }
    // Muat status toggle push/email per kategori dari backend — sebelumnya
    // state ini murni lokal sehingga selalu kembali ke default (email=false).
    if (preferencesData?.notification_prefs) {
      setNotificationPrefs(prev => {
        const next = { ...prev }
        preferencesData.notification_prefs.forEach((p: any) => {
          const cat = p.category as NotifCategory
          const chan = p.channel as NotifChannel
          if (next[cat] && (chan === 'push' || chan === 'email')) {
            next[cat] = { ...next[cat], [chan]: Boolean(p.enabled) }
          }
        })
        return next
      })
    }
    if (preferencesData?.preference?.notifications_enabled !== undefined) {
      setNotificationsEnabled(Boolean(preferencesData.preference.notifications_enabled))
    }
  }, [preferencesData])

  const handleNotificationsToggle = async (enabled: boolean) => {
    setNotificationsEnabled(enabled)
    try {
      await preferencesApi.updatePreferences({ notifications_enabled: enabled })
    } catch {
      setNotificationsEnabled(!enabled)
      addNotification({
        type: 'error',
        title: t('profile.notifPrefSaveFailed', { defaultValue: 'Gagal menyimpan preferensi notifikasi.' }),
      })
    }
  }

  /**
   * Simpan threshold ke backend — state sudah dalam base unit,
   * jadi langsung kirim tanpa konversi tambahan.
   */
  const handleSensorThresholdChange = async (parameter_key: SensorParam, min: number, max: number) => {
    try {
      await preferencesApi.updateSensorThreshold({ parameter_key, min_value: min, max_value: max })
    } catch {
      addNotification({ 
        type: 'error', 
        title: t('profile.thresholdSaveFailed', { defaultValue: 'Gagal menyimpan ambang batas sensor.' }) 
      })
    }
  }

  // Simpan toggle notifikasi ke backend (optimistic + rollback bila gagal)
  const handleNotifPrefChange = async (
    category: NotifCategory,
    channel: NotifChannel,
    enabled: boolean,
  ) => {
    setNotificationPrefs(prev => ({
      ...prev,
      [category]: { ...prev[category], [channel]: enabled },
    }))
    try {
      await preferencesApi.updateNotificationPref({ category, channel, enabled })
    } catch {
      setNotificationPrefs(prev => ({
        ...prev,
        [category]: { ...prev[category], [channel]: !enabled },
      }))
      addNotification({
        type: 'error',
        title: t('profile.notifPrefSaveFailed', { defaultValue: 'Gagal menyimpan preferensi notifikasi.' }),
      })
    }
  }

  // Simpan unit pengukuran ke backend (PUT /preferences/units per parameter)
  const handleSaveUnits = async () => {
    setSavingUnits(true)
    try {
      for (const unit of measurementUnits) {
        const value = selectedUnits[unit.id]
        if (value) {
          await preferencesApi.updateUnit({ parameter_key: unit.id, unit_value: value })
        }
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.preferences.all })
      addNotification({ type: 'success', title: t('profile.unitsSaved', { defaultValue: 'Satuan pengukuran berhasil disimpan.' }) })
      setActivePanel('main')
    } catch {
      addNotification({ type: 'error', title: t('profile.unitsSaveFailed', { defaultValue: 'Gagal menyimpan satuan pengukuran.' }) })
    } finally {
      setSavingUnits(false)
    }
  }

  const { data: devicesData } = useQuery({ queryKey: queryKeys.devices.all, queryFn: devicesApi.getAll })
  useEffect(() => {
    if (devicesData) {
      setIotDevices(devicesData.map((d: any) => mapBackendDevice(d, t)))
    }
  }, [devicesData, t])

  useEffect(() => {
    if (currentUser) {
      setTwoFactorEnabled(Boolean(currentUser.two_factor_enabled))
      setTwoFactorVerified(Boolean(currentUser.two_factor_enabled))
    }
  }, [currentUser])

  const deleteDeviceMutation = useMutation({
    mutationFn: devicesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.devices.all })
      addNotification({ type: 'success', title: `${deviceToDelete?.name} berhasil dihapus` })
      setDeviceToDelete(null)
    },
    onError: (err: any) => {
      addNotification({ type: 'error', title: getApiErrorMessage(err, t('profile.deviceDeleteFailed', 'Gagal menghapus perangkat')) })
    }
  })

  const handleDeleteDevice = () => {
    if (deviceToDelete) deleteDeviceMutation.mutate(deviceToDelete.id)
  }

  const createDeviceMutation = useMutation({
    mutationFn: devicesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.devices.all })
      addNotification({ type: 'success', title: `${newDeviceName} (#${newDeviceCode}) ${t('profile.deviceAdded')}` })
      setNewDeviceName('')
      setNewDeviceCode('')
      setNewDeviceType('sensor')
      setActivePanel('iotStatus')
    },
    onError: (err: any) => {
      addNotification({ type: 'error', title: getApiErrorMessage(err, t('profile.deviceAddFailed', 'Gagal menambahkan perangkat')) })
    }
  })

  const handleCreateDevice = () => {
    if (!newDeviceName || !newDeviceCode || createDeviceMutation.isPending) return
    createDeviceMutation.mutate({
      name: newDeviceName,
      code: newDeviceCode.replace(/^#/, ''),
      type: newDeviceType,
    })
  }

  const handleLanguageChange = (code: string) => {
    i18n.changeLanguage(code)
    setActivePanel('main')
  }

  const handleSavePassword = async () => {
    setPasswordError('')
    if (!currentPassword) { setPasswordError(t('profile.currentPasswordRequired', 'Masukkan kata sandi saat ini')); return }
    if (!isPasswordStrong(newPassword)) { setPasswordError(t('auth.passwordPolicyError')); return }
    if (newPassword !== confirmPassword) { setPasswordError(t('profile.passwordMismatchError')); return }
    setSavingPassword(true)
    try {
      await usersApi.updateProfile({ password: newPassword, currentPassword })
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.profile })
      addNotification({ type: 'success', title: t('profile.passwordUpdated') })
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setPasswordError('')
      setActivePanel('main')
    } catch (err: any) {
      setPasswordError(getApiErrorMessage(err, t('profile.passwordUpdateFailed', 'Gagal memperbarui kata sandi')))
    } finally {
      setSavingPassword(false)
    }
  }

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      addNotification({ type: 'error', title: t('profile.nameRequired', 'Nama lengkap wajib diisi') })
      return
    }
    if (editEmail !== userEmail && !isValidEmail(editEmail)) {
      addNotification({ type: 'error', title: t('profile.invalidEmail', 'Format email tidak valid') })
      return
    }
    if (editEmail !== userEmail && !emailConfirmed) {
      addNotification({ type: 'error', title: t('profile.confirmEmailFirst') })
      return
    }
    setSavingProfile(true)
    try {
      const payload: { name?: string; email?: string; emailToken?: string } = {}
      if (editName.trim() && editName !== userName) payload.name = editName.trim()
      if (editEmail !== userEmail) {
        payload.email = editEmail
        payload.emailToken = emailToken
      }
      if (Object.keys(payload).length > 0) {
        await usersApi.updateProfile(payload)
        await queryClient.invalidateQueries({ queryKey: queryKeys.auth.profile })
      }
      addNotification({ type: 'success', title: t('profile.profileUpdated') })
      setEmailToken(''); setEmailTokenSent(false); setEmailConfirmed(false); setEmailResendCooldown(0)
      setActivePanel('main')
      setShowEditModal(false)
    } catch (err: any) {
      addNotification({ type: 'error', title: getApiErrorMessage(err, t('profile.profileUpdateFailed', 'Gagal memperbarui profil')) })
    } finally {
      setSavingProfile(false)
    }
  }

  const startEmailCooldown = useCallback(() => {
    setEmailResendCooldown(60)
    const interval = setInterval(() => {
      setEmailResendCooldown(prev => {
        if (prev <= 1) { clearInterval(interval); return 0 }
        return prev - 1
      })
    }, 1000)
  }, [])

  const handleSendEmailToken = async () => {
    if (!isValidEmail(editEmail)) {
      addNotification({ type: 'error', title: t('profile.invalidEmail', 'Format email tidak valid') })
      return
    }
    setEmailSending(true)
    try {
      await usersApi.sendEmailToken({ newEmail: editEmail })
      setEmailTokenSent(true)
      startEmailCooldown()
      addNotification({ type: 'success', title: t('profile.tokenSent') })
    } catch (err: any) {
      addNotification({ type: 'error', title: getApiErrorMessage(err, 'Gagal mengirim token OTP') })
    } finally {
      setEmailSending(false)
    }
  }

  const handleResendEmailToken = async () => {
    if (emailResendCooldown > 0) return
    handleSendEmailToken()
  }

  const handleConfirmEmail = async () => {
    if (emailToken.length !== 6) {
      addNotification({ type: 'error', title: t('profile.tokenMust6Digits') })
      return
    }
    
    setEmailVerifying(true)
    try {
      await usersApi.verifyEmailToken({ newEmail: editEmail, token: emailToken })
      setEmailConfirmed(true)
      addNotification({ type: 'success', title: t('profile.emailConfirmed') })
    } catch (err: any) {
      addNotification({ type: 'error', title: getApiErrorMessage(err, 'Token OTP tidak valid') })
    } finally {
      setEmailVerifying(false)
    }
  }

  const forgotPasswordMutation = useMutation({
    mutationFn: authApi.forgotPassword,
    onSuccess: () => {
      setForgotSubmitted(true)
      addNotification({ type: 'success', title: t('profile.resetLinkSent', 'Link reset password dikirim') })
    },
    onError: (err: any) => {
      addNotification({ type: 'error', title: getApiErrorMessage(err, t('profile.resetLinkFailed', 'Gagal mengirim link reset password')) })
    }
  })

  const handleForgotPassword = () => {
    forgotPasswordMutation.mutate({ email: forgotEmail })
  }

  const setup2FaMutation = useMutation({
    mutationFn: authApi.setup2Fa,
    onSuccess: (setup: any) => {
      setTwoFactorEnabled(true)
      setTwoFactorStep('qr')
      setTwoFactorVerified(false)
      setTotpCode('')
      setTwoFactorSecret(setup.secret)
      setTwoFactorOtpauthUri(setup.otpauth_uri || '')
      setRecoveryCodes([])
      setShowDisable2FAConfirm(false)
    },
    onError: (err: any) => {
      addNotification({ type: 'error', title: getApiErrorMessage(err, t('profile.twoFactorSetupFailed', 'Gagal menyiapkan 2FA')) })
    }
  })

  const handle2FAToggle = (checked: boolean) => {
    if (checked) {
      setup2FaMutation.mutate()
    } else {
      if (twoFactorVerified) {
        setShowDisable2FAConfirm(true)
      } else {
        handleCancel2FA()
      }
    }
  }

  const disable2FaMutation = useMutation({
    mutationFn: authApi.disable2Fa,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.profile })
      setTwoFactorEnabled(false)
      setTwoFactorStep('idle')
      setTwoFactorVerified(false)
      setTotpCode('')
      setTwoFactorSecret('')
      setRecoveryCodes([])
      setShowDisable2FAConfirm(false)
      addNotification({ type: 'success', title: t('profile.twoFactorDisabled') })
    },
    onError: (err: any) => {
      addNotification({ type: 'error', title: getApiErrorMessage(err, t('profile.twoFactorDisableFailed', 'Gagal menonaktifkan 2FA')) })
    }
  })

  const handleConfirmDisable2FA = () => {
    disable2FaMutation.mutate()
  }

  const handleCopyManualCode = () => {
    navigator.clipboard.writeText(twoFactorSecret)
    setTwoFactorCopied(true)
    addNotification({ type: 'success', title: t('profile.codeCopied') })
    setTimeout(() => setTwoFactorCopied(false), 2000)
  }

  const enable2FaMutation = useMutation({
    mutationFn: authApi.enable2Fa,
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.profile })
      setRecoveryCodes(result.recovery_codes || [])
      setTwoFactorVerified(true)
      setTwoFactorStep('idle')
      setTotpCode('')
      addNotification({ type: 'success', title: t('profile.twoFactorActivated') })
    },
    onError: (err: any) => {
      addNotification({ type: 'error', title: getApiErrorMessage(err, t('profile.twoFactorVerifyFailed', 'Kode 2FA tidak valid')) })
    }
  })

  const handleVerify2FA = () => {
    enable2FaMutation.mutate({ token: totpCode })
  }

  const handleCancel2FA = () => {
    setTwoFactorEnabled(false)
    setTwoFactorVerified(false)
    setTwoFactorStep('idle')
    setTotpCode('')
    setTwoFactorSecret('')
    setTwoFactorOtpauthUri('')
    setRecoveryCodes([])
    setShowDisable2FAConfirm(false)
  }

  const recoveryCodesList = recoveryCodes

  // Real TOTP QR rendered client-side from the otpauth URI (secret never leaves the browser).
  const renderTwoFactorQr = () => (
    twoFactorOtpauthUri ? (
      <div className="flex h-48 w-48 items-center justify-center rounded-2xl border border-surface-muted bg-white p-3">
        <QRCodeSVG value={twoFactorOtpauthUri} size={168} level="M" />
      </div>
    ) : (
      <div className="h-48 w-48 rounded-2xl bg-surface-muted border-2 border-dashed border-foreground/20 flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-10 w-10 text-foreground/30 mx-auto mb-2" />
          <p className="text-xs text-foreground/40">{t('profile.qrCodeLoading', 'Memuat kode QR...')}</p>
        </div>
      </div>
    )
  )

  const handleCopyAllRecoveryCodes = () => {
    navigator.clipboard.writeText(recoveryCodesList.join('\n'))
    addNotification({ type: 'success', title: t('profile.codesCopied') })
  }

  const handleDownloadRecoveryCodes = () => {
    const header = t('profile.recoveryCodesHeader', 'Hanjeli Smart Farm — Kode Pemulihan 2FA')
    const note = t('profile.recoveryCodesNote', 'Simpan file ini di tempat yang aman. Setiap kode hanya dapat digunakan satu kali.')
    const content = `${header}\n${note}\n\n${recoveryCodesList.join('\n')}\n`
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'hanjeli-recovery-codes.txt'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    addNotification({ type: 'success', title: t('profile.codesDownloaded', 'Kode pemulihan diunduh') })
  }

  const uploadAvatarMutation = useMutation({
    mutationFn: usersApi.uploadAvatar,
    onSuccess: async (updatedUser: any) => {
      setAvatarError(null)
      // Persist the new avatar URL into the React Query cache + localStorage so the
      // header avatar on /home updates immediately and survives reload/logout.
      if (updatedUser?.avatar_url) {
        queryClient.setQueryData(queryKeys.auth.profile, (prev: any) => ({
          ...(prev ?? {}),
          ...updatedUser,
        }))
        const stored = getStoredUser() ?? ({} as any)
        storeCurrentUser({ ...stored, ...updatedUser })
      }
      // Refetch in the background so any other consumer (e.g. /home avatar) syncs.
      // We don't clear avatarPreview yet — keep the data-URI visible until the
      // canonical server URL has loaded, otherwise the avatar briefly flashes back
      // to the initials fallback (the "click twice to show" UX the user reported).
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.profile })
      addNotification({ type: 'success', title: t('profile.avatarUpdated', 'Foto profil diperbarui') })
      setAvatarPreview(null)
    },
    onError: (err: any) => {
      setAvatarPreview(null)
      setAvatarError(getApiErrorMessage(err, t('profile.avatarUploadFailed', 'Gagal mengunggah foto profil')))
    },
  })

  const handleAvatarFile = (file: File) => {
    setAvatarError(null)
    if (!file.type.startsWith('image/')) {
      setAvatarError(t('profile.avatarInvalidType', 'File harus berupa gambar'))
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError(t('profile.avatarTooLarge', 'Ukuran maksimal 2 MB'))
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') setAvatarPreview(reader.result)
    }
    reader.readAsDataURL(file)
    // Persist immediately; the server returns the hosted avatar URL.
    uploadAvatarMutation.mutate(file)
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleAvatarFile(file)
    e.target.value = ''
  }




  const isEditProfileDirty = editName !== userName || editEmail !== userEmail || avatarPreview !== null

  const requestCloseEditModal = useCallback(() => {
    if (isEditProfileDirty) {
      setShowDiscardConfirm(true)
    } else {
      setShowEditModal(false)
      setActivePanel('main')
    }
  }, [isEditProfileDirty])

  const confirmDiscardChanges = () => {
    setEditName(userName)
    setEditEmail(userEmail)
    setAvatarPreview(null)
    setAvatarError(null)
    setEmailToken('')
    setEmailTokenSent(false)
    setEmailConfirmed(false)
    setShowDiscardConfirm(false)
    setShowEditModal(false)
    if (activePanel === 'editProfile') setActivePanel('main')
  }

  const handleDeleteAccount = async () => {
    setDeleteError('')
    if (!deletePassword) { setDeleteError(t('profile.enterPasswordToVerify')); return }
    if (deleteConfirmText !== t('profile.deleteConfirmText')) { setDeleteError(t('profile.typeDeleteConfirm')); return }
    if (twoFactorVerified && delete2FACode.length !== 6) { setDeleteError(t('profile.enter2faCode')); return }

    setDeletingAccount(true)
    try {
      await usersApi.deleteAccount({
        password: deletePassword,
        twoFactorToken: twoFactorVerified ? delete2FACode : undefined,
      })
      clearAuthSession()
      addNotification({ type: 'success', title: t('profile.accountDeleted') })
      router.push('/login')
    } catch (err: any) {
      setDeleteError(getApiErrorMessage(err, t('profile.accountDeleteFailed', 'Gagal menghapus akun')))
    } finally {
      setDeletingAccount(false)
    }
  }

  const currentLangObj = languageOptions.find(l => l.code === selectedLang) || languageOptions[0]



  // ─── Desktop detection & scroll lock ───
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1024px)')
    const onChange = () => setIsDesktop(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    const anyModalOpen = showEditModal || (isDesktop && activePanel !== 'main')
    document.documentElement.classList.toggle('modal-open', anyModalOpen)
    document.body.classList.toggle('modal-open', anyModalOpen)

    return () => {
      document.documentElement.classList.remove('modal-open')
      document.body.classList.remove('modal-open')
    }
  }, [showEditModal, isDesktop, activePanel])

  // ─── Escape key handler for modals ───
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showEditModal) setShowEditModal(false)
        else if (activePanel !== 'main') setActivePanel('main')
      }
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [showEditModal, activePanel])

  // Keep editable fields in sync with the loaded user while not actively editing.
  useEffect(() => {
    if (showEditModal || activePanel === 'editProfile' || activePanel === 'forgotPassword') return
    setEditName(userName)
    setEditEmail(userEmail)
    setForgotEmail(userEmail)
  }, [userName, userEmail, showEditModal, activePanel])



  // ─── Language Panel ───
  if (!isDesktop && activePanel === 'language') {
    return (
      <div className="relative min-h-screen w-full bg-page">
        <SubPageHeader title={t('profile.selectLanguage')} subtitle={t('profile.languageSubtitle')} onBack={() => setActivePanel('main')} icon={Globe} />
        <div className="px-5 md:px-6 lg:px-8 pt-4 pb-28 lg:pb-8">
          <div className="hf-panel-inset overflow-hidden">
            <div className="max-h-[60vh] overflow-y-auto">
              {languageOptions.map((lang, index) => (
                <button key={lang.code} onClick={() => handleLanguageChange(lang.code)}
                  className={cn("flex w-full items-center justify-between px-4 py-3.5 transition-all hover:bg-surface-muted/50 active:scale-[0.99]",
                    index !== languageOptions.length - 1 && "border-b border-surface-muted",
                    selectedLang === lang.code && "bg-success/10"
                  )}>
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{lang.flag}</span>
                    <span className={cn("text-sm md:text-base", selectedLang === lang.code ? "font-semibold text-primary" : "font-medium text-foreground")}>{lang.label}</span>
                  </div>
                  {selectedLang === lang.code && (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary"><Check className="h-4 w-4 text-white" /></div>
                  )}
                </button>
              ))}
            </div>
          </div>
          <p className="text-center text-[10px] md:text-xs text-foreground/40 mt-4">{t('profile.changeLanguageDesc', 'Diterjemahkan secara native')}</p>
        </div>
      </div>
    )
  }

  // ─── Forgot Password Panel (in-app) ───
  if (!isDesktop && activePanel === 'forgotPassword') {
    return (
      <div className="relative min-h-screen w-full bg-page">
        <SubPageHeader title={t('profile.forgotPasswordTitle', 'Lupa Kata Sandi')} subtitle={t('profile.forgotPasswordDesc', 'Kirim link reset ke email Anda')} onBack={() => { setActivePanel('password'); setForgotSubmitted(false); setForgotEmail(userEmail) }} icon={Lock} />
        <div className="px-5 md:px-6 lg:px-8 pt-4 pb-28 lg:pb-8">
          {!forgotSubmitted ? (
            <div className="hf-panel-inset p-5 md:p-6">
              <div className="flex flex-col items-center text-center mb-6">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/40">
                  <Mail className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground text-base md:text-lg mb-1">{t('profile.forgotPasswordTitle', 'Lupa Kata Sandi')}</h3>
                <p className="text-xs md:text-sm text-foreground/60 max-w-sm">
                  {t('profile.forgotPasswordDesc', 'Jangan khawatir! Masukkan alamat email Anda dan kami akan mengirimkan link untuk mereset kata sandi.')}
                </p>
              </div>
              <div className="space-y-4">
                <div className="rounded-2xl border border-white/60 bg-surface-sage p-5 neu-raised space-y-4">
                <div>
                  <label className="text-xs md:text-sm font-semibold text-foreground/70 mb-1.5 block">{t('profile.email', 'Alamat Email')}</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/50" />
                    <NeuInput
                      variant="soft"
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder={t('auth.enterEmail')}
                      className="rounded-2xl pl-10" />
                  </div>
                </div>
                </div>
                <button
                  onClick={handleForgotPassword}
                  disabled={!forgotEmail || forgotPasswordMutation.isPending}
                  className="w-full rounded-2xl bg-primary py-3 text-sm md:text-base font-semibold text-white transition-all active:scale-[0.98] hover:bg-primary-dark hover:shadow-md disabled:opacity-50 disabled:active:scale-100"
                >
                  {forgotPasswordMutation.isPending ? '...' : t('profile.sendResetLink', 'Kirim Link Reset')}
                </button>
                <button
                  onClick={() => { setActivePanel('password'); setForgotEmail(userEmail) }}
                  className="w-full rounded-2xl border border-surface-muted py-3 text-sm md:text-base font-medium text-foreground/70 transition-all active:scale-[0.98] hover:bg-surface-muted/50"
                >
                  {t('profile.cancelRemember', 'Batal, Saya Ingat Kata Sandi')}
                </button>
              </div>
            </div>
          ) : (
            <div className="hf-panel-inset p-5 md:p-6">
              <div className="flex flex-col items-center text-center mb-6">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success">
                  <CheckCircle2 className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground text-base md:text-lg mb-1">{t('profile.checkEmail', 'Cek Email Anda')}</h3>
                <p className="text-xs md:text-sm text-foreground/60 max-w-sm">
                  {t('profile.resetLinkSentTo')}{' '}
                  <span className="font-semibold text-primary">{forgotEmail}</span>
                </p>
              </div>
              {/* Spam notice */}
              <div className="rounded-2xl bg-yellow-50 border border-yellow-200 px-4 py-3 mb-2">
                <p className="text-xs text-yellow-700 leading-relaxed">
                  <span className="font-semibold">💡 {t('profile.emailNotFoundTip')}</span> {t('profile.checkSpamFolder')} <span className="font-semibold">{t('profile.spamFolder')}</span> {t('profile.orFolder')} <span className="font-semibold">{t('profile.junkFolder')}</span> {t('profile.inYourInbox')}
                </p>
              </div>
              <div className="space-y-3">
                <button
                  onClick={() => setForgotSubmitted(false)}
                  className="w-full rounded-2xl border border-surface-muted py-3 text-sm md:text-base font-medium text-primary transition-all active:scale-[0.98] hover:bg-surface-muted/50"
                >
                  {t('profile.resendEmail', 'Kirim Ulang Email')}
                </button>
                <button
                  onClick={() => { setActivePanel('password'); setForgotSubmitted(false); setForgotEmail(userEmail) }}
                  className="w-full rounded-2xl bg-primary py-3 text-sm md:text-base font-semibold text-white transition-all active:scale-[0.98] hover:bg-primary-dark hover:shadow-md"
                >
                  {t('profile.back', 'Kembali ke Ganti Kata Sandi')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ─── Change Password Panel ───
  if (!isDesktop && activePanel === 'password') {
    return (
      <div className="relative min-h-screen w-full bg-page">
        <SubPageHeader title={t('profile.changePassword', 'Ganti Kata Sandi')} subtitle={t('profile.changePasswordDesc', 'Perbarui kata sandi akun Anda')} onBack={() => setActivePanel('main')} icon={Lock} />
        <div className="px-5 md:px-6 lg:px-8 pt-4 pb-28 lg:pb-8">
          <div className="hf-panel-inset p-5 md:p-6 space-y-4">
            {capsLockOn && (
              <div className="flex items-center gap-2 rounded-2xl bg-warning/15 border border-warning/40 px-3 py-2" role="status" aria-live="polite">
                <AlertTriangle className="h-4 w-4 text-warning-foreground shrink-0" />
                <p className="text-xs font-medium text-warning-foreground">{t('profile.capsLockOn', 'Caps Lock aktif')}</p>
              </div>
            )}
            <div className="rounded-2xl border border-white/60 bg-surface-sage p-5 neu-raised space-y-4">
            <div>
              <label className="text-xs md:text-sm font-semibold text-foreground/70 mb-1.5 block">{t('profile.currentPassword', 'Kata Sandi Saat Ini')}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/50" />
                <NeuInput variant="soft" type={showCurrentPassword ? "text" : "password"} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} onKeyDown={detectCapsLock} onKeyUp={detectCapsLock} placeholder={t('profile.enterCurrentPassword', 'Masukkan kata sandi saat ini')} className="rounded-2xl pl-10 pr-11" />
                <button type="button" onClick={() => setShowCurrentPassword(!showCurrentPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-foreground/40 hover:text-primary transition-colors" aria-label={showCurrentPassword ? t('auth.hidePassword', 'Sembunyikan kata sandi') : t('auth.showPassword', 'Tampilkan kata sandi')}>
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>
              <div className="mt-1.5 text-right">
                <button onClick={() => setActivePanel('forgotPassword')} className="text-xs md:text-sm font-medium text-primary hover:underline transition-colors">
                  {t('profile.forgotPassword', 'Lupa Kata Sandi?')}
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs md:text-sm font-semibold text-foreground/70 mb-1.5 block">{t('profile.newPassword', 'Kata Sandi Baru')}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/50" />
                <NeuInput variant="soft" type={showNewPassword ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} onKeyDown={detectCapsLock} onKeyUp={detectCapsLock} placeholder={t('profile.enterNewPassword')} className="rounded-2xl pl-10 pr-11" />
                <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-foreground/40 hover:text-primary transition-colors" aria-label={showNewPassword ? t('auth.hidePassword', 'Sembunyikan kata sandi') : t('auth.showPassword', 'Tampilkan kata sandi')}>
                  {showNewPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs md:text-sm font-semibold text-foreground/70 mb-1.5 block">{t('profile.confirmPassword', 'Konfirmasi Kata Sandi Baru')}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/50" />
                <NeuInput variant="soft" type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} onKeyDown={detectCapsLock} onKeyUp={detectCapsLock} placeholder={t('profile.confirmNewPassword')} className="rounded-2xl pl-10 pr-11" />
                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-foreground/40 hover:text-primary transition-colors" aria-label={showConfirmPassword ? t('auth.hidePassword', 'Sembunyikan kata sandi') : t('auth.showPassword', 'Tampilkan kata sandi')}>
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>
            </div>

            {/* Password Requirements Checklist + strength meter (shared) */}
            {newPassword && (
              <PasswordStrength password={newPassword} confirmPassword={confirmPassword} t={t} />
            )}

            {/* Inline error */}
            {passwordError && (
              <div className="flex items-center gap-2 rounded-2xl bg-red-50 border border-red-200 px-4 py-3" role="alert">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0" aria-hidden="true" />
                <p className="text-sm text-destructive font-medium">{passwordError}</p>
              </div>
            )}
            </div>

            <button onClick={handleSavePassword} disabled={!currentPassword || !newPassword || !confirmPassword || savingPassword} className="w-full rounded-2xl bg-primary py-3 text-sm md:text-base font-semibold text-white transition-all active:scale-[0.98] hover:bg-primary-dark hover:shadow-md disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2">
              {savingPassword && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('profile.savePassword', 'Simpan Kata Sandi')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─── Edit Profile Panel ───
  if (!isDesktop && activePanel === 'editProfile') {
    const emailChanged = editEmail !== userEmail

    return (
      <div className="relative min-h-screen w-full bg-page">
        <SubPageHeader title={t('profile.editProfile', 'Edit Profil')} subtitle={t('profile.editProfileDesc', 'Perbarui informasi profil Anda')} onBack={() => { setActivePanel('main'); setEmailToken(''); setEmailTokenSent(false); setEmailConfirmed(false) }} icon={User} />
        <div className="px-5 md:px-6 lg:px-8 pt-4 pb-28 lg:pb-8">
          <div className="flex flex-col items-center mb-6">
            <div className="relative">
              <div className="h-24 w-24 md:h-28 md:w-28 overflow-hidden rounded-full bg-success flex items-center justify-center ring-4 ring-primary/20">
                {(avatarPreview ?? userAvatarUrl) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={(avatarPreview ?? userAvatarUrl) as string} alt={t('profile.avatarAlt', 'Foto profil')} className="h-full w-full object-cover" />
                ) : (
                  <User className="h-12 w-12 md:h-14 md:w-14 text-primary" aria-hidden="true" />
                )}
              </div>
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                aria-label={t('profile.changeAvatar', 'Ubah foto profil')}
                className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white shadow-md transition-all active:scale-95 hover:bg-primary-dark"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={handleAvatarChange}
                aria-hidden="true"
                tabIndex={-1}
              />
            </div>
            {avatarError && (
              <p className="mt-2 text-xs text-destructive font-medium" role="alert">{avatarError}</p>
            )}
          </div>
          <div className="hf-panel-inset p-5 md:p-6 space-y-4">
            <div className="rounded-2xl border border-white/60 bg-surface-sage p-5 neu-raised space-y-4">
            <div>
              <label className="text-xs md:text-sm font-semibold text-foreground/70 mb-1.5 block">{t('profile.fullName', 'Nama Lengkap')}</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/50" />
                <NeuInput variant="soft" type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="rounded-2xl pl-10" />
              </div>
            </div>
            <div>
              <label className="text-xs md:text-sm font-semibold text-foreground/70 mb-1.5 block">{t('profile.email', 'Email')}</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/50" />
                <NeuInput
                  variant="soft"
                  type="email"
                  value={editEmail}
                  onChange={(e) => { setEditEmail(e.target.value); setEmailTokenSent(false); setEmailConfirmed(false); setEmailToken('') }}
                  className="rounded-2xl pl-10" />
              </div>
            </div>

            {/* Email Confirmation Section */}
            {emailChanged && (
              <div className="rounded-2xl border border-primary/20 bg-success/10 p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <Mail className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div className="text-xs md:text-sm text-primary">
                    <p className="font-semibold mb-0.5">{t('profile.confirmEmailTitle', 'Konfirmasi Email Baru')}</p>
                    <p className="text-primary/70">{t('profile.emailConfirmDesc')}</p>
                  </div>
                </div>

                {!emailTokenSent ? (
                  <button
                    onClick={handleSendEmailToken}
                    disabled={emailSending}
                    className="w-full rounded-2xl bg-primary py-2.5 text-sm font-semibold text-white transition-all active:scale-[0.98] hover:bg-primary-dark hover:shadow-md disabled:opacity-50"
                  >
                    {emailSending ? '...' : t('profile.sendConfirmToken')}
                  </button>
                ) : emailConfirmed ? (
                  <div className="flex items-center gap-2 rounded-2xl bg-success/40 px-4 py-2.5">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold text-primary">{t('profile.emailConfirmed')}</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-primary/60">{t('profile.tokenSentTo')} <span className="font-semibold">{editEmail}</span></p>
                    <div>
                      <label className="text-xs font-semibold text-foreground/70 mb-1 block">{t('profile.confirmEmailToken', 'Masukkan 6-Digit Token')}</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/50" />
                        <NeuInput
                          variant="soft"
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={emailToken}
                          onChange={(e) => setEmailToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="000000"
                          maxLength={6}
                          className="rounded-2xl py-2.5 pl-10 text-center text-base font-mono font-semibold tracking-[0.4em] placeholder:text-foreground/20 placeholder:tracking-[0.4em]" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleResendEmailToken}
                        disabled={emailResendCooldown > 0 || emailSending}
                        className="flex-1 rounded-2xl border border-surface-muted py-2.5 text-sm font-medium text-foreground/70 transition-all active:scale-[0.98] hover:bg-surface-muted/50 disabled:opacity-50 flex items-center justify-center gap-1"
                      >
                        {emailSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                        {emailResendCooldown > 0 ? `${emailResendCooldown}s` : t('profile.resend')}
                      </button>
                      <button
                        onClick={handleConfirmEmail}
                        disabled={emailToken.length !== 6 || emailVerifying}
                        className="flex-1 rounded-2xl bg-primary py-2.5 text-sm font-semibold text-white transition-all active:scale-[0.98] hover:bg-primary-dark hover:shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {emailVerifying && <Loader2 className="h-4 w-4 animate-spin" />}
                        {emailVerifying ? 'Verifikasi...' : t('profile.confirm')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            </div>

            <button
              onClick={handleSaveProfile}
              disabled={(emailChanged && !emailConfirmed) || savingProfile}
              className="w-full rounded-2xl bg-primary py-3 text-sm md:text-base font-semibold text-white transition-all active:scale-[0.98] hover:bg-primary-dark hover:shadow-md disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
            >
              {savingProfile && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('profile.saveProfile', 'Simpan Profil')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─── 2FA Panel ───
  if (!isDesktop && activePanel === '2fa') {
    return (
      <div className="relative min-h-screen w-full bg-page">
        <SubPageHeader title={t('profile.twoFactor', 'Autentikasi Dua Faktor')} subtitle={t('profile.twoFactorProtect', 'Lindungi akun dengan aplikasi Authenticator')} onBack={() => setActivePanel('main')} icon={Shield} />
        <div className="px-5 md:px-6 lg:px-8 pt-4 pb-28 lg:pb-8">
          {/* Status Card */}
          <div className="rounded-2xl border border-white/60 bg-surface-sage neu-raised p-5 md:p-6 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-2xl", twoFactorVerified ? "bg-success/40" : "bg-surface-muted")}>
                  <Shield className={cn("h-5 w-5", twoFactorVerified ? "text-primary" : "text-foreground/50")} />
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm md:text-base">{t('profile.twoFactorStatus', 'Status 2FA')}</p>
                  <p className={cn("text-xs md:text-sm font-medium flex items-center gap-1", twoFactorVerified ? "text-primary" : "text-warning")}>
                    {!twoFactorVerified && <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />}
                    {twoFactorVerified ? t('profile.active', 'Aktif') : t('profile.inactive', 'Nonaktif')}
                  </p>
                </div>
              </div>
              <Switch
                checked={twoFactorEnabled}
                onCheckedChange={handle2FAToggle}
                className="data-[state=checked]:bg-primary"
              />
            </div>
          </div>

          {/* Disable 2FA Confirmation Dialog */}
          {showDisable2FAConfirm && (
            <div className="rounded-2xl border-2 border-destructive/20 bg-surface-sage neu-raised p-5 md:p-6 mb-4">
              <div className="flex items-start gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 shrink-0">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm md:text-base">{t('profile.disable2faTitle')}</p>
                  <p className="text-xs md:text-sm text-foreground/60 mt-1">
                    {t('profile.disable2faDesc')}
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDisable2FAConfirm(false)}
                  className="flex-1 rounded-2xl bg-surface-sage border border-white/60 neu-raised py-3 text-sm font-medium text-foreground/70 transition-all active:scale-95 hover:text-primary-shade"
                >
                  {t('profile.cancel')}
                </button>
                <button
                  onClick={handleConfirmDisable2FA}
                  className="flex-1 rounded-2xl bg-destructive py-3 text-sm font-semibold text-white transition-all active:scale-[0.98] hover:bg-destructive/90"
                >
                  {t('profile.yesDisable')}
                </button>
              </div>
            </div>
          )}

          {/* Step QR: Show QR Code + Manual Code */}
          {twoFactorEnabled && twoFactorStep === 'qr' && !twoFactorVerified && (
            <div className="rounded-2xl border border-white/60 bg-surface-sage neu-raised p-5 md:p-6 mb-4">
              {/* Step indicator */}
              <div className="flex items-center gap-2 mb-4">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white text-xs font-bold">1</div>
                <span className="text-sm font-semibold text-foreground">{t('profile.scanQrCode')}</span>
                <div className="flex-1 h-px bg-surface-muted" />
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-muted text-foreground/40 text-xs font-bold">2</div>
                <span className="text-sm font-medium text-foreground/40">{t('profile.verify')}</span>
              </div>

              <p className="text-xs md:text-sm text-foreground/60 mb-4">
                {t('profile.scanQrInstruction')}
              </p>
              <div className="flex justify-center mb-4">
                {renderTwoFactorQr()}
              </div>
              <div className="rounded-2xl bg-surface-sage border border-surface-muted/60 neu-inset shadow-inner p-3 mb-4">
                <p className="text-xs text-foreground/60 mb-1">{t('profile.orEnterManualCode')}</p>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-sm font-semibold text-primary tracking-wider select-all break-all">{twoFactorSecret || 'Memuat secret...'}</p>
                  <button
                    onClick={handleCopyManualCode}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-primary hover:bg-white/60 transition-all active:scale-95"
                  >
                    {twoFactorCopied ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {twoFactorCopied ? t('profile.copied') : t('profile.copy')}
                  </button>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleCancel2FA}
                  className="flex-1 rounded-2xl bg-surface-sage border border-white/60 neu-raised py-3 text-sm font-medium text-foreground/70 transition-all active:scale-95 hover:text-primary-shade"
                >
                  {t('profile.cancel')}
                </button>
                <button
                  onClick={() => setTwoFactorStep('verify')}
                  className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-semibold text-white transition-all active:scale-[0.98] hover:bg-primary-dark hover:shadow-md"
                >
                  {t('profile.continue')}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step Verify: Enter 6-digit code */}
          {twoFactorEnabled && twoFactorStep === 'verify' && !twoFactorVerified && (
            <div className="rounded-2xl border border-white/60 bg-surface-sage neu-raised p-5 md:p-6 mb-4">
              {/* Step indicator */}
              <div className="flex items-center gap-2 mb-4">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-success text-primary text-xs font-bold">
                  <Check className="h-3.5 w-3.5" />
                </div>
                <span className="text-sm font-medium text-primary">{t('profile.scanQrCode')}</span>
                <div className="flex-1 h-px bg-primary/30" />
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white text-xs font-bold">2</div>
                <span className="text-sm font-semibold text-foreground">{t('profile.verify')}</span>
              </div>

              <p className="text-xs md:text-sm text-foreground/60 mb-4">
                {t('profile.enterVerificationCode')}
              </p>
              <div className="relative mb-4">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/50" />
                <NeuInput
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  className="rounded-2xl pl-10 text-center text-lg md:text-xl font-mono font-semibold tracking-[0.5em] placeholder:text-foreground/20 placeholder:tracking-[0.5em]" />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleCancel2FA}
                  className="flex-1 rounded-2xl bg-surface-sage border border-white/60 neu-raised py-3 text-sm font-medium text-foreground/70 transition-all active:scale-95 hover:text-primary-shade"
                >
                  {t('profile.cancel')}
                </button>
                <button
                  disabled={totpCode.length !== 6 || verifying2FA}
                  onClick={handleVerify2FA}
                  className="flex-1 rounded-2xl bg-primary py-3 text-sm font-semibold text-white transition-all active:scale-[0.98] hover:bg-primary-dark hover:shadow-md disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
                >
                  {verifying2FA && <Loader2 className="h-4 w-4 animate-spin" />}
                  {verifying2FA ? t('profile.verifying') : t('profile.verifyAndActivate')}
                </button>
              </div>
            </div>
          )}

          {/* Success: 2FA Verified — show Recovery Codes */}
          {twoFactorVerified && (
            <>
              <div className="rounded-2xl bg-success/20 border border-primary/20 p-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-primary text-sm md:text-base">{t('profile.twoFactorActivated')}</p>
                    <p className="text-xs text-primary/70">{t('profile.twoFactorActivatedDesc')}</p>
                  </div>
                </div>
              </div>

              {/* Recovery Codes */}
              {recoveryCodesList.length > 0 ? (
                <div className="rounded-2xl border border-white/60 bg-surface-sage neu-raised p-5 md:p-6">
                  <h3 className="font-semibold text-foreground text-sm md:text-base mb-2">{t('profile.recoveryCodes')}</h3>
                  <p className="text-xs md:text-sm text-foreground/60 mb-4">
                    {t('profile.recoveryCodesDesc')}
                  </p>
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {recoveryCodesList.map((code, i) => (
                      <div key={i} className="rounded-lg bg-surface-muted px-3 py-2 text-center">
                        <span className="font-mono text-xs md:text-sm font-medium text-foreground select-all">{code}</span>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={handleCopyAllRecoveryCodes} className="rounded-2xl border border-surface-muted py-2.5 text-sm font-medium text-primary transition-all hover:bg-surface-muted/50 active:scale-[0.98] flex items-center justify-center gap-2">
                      <Copy className="h-4 w-4" />
                      {t('profile.copyAllCodes')}
                    </button>
                    <button onClick={handleDownloadRecoveryCodes} className="rounded-2xl bg-primary py-2.5 text-sm font-semibold text-white transition-all hover:bg-primary-dark hover:shadow-md active:scale-[0.98] flex items-center justify-center gap-2">
                      <ArrowRight className="h-4 w-4 rotate-90" aria-hidden="true" />
                      {t('profile.downloadCodes', 'Unduh .txt')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-white/60 bg-surface-sage neu-raised p-5 md:p-6">
                  <h3 className="font-semibold text-foreground text-sm md:text-base mb-2">{t('profile.recoveryCodes')}</h3>
                  <div className="rounded-xl border border-yellow-400/30 bg-yellow-50 p-4">
                    <p className="text-xs md:text-sm text-yellow-800 font-medium leading-relaxed">
                      {t('profile.recoveryCodesHidden', { defaultValue: 'Demi keamanan, kode pemulihan hanya ditampilkan satu kali saat pertama diaktifkan. Jika Anda kehilangan kode pemulihan, nonaktifkan dan aktifkan kembali 2FA untuk mendapatkan kode baru.' })}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Idle: 2FA not enabled */}
          {!twoFactorEnabled && !twoFactorVerified && (
            <div className="rounded-2xl border border-white/60 bg-surface-sage neu-raised p-5 md:p-6">
              <div className="flex flex-col items-center text-center py-6">
                <div className="mb-4 rounded-full bg-surface-muted/50 p-5">
                  <Shield className="h-10 w-10 text-foreground/30" />
                </div>
                <h3 className="font-semibold text-foreground text-base mb-2">{t('profile.twoFactorNotActive')}</h3>
                <p className="text-xs md:text-sm text-foreground/50 max-w-sm">
                  {t('profile.twoFactorNotActiveDesc')}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ─── IoT Devices Panel ───
  if (!isDesktop && activePanel === 'iotStatus' && isAdmin) {
    const onlineCount = iotDevices.filter(d => d.status === 'online').length
    const warningCount = iotDevices.filter(d => d.status === 'warning').length
    const offlineCount = iotDevices.filter(d => d.status === 'offline').length

    return (
      <div className="relative min-h-screen w-full bg-page">
        <SubPageHeader title={t('profile.iotDevice', 'Perangkat IoT')} subtitle={t('profile.iotManage', 'Kelola dan pantau perangkat Anda')} onBack={() => setActivePanel('main')} icon={Cpu} />
        <div className="px-5 md:px-6 lg:px-8 pt-4 pb-28 lg:pb-8">
          {/* Summary Cards — sage neumorphic, color only on the count */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="rounded-2xl border border-success/30 bg-success/10 p-3 text-center neu-inset shadow-inner">
              <p className="text-2xl md:text-3xl font-semibold text-primary">{onlineCount}</p>
              <p className="text-[10px] md:text-xs font-medium text-primary/80">Online</p>
            </div>
            <div className="rounded-2xl border border-yellow-400/30 bg-yellow-50 p-3 text-center neu-inset shadow-inner">
              <p className="text-2xl md:text-3xl font-semibold text-warning-foreground">{warningCount}</p>
              <p className="text-[10px] md:text-xs font-medium text-warning-foreground/80">Peringatan</p>
            </div>
            <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-center neu-inset shadow-inner">
              <p className="text-2xl md:text-3xl font-semibold text-destructive">{offlineCount}</p>
              <p className="text-[10px] md:text-xs font-medium text-destructive/80">Offline</p>
            </div>
          </div>

          {/* Add Device Button */}
          <button
            onClick={() => setActivePanel('addDevice')}
            className="hf-btn-primary w-full px-4 py-3.5 mb-4 text-sm md:text-base"
          >
            <Plus className="h-5 w-5" />
            <span>{t('profile.addDevice', 'Tambah Perangkat')}</span>
          </button>

          {/* Device List */}
          <div className="rounded-2xl border border-white/60 bg-surface-sage p-4 md:p-5 neu-inset">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-foreground text-sm md:text-base">{t('profile.allDevices')}</h3>
              <div className="flex items-center gap-2">
                <Wifi className="h-4 w-4 text-primary" />
                <span className="text-xs md:text-sm text-foreground/60">{onlineCount}/{iotDevices.length} {t('profile.devicesConnected')}</span>
              </div>
            </div>
            {iotDevices.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-10 text-center" role="status">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-sage neu-inset">
                  <Cpu className="h-8 w-8 text-foreground/30" aria-hidden="true" />
                </div>
                <h4 className="font-semibold text-foreground text-base mb-1">{t('profile.noDevicesTitle', 'Belum ada perangkat')}</h4>
                <p className="text-xs md:text-sm text-foreground/50 max-w-xs mb-5">
                  {t('profile.noDevicesDesc', 'Tambahkan perangkat IoT pertama Anda untuk mulai memantau lahan.')}
                </p>
                <button
                  onClick={() => setActivePanel('addDevice')}
                  className="hf-btn-primary px-5 py-2.5 text-sm"
                >
                  <Plus className="h-4 w-4" />
                  {t('profile.addFirstDevice', 'Tambah Perangkat Pertama')}
                </button>
              </div>
            ) : (
            <div className="space-y-3">
              {iotDevices.map((device) => (
                <div key={device.id} className="rounded-2xl border border-white/60 bg-surface-sage p-3 md:p-4 neu-raised">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-transparent neu-inset">
                        {device.type === "pump" && <Droplet className="h-4 w-4 text-primary" />}
                        {device.type === "sensor" && <Activity className="h-4 w-4 text-primary" />}
                        {device.type === "camera" && <Camera className="h-4 w-4 text-primary" />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground text-sm md:text-base truncate">{device.name}</p>
                        <p className="text-xs text-foreground/50">{device.code} • {device.type}</p>
                        <p className="text-[10px] text-foreground/40">{t('profile.lastSeen')} {device.lastSeen}</p>
                        {device.warning && (
                          <p className="text-[10px] md:text-xs text-yellow-600 mt-0.5">⚠ {device.warning}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <div className={cn(
                        "flex items-center gap-1.5 rounded-full px-2.5 py-1 neu-inset border border-white/40",
                        device.status === "online" ? "bg-success/20" :
                        device.status === "warning" ? "bg-yellow-50" : "bg-red-50"
                      )}>
                        <div className={cn(
                          "h-2 w-2 rounded-full",
                          device.status === "online" ? "bg-primary" :
                          device.status === "warning" ? "bg-yellow-500" : "bg-destructive"
                        )} />
                        <span className={cn(
                          "text-xs font-medium capitalize",
                          device.status === "online" ? "text-primary" :
                          device.status === "warning" ? "text-yellow-700" : "text-destructive"
                        )}>{device.status}</span>
                      </div>
                      <button 
                        onClick={() => setDeviceToDelete({ id: device.id, name: device.name })}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-destructive transition-all hover:bg-destructive hover:text-white active:scale-95"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            )}
          </div>
        </div>
        {/* Delete Confirmation Modal */}
        {/* Delete Confirmation Modal moved to root */}
      </div>
    )
  }

  // ─── Add Device Panel ───
  if (!isDesktop && activePanel === 'addDevice' && isAdmin) {
    return (
      <div className="relative min-h-screen w-full bg-page">
        <SubPageHeader title={t('profile.addDevice')} subtitle={t('profile.addDeviceSubtitle')} onBack={() => setActivePanel('iotStatus')} icon={Plus} />
        <div className="px-5 md:px-6 lg:px-8 pt-4 pb-28 lg:pb-8">
          <div className="hf-panel-inset p-5 md:p-6 space-y-4">
            <div className="rounded-2xl border border-white/60 bg-surface-sage p-5 neu-raised space-y-4">
            <div>
              <label className="text-xs md:text-sm font-semibold text-foreground/70 mb-1.5 block">{t('profile.deviceName')}</label>
              <div className="relative">
                <Cpu className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/50" />
                <NeuInput variant="soft" type="text" value={newDeviceName} onChange={(e) => setNewDeviceName(e.target.value)} placeholder="e.g. JLNew H10: Soil Moisture Sensor" className="rounded-2xl pl-10 placeholder:text-foreground/30" />
              </div>
            </div>
            <div>
              <label className="text-xs md:text-sm font-semibold text-foreground/70 mb-1.5 block">{t('profile.deviceCode')}</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/50 text-sm font-mono">#</span>
                <NeuInput variant="soft" type="text" value={newDeviceCode} onChange={(e) => setNewDeviceCode(e.target.value.toUpperCase())} placeholder="e.g. WS004" maxLength={10} className="rounded-2xl pl-10 font-mono placeholder:text-foreground/30" />
              </div>
            </div>
            <div>
              <label className="text-xs md:text-sm font-semibold text-foreground/70 mb-1.5 block">{t('profile.deviceType')}</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { type: 'sensor', labelKey: 'profile.sensor', icon: Activity },
                  { type: 'pump', labelKey: 'profile.pump', icon: Droplet },
                  { type: 'camera', labelKey: 'profile.camera', icon: Camera },
                ].map((opt) => (
                  <button
                    key={opt.type}
                    onClick={() => setNewDeviceType(opt.type)}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-2xl px-3 py-4 transition-all active:scale-[0.98]",
                      newDeviceType === opt.type
                        ? "bg-primary text-white shadow-sm"
                        : "bg-surface-muted text-foreground hover:bg-surface-muted/70"
                    )}
                  >
                    <opt.icon className={cn("h-5 w-5", newDeviceType === opt.type ? "text-white" : "text-primary")} />
                    <span className="text-xs md:text-sm font-medium">{t(opt.labelKey)}</span>
                  </button>
                ))}
              </div>
            </div>
            </div>
            <button
              disabled={!newDeviceName || !newDeviceCode || savingDevice}
              onClick={handleCreateDevice}
              className="w-full rounded-2xl bg-primary py-3 text-sm md:text-base font-semibold text-white transition-all active:scale-[0.98] hover:bg-primary-dark hover:shadow-md disabled:opacity-50 disabled:active:scale-100"
            >
              <span className="flex items-center justify-center gap-2">
                <Check className="h-4 w-4" />
                {t('profile.saveNewDevice')}
              </span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─── Measurement Units Panel ───
  if (!isDesktop && activePanel === 'units') {
    return (
      <div className="relative min-h-screen w-full bg-page">
        <SubPageHeader title={t('profile.measurementUnits')} subtitle={t('profile.measurementUnitsSubtitle')} onBack={() => setActivePanel('main')} icon={Ruler} />
        <div className="px-5 md:px-6 lg:px-8 pt-4 pb-28 lg:pb-8">
          {measurementUnits.map((unit) => {
            const currentValue = selectedUnits[unit.id]
            const setValue = (val: string) => setSelectedUnits(prev => ({ ...prev, [unit.id]: val }))

            return (
              <div key={unit.id} className="rounded-2xl border border-white/60 bg-surface-sage p-5 md:p-6 mb-4 neu-raised">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-transparent neu-inset">
                    <unit.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground text-sm md:text-base">{t(unit.labelKey)}</h3>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {unit.options.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setValue(opt)}
                      className={cn(
                        "rounded-2xl px-4 py-3 text-sm md:text-base font-medium transition-all duration-200 active:scale-[0.98]",
                        currentValue === opt
                          ? "bg-primary text-white neu-btn-primary"
                          : "bg-surface-sage text-foreground/70 neu-inset hover:bg-surface-leaf hover:text-primary"
                      )}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
          <button
            onClick={handleSaveUnits}
            disabled={savingUnits}
            className="w-full rounded-2xl bg-primary py-3 text-sm md:text-base font-semibold text-white transition-all active:scale-[0.98] hover:bg-primary-dark hover:shadow-md"
          >
            {t('profile.saveUnits', 'Simpan Satuan')}
          </button>
        </div>
      </div>
    )
  }

  // ─── Delete Account Panel ───
  if (!isDesktop && activePanel === 'deleteAccount') {
    return (
      <div className="relative min-h-screen w-full bg-page">
        <SubPageHeader title={t('profile.deleteAccount', 'Hapus Akun')} subtitle={t('profile.deleteAccountConfirm', 'Tindakan ini tidak dapat dibatalkan')} onBack={() => { setActivePanel('main'); setDeleteConfirmText(''); setDeletePassword(''); setDelete2FACode(''); setDeleteError('') }} icon={Trash2} />
        <div className="px-5 md:px-6 lg:px-8 pt-4 pb-28 lg:pb-8">
          <div className="hf-panel-inset p-5 md:p-6 mb-4">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="mb-4 rounded-full bg-red-50/50 border border-red-200/30 neu-inset p-4 shadow-[inset_0_4px_10px_rgba(220,38,38,0.15)] text-destructive">
                <AlertTriangle className="h-10 w-10" />
              </div>
              <h3 className="font-semibold text-foreground text-lg mb-2">{t('profile.deleteAccountTitle')}</h3>
              <p className="text-xs md:text-sm text-foreground/60 max-w-sm">
                {t('profile.deleteAccountDesc')}
              </p>
            </div>

            <div className="rounded-2xl bg-red-50/80 border border-red-200/60 p-4 mb-4 neu-raised shadow-[inset_0_2px_4px_rgba(255,255,255,0.8),0_4px_10px_rgba(220,38,38,0.1)]">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <div className="text-xs md:text-sm text-destructive">
                  <p className="font-semibold mb-1">{t('profile.dataToBeDeleted')}</p>
                  <ul className="list-disc list-inside space-y-0.5 text-destructive/80">
                    <li>{t('profile.deleteProfileSettings')}</li>
                    <li>{t('profile.deleteIotConfig')}</li>
                    <li>{t('profile.deleteSensorHistory')}</li>
                    <li>{t('profile.deleteIrrigationRules')}</li>
                    <li>{t('profile.deleteAllNotifications')}</li>
                  </ul>
                </div>
              </div>
            </div>


            {/* Step 1: Password Verification */}
            <div className="rounded-2xl border border-white/60 bg-surface-sage p-5 neu-raised mb-4">
            <div className="mb-4">
              <label className="text-xs md:text-sm font-semibold text-foreground/70 mb-1.5 block">
                {t('profile.verifyPassword')}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive/50" />
                <NeuInput
                  variant="soft"
                  type={showDeletePassword ? "text" : "password"}
                  value={deletePassword}
                  onChange={(e) => { setDeletePassword(e.target.value); setDeleteError('') }}
                  placeholder={t('profile.enterYourPassword')}
                  className="rounded-2xl border-red-200 pl-10 pr-11 placeholder:text-foreground/30 focus:ring-destructive/30 focus:border-destructive" />
                <button type="button" onClick={() => setShowDeletePassword(!showDeletePassword)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-foreground/40 hover:text-destructive transition-colors" aria-label={showDeletePassword ? t('auth.hidePassword', 'Sembunyikan kata sandi') : t('auth.showPassword', 'Tampilkan kata sandi')}>
                  {showDeletePassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>
            </div>

            {/* Step 2: 2FA Code (only if 2FA is active) */}
            {twoFactorVerified && (
              <div className="mb-4">
                <label className="text-xs md:text-sm font-semibold text-foreground/70 mb-1.5 block">
                  {t('profile.twoFactorCodeLabel')}
                </label>
                <div className="relative">
                  <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive/50" />
                  <NeuInput
                    variant="soft"
                    type="text"
                    value={delete2FACode}
                    onChange={(e) => { setDelete2FACode(e.target.value.replace(/\D/g, '').slice(0, 6)); setDeleteError('') }}
                    placeholder="000000"
                    maxLength={6}
                    className="rounded-2xl border-red-200 pl-10 text-center text-base font-mono font-semibold tracking-[0.4em] placeholder:text-foreground/15 placeholder:tracking-[0.4em] focus:ring-destructive/30 focus:border-destructive" />
                </div>
                <p className="text-[10px] md:text-xs text-foreground/40 mt-1.5">{t('profile.twoFactorRequired')}</p>
              </div>
            )}

            {/* Step 3: Type HAPUS AKUN */}
            <div className="mb-4">
              <label className="text-xs md:text-sm font-semibold text-foreground/70 mb-1.5 block">
                {t('profile.typeToConfirm')} <span className="font-bold text-destructive">{t('profile.deleteConfirmText')}</span> {t('profile.toConfirm')}
              </label>
              <NeuInput
                variant="soft"
                type="text"
                value={deleteConfirmText}
                onChange={(e) => { setDeleteConfirmText(e.target.value); setDeleteError('') }}
                placeholder={t('profile.deleteConfirmText')}
                className="rounded-2xl border-red-200 placeholder:text-foreground/20 focus:ring-destructive/30 focus:border-destructive" />
            </div>
            </div>

            {/* Error */}
            {deleteError && (
              <div className="flex items-center gap-2 rounded-2xl bg-red-50 border border-red-200 px-4 py-3 mb-4" role="alert">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0" aria-hidden="true" />
                <p className="text-sm text-destructive font-medium">{deleteError}</p>
              </div>
            )}

            <button
              onClick={handleDeleteAccount}
              disabled={deleteConfirmText !== t('profile.deleteConfirmText') || !deletePassword || (twoFactorVerified && delete2FACode.length !== 6) || deletingAccount}
              className="w-full rounded-2xl bg-destructive py-3 text-sm md:text-base font-semibold text-white transition-all active:scale-[0.98] hover:bg-destructive/90 disabled:opacity-40 disabled:active:scale-100"
            >
              <span className="flex items-center justify-center gap-2">
                {deletingAccount ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {deletingAccount ? '...' : t('profile.deleteAccount', 'Hapus Akun')}
              </span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─── Main Profile Panel ───
  const modalEmailChanged = editEmail !== userEmail

  return (
    <div className="relative min-h-screen w-full bg-page">

      {/* ═══════════ MOBILE LAYOUT (< lg) ═══════════ */}
      <div className="lg:hidden">
        {/* Profile Header — same sage gradient as other pages for consistency */}
        <div
          className="bg-linear-to-b from-surface-sage-soft to-surface-sage px-5 md:px-6 pb-8 neu-header border-b border-white/50"
          style={{ paddingTop: 'max(56px, calc(env(safe-area-inset-top, 0px) + 32px))' }}
        >
          <div className="flex flex-col items-center text-center gap-3">
            <UserAvatar
              src={userAvatarUrl}
              name={userName}
              className="h-20 w-20 md:h-24 md:w-24 ring-4 ring-white shadow-md"
              iconClassName="h-10 w-10 md:h-12 md:w-12 text-2xl"
            />
            <div>
              <h2 className="text-lg md:text-xl font-semibold text-foreground">{userName}</h2>
              <div className="flex flex-col items-center gap-1 mt-0.5">
                <p className="text-sm md:text-base text-foreground/60">{userEmail}</p>
                <div className="inline-flex items-center rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-[10px] md:text-xs font-semibold text-primary shadow-sm">
                  {userRole}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="px-5 md:px-6 pt-4 pb-28">
          {/* System Settings */}
          <div className="mb-6">
            <h3 className="text-sm md:text-base font-semibold text-foreground/70 mb-3 px-1">{t('profile.systemSettings', 'Pengaturan Sistem')}</h3>
            <div className="hf-panel-inset overflow-hidden">
              <button onClick={() => setActivePanel('language')} className="flex w-full items-center justify-between px-4 py-3.5 border-b border-surface-muted transition-all duration-200 hover:bg-primary/5 active:scale-[0.99] group">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/30"><Globe className="h-5 w-5 text-primary" /></div>
                  <span className="font-medium text-foreground text-sm md:text-base">{t('profile.language', 'Bahasa')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm md:text-base text-foreground/60">{currentLangObj.flag} {currentLangObj.label}</span>
                  <ChevronRight className="h-5 w-5 text-foreground/30" />
                </div>
              </button>
              <details className="border-b border-surface-muted group/notif-prefs">
                <summary className="flex items-center justify-between px-4 py-3.5 cursor-pointer list-none transition-all duration-200 hover:bg-primary/5 active:scale-[0.99]">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/30"><Bell className="h-5 w-5 text-primary" /></div>
                    <div className="text-left">
                      <p className="font-medium text-foreground text-sm md:text-base">{t('profile.notifications', 'Notifikasi & Peringatan')}</p>
                      <p className="text-xs text-foreground/50 mt-0.5">{notificationsEnabled ? t('profile.active', 'Aktif') : t('profile.inactive', 'Nonaktif')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3" onClick={(e) => e.preventDefault()}>
                    <Switch checked={notificationsEnabled} onCheckedChange={handleNotificationsToggle} className="data-[state=checked]:bg-primary" aria-label={t('profile.notifications', 'Notifikasi & Peringatan')} />
                    <ChevronRight className="h-5 w-5 text-foreground/30 transition-transform group-open/notif-prefs:rotate-90" aria-hidden="true" />
                  </div>
                </summary>
                <div className="px-4 pb-4 space-y-3 bg-surface-muted/20" aria-disabled={!notificationsEnabled}>
                  <p className="text-[11px] uppercase tracking-wide font-semibold text-foreground/50 pt-3">{t('profile.notifPerCategory', 'Per Kategori & Jalur')}</p>
                  {(['irrigation', 'sensor', 'system'] as const).map((cat) => (
                    <div key={cat} className="rounded-2xl bg-white p-3 border border-surface-muted/60">
                      <div className="text-xs font-semibold text-foreground mb-2">{t(`profile.notifCat_${cat}`, cat)}</div>
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <label className="flex items-center gap-2 flex-1 cursor-pointer">
                          <Switch
                            checked={notificationsEnabled && notificationPrefs[cat].push}
                            disabled={!notificationsEnabled}
                            onCheckedChange={(v) => handleNotifPrefChange(cat, 'push', v)}
                            className="data-[state=checked]:bg-primary"
                            aria-label={t('profile.notifChannelPush', 'Push')}
                          />
                          <span className="text-foreground/70">{t('profile.notifChannelPush', 'Push')}</span>
                        </label>
                        <label className="flex items-center gap-2 flex-1 cursor-pointer">
                          <Switch
                            checked={notificationsEnabled && notificationPrefs[cat].email}
                            disabled={!notificationsEnabled}
                            onCheckedChange={(v) => handleNotifPrefChange(cat, 'email', v)}
                            className="data-[state=checked]:bg-primary"
                            aria-label={t('profile.notifChannelEmail', 'Email')}
                          />
                          <span className="text-foreground/70">{t('profile.notifChannelEmail', 'Email')}</span>
                        </label>
                      </div>
                    </div>
                  ))}

                  {/* Sensor Threshold Ranges */}
                  <p className="text-[11px] uppercase tracking-wide font-semibold text-foreground/50 pt-4">{t('profile.thresholdTitle', 'Ambang Batas Notifikasi')}</p>
                  <p className="text-[10px] text-foreground/40 -mt-1 mb-1">{t('profile.thresholdDesc', 'Terima notifikasi jika nilai di luar rentang')}</p>
                  {sensorParamConfig.map((param) => {
                    const th = sensorThresholds[param.key]
                    const displayMin = toDisplayValue(th.min, param.key)
                    const displayMax = toDisplayValue(th.max, param.key)
                    const displayRange = getDisplayRange(param.key, param.rangeMin, param.rangeMax)
                    const displayUnit = selectedUnits[param.unitKey] || th.unit
                    return (
                      <div key={param.key} className="rounded-2xl bg-white p-3 border border-surface-muted/60">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <param.icon className="h-4 w-4 text-primary" />
                            <span className="text-xs font-semibold text-foreground">{t(param.labelKey)}</span>
                          </div>
                          <span className="text-[10px] text-foreground/40 font-medium">{displayMin}{displayUnit} — {displayMax}{displayUnit}</span>
                        </div>
                        <div className="mt-6 mb-3 px-2">
                          <Slider
                            value={[displayMin, displayMax]}
                            min={displayRange.min}
                            max={displayRange.max}
                            step={param.step}
                            disabled={!notificationsEnabled}
                            onValueChange={([min, max]) => {
                              const baseMin = fromDisplayValue(min, param.key)
                              const baseMax = fromDisplayValue(max, param.key)
                              setSensorThresholds((prev) => ({ 
                                ...prev, 
                                [param.key]: { ...prev[param.key], min: baseMin, max: baseMax } 
                              }))
                            }}
                            onValueCommit={() => handleSensorThresholdChange(param.key, sensorThresholds[param.key].min, sensorThresholds[param.key].max)}
                            className={cn(
                              "**:data-[slot=slider-track]:bg-surface-muted/80 [&_[data-slot=slider-track]]:neu-inset **:data-[slot=slider-track]:h-2.5",
                              "**:data-[slot=slider-range]:bg-primary **:data-[slot=slider-range]:shadow-[0_0_10px_rgba(0,108,73,0.6)]",
                              "**:data-[slot=slider-thumb]:h-5 **:data-[slot=slider-thumb]:w-5 **:data-[slot=slider-thumb]:border-2 **:data-[slot=slider-thumb]:border-primary **:data-[slot=slider-thumb]:bg-white **:data-[slot=slider-thumb]:shadow-[0_2px_5px_rgba(0,0,0,0.15)]",
                              !notificationsEnabled && "opacity-50"
                            )}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </details>
              {isAdmin && (
                <button onClick={() => setActivePanel('iotStatus')} className="flex w-full items-center justify-between px-4 py-3.5 border-b border-surface-muted transition-all duration-200 hover:bg-primary/5 active:scale-[0.99] group">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/30"><Cpu className="h-5 w-5 text-primary" /></div>
                    <span className="font-medium text-foreground text-sm md:text-base">{t('profile.iotDevice', 'Status Perangkat IoT')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm md:text-base text-foreground/60">{iotDevices.filter(d => d.status === 'online').length} {t('profile.connected', 'Terhubung')}</span>
                    <ChevronRight className="h-5 w-5 text-foreground/30" />
                  </div>
                </button>
              )}
              <button onClick={() => setActivePanel('units')} className="flex w-full items-center justify-between px-4 py-3.5 transition-all duration-200 hover:bg-primary/5 active:scale-[0.99] group">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/30"><Ruler className="h-5 w-5 text-primary" /></div>
                  <span className="font-medium text-foreground text-sm md:text-base">{t('profile.measurementUnits', 'Satuan Pengukuran')}</span>
                </div>
              </button>
            </div>
          </div>
          {/* Account & Security */}
          <div className="mb-6">
            <h3 className="text-sm md:text-base font-semibold text-foreground/70 mb-3 px-1">{t('profile.accountSecurity', 'Akun & Keamanan')}</h3>
            <div className="hf-panel-inset overflow-hidden">
              <button onClick={() => setActivePanel('password')} className="flex w-full items-center justify-between px-4 py-3.5 border-b border-surface-muted transition-all duration-200 hover:bg-primary/5 active:scale-[0.99] group">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/30"><Lock className="h-5 w-5 text-primary" /></div>
                  <span className="font-medium text-foreground text-sm md:text-base">{t('profile.changePassword', 'Ganti Kata Sandi')}</span>
                </div>
                <ChevronRight className="h-5 w-5 text-foreground/30" />
              </button>
              <button onClick={() => setActivePanel('2fa')} className="flex w-full items-center justify-between px-4 py-3.5 border-b border-surface-muted transition-all duration-200 hover:bg-primary/5 active:scale-[0.99] group">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/30"><Shield className="h-5 w-5 text-primary" /></div>
                  <span className="font-medium text-foreground text-sm md:text-base">{t('profile.twoFactor', 'Autentikasi Dua Faktor (2FA)')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("inline-flex items-center gap-1 text-xs md:text-sm font-medium px-2 py-0.5 rounded-full", twoFactorVerified ? "bg-success/40 text-primary" : "bg-warning/20 text-warning-foreground")}>
                    {!twoFactorVerified && <AlertTriangle className="h-3 w-3" aria-hidden="true" />}
                    {twoFactorVerified ? t('profile.active') : t('profile.inactive')}
                  </span>
                  <ChevronRight className="h-5 w-5 text-foreground/30" />
                </div>
              </button>
              <button onClick={() => setActivePanel('editProfile')} className="flex w-full items-center justify-between px-4 py-3.5 transition-all duration-200 hover:bg-primary/5 active:scale-[0.99] group">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/30"><Pencil className="h-5 w-5 text-primary" /></div>
                  <span className="font-medium text-foreground text-sm md:text-base">{t('profile.editProfile', 'Edit Profil')}</span>
                </div>
                <ChevronRight className="h-5 w-5 text-foreground/30" />
              </button>
            </div>
          </div>
          {/* Danger Zone — Logout + Delete grouped */}
          <div className="mb-6">
            <h3 className="text-sm md:text-base font-semibold text-destructive/70 mb-3 px-1">{t('profile.dangerZone', 'Zona Bahaya')}</h3>
            <div className="hf-panel-inset overflow-hidden">
              <button onClick={() => authApi.logout()} className="flex w-full items-center justify-between px-4 py-3.5 border-b border-surface-muted transition-all hover:bg-red-50 active:scale-[0.99]">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100"><LogOut className="h-5 w-5 text-destructive" /></div>
                  <span className="font-medium text-destructive text-sm md:text-base">{t('profile.logOut', 'Keluar')}</span>
                </div>
                <ChevronRight className="h-5 w-5 text-destructive/30" />
              </button>
              <button onClick={() => setActivePanel('deleteAccount')} className="flex w-full items-center justify-between px-4 py-3.5 transition-all hover:bg-red-50 active:scale-[0.99]">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100"><Trash2 className="h-5 w-5 text-destructive" /></div>
                  <span className="font-medium text-destructive text-sm md:text-base">{t('profile.deleteAccount', 'Hapus Akun')}</span>
                </div>
                <ChevronRight className="h-5 w-5 text-destructive/30" />
              </button>
            </div>
          </div>
          <p className="text-center text-xs md:text-sm text-foreground/40 mt-6">Hanjeli Smart Farm v1.0.0</p>
        </div>
      </div>

      {/* ═══════════ DESKTOP LAYOUT (lg+) ═══════════ */}
      <div className="hidden lg:block">
        <div className="px-8 pt-6 pb-8">
          <div className="mx-auto max-w-5xl space-y-6">

            {/* ── HERO PROFILE CARD — green gradient ── */}
            <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-primary-dark via-primary to-primary-shade shadow-[0_20px_50px_-20px_rgba(0,108,73,0.55)]">
              {/* Decorative organic curves */}
              <div className="pointer-events-none absolute inset-0 opacity-20">
                <div className="absolute -right-10 -top-16 h-64 w-64 rounded-full bg-leaf/30 blur-3xl" />
                <div className="absolute right-32 top-4 h-32 w-32 rounded-full bg-primary-fixed-dim/20 blur-2xl" />
              </div>
              <div className="relative flex items-center justify-between gap-6 px-8 py-7">
                <div className="flex items-center gap-5 min-w-0">
                  <UserAvatar
                    src={userAvatarUrl}
                    name={userName}
                    className="h-20 w-20 ring-4 ring-white/30 shadow-xl shrink-0"
                    iconClassName="h-10 w-10 text-2xl text-white"
                  />
                  <div className="min-w-0">
                    <h2 className="text-2xl font-bold text-white font-(family-name:--font-jakarta) truncate">{userName}</h2>
                    <p className="text-sm text-white/70 mt-0.5 truncate">{userEmail}</p>
                    <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 px-2.5 py-1 text-xs font-semibold text-white">
                      <Shield className="h-3 w-3" />
                      {userRole}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => { setShowEditModal(true); setEditName(userName); setEditEmail(userEmail) }}
                  className="shrink-0 inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur-sm border border-white/25 px-5 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-white/25 hover:border-white/40 active:scale-[0.98]"
                >
                  <Pencil className="h-4 w-4" />
                  {t('profile.editProfile', 'Edit Profil')}
                </button>
              </div>
            </div>

            {/* ── PENGATURAN SISTEM ── */}
            <div className="rounded-3xl bg-white border border-surface-muted/70 shadow-[0_4px_20px_-8px_rgba(143,139,120,0.25)] overflow-hidden">
              {/* Section header */}
              <div className="flex items-start gap-3 px-7 pt-6 pb-5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-success/35">
                  <Settings className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-foreground font-(family-name:--font-jakarta)">{t('profile.systemSettings', 'Pengaturan Sistem')}</h3>
                  <p className="text-xs text-foreground/55 mt-0.5">{t('profile.systemSettingsDesc', 'Bahasa, notifikasi & ambang batas sensor')}</p>
                </div>
              </div>

              {/* 2-col mini cards: Bahasa + Notifikasi */}
              <div className="px-7 pb-6 grid grid-cols-2 gap-4">
                {/* Bahasa mini-card with custom dropdown (monitoring pattern) */}
                <div className="rounded-2xl border border-surface-muted/60 bg-surface-elevated px-5 py-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-success/30">
                      <Globe className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{t('profile.language', 'Bahasa')}</p>
                      <p className="text-[11px] text-foreground/50">{t('profile.languageSubtitle', 'Diterjemahkan secara native')}</p>
                    </div>
                  </div>
                  <div className="relative">
                    <button
                      onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
                      aria-expanded={isLangDropdownOpen}
                      aria-haspopup="listbox"
                      className="group w-full flex items-center justify-between rounded-2xl bg-surface-sage border border-white/60 px-4 py-2.5 neu-raised transition-all duration-300 hover:bg-surface-leaf hover:-translate-y-0.5 neu-raised-hover active:translate-y-0 active:scale-[0.99] neu-selector-press"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-base leading-none">{currentLangObj.flag}</span>
                        <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{currentLangObj.label}</span>
                      </div>
                      <ChevronDown className={cn("h-4 w-4 text-foreground/50 transition-all duration-300 group-hover:text-primary", isLangDropdownOpen && "rotate-180")} />
                    </button>
                    {isLangDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setIsLangDropdownOpen(false)} aria-hidden="true" />
                        <div className="absolute top-full left-0 right-0 mt-2 rounded-2xl neu-dropdown z-20 overflow-hidden bg-surface-sage border border-white/60" role="listbox">
                          {languageOptions.map((lang) => {
                            const isSel = selectedLang === lang.code
                            return (
                              <button
                                key={lang.code}
                                role="option"
                                aria-selected={isSel}
                                onClick={() => { i18n.changeLanguage(lang.code); setIsLangDropdownOpen(false) }}
                                className={cn(
                                  "group w-full px-4 py-2.5 text-left transition-all duration-300 flex items-center gap-2.5",
                                  isSel ? "bg-primary/12 neu-dropdown-selected" : "hover:bg-primary/10 active:bg-primary/15 neu-dropdown-press cursor-pointer"
                                )}
                              >
                                <span className="text-base leading-none">{lang.flag}</span>
                                <span className={cn("text-sm font-medium", isSel ? "text-primary-dark font-semibold" : "text-foreground group-hover:text-primary-dark")}>{lang.label}</span>
                                {isSel && <Check className="ml-auto h-4 w-4 text-primary" />}
                              </button>
                            )
                          })}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Notifikasi mini-card with toggle */}
                <div className={cn(
                  "rounded-2xl border px-5 py-4 transition-colors",
                  notificationsEnabled ? "border-success/40 bg-success/15" : "border-surface-muted/60 bg-surface-elevated"
                )}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success/30">
                        <Bell className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{t('profile.notifications', 'Notifikasi & Peringatan')}</p>
                        <p className="text-[11px] text-foreground/50">{notificationsEnabled ? t('profile.active', 'Aktif') : t('profile.inactive', 'Nonaktif')}</p>
                      </div>
                    </div>
                    <Switch checked={notificationsEnabled} onCheckedChange={handleNotificationsToggle} className="data-[state=checked]:bg-primary shrink-0" />
                  </div>
                  <p className="text-xs text-foreground/60 mt-3 leading-relaxed">
                    {t('profile.notifInlineDesc', 'Peringatan dikirim sesuai jalur & ambang batas di bawah.')}
                  </p>
                </div>
              </div>

              {/* Per Kategori & Jalur */}
              {notificationsEnabled && (
                <>
                  <div className="px-7">
                    <p className="text-[11px] uppercase tracking-[0.15em] font-bold text-foreground/45 mb-3">{t('profile.notifPerCategory', 'Per Kategori & Jalur')}</p>
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      {([
                        { id: 'irrigation' as const, icon: Droplet, gradient: 'from-sky-500 to-cyan-600' },
                        { id: 'sensor' as const, icon: Activity, gradient: 'from-emerald-500 to-teal-600' },
                        { id: 'system' as const, icon: Settings, gradient: 'from-lime-600 to-olive-600' },
                      ]).map((cat) => (
                        <div key={cat.id} className={cn("rounded-2xl bg-linear-to-br p-4 text-white shadow-md", cat.gradient)}>
                          <div className="flex items-center gap-2.5 mb-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
                              <cat.icon className="h-4 w-4 text-white" />
                            </div>
                            <span className="text-sm font-bold">{t(`profile.notifCat_${cat.id}`, cat.id)}</span>
                          </div>
                          <div className="space-y-2">
                            <label className="flex items-center gap-2 cursor-pointer text-xs">
                              <Switch
                                checked={notificationPrefs[cat.id].push}
                                onCheckedChange={(v) => handleNotifPrefChange(cat.id, 'push', v)}
                                className="data-[state=checked]:bg-white data-[state=checked]:[&>span]:bg-primary"
                                aria-label={`${cat.id} Push`}
                              />
                              <span className="text-white/90 font-medium">{t('profile.notifChannelPush', 'Push')}</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer text-xs">
                              <Switch
                                checked={notificationPrefs[cat.id].email}
                                onCheckedChange={(v) => handleNotifPrefChange(cat.id, 'email', v)}
                                className="data-[state=checked]:bg-white data-[state=checked]:[&>span]:bg-primary"
                                aria-label={`${cat.id} Email`}
                              />
                              <span className="text-white/90 font-medium">{t('profile.notifChannelEmail', 'Email')}</span>
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Ambang Batas Notifikasi — min/max number inputs only */}
                  <div className="px-7 pb-6">
                    <p className="text-[11px] uppercase tracking-[0.15em] font-bold text-foreground/45 mb-3">{t('profile.thresholdTitle', 'Ambang Batas Notifikasi')}</p>
                    <div className="grid grid-cols-2 gap-4">
                      {sensorParamConfig.map((param) => {
                        const th = sensorThresholds[param.key]
                        const Icon = param.icon
                        const displayMin = toDisplayValue(th.min, param.key)
                        const displayMax = toDisplayValue(th.max, param.key)
                        const displayRange = getDisplayRange(param.key, param.rangeMin, param.rangeMax)
                        const displayUnit = selectedUnits[param.unitKey] || th.unit
                        return (
                          <div key={param.key} className="rounded-2xl border border-surface-muted/60 bg-surface-elevated px-5 py-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2.5">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success/30">
                                  <Icon className="h-4 w-4 text-primary" />
                                </div>
                                <span className="text-sm font-semibold text-foreground">{t(param.labelKey)}</span>
                              </div>
                              <span className="text-[11px] text-foreground/45 font-medium tabular-nums">{displayMin}{displayUnit} — {displayMax}{displayUnit}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex-1">
                                <label className="text-[10px] uppercase tracking-wider text-foreground/45 font-bold mb-1 block">Min</label>
                                <input
                                  type="number"
                                  value={displayMin}
                                  step={param.step}
                                  min={displayRange.min}
                                  max={displayMax}
                                  onChange={(e) => {
                                    const baseVal = fromDisplayValue(parseFloat(e.target.value) || 0, param.key)
                                    setSensorThresholds((prev) => ({ ...prev, [param.key]: { ...prev[param.key], min: baseVal } }))
                                  }}
                                  onBlur={() => handleSensorThresholdChange(param.key, th.min, th.max)}
                                  className="w-full rounded-xl border border-surface-muted bg-surface-sage neu-inset-shallow px-3 py-2 text-sm font-semibold text-foreground text-center focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                />
                              </div>
                              <span className="text-foreground/30 text-base font-bold mt-5">—</span>
                              <div className="flex-1">
                                <label className="text-[10px] uppercase tracking-wider text-foreground/45 font-bold mb-1 block">Max</label>
                                <input
                                  type="number"
                                  value={displayMax}
                                  step={param.step}
                                  min={displayMin}
                                  max={displayRange.max}
                                  onChange={(e) => {
                                    const baseVal = fromDisplayValue(parseFloat(e.target.value) || 0, param.key)
                                    setSensorThresholds((prev) => ({ ...prev, [param.key]: { ...prev[param.key], max: baseVal } }))
                                  }}
                                  onBlur={() => handleSensorThresholdChange(param.key, th.min, th.max)}
                                  className="w-full rounded-xl border border-surface-muted bg-surface-sage neu-inset-shallow px-3 py-2 text-sm font-semibold text-foreground text-center focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                />
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </>
              )}

              {/* Bottom rows: IoT + Units */}
              <div className="px-7 pb-6 grid grid-cols-2 gap-4">
                {isAdmin ? (
                  <button
                    onClick={() => setActivePanel('iotStatus')}
                    className="group flex items-center gap-3 rounded-2xl border border-surface-muted/60 bg-surface-elevated px-5 py-4 text-left transition-all duration-200 hover:border-primary/30 hover:bg-primary/5 active:scale-[0.99]"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success/30">
                      <Wifi className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">{t('profile.iotDevice', 'Status Perangkat IoT')}</p>
                      <p className="text-[11px] text-foreground/50 mt-0.5">{iotDevices.filter(d => d.status === 'online').length}/{iotDevices.length} {t('profile.connected', 'perangkat terhubung')}</p>
                    </div>
                  </button>
                ) : <div />}
                <button
                  onClick={() => setActivePanel('units')}
                  className="group flex items-center gap-3 rounded-2xl border border-surface-muted/60 bg-surface-elevated px-5 py-4 text-left transition-all duration-200 hover:border-primary/30 hover:bg-primary/5 active:scale-[0.99]"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success/30">
                    <Ruler className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{t('profile.measurementUnits', 'Satuan Pengukuran')}</p>
                    <p className="text-[11px] text-foreground/50 mt-0.5 truncate">{Object.values(selectedUnits).join(' · ')}</p>
                  </div>
                </button>
              </div>
            </div>

            {/* ── AKUN & KEAMANAN ── */}
            <div className="rounded-3xl bg-white border border-surface-muted/70 shadow-[0_4px_20px_-8px_rgba(143,139,120,0.25)] overflow-hidden">
              <div className="flex items-start gap-3 px-7 pt-6 pb-5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-success/35">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-foreground font-(family-name:--font-jakarta)">{t('profile.accountSecurity', 'Akun & Keamanan')}</h3>
                  <p className="text-xs text-foreground/55 mt-0.5">{t('profile.accountSecurityDesc', 'Kredensial login & proteksi tambahan')}</p>
                </div>
              </div>

              <div className="px-7 pb-6 grid gap-4">
                {/* Ganti Kata Sandi */}
                <div className="flex items-center justify-between rounded-2xl border border-surface-muted/60 bg-surface-elevated px-5 py-4 transition-all duration-200 hover:border-primary/30">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success/30">
                      <Lock className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{t('profile.changePassword', 'Ganti Kata Sandi')}</p>
                      <p className="text-xs text-foreground/45 mt-0.5">•••••••• · {passwordUpdatedAt ? `${t('profile.lastChanged', 'diubah')} ${formatDistanceToNow(new Date(passwordUpdatedAt), { locale: i18n.language === 'id' ? idLocale : enLocale, addSuffix: true })}` : t('profile.passwordNeverChanged', 'belum pernah diubah')}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setActivePanel('password')}
                    className="hf-btn-outline-primary shrink-0 px-5 py-2 text-xs uppercase tracking-wider"
                  >
                    <Check className="h-3.5 w-3.5" />
                    {t('profile.updatePassword', { defaultValue: 'Update Sandi' })}
                  </button>
                </div>

                {/* 2FA */}
                <div className="flex items-center justify-between rounded-2xl border border-surface-muted/60 bg-surface-elevated px-5 py-4 transition-all duration-200 hover:border-primary/30">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success/30">
                      <Shield className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{t('profile.twoFactor', 'Autentikasi Dua Faktor (2FA)')}</p>
                      <p className="text-xs text-foreground/45 mt-0.5">{t('profile.twoFactorProtect', 'Lindungi akun dengan aplikasi Authenticator')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={cn(
                      "inline-flex items-center gap-1 text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wider border",
                      twoFactorVerified
                        ? "bg-success/30 text-primary border-success/40"
                        : "bg-warning/15 text-warning-foreground border-warning/30"
                    )}>
                      {!twoFactorVerified && <AlertTriangle className="h-3 w-3" aria-hidden="true" />}
                      {twoFactorVerified ? t('profile.active', { defaultValue: 'Aktif' }) : t('profile.inactive', { defaultValue: 'Nonaktif' })}
                    </span>
                    <button
                      onClick={() => setActivePanel('2fa')}
                      className={cn(
                        "px-4 py-2 text-xs uppercase tracking-wider",
                        twoFactorVerified ? "hf-btn-outline-danger" : "hf-btn-primary"
                      )}
                    >
                      {twoFactorVerified ? t('profile.deactivate', { defaultValue: 'Nonaktifkan' }) : t('profile.activate', { defaultValue: 'Aktifkan' })}
                    </button>
                  </div>
                </div>

                {/* HAPUS AKUN */}
                <div className="flex items-center justify-between rounded-2xl border border-destructive/25 bg-destructive/5 px-5 py-4 transition-all duration-200 hover:border-destructive/40 hover:bg-destructive/10">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-destructive/15">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-destructive">{t('profile.deleteAccount', 'Hapus Akun')}</p>
                      <p className="text-xs text-destructive/65 mt-0.5">{t('profile.deleteAccountConfirm', 'Tindakan ini tidak dapat dibatalkan')}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setActivePanel('deleteAccount')}
                    className="shrink-0 px-5 py-2 text-xs uppercase tracking-wider rounded-full bg-destructive font-bold text-white transition-all hover:bg-destructive/90 hover:shadow-md hover:shadow-destructive/25 active:scale-[0.98]"
                  >
                    {t('profile.deleteAccount', 'Hapus Akun')}
                  </button>
                </div>
              </div>
            </div>

            <p className="text-center text-xs text-foreground/40 pt-2">Hanjeli Smart Farm v1.0.0</p>
          </div>
        </div>
      </div>

      {/* ── Edit Personal Info Modal ── */}
      {showEditModal && (
        <ModalPortal>
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 sm:p-6 bg-black/50 transition-opacity"
          onClick={requestCloseEditModal}
          role="presentation"
        >
          <div
            className="bg-surface-sage rounded-2xl border-[3px] border-white/60 neu-modal relative w-full max-w-[90vw] sm:max-w-lg flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-profile-title"
          >
            <div className="p-5 md:p-6 border-b border-surface-muted/30 shrink-0">
              <div className="flex items-start justify-between">
                <div>
                  <h3 id="edit-profile-title" className="text-lg md:text-xl font-bold text-foreground flex items-center gap-2">
                    <Pencil className="h-5 w-5 text-primary" />
                    {t('profile.editProfile', 'Edit Profil')}
                  </h3>
                  <p className="text-xs md:text-sm text-foreground/60 mt-0.5">
                    {t('profile.editProfileDesc', 'Perbarui informasi profil Anda')}
                  </p>
                </div>
                <button onClick={requestCloseEditModal} aria-label={t('profile.close', 'Tutup')} className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-sage text-foreground/60 neu-inset-deep transition-all duration-200 hover:bg-red-300 hover:text-red-800 active:scale-75 active:bg-red-400 active:text-red-900">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto p-5 md:p-6 space-y-4">
              <div className="flex flex-col items-center pt-1">
                <div className="relative">
                  <div className="h-20 w-20 overflow-hidden rounded-full bg-success flex items-center justify-center ring-4 ring-primary/20">
                    {(avatarPreview ?? userAvatarUrl) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={(avatarPreview ?? userAvatarUrl) as string} alt={t('profile.avatarAlt', 'Foto profil')} className="h-full w-full object-cover" />
                    ) : (
                      <User className="h-10 w-10 text-primary" aria-hidden="true" />
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    aria-label={t('profile.changeAvatar', 'Ubah foto profil')}
                    className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-white shadow-md transition-all active:scale-95 hover:bg-primary-dark"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={handleAvatarChange}
                    aria-hidden="true"
                    tabIndex={-1}
                  />
                </div>
                {avatarError && (
                  <p className="mt-2 text-xs text-destructive font-medium" role="alert">{avatarError}</p>
                )}
              </div>
              <div>
                <label className="text-xs md:text-sm font-semibold text-foreground/70 mb-1.5 block">{t('profile.fullName', 'Nama Lengkap')}</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/50" />
                  <NeuInput variant="soft" type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="rounded-2xl pl-10" />
                </div>
              </div>
              <div>
                <label className="text-xs md:text-sm font-semibold text-foreground/70 mb-1.5 block">{t('profile.email', 'Email')}</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/50" />
                  <NeuInput variant="soft" type="email" value={editEmail} onChange={(e) => { setEditEmail(e.target.value); setEmailTokenSent(false); setEmailConfirmed(false); setEmailToken('') }} className="rounded-2xl pl-10" />
                </div>
              </div>
              {modalEmailChanged && (
                <div className="rounded-2xl border border-primary/20 bg-success/10 p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <Mail className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <div className="text-xs md:text-sm text-primary">
                      <p className="font-semibold mb-0.5">{t('profile.confirmEmailTitle', 'Konfirmasi Email Baru')}</p>
                      <p className="text-primary/70">{t('profile.emailConfirmDesc')}</p>
                    </div>
                  </div>
                  {!emailTokenSent ? (
                    <button onClick={handleSendEmailToken} disabled={emailSending} className="w-full rounded-2xl bg-primary py-2.5 text-sm font-semibold text-white transition-all active:scale-[0.98] hover:bg-primary-dark hover:shadow-md disabled:opacity-50">
                      {emailSending ? '...' : t('profile.sendConfirmToken')}
                    </button>
                  ) : emailConfirmed ? (
                    <div className="flex items-center gap-2 rounded-2xl bg-success/40 px-4 py-2.5">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold text-primary">{t('profile.emailConfirmed')}</span>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs text-primary/60">{t('profile.tokenSentTo')} <span className="font-semibold">{editEmail}</span></p>
                      <div>
                        <label className="text-xs font-semibold text-foreground/70 mb-1 block">{t('profile.confirmEmailToken', 'Masukkan 6-Digit Token')}</label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/50" />
                          <NeuInput variant="soft" type="text" inputMode="numeric" pattern="[0-9]*" value={emailToken} onChange={(e) => setEmailToken(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" maxLength={6} className="rounded-2xl py-2.5 pl-10 text-center text-base font-mono font-semibold tracking-[0.4em] placeholder:text-foreground/20 placeholder:tracking-[0.4em]" />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={handleResendEmailToken} disabled={emailResendCooldown > 0 || emailSending} className="flex-1 rounded-2xl border border-surface-muted py-2.5 text-sm font-medium text-foreground/70 transition-all active:scale-[0.98] hover:bg-surface-muted/50 disabled:opacity-50 flex items-center justify-center gap-1">
                          {emailSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                          {emailResendCooldown > 0 ? `${emailResendCooldown}s` : t('profile.resend')}
                        </button>
                        <button onClick={handleConfirmEmail} disabled={emailToken.length !== 6 || emailVerifying} className="flex-1 rounded-2xl bg-primary py-2.5 text-sm font-semibold text-white transition-all active:scale-[0.98] hover:bg-primary-dark hover:shadow-md disabled:opacity-50 flex items-center justify-center gap-2">
                          {emailVerifying && <Loader2 className="h-4 w-4 animate-spin" />}
                          {emailVerifying ? 'Verifikasi...' : t('profile.confirm')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <button onClick={handleSaveProfile} disabled={(modalEmailChanged && !emailConfirmed) || savingProfile} className="w-full rounded-2xl bg-primary py-3 text-sm md:text-base font-semibold text-white transition-all active:scale-[0.98] hover:bg-primary-dark hover:shadow-md disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2">
                {savingProfile && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('profile.saveProfile', 'Save Changes')}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
      {/* ── Desktop Sub-Panel Modal ── */}
      {isDesktop && activePanel !== 'main' && (() => {
        const emailChanged = editEmail !== userEmail
        const handleDesktopClose = () => {
          if (activePanel === 'editProfile' && isEditProfileDirty) {
            setShowDiscardConfirm(true)
          } else {
            setActivePanel('main')
          }
        }
        return (
          <ModalPortal>
          <div
            className="fixed inset-0 z-70 flex items-center justify-center p-4 sm:p-6 bg-black/50 transition-opacity"
            onClick={handleDesktopClose}
            role="presentation"
          >
            <div
              className="bg-surface-sage rounded-2xl border-[3px] border-white/60 neu-modal relative w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95"
              onClick={e => e.stopPropagation()}
              style={{ maxWidth: 'min(672px, 90vw)' }}
              role="dialog"
              aria-modal="true"
              aria-label={t(`profile.${activePanel}`, activePanel)}
            >
              <div className="overflow-y-auto [&>div]:min-h-0 flex-1">
                {activePanel === 'language' && (
                  <div>
                    <SubPageHeader title={t('profile.selectLanguage')} subtitle={t('profile.languageSubtitle')} onBack={() => setActivePanel('main')} icon={Globe} />
                    <div className="px-6 pt-4 pb-6">
                      <div className="rounded-2xl bg-surface-muted/50 overflow-hidden">
                        {languageOptions.map((lang) => (
                          <button key={lang.code} onClick={() => { i18n.changeLanguage(lang.code); addNotification({ type: 'success', title: `${t('profile.languageChanged')} ${lang.label}` }); setActivePanel('main') }} className={cn("flex w-full items-center justify-between px-4 py-3.5 border-b border-surface-muted last:border-0 transition-all hover:bg-surface-muted/80", selectedLang === lang.code && "bg-success/20")}>
                            <div className="flex items-center gap-3">
                              <span className="text-xl">{lang.flag}</span>
                              <span className="font-medium text-foreground text-sm">{lang.label}</span>
                            </div>
                            {selectedLang === lang.code && <CheckCircle2 className="h-5 w-5 text-primary" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {activePanel === 'password' && (
                  <div>
                    <SubPageHeader title={t('profile.changePassword', 'Ganti Kata Sandi')} subtitle={t('profile.changePasswordDesc', 'Perbarui kata sandi akun Anda')} onBack={() => setActivePanel('main')} icon={Lock} />
                    <div className="px-6 pt-4 pb-6 space-y-4">
                      {capsLockOn && (
                        <div className="flex items-center gap-2 rounded-2xl bg-warning/15 border border-warning/40 px-3 py-2" role="status" aria-live="polite">
                          <AlertTriangle className="h-4 w-4 text-warning-foreground shrink-0" />
                          <p className="text-xs font-medium text-warning-foreground">{t('profile.capsLockOn', 'Caps Lock aktif')}</p>
                        </div>
                      )}
                      <div className="rounded-2xl border border-white/60 bg-surface-sage p-5 neu-raised space-y-4">
                        <div>
                        <label className="text-xs font-semibold text-foreground/70 mb-1.5 block">{t('profile.currentPassword')}</label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/50" />
                          <NeuInput variant="soft" type={showCurrentPassword ? 'text' : 'password'} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} onKeyDown={detectCapsLock} onKeyUp={detectCapsLock} className="rounded-2xl pl-10 pr-10 text-sm md:text-sm" />
                          <button onClick={() => setShowCurrentPassword(!showCurrentPassword)} className="absolute right-3 top-1/2 -translate-y-1/2" aria-label={showCurrentPassword ? t('auth.hidePassword', 'Sembunyikan kata sandi') : t('auth.showPassword', 'Tampilkan kata sandi')}>{showCurrentPassword ? <EyeOff className="h-4 w-4 text-foreground/40" aria-hidden="true" /> : <Eye className="h-4 w-4 text-foreground/40" aria-hidden="true" />}</button>
                        </div>
                        <button onClick={() => setActivePanel('forgotPassword')} className="text-xs font-medium text-primary mt-1.5 hover:underline">{t('profile.forgotPassword')}</button>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-foreground/70 mb-1.5 block">{t('profile.newPassword')}</label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/50" />
                          <NeuInput variant="soft" type={showNewPassword ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} onKeyDown={detectCapsLock} onKeyUp={detectCapsLock} className="rounded-2xl pl-10 pr-10 text-sm md:text-sm" />
                          <button onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 top-1/2 -translate-y-1/2" aria-label={showNewPassword ? t('auth.hidePassword', 'Sembunyikan kata sandi') : t('auth.showPassword', 'Tampilkan kata sandi')}>{showNewPassword ? <EyeOff className="h-4 w-4 text-foreground/40" aria-hidden="true" /> : <Eye className="h-4 w-4 text-foreground/40" aria-hidden="true" />}</button>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-foreground/70 mb-1.5 block">{t('profile.confirmPassword')}</label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/50" />
                          <NeuInput variant="soft" type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} onKeyDown={detectCapsLock} onKeyUp={detectCapsLock} className="rounded-2xl pl-10 pr-10 text-sm md:text-sm" />
                          <button onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2" aria-label={showConfirmPassword ? t('auth.hidePassword', 'Sembunyikan kata sandi') : t('auth.showPassword', 'Tampilkan kata sandi')}>{showConfirmPassword ? <EyeOff className="h-4 w-4 text-foreground/40" aria-hidden="true" /> : <Eye className="h-4 w-4 text-foreground/40" aria-hidden="true" />}</button>
                        </div>
                      </div>
                      {newPassword && (
                        <PasswordStrength password={newPassword} confirmPassword={confirmPassword} t={t} />
                      )}
                      {passwordError && (
                        <div className="flex items-center gap-2 rounded-2xl bg-red-50 border border-red-200 px-4 py-3" role="alert">
                          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" aria-hidden="true" />
                          <p className="text-sm text-destructive font-medium">{passwordError}</p>
                        </div>
                      )}
                      </div>
                      <button onClick={handleSavePassword} disabled={!currentPassword || !newPassword || !confirmPassword || savingPassword} className="w-full rounded-2xl bg-primary py-3 text-sm font-semibold text-white transition-all active:scale-[0.98] hover:bg-primary-dark hover:shadow-md disabled:opacity-50 flex items-center justify-center gap-2">
                        {savingPassword && <Loader2 className="h-4 w-4 animate-spin" />}
                        {t('profile.changePassword', 'Ganti Kata Sandi')}
                      </button>
                    </div>
                  </div>
                )}
                {activePanel === 'forgotPassword' && (
                  <div>
                    <SubPageHeader title={t('profile.forgotPasswordTitle', 'Lupa Kata Sandi')} subtitle={t('profile.forgotPasswordDesc', 'Kirim link reset ke email Anda')} onBack={() => { setActivePanel('password'); setForgotSubmitted(false); setForgotEmail(userEmail) }} icon={Lock} />
                    <div className="px-6 pt-4 pb-6 space-y-4">
                      {!forgotSubmitted ? (
                        <>
                          <div>
                            <label className="text-xs font-semibold text-foreground/70 mb-1.5 block">{t('profile.email', 'Email')}</label>
                            <div className="relative">
                              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/50" />
                              <NeuInput variant="soft" type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} className="rounded-2xl pl-10 text-sm md:text-sm" />
                            </div>
                          </div>
                          <button onClick={handleForgotPassword} disabled={!forgotEmail || forgotLoading} className="w-full rounded-2xl bg-primary py-3 text-sm font-semibold text-white transition-all active:scale-[0.98] hover:bg-primary-dark hover:shadow-md disabled:opacity-50 flex items-center justify-center gap-2">
                            {forgotLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                            {t('profile.sendResetLink', 'Kirim Link Reset')}
                          </button>
                        </>
                      ) : (
                        <div className="text-center space-y-4 py-4">
                          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/30"><Mail className="h-8 w-8 text-primary" /></div>
                          <div>
                            <p className="font-semibold text-foreground">{t('profile.resetLinkSent', { defaultValue: 'Reset Link Sent!' })}</p>
                            <p className="text-sm text-foreground/60 mt-1">{t('profile.checkEmail', { defaultValue: 'Check your email' })}</p>
                          </div>
                          <button onClick={() => { setActivePanel('password'); setForgotSubmitted(false); setForgotEmail(userEmail) }} className="w-full rounded-2xl bg-primary py-3 text-sm font-semibold text-white transition-all active:scale-[0.98] hover:bg-primary-dark hover:shadow-md">
                            {t('profile.back', { defaultValue: 'Back' })}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {activePanel === 'editProfile' && (
                  <div>
                    <SubPageHeader title={t('profile.editProfile', { defaultValue: 'Edit Profile' })} subtitle={t('profile.editProfileDesc')} onBack={() => setActivePanel('main')} icon={User} />
                    <div className="px-6 pt-4 pb-6 space-y-4">
                      <div className="rounded-2xl border border-white/60 bg-surface-sage p-5 neu-raised space-y-4">
                        <div>
                          <label className="text-xs font-semibold text-foreground/70 mb-1.5 block">{t('profile.fullName', { defaultValue: 'Full Name' })}</label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/50" />
                          <NeuInput variant="soft" type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="rounded-2xl pl-10 text-sm md:text-sm" />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-foreground/70 mb-1.5 block">{t('profile.email', 'Email')}</label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/50" />
                          <NeuInput variant="soft" type="email" value={editEmail} onChange={(e) => { setEditEmail(e.target.value); setEmailTokenSent(false); setEmailConfirmed(false); setEmailToken('') }} className="rounded-2xl pl-10 text-sm md:text-sm" />
                        </div>
                      </div>
                      </div>
                      <button onClick={handleSaveProfile} disabled={(emailChanged && !emailConfirmed) || savingProfile} className="w-full rounded-2xl bg-primary py-3 text-sm font-semibold text-white transition-all active:scale-[0.98] hover:bg-primary-dark hover:shadow-md disabled:opacity-50 flex items-center justify-center gap-2">
                        {savingProfile && <Loader2 className="h-4 w-4 animate-spin" />}
                        {t('profile.saveProfile', 'Simpan Profil')}
                      </button>
                    </div>
                  </div>
                )}
                {activePanel === '2fa' && (
                  <div>
                    <SubPageHeader title={t('profile.twoFactor', 'Autentikasi Dua Faktor')} subtitle={t('profile.twoFactorProtect', 'Lindungi akun dengan aplikasi Authenticator')} onBack={() => setActivePanel('main')} icon={Shield} />
                    <div className="px-5 md:px-6 lg:px-8 pt-4 pb-6">
                      {/* Status Card */}
                      <div className="rounded-2xl border border-white/60 bg-surface-sage neu-raised p-5 md:p-6 mb-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={cn("flex h-10 w-10 items-center justify-center rounded-2xl", twoFactorVerified ? "bg-success/40" : "bg-surface-muted")}>
                              <Shield className={cn("h-5 w-5", twoFactorVerified ? "text-primary" : "text-foreground/50")} />
                            </div>
                            <div>
                              <p className="font-semibold text-foreground text-sm md:text-base">{t('profile.twoFactorStatus', 'Status 2FA')}</p>
                              <p className={cn("text-xs md:text-sm font-medium flex items-center gap-1", twoFactorVerified ? "text-primary" : "text-warning")}>
                                {!twoFactorVerified && <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />}
                                {twoFactorVerified ? t('profile.active', 'Aktif') : t('profile.inactive', 'Nonaktif')}
                              </p>
                            </div>
                          </div>
                          <Switch
                            checked={twoFactorEnabled}
                            onCheckedChange={handle2FAToggle}
                            className="data-[state=checked]:bg-primary"
                          />
                        </div>
                      </div>

                      {showDisable2FAConfirm && (
                        <div className="rounded-2xl border-2 border-destructive/20 bg-surface-sage neu-raised p-5 md:p-6 mb-4">
                          <div className="flex items-start gap-3 mb-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 shrink-0">
                              <AlertTriangle className="h-5 w-5 text-destructive" />
                            </div>
                            <div>
                              <p className="font-semibold text-foreground text-sm md:text-base">{t('profile.disable2faTitle')}</p>
                              <p className="text-xs md:text-sm text-foreground/60 mt-1">{t('profile.disable2faDesc')}</p>
                            </div>
                          </div>
                          <div className="flex gap-3">
                            <button onClick={() => setShowDisable2FAConfirm(false)} className="flex-1 rounded-2xl bg-surface-sage border border-white/60 neu-raised py-3 text-sm font-medium text-foreground/70 transition-all active:scale-95 hover:text-primary-shade">{t('profile.cancel')}</button>
                            <button onClick={handleConfirmDisable2FA} className="flex-1 rounded-2xl bg-destructive py-3 text-sm font-semibold text-white transition-all active:scale-[0.98] hover:bg-destructive/90">{t('profile.yesDisable')}</button>
                          </div>
                        </div>
                      )}

                      {twoFactorEnabled && twoFactorStep === 'qr' && !twoFactorVerified && (
                        <div className="rounded-2xl border border-white/60 bg-surface-sage neu-raised p-5 md:p-6 mb-4">
                          <div className="flex items-center gap-2 mb-4">
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white text-xs font-bold">1</div>
                            <span className="text-sm font-semibold text-foreground">{t('profile.scanQrCode')}</span>
                            <div className="flex-1 h-px bg-surface-muted" />
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-muted text-foreground/40 text-xs font-bold">2</div>
                            <span className="text-sm font-medium text-foreground/40">{t('profile.verify')}</span>
                          </div>
                          <p className="text-xs md:text-sm text-foreground/60 mb-4">{t('profile.scanQrInstruction')}</p>
                          <div className="flex justify-center mb-4">
                            {renderTwoFactorQr()}
                          </div>
                          <div className="rounded-2xl bg-surface-sage border border-surface-muted/60 neu-inset shadow-inner p-3 mb-4">
                            <p className="text-xs text-foreground/60 mb-1">{t('profile.orEnterManualCode')}</p>
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-mono text-sm font-semibold text-primary tracking-wider select-all break-all">{twoFactorSecret || 'Memuat secret...'}</p>
                              <button onClick={handleCopyManualCode} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-primary hover:bg-white/60 transition-all active:scale-95">
                                {twoFactorCopied ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                {twoFactorCopied ? t('profile.copied') : t('profile.copy')}
                              </button>
                            </div>
                          </div>
                          <div className="flex gap-3">
                            <button onClick={handleCancel2FA} className="flex-1 rounded-2xl bg-surface-sage border border-white/60 neu-raised py-3 text-sm font-medium text-foreground/70 transition-all active:scale-95 hover:text-primary-shade">{t('profile.cancel')}</button>
                            <button onClick={() => setTwoFactorStep('verify')} className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-semibold text-white transition-all active:scale-[0.98] hover:bg-primary-dark hover:shadow-md">
                              {t('profile.continue')}
                              <ArrowRight className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      )}

                      {twoFactorEnabled && twoFactorStep === 'verify' && !twoFactorVerified && (
                        <div className="rounded-2xl border border-white/60 bg-surface-sage neu-raised p-5 md:p-6 mb-4">
                          <div className="flex items-center gap-2 mb-4">
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-success text-primary text-xs font-bold">
                              <Check className="h-3.5 w-3.5" />
                            </div>
                            <span className="text-sm font-medium text-primary">{t('profile.scanQrCode')}</span>
                            <div className="flex-1 h-px bg-primary/30" />
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white text-xs font-bold">2</div>
                            <span className="text-sm font-semibold text-foreground">{t('profile.verify')}</span>
                          </div>
                          <p className="text-xs md:text-sm text-foreground/60 mb-4">{t('profile.enterVerificationCode')}</p>
                          <div className="relative mb-4">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/50" />
                            <NeuInput
                              variant="soft"
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={totpCode}
                              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                              placeholder="000000"
                              maxLength={6}
                              className="rounded-2xl pl-10 text-center text-lg md:text-xl font-mono font-semibold tracking-[0.5em] placeholder:text-foreground/20 placeholder:tracking-[0.5em]" />
                          </div>
                          <div className="flex gap-3">
                            <button onClick={handleCancel2FA} className="flex-1 rounded-2xl bg-surface-sage border border-white/60 neu-raised py-3 text-sm font-medium text-foreground/70 transition-all active:scale-95 hover:text-primary-shade">{t('profile.cancel')}</button>
                            <button disabled={totpCode.length !== 6 || verifying2FA} onClick={handleVerify2FA} className="flex-1 rounded-2xl bg-primary py-3 text-sm font-semibold text-white transition-all active:scale-[0.98] hover:bg-primary-dark hover:shadow-md disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2">
                              {verifying2FA && <Loader2 className="h-4 w-4 animate-spin" />}
                              {verifying2FA ? t('profile.verifying') : t('profile.verifyAndActivate')}
                            </button>
                          </div>
                        </div>
                      )}

                      {twoFactorVerified && (
                        <>
                          <div className="rounded-2xl bg-success/20 border border-primary/20 p-4 mb-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success">
                                <CheckCircle2 className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <p className="font-semibold text-primary text-sm md:text-base">{t('profile.twoFactorActivated')}</p>
                                <p className="text-xs text-primary/70">{t('profile.twoFactorActivatedDesc')}</p>
                              </div>
                            </div>
                          </div>
                          {recoveryCodesList.length > 0 ? (
                            <div className="rounded-2xl border border-white/60 bg-surface-sage neu-raised p-5 md:p-6">
                              <h3 className="font-semibold text-foreground text-sm md:text-base mb-2">{t('profile.recoveryCodes')}</h3>
                              <p className="text-xs md:text-sm text-foreground/60 mb-4">{t('profile.recoveryCodesDesc')}</p>
                              <div className="grid grid-cols-2 gap-2 mb-4">
                                {recoveryCodesList.map((code, i) => (
                                  <div key={i} className="rounded-lg bg-surface-muted px-3 py-2 text-center">
                                    <span className="font-mono text-xs md:text-sm font-medium text-foreground select-all">{code}</span>
                                  </div>
                                ))}
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <button onClick={handleCopyAllRecoveryCodes} className="rounded-2xl border border-surface-muted py-2.5 text-sm font-medium text-primary transition-all hover:bg-surface-muted/50 active:scale-[0.98] flex items-center justify-center gap-2">
                                  <Copy className="h-4 w-4" />
                                  {t('profile.copyAllCodes')}
                                </button>
                                <button onClick={handleDownloadRecoveryCodes} className="rounded-2xl bg-primary py-2.5 text-sm font-semibold text-white transition-all hover:bg-primary-dark hover:shadow-md active:scale-[0.98] flex items-center justify-center gap-2">
                                  <ArrowRight className="h-4 w-4 rotate-90" aria-hidden="true" />
                                  {t('profile.downloadCodes', 'Unduh .txt')}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="rounded-2xl border border-white/60 bg-surface-sage neu-raised p-5 md:p-6">
                              <h3 className="font-semibold text-foreground text-sm md:text-base mb-2">{t('profile.recoveryCodes')}</h3>
                              <div className="rounded-xl border border-yellow-400/30 bg-yellow-50 p-4">
                                <p className="text-xs md:text-sm text-yellow-800 font-medium leading-relaxed">
                                  {t('profile.recoveryCodesHidden', { defaultValue: 'Demi keamanan, kode pemulihan hanya ditampilkan satu kali saat pertama diaktifkan. Jika Anda kehilangan kode pemulihan, nonaktifkan dan aktifkan kembali 2FA untuk mendapatkan kode baru.' })}
                                </p>
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {!twoFactorEnabled && !twoFactorVerified && (
                        <div className="rounded-2xl border border-white/60 bg-surface-sage neu-raised p-5 md:p-6">
                          <div className="flex flex-col items-center text-center py-6">
                            <div className="mb-4 rounded-full bg-surface-muted/50 p-5">
                              <Shield className="h-10 w-10 text-foreground/30" />
                            </div>
                            <h3 className="font-semibold text-foreground text-base mb-2">{t('profile.twoFactorNotActive')}</h3>
                            <p className="text-xs md:text-sm text-foreground/50 max-w-sm">{t('profile.twoFactorNotActiveDesc')}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activePanel === 'iotStatus' && isAdmin && (() => {
                  const onlineCount = iotDevices.filter(d => d.status === 'online').length
                  const warningCount = iotDevices.filter(d => d.status === 'warning').length
                  const offlineCount = iotDevices.filter(d => d.status === 'offline').length
                  return (
                    <div>
                      <SubPageHeader title={t('profile.iotDevice', 'Perangkat IoT')} subtitle={t('profile.iotManage', 'Kelola dan pantau perangkat Anda')} onBack={() => setActivePanel('main')} icon={Cpu} />
                      <div className="px-5 md:px-6 lg:px-8 pt-4 pb-6">
                        <div className="grid grid-cols-3 gap-3 mb-4">
                          <div className="rounded-2xl border border-success/30 bg-success/10 p-3 text-center neu-inset shadow-inner">
                            <p className="text-2xl md:text-3xl font-semibold text-primary">{onlineCount}</p>
                            <p className="text-[10px] md:text-xs font-medium text-primary/80">{t('profile.online', 'Online')}</p>
                          </div>
                          <div className="rounded-2xl border border-yellow-400/30 bg-yellow-50 p-3 text-center neu-inset shadow-inner">
                            <p className="text-2xl md:text-3xl font-semibold text-warning-foreground">{warningCount}</p>
                            <p className="text-[10px] md:text-xs font-medium text-warning-foreground/80">{t('profile.warning', 'Peringatan')}</p>
                          </div>
                          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-center neu-inset shadow-inner">
                            <p className="text-2xl md:text-3xl font-semibold text-destructive">{offlineCount}</p>
                            <p className="text-[10px] md:text-xs font-medium text-destructive/80">{t('profile.offline', 'Offline')}</p>
                          </div>
                        </div>
                        <button onClick={() => setActivePanel('addDevice')} className="hf-btn-primary w-full px-4 py-3.5 mb-4 text-sm md:text-base">
                          <Plus className="h-5 w-5" />
                          <span>{t('profile.addDevice', 'Tambah Perangkat')}</span>
                        </button>
                        <div className="rounded-2xl border border-white/60 bg-surface-sage p-4 md:p-5 neu-inset">
                          <div className="mb-3 flex items-center justify-between">
                            <h3 className="font-semibold text-foreground text-sm md:text-base">{t('profile.allDevices')}</h3>
                            <div className="flex items-center gap-2">
                              <Wifi className="h-4 w-4 text-primary" />
                              <span className="text-xs md:text-sm text-foreground/60">{onlineCount}/{iotDevices.length} {t('profile.devicesConnected')}</span>
                            </div>
                          </div>
                          <div className="space-y-3">
                            {iotDevices.map((device) => (
                              <div key={device.id} className="rounded-2xl border border-white/60 bg-surface-sage p-3 md:p-4 neu-raised">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-transparent neu-inset">
                                      {device.type === "pump" && <Droplet className="h-4 w-4 text-primary" />}
                                      {device.type === "sensor" && <Activity className="h-4 w-4 text-primary" />}
                                      {device.type === "camera" && <Camera className="h-4 w-4 text-primary" />}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-medium text-foreground text-sm md:text-base truncate">{device.name}</p>
                                      <p className="text-xs text-foreground/50">{device.code} • {device.type}</p>
                                      <p className="text-[10px] text-foreground/40">{t('profile.lastSeen')} {device.lastSeen}</p>
                                      {device.warning && (
                                        <p className="text-[10px] md:text-xs text-yellow-600 mt-0.5">⚠ {device.warning}</p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0 ml-3">
                                    <div className={cn(
                                      "flex items-center gap-1.5 rounded-full px-2.5 py-1 neu-inset border border-white/40",
                                      device.status === "online" ? "bg-success/20" :
                                      device.status === "warning" ? "bg-yellow-50" : "bg-red-50"
                                    )}>
                                      <div className={cn(
                                        "h-2 w-2 rounded-full",
                                        device.status === "online" ? "bg-primary" :
                                        device.status === "warning" ? "bg-yellow-500" : "bg-destructive"
                                      )} />
                                      <span className={cn(
                                        "text-xs font-medium capitalize",
                                        device.status === "online" ? "text-primary" :
                                        device.status === "warning" ? "text-yellow-700" : "text-destructive"
                                      )}>{device.status}</span>
                                    </div>
                                    <button
                                      onClick={() => setDeviceToDelete({ id: device.id, name: device.name })}
                                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-destructive transition-all hover:bg-destructive hover:text-white active:scale-95"
                                      aria-label={t('profile.delete')}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })()}

                {activePanel === 'addDevice' && isAdmin && (
                  <div>
                    <SubPageHeader title={t('profile.addDevice')} subtitle={t('profile.addDeviceSubtitle')} onBack={() => setActivePanel('iotStatus')} icon={Plus} />
                    <div className="px-5 md:px-6 lg:px-8 pt-4 pb-6">
                      <div className="hf-panel-inset p-5 md:p-6 space-y-4">
                        <div className="rounded-2xl border border-white/60 bg-surface-sage p-5 neu-raised space-y-4">
                        <div>
                          <label className="text-xs md:text-sm font-semibold text-foreground/70 mb-1.5 block">{t('profile.deviceName')}</label>
                          <div className="relative">
                            <Cpu className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/50" />
                            <NeuInput variant="soft" type="text" value={newDeviceName} onChange={(e) => setNewDeviceName(e.target.value)} placeholder="e.g. JLNew H10: Soil Moisture Sensor" className="rounded-2xl pl-10 placeholder:text-foreground/30" />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs md:text-sm font-semibold text-foreground/70 mb-1.5 block">{t('profile.deviceCode')}</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/50 text-sm font-mono">#</span>
                            <NeuInput variant="soft" type="text" value={newDeviceCode} onChange={(e) => setNewDeviceCode(e.target.value.toUpperCase())} placeholder="e.g. WS004" maxLength={10} className="rounded-2xl pl-10 font-mono placeholder:text-foreground/30" />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs md:text-sm font-semibold text-foreground/70 mb-1.5 block">{t('profile.deviceType')}</label>
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { type: 'sensor', labelKey: 'profile.sensor', icon: Activity },
                              { type: 'pump', labelKey: 'profile.pump', icon: Droplet },
                              { type: 'camera', labelKey: 'profile.camera', icon: Camera },
                            ].map((opt) => (
                              <button
                                key={opt.type}
                                onClick={() => setNewDeviceType(opt.type)}
                                className={cn(
                                  "flex flex-col items-center gap-2 rounded-2xl px-3 py-4 transition-all duration-200 active:scale-[0.98]",
                                  newDeviceType === opt.type
                                    ? "bg-primary text-white neu-btn-primary"
                                    : "bg-surface-sage text-foreground/70 neu-inset hover:bg-surface-leaf hover:text-primary"
                                )}
                              >
                                <opt.icon className={cn("h-5 w-5", newDeviceType === opt.type ? "text-white" : "text-primary")} />
                                <span className="text-xs md:text-sm font-medium">{t(opt.labelKey)}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                        </div>
                        <button
                          disabled={!newDeviceName || !newDeviceCode || savingDevice}
                          onClick={handleCreateDevice}
                          className="hf-btn-primary w-full py-3 text-sm md:text-base"
                        >
                          <Check className="h-4 w-4" />
                          {t('profile.saveNewDevice')}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {activePanel === 'units' && (
                  <div>
                    <SubPageHeader title={t('profile.measurementUnits')} subtitle={t('profile.measurementUnitsSubtitle')} onBack={() => setActivePanel('main')} icon={Ruler} />
                    <div className="px-5 md:px-6 lg:px-8 pt-4 pb-6">
                      {measurementUnits.map((unit) => {
                        const currentValue = selectedUnits[unit.id]
                        const setValue = (val: string) => setSelectedUnits(prev => ({ ...prev, [unit.id]: val }))
                        const isUnitDisabled = (unit as any).disabled === true
                        return (
                          <div key={unit.id} className={cn("rounded-2xl border border-white/60 bg-surface-sage p-5 md:p-6 mb-4 neu-raised", isUnitDisabled && "opacity-50")}>
                            <div className="flex items-center gap-3 mb-4">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-transparent neu-inset">
                                <unit.icon className={cn("h-5 w-5", isUnitDisabled ? "text-foreground/30" : "text-primary")} />
                              </div>
                              <h3 className={cn("font-semibold text-sm md:text-base", isUnitDisabled ? "text-foreground/40" : "text-foreground")}>{t(unit.labelKey)}</h3>
                              {isUnitDisabled && <span className="ml-auto text-[9px] uppercase tracking-wider text-foreground/35 font-bold bg-surface-sage neu-inset px-2 py-0.5 rounded-full">Nonaktif</span>}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {unit.options.map((opt) => (
                                <button
                                  key={opt}
                                  onClick={() => { if (!isUnitDisabled) setValue(opt) }}
                                  disabled={isUnitDisabled}
                                  className={cn(
                                    "rounded-2xl px-4 py-3 text-sm md:text-base font-medium transition-all duration-200 active:scale-[0.98]",
                                    isUnitDisabled
                                      ? "bg-surface-sage/50 text-foreground/25 cursor-not-allowed"
                                      : currentValue === opt
                                        ? "bg-primary text-white neu-btn-primary"
                                        : "bg-surface-sage text-foreground/70 neu-inset hover:bg-surface-leaf hover:text-primary"
                                  )}
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                      <button
                        onClick={handleSaveUnits}
            disabled={savingUnits}
                        className="w-full rounded-2xl bg-primary py-3 text-sm md:text-base font-semibold text-white transition-all active:scale-[0.98] hover:bg-primary-dark hover:shadow-md"
                      >
                        {t('profile.saveUnits', 'Simpan Satuan')}
                      </button>
                    </div>
                  </div>
                )}

                {activePanel === 'deleteAccount' && (
                  <div>
                    <SubPageHeader title={t('profile.deleteAccount', 'Hapus Akun')} subtitle={t('profile.deleteAccountConfirm', 'Tindakan ini tidak dapat dibatalkan')} onBack={() => { setActivePanel('main'); setDeleteConfirmText(''); setDeletePassword(''); setDelete2FACode(''); setDeleteError('') }} icon={Trash2} />
                    <div className="px-5 md:px-6 lg:px-8 pt-4 pb-6">
                      <div className="hf-panel-inset p-5 md:p-6 mb-4">
                        <div className="flex flex-col items-center text-center mb-6">
                          <div className="mb-4 rounded-full bg-red-50/50 border border-red-200/30 neu-inset p-4 shadow-[inset_0_4px_10px_rgba(220,38,38,0.15)] text-destructive">
                            <AlertTriangle className="h-10 w-10" />
                          </div>
                          <h3 className="font-semibold text-foreground text-lg mb-2">{t('profile.deleteAccountTitle')}</h3>
                          <p className="text-xs md:text-sm text-foreground/60 max-w-sm">{t('profile.deleteAccountDesc')}</p>
                        </div>

                        <div className="rounded-2xl bg-red-50/80 border border-red-200/60 p-4 mb-4 neu-raised shadow-[inset_0_2px_4px_rgba(255,255,255,0.8),0_4px_10px_rgba(220,38,38,0.1)]">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                            <div className="text-xs md:text-sm text-destructive">
                              <p className="font-semibold mb-1">{t('profile.dataToBeDeleted')}</p>
                              <ul className="list-disc list-inside space-y-0.5 text-destructive/80">
                                <li>{t('profile.deleteProfileSettings')}</li>
                                <li>{t('profile.deleteIotConfig')}</li>
                                <li>{t('profile.deleteSensorHistory')}</li>
                                <li>{t('profile.deleteIrrigationRules')}</li>
                                <li>{t('profile.deleteAllNotifications')}</li>
                              </ul>
                            </div>
                          </div>
                        </div>


                        <div className="rounded-2xl border border-white/60 bg-surface-sage p-5 neu-raised mb-4">
                        <div className="mb-4">
                          <label className="text-xs md:text-sm font-semibold text-foreground/70 mb-1.5 block">{t('profile.verifyPassword')}</label>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive/50" />
                            <NeuInput
                              variant="soft"
                              type={showDeletePassword ? "text" : "password"}
                              value={deletePassword}
                              onChange={(e) => { setDeletePassword(e.target.value); setDeleteError('') }}
                              placeholder={t('profile.enterYourPassword')}
                              className="rounded-2xl border-red-200 pl-10 pr-11 placeholder:text-foreground/30 focus:ring-destructive/30 focus:border-destructive" />
                            <button type="button" onClick={() => setShowDeletePassword(!showDeletePassword)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-foreground/40 hover:text-destructive transition-colors" aria-label={showDeletePassword ? t('auth.hidePassword', 'Sembunyikan kata sandi') : t('auth.showPassword', 'Tampilkan kata sandi')}>
                              {showDeletePassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                            </button>
                          </div>
                        </div>

                        {twoFactorVerified && (
                          <div className="mb-4">
                            <label className="text-xs md:text-sm font-semibold text-foreground/70 mb-1.5 block">{t('profile.twoFactorCodeLabel')}</label>
                            <div className="relative">
                              <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive/50" />
                              <NeuInput
                                variant="soft"
                                type="text"
                                value={delete2FACode}
                                onChange={(e) => { setDelete2FACode(e.target.value.replace(/\D/g, '').slice(0, 6)); setDeleteError('') }}
                                placeholder="000000"
                                maxLength={6}
                                className="rounded-2xl border-red-200 pl-10 text-center text-base font-mono font-semibold tracking-[0.4em] placeholder:text-foreground/15 placeholder:tracking-[0.4em] focus:ring-destructive/30 focus:border-destructive" />
                            </div>
                            <p className="text-[10px] md:text-xs text-foreground/40 mt-1.5">{t('profile.twoFactorRequired')}</p>
                          </div>
                        )}

                        <div className="mb-4">
                          <label className="text-xs md:text-sm font-semibold text-foreground/70 mb-1.5 block">
                            {t('profile.typeToConfirm')} <span className="font-bold text-destructive">{t('profile.deleteConfirmText')}</span> {t('profile.toConfirm')}
                          </label>
                          <NeuInput
                            variant="soft"
                            type="text"
                            value={deleteConfirmText}
                            onChange={(e) => { setDeleteConfirmText(e.target.value); setDeleteError('') }}
                            placeholder={t('profile.deleteConfirmText')}
                            className="rounded-2xl border-red-200 placeholder:text-foreground/20 focus:ring-destructive/30 focus:border-destructive" />
                        </div>
                        </div>

                        {deleteError && (
                          <div className="flex items-center gap-2 rounded-2xl bg-red-50 border border-red-200 px-4 py-3 mb-4" role="alert">
                            <AlertTriangle className="h-4 w-4 text-destructive shrink-0" aria-hidden="true" />
                            <p className="text-sm text-destructive font-medium">{deleteError}</p>
                          </div>
                        )}

                        <button
                          onClick={handleDeleteAccount}
                          disabled={deleteConfirmText !== t('profile.deleteConfirmText') || !deletePassword || (twoFactorVerified && delete2FACode.length !== 6) || deletingAccount}
                          className="w-full rounded-2xl bg-destructive py-3 text-sm md:text-base font-semibold text-white transition-all active:scale-[0.98] hover:bg-destructive/90 disabled:opacity-40 disabled:active:scale-100"
                        >
                          <span className="flex items-center justify-center gap-2">
                            {deletingAccount ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            {deletingAccount ? '...' : t('profile.deleteAccount', 'Hapus Akun')}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          </ModalPortal>
        )
      })()}

      {/* ── Delete Device Confirmation ── */}
      {deviceToDelete && (
        <ModalPortal>
        <div
          className="fixed inset-0 z-80 flex items-center justify-center p-4 sm:p-6 bg-black/50 transition-opacity"
          onClick={() => setDeviceToDelete(null)}
          role="presentation"
        >
          <div
            className="bg-surface-sage rounded-2xl border-[3px] border-white/60 neu-modal relative w-full max-w-[90vw] sm:max-w-sm flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-device-title"
          >
            <div className="overflow-y-auto p-5 md:p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 neu-inset mx-auto">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <h3 id="delete-device-title" className="text-center text-lg md:text-xl font-bold text-foreground mb-2">{t('profile.deleteDeviceTitle')}</h3>
              <p className="text-center text-sm text-foreground/70 mb-6">
                {t('profile.deleteDeviceConfirmPrefix')} <span className="font-semibold text-foreground">{deviceToDelete.name}</span>{t('profile.deleteDeviceConfirmSuffix')}
              </p>
              <div className="flex gap-3">
              <button
                onClick={() => setDeviceToDelete(null)}
                className="flex-1 rounded-2xl bg-surface-sage neu-inset py-3 text-sm font-semibold text-foreground/70 transition-all hover:bg-surface-leaf hover:text-primary active:scale-[0.98]"
              >
                {t('profile.cancel')}
              </button>
              <button
                onClick={handleDeleteDevice}
                disabled={deleteDeviceMutation.isPending}
                className="flex-1 rounded-2xl bg-destructive py-3 text-sm font-semibold text-white transition-all hover:bg-destructive/90 hover:shadow-md hover:shadow-destructive/25 active:scale-[0.98] flex justify-center items-center gap-2 disabled:opacity-50"
              >
                {deleteDeviceMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('profile.delete')}
              </button>
            </div>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* ── Discard Unsaved Changes Confirmation ── */}
      {showDiscardConfirm && (
        <ModalPortal>
        <div
          className="fixed inset-0 z-80 flex items-center justify-center p-4 sm:p-6 bg-black/50 transition-opacity"
          onClick={() => setShowDiscardConfirm(false)}
          role="presentation"
        >
          <div
            className="bg-surface-sage rounded-2xl border-[3px] border-white/60 neu-modal relative w-full max-w-[90vw] sm:max-w-sm flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="discard-title"
            aria-describedby="discard-desc"
          >
            <div className="overflow-y-auto p-5 md:p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100/80 border border-yellow-300/40 neu-inset-deep mx-auto transition-all duration-300 hover:bg-yellow-200/90 hover:shadow-[inset_3px_3px_6px_rgba(180,160,50,0.35),inset_-3px_-3px_6px_rgba(255,255,255,0.9)]">
                <AlertTriangle className="h-6 w-6 text-warning" aria-hidden="true" />
              </div>
              <h3 id="discard-title" className="text-center text-lg md:text-xl font-bold text-foreground mb-2">
                {t('profile.discardChangesTitle', 'Buang perubahan?')}
              </h3>
            <p id="discard-desc" className="text-center text-sm text-foreground/70 mb-6">
              {t('profile.discardChangesDesc', 'Perubahan yang belum disimpan akan hilang. Apakah Anda yakin ingin menutupnya?')}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDiscardConfirm(false)}
                className="flex-1 rounded-2xl bg-surface-sage border border-white/60 neu-raised py-3 text-sm font-semibold text-foreground/70 transition-all duration-200 hover:bg-surface-leaf hover:text-primary active:scale-95 active:shadow-[inset_4px_4px_8px_rgba(143,139,120,0.5),inset_-4px_-4px_8px_rgba(255,255,255,0.9)]"
              >
                {t('profile.keepEditing', 'Tetap Edit')}
              </button>
              <button
                onClick={confirmDiscardChanges}
                className="flex-1 rounded-2xl bg-destructive neu-btn-danger py-3 text-sm font-semibold text-white transition-all duration-200 hover:bg-destructive/85 hover:shadow-[inset_4px_4px_8px_rgba(0,0,0,0.2),inset_-4px_-4px_8px_rgba(255,150,150,0.15)] active:scale-95 active:shadow-[inset_7px_7px_14px_rgba(0,0,0,0.5),inset_-5px_-5px_10px_rgba(255,100,100,0.1)]"
              >
                {t('profile.discard', 'Buang')}
              </button>
            </div>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

    </div>
  )
}
