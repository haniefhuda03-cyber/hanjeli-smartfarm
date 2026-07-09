"use client"

import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Search,
  Mail,
  AlertTriangle,
  X,
  Check,
  UserPlus,
  Loader2,
  UserX,
  Lock,
  Eye,
  EyeOff,
  User,
  ShieldOff,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useNotifications } from "@/contexts/notification-context"
import { EmptyState } from "@/components/ui-states/empty-state"
import { LoadingState } from "@/components/ui-states/loading-state"
import { apiClient } from "@/lib/api/client"
import { getApiErrorMessage } from "@/lib/api/errors"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/api/query-keys"
import { usersApi } from "@/lib/api/users"
import { ModalPortal } from "@/components/modal-portal"
import { PasswordStrength } from "@/components/ui/password-strength"
import { isPasswordStrong, isValidEmail } from "@/lib/password"
import { useCurrentUser } from "@/lib/hooks/useCurrentUser"

const PAGE_SIZE = 5
type UserRole = "Admin" | "Guest"
const ROLE_OPTIONS: UserRole[] = ["Admin", "Guest"]

type AppUser = {
  id: string
  name: string
  email: string
  password?: string
  role: UserRole
  twoFactorEnabled?: boolean
}

type BackendUser = {
  id: string
  name: string
  email: string
  role: string
  two_factor_enabled?: boolean
}

type UsersResponse = {
  data: BackendUser[]
}

type EditingState =
  | { mode: "create" }
  | { mode: "edit"; user: AppUser }

function mapBackendUser(user: BackendUser): AppUser {
  return {
    id: String(user.id),
    name: user.name,
    email: user.email,
    role: user.role === "Admin" ? "Admin" : "Guest",
    twoFactorEnabled: user.two_factor_enabled,
  }
}

export default function UsersPage() {
  const { t } = useTranslation()
  const { addNotification } = useNotifications()
  const { user: currentUser } = useCurrentUser()

  const [users, setUsers] = useState<AppUser[]>([])
  const [query, setQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all")
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  const [editing, setEditing] = useState<EditingState | null>(null)
  const [formName, setFormName] = useState("")
  const [formEmail, setFormEmail] = useState("")
  const [formPassword, setFormPassword] = useState("")
  const [formRole, setFormRole] = useState<UserRole>("Guest")
  const [formError, setFormError] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  const [userToDelete, setUserToDelete] = useState<AppUser | null>(null)
  const [userToDisable2fa, setUserToDisable2fa] = useState<AppUser | null>(null)

  // Lock body scroll when modal is open
  useEffect(() => {
    const shouldLock = Boolean(editing || userToDelete || userToDisable2fa)
    document.documentElement.classList.toggle('modal-open', shouldLock)
    document.body.classList.toggle('modal-open', shouldLock)

    return () => {
      document.documentElement.classList.remove('modal-open')
      document.body.classList.remove('modal-open')
    }
  }, [editing, userToDelete, userToDisable2fa])

  const queryClient = useQueryClient()

  // Use React Query for users
  const { data: usersData, isLoading: loadingUsers } = useQuery({
    queryKey: queryKeys.users.list({ limit: 100 }),
    queryFn: async () => {
      const res = await usersApi.getAll({ limit: 100 }) as UsersResponse
      return (res.data || []).map(mapBackendUser)
    }
  })

  // We sync local state when data arrives to keep search and optimistic updates simple, 
  // though typically you'd just use usersData directly and rely on invalidateQueries
  useEffect(() => {
    if (usersData) {
      setUsers(usersData)
    }
  }, [usersData])

  // Derived: filter + search
  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase()
    return users.filter((u) => {
      const matchesQuery = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.role.toLowerCase().includes(q)
      const matchesRole = roleFilter === "all" || u.role === roleFilter
      return matchesQuery && matchesRole
    })
  }, [users, query, roleFilter])

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const paginated = filteredUsers.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  // Reset to first page when filter/search changes
  const resetPage = () => setCurrentPage(1)

  const closeForm = () => {
    setEditing(null)
    setFormName("")
    setFormEmail("")
    setFormPassword("")
    setFormRole("Guest")
    setFormError("")
  }

  const handleDisable2faClick = (user: AppUser) => {
    setUserToDisable2fa(user)
  }

  const handleDeleteClick = (user: AppUser) => {
    setUserToDelete(user)
  }

  const openCreate = () => {
    setEditing({ mode: "create" })
    setFormName("")
    setFormEmail("")
    setFormPassword("")
    setFormRole("Guest")
    setFormError("")
    setShowPassword(false)
  }

  const openEdit = (user: AppUser) => {
    setEditing({ mode: "edit", user })
    setFormName(user.name)
    setFormEmail(user.email)
    setFormPassword("")
    setFormRole(user.role)
    setFormError("")
    setShowPassword(false)
  }



  const createUserMutation = useMutation({
    mutationFn: usersApi.create,
    onSuccess: (created: any) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.list({ limit: 100 }) })
      setUsers((prev) => [mapBackendUser(created), ...prev])
      addNotification({ type: "success", title: t("users.userAdded", { email: formEmail.trim() }) })
      closeForm()
    },
    onError: (err: unknown) => {
      setFormError(getApiErrorMessage(err, t("users.saveFailed", "Gagal menyimpan pengguna")))
    }
  })

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }: { id: string, data: any }) => usersApi.update(id, data),
    onSuccess: (updated: any) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.list({ limit: 100 }) })
      if (editing?.mode === 'edit') {
        setUsers((prev) => prev.map((u) => (u.id === editing.user.id ? mapBackendUser(updated) : u)))
      }
      addNotification({ type: "success", title: t("users.userUpdated", { email: formEmail.trim() }) })
      closeForm()
    },
    onError: (err: unknown) => {
      setFormError(getApiErrorMessage(err, t("users.saveFailed", "Gagal menyimpan pengguna")))
    }
  })

  const handleSave = () => {
    setFormError("")
    const trimmedName = formName.trim()
    const trimmedEmail = formEmail.trim()
    const trimmedPassword = formPassword.trim()

    if (!trimmedName) {
      setFormError(t("users.nameRequired"))
      return
    }
    if (!trimmedEmail) {
      setFormError(t("users.emailRequired"))
      return
    }
    if (!isValidEmail(trimmedEmail)) {
      setFormError(t("users.invalidEmail"))
      return
    }
    // CREATE wajib kata sandi kuat. EDIT: kata sandi OPSIONAL (kosongkan bila
    // tidak diubah — hanya untuk ganti darurat oleh admin); bila diisi, wajib kuat.
    if (editing?.mode === "create" && !isPasswordStrong(trimmedPassword)) {
      setFormError(t("auth.passwordPolicyError"))
      return
    }
    if (editing?.mode === "edit" && trimmedPassword && !isPasswordStrong(trimmedPassword)) {
      setFormError(t("auth.passwordPolicyError"))
      return
    }
    const duplicate = users.some(
      (u) => u.email.toLowerCase() === trimmedEmail.toLowerCase() && (editing?.mode !== "edit" || u.id !== editing.user.id),
    )
    if (duplicate) {
      setFormError(t("users.emailDuplicate"))
      return
    }

    if (editing?.mode === "edit") {
      const payload: Record<string, string> = {
        name: trimmedName,
        email: trimmedEmail,
        role: formRole,
      }
      if (trimmedPassword) payload.password = trimmedPassword
      updateUserMutation.mutate({ id: editing.user.id, data: payload })
    } else {
      createUserMutation.mutate({
        name: trimmedName,
        email: trimmedEmail,
        password: trimmedPassword,
        role: formRole,
      })
    }
  }



  const deleteUserMutation = useMutation({
    mutationFn: usersApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.list({ limit: 100 }) })
      if (userToDelete) {
        setUsers((prev) => prev.filter((u) => u.id !== userToDelete.id))
        addNotification({ type: "success", title: t("users.userDeleted", { email: userToDelete.email }) })
        setUserToDelete(null)
      }
    },
    onError: (err: unknown) => {
      addNotification({ type: "error", title: getApiErrorMessage(err, t("users.deleteFailed", "Gagal menghapus pengguna")) })
    }
  })

  const handleDelete = () => {
    if (!userToDelete) return
    if (currentUser?.id && String(currentUser.id) === userToDelete.id) {
      addNotification({ type: "error", title: t("users.selfDeleteDenied", "Akses Ditolak: Gunakan menu Profil Anda untuk menghapus akun ini.") })
      setUserToDelete(null)
      return
    }
    deleteUserMutation.mutate(userToDelete.id)
  }

  const disable2faMutation = useMutation({
    mutationFn: usersApi.adminDisable2fa,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.list({ limit: 100 }) })
      if (userToDisable2fa) {
        setUsers((prev) => prev.map((u) => u.id === userToDisable2fa.id ? { ...u, twoFactorEnabled: false } : u))
        addNotification({ type: "success", title: t("users.disable2faSuccess") })
        setUserToDisable2fa(null)
      }
    },
    onError: (err: unknown) => {
      addNotification({ type: "error", title: getApiErrorMessage(err, t("users.disable2faFailed")) })
    }
  })

  const handleDisable2fa = () => {
    if (!userToDisable2fa) return
    if (currentUser?.id && String(currentUser.id) === userToDisable2fa.id) {
      addNotification({ type: "error", title: t("users.selfDisable2faDenied", "Akses Ditolak: Gunakan menu Profil Anda untuk mengelola autentikasi dua faktor.") })
      setUserToDisable2fa(null)
      return
    }
    disable2faMutation.mutate(userToDisable2fa.id)
  }

  const isEmpty = filteredUsers.length === 0
  const isEmptyDueToFilter = isEmpty && (query.trim() !== "" || roleFilter !== "all")

  return (
    <div className="relative min-h-screen w-full bg-page">
      {/* Header */}
      <div className="bg-linear-to-b from-surface-sage-soft to-surface-sage px-5 md:px-6 lg:px-8 pt-14 lg:pt-6 pb-4 sticky top-0 z-30 neu-header border-b border-white/50">
        <h1 className="text-xl md:text-2xl font-extrabold bg-linear-to-r from-primary to-foreground bg-clip-text text-transparent font-(family-name:--font-jakarta)">
          {t("users.title")}
        </h1>
        <p className="text-sm md:text-base text-foreground/50 font-medium tracking-wide">
          {t("users.subtitle")}
        </p>
      </div>

      <div className="px-5 md:px-6 lg:px-8 pt-6 pb-28 lg:pb-8">
        <div className="rounded-2xl bg-surface-sage border border-white/60 p-4 md:p-6 neu-raised neu-raised-hover transition-all duration-300">
          {/* Toolbar: title + add */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <h2 className="text-base md:text-lg font-semibold text-foreground flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              {t("users.listTitle")}
            </h2>
            <button
              onClick={openCreate}
              className="flex items-center justify-center gap-1.5 rounded-2xl bg-primary px-3.5 py-2 text-xs md:text-sm font-semibold text-white neu-btn-primary transition-all duration-300 hover:bg-success active:bg-primary-shade active:scale-[0.97] w-full md:w-auto"
            >
              <Plus className="h-4 w-4" />
              {t("users.addUser")}
            </button>
          </div>

          {/* Search + role filter */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/50" />
              <input
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  resetPage()
                }}
                placeholder={t("users.searchPlaceholder")}
                className="w-full rounded-2xl border border-white/60 bg-white/70 px-4 py-2.5 pl-10 text-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary neu-inset-shallow"
                aria-label={t("users.searchPlaceholder")}
              />
            </div>
            <div className="relative sm:w-48">
              <span id="role-filter-label" className="sr-only">{t("users.filterRole")}</span>
              <button
                type="button"
                onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
                aria-expanded={isRoleDropdownOpen}
                aria-haspopup="listbox"
                aria-labelledby="role-filter-label"
                className="group w-full flex items-center justify-between rounded-2xl bg-surface-sage border border-white/60 px-4 py-2.5 neu-raised transition-all duration-300 hover:bg-surface-leaf hover:-translate-y-0.5 neu-raised-hover active:translate-y-0 active:scale-[0.99] neu-selector-press"
              >
                <span className="text-sm font-medium text-foreground transition-colors group-hover:text-primary">
                  {roleFilter === "all" ? t("users.allRoles") : t(`users.role${roleFilter}`, roleFilter)}
                </span>
                <ChevronDown className={cn(
                  "h-4 w-4 text-foreground/50 transition-all duration-300 group-hover:text-primary",
                  isRoleDropdownOpen && "rotate-180"
                )} />
              </button>
              {isRoleDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsRoleDropdownOpen(false)} aria-hidden="true" />
                  <div className="absolute top-full left-0 right-0 mt-2 rounded-2xl neu-dropdown z-20 overflow-hidden bg-surface-sage border border-white/60" role="listbox" aria-labelledby="role-filter-label">
                    {(["all", ...ROLE_OPTIONS] as const).map((value) => {
                      const isSel = roleFilter === value
                      const label = value === "all" ? t("users.allRoles") : t(`users.role${value}`, value)
                      return (
                        <button
                          key={value}
                          role="option"
                          aria-selected={isSel}
                          onClick={() => {
                            setRoleFilter(value as UserRole | "all")
                            resetPage()
                            setIsRoleDropdownOpen(false)
                          }}
                          className={cn(
                            "group w-full px-4 py-2.5 text-left transition-all duration-300 flex items-center gap-2.5",
                            isSel
                              ? "bg-primary/12 neu-dropdown-selected"
                              : "hover:bg-primary/10 active:bg-primary/15 neu-dropdown-press cursor-pointer"
                          )}
                        >
                          <span className={cn(
                            "text-sm font-medium",
                            isSel ? "text-primary-dark font-semibold" : "text-foreground group-hover:text-primary-dark"
                          )}>{label}</span>
                          {isSel && <Check className="ml-auto h-4 w-4 text-primary" />}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Empty / List */}
          {loadingUsers ? (
            <LoadingState title={t("users.loading", "Memuat pengguna...")} className="max-w-sm mx-auto" />
          ) : isEmpty ? (
            <EmptyState
              icon={<UserX className="h-7 w-7" />}
              title={isEmptyDueToFilter ? t("users.noMatchTitle") : t("users.emptyTitle")}
              description={isEmptyDueToFilter ? t("users.noMatchDesc") : t("users.emptyDesc")}
              action={
                isEmptyDueToFilter ? (
                  <button
                    onClick={() => {
                      setQuery("")
                      setRoleFilter("all")
                      resetPage()
                    }}
                    className="hf-btn-outline-primary px-4 py-2 text-sm"
                  >
                    {t("users.allRoles")}
                  </button>
                ) : (
                  <button
                    onClick={openCreate}
                    className="hf-btn-primary px-4 py-2 text-sm"
                  >
                    <UserPlus className="h-4 w-4" />
                    {t("users.addUser")}
                  </button>
                )
              }
            />
          ) : (
            <>
              {/* ═══ DESKTOP TABLE (md+) ═══ */}
              <div className="hidden md:block overflow-x-auto rounded-2xl bg-transparent neu-inset border border-white/40 scrollbar-hide">
                <table className="w-full min-w-[700px]">
                  <thead className="bg-primary">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs md:text-sm font-medium text-white whitespace-nowrap w-16">
                        {t("users.no")}
                      </th>
                      <th className="px-4 py-3 text-left text-xs md:text-sm font-medium text-white whitespace-nowrap">
                        {t("users.fullName")}
                      </th>
                      <th className="px-4 py-3 text-left text-xs md:text-sm font-medium text-white whitespace-nowrap">
                        {t("users.email")}
                      </th>
                      <th className="px-4 py-3 text-left text-xs md:text-sm font-medium text-white whitespace-nowrap w-32">
                        {t("users.role")}
                      </th>
                      <th className="px-4 py-3 text-center text-xs md:text-sm font-medium text-white whitespace-nowrap w-32">
                        {t("users.actions")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((user, index) => (
                      <tr key={user.id} className="border-t border-white/30 hover:bg-surface-leaf transition-colors">
                        <td className="px-4 py-3.5 text-xs md:text-sm text-foreground">
                          {(safePage - 1) * PAGE_SIZE + index + 1}
                        </td>
                        <td className="px-4 py-3.5 text-xs md:text-sm font-medium text-foreground">{user.name}</td>
                        <td className="px-4 py-3.5 text-xs md:text-sm text-foreground/80">{user.email}</td>
                        <td className="px-4 py-3.5">
                          <span
                            className={cn(
                              "inline-block rounded-full px-3 py-1 text-xs font-semibold border",
                              user.role === "Admin"
                                ? "bg-primary/10 border-primary/20 text-primary"
                                : "bg-foreground/5 border-foreground/10 text-foreground/70",
                            )}
                          >
                            {t(`users.role${user.role}`, user.role)}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center justify-center gap-2">
                            {user.twoFactorEnabled && (
                              <button
                                onClick={() => handleDisable2faClick(user)}
                                aria-label={t("users.disable2faTitle", { defaultValue: "Nonaktifkan 2FA" })}
                                title={t("users.disable2faTitle", { defaultValue: "Nonaktifkan 2FA" })}
                                className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-sage neu-inset-deep transition-all duration-300 hover:bg-orange-50 hover:text-orange-600 active:scale-[0.97] text-foreground/60"
                              >
                                <ShieldOff className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              onClick={() => openEdit(user)}
                              aria-label={t("users.edit")}
                              title={t("users.edit")}
                              className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-sage neu-inset-deep transition-all duration-300 hover:bg-primary/25 hover:text-primary-shade active:scale-[0.97] text-foreground/60"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteClick(user)}
                              aria-label={t("users.delete")}
                              title={t("users.delete")}
                              className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-sage neu-inset-deep transition-all duration-300 hover:bg-red-50 hover:text-destructive active:scale-[0.97] text-foreground/60"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ═══ MOBILE CARD STACK (< md) ═══ */}
              <div className="md:hidden space-y-3">
                {paginated.map((user, index) => (
                  <div
                    key={user.id}
                    className="rounded-2xl bg-white/80 border border-white/60 p-3.5 neu-raised-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success/30 text-primary text-sm font-semibold">
                          {(safePage - 1) * PAGE_SIZE + index + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground truncate" title={user.name}>
                            {user.name}
                          </p>
                          <p className="text-xs text-foreground/60 truncate mt-0.5" title={user.email}>
                            {user.email}
                          </p>
                          <span
                            className={cn(
                              "inline-block mt-1.5 rounded-full px-3 py-0.5 text-[11px] font-semibold border",
                              user.role === "Admin"
                                ? "bg-primary/10 border-primary/20 text-primary"
                                : "bg-foreground/5 border-foreground/10 text-foreground/70",
                            )}
                          >
                            {t(`users.role${user.role}`, user.role)}
                          </span>
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        {user.twoFactorEnabled && (
                          <button
                            onClick={() => handleDisable2faClick(user)}
                            aria-label={t("users.disable2faTitle", { defaultValue: "Nonaktifkan 2FA" })}
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-sage text-foreground/60 neu-inset transition-all hover:bg-orange-50 hover:text-orange-600 active:scale-95"
                          >
                            <ShieldOff className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => openEdit(user)}
                          aria-label={t("users.edit")}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-sage text-foreground/60 neu-inset transition-all hover:bg-primary/25 hover:text-primary-shade active:scale-95"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(user)}
                          aria-label={t("users.delete")}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-sage text-foreground/60 neu-inset transition-all hover:bg-red-50 hover:text-destructive active:scale-95"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* ═══ PAGINATION ═══ */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
                <span className="text-xs md:text-sm text-foreground/60 order-2 sm:order-1">
                  {t("users.showing", { shown: paginated.length, total: filteredUsers.length })}
                </span>
                <div className="flex items-center gap-3 order-1 sm:order-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={safePage <= 1}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-sage neu-inset-deep text-xs md:text-sm font-medium text-foreground transition-all duration-300 hover:bg-primary/25 hover:text-primary-shade active:scale-[0.97] disabled:opacity-40 disabled:hover:bg-surface-sage disabled:hover:text-foreground"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    {t("users.back")}
                  </button>
                  <span className="text-xs md:text-sm text-foreground/70 font-medium whitespace-nowrap">
                    {t("users.pageOf", { current: safePage, total: totalPages })}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage >= totalPages}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-sage neu-inset-deep text-xs md:text-sm font-medium text-foreground transition-all duration-300 hover:bg-primary/25 hover:text-primary-shade active:scale-[0.97] disabled:opacity-40 disabled:hover:bg-surface-sage disabled:hover:text-foreground"
                  >
                    {t("users.next")}
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ═══ CREATE / EDIT MODAL ═══ */}
      {editing && (
        <ModalPortal>
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="user-form-title"
        >
          {/* Backdrop overlay — separate layer like irrigation settings */}
          <div className="absolute inset-0 bg-black/50 transition-opacity" onClick={closeForm} aria-hidden="true" />
          <div
            className="relative w-full max-w-[90vw] sm:max-w-md max-h-[90vh] bg-surface-sage rounded-2xl border-[3px] border-white/60 animate-in zoom-in-95 overflow-hidden flex flex-col neu-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="overflow-y-auto w-full p-5 md:p-6" style={{ maxHeight: 'calc(90vh - 2rem)' }}>
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3
                    id="user-form-title"
                    className="text-lg md:text-xl font-bold text-foreground flex items-center gap-2"
                  >
                    {editing.mode === "edit" ? <Pencil className="h-5 w-5 text-primary" /> : <UserPlus className="h-5 w-5 text-primary" />}
                    {editing.mode === "edit" ? t("users.editUser") : t("users.addUserTitle")}
                  </h3>
                  <p className="text-xs md:text-sm text-foreground/60 mt-0.5">
                    {editing.mode === "edit" ? t("users.editUserDesc") : t("users.addUserDesc")}
                  </p>
                </div>
                <button
                  onClick={closeForm}
                  aria-label={t("users.cancel")}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-sage text-foreground/60 neu-inset-deep transition-all duration-200 hover:bg-red-300 hover:text-red-800 active:scale-75 active:bg-red-400 active:text-red-900"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Form fields */}
              <div className="space-y-4">
                <div>
                  <label htmlFor="form-name" className="text-xs md:text-sm font-semibold text-foreground/70 mb-1.5 block">
                    {t("users.fullName")}
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/50" />
                    <input
                      id="form-name"
                      type="text"
                      value={formName}
                      onChange={(e) => {
                        setFormName(e.target.value)
                        setFormError("")
                      }}
                      placeholder={t("users.namePlaceholder")}
                      autoFocus
                      className="w-full rounded-2xl border border-white/60 bg-surface-sage neu-inset-shallow px-4 py-3 pl-10 text-sm md:text-base text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-shadow"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="form-email" className="text-xs md:text-sm font-semibold text-foreground/70 mb-1.5 block">
                    {t("users.email")}
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/50" />
                    <input
                      id="form-email"
                      type="email"
                      value={formEmail}
                      onChange={(e) => {
                        setFormEmail(e.target.value)
                        setFormError("")
                      }}
                      placeholder={t("users.emailPlaceholder")}
                      className="w-full rounded-2xl border border-white/60 bg-surface-sage neu-inset-shallow px-4 py-3 pl-10 text-sm md:text-base text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-shadow"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="form-password" className="text-xs md:text-sm font-semibold text-foreground/70 mb-1.5 block">
                    {t("users.password")}
                    {editing.mode === "edit" && (
                      <span className="ml-1.5 font-normal text-foreground/45">{t("users.passwordOptionalHint", "(kosongkan jika tidak diubah)")}</span>
                    )}
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/50" />
                    <input
                      id="form-password"
                      type={showPassword ? "text" : "password"}
                      value={formPassword}
                      onChange={(e) => {
                        setFormPassword(e.target.value)
                        setFormError("")
                      }}
                      placeholder={t("users.passwordPlaceholder")}
                      className="w-full rounded-2xl border border-white/60 bg-surface-sage neu-inset-shallow px-4 py-3 pl-10 pr-11 text-sm md:text-base text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-shadow"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground/70 transition-colors"
                      aria-label={showPassword ? t("users.hidePassword") : t("users.showPassword")}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {formPassword && (
                    <div className="mt-2">
                      <PasswordStrength password={formPassword} showMatch={false} t={t} />
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-xs md:text-sm font-semibold text-foreground/70 mb-1.5 block">
                    {t("users.role")}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {ROLE_OPTIONS.map((r) => {
                      const isSelfEdit = editing?.mode === "edit" && currentUser?.id && String(currentUser.id) === editing.user.id
                      const isOptionDisabled = isSelfEdit && r !== editing.user.role
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() => {
                            if (isOptionDisabled) {
                              addNotification({
                                type: "error",
                                title: t("users.selfRoleChangeDenied", "Perubahan Ditolak: Anda tidak dapat menurunkan atau mengubah peran akun Anda sendiri."),
                              })
                              return
                            }
                            setFormRole(r)
                          }}
                          className={cn(
                            "rounded-2xl px-4 py-3 text-sm font-semibold transition-all duration-200",
                            isOptionDisabled 
                              ? "opacity-60 cursor-not-allowed hover:bg-red-50/50 hover:border-red-200 border border-transparent" 
                              : "active:scale-[0.98]",
                            formRole === r
                              ? "bg-primary text-white neu-btn-primary"
                              : "bg-surface-sage text-foreground/70 neu-inset hover:bg-surface-leaf hover:text-primary",
                          )}
                        >
                          {t(`users.role${r}`, r)}
                        </button>
                      )
                    })}
                  </div>
                  {editing?.mode === "edit" && currentUser?.id && String(currentUser.id) === editing.user.id && (
                    <p className="text-[11px] md:text-xs text-orange-600 font-medium mt-2 flex items-center gap-1.5 bg-orange-50/50 p-2 rounded-lg border border-orange-100">
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      {t("users.selfRoleChangeWarning", "Peran untuk akun yang sedang digunakan tidak dapat diubah.")}
                    </p>
                  )}
                </div>

                {formError && (
                  <div className="flex items-center gap-2 rounded-2xl bg-red-50 border border-red-200 px-4 py-2.5" role="alert">
                    <AlertTriangle className="h-4 w-4 text-destructive shrink-0" aria-hidden="true" />
                    <p className="text-sm text-destructive font-medium">{formError}</p>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={closeForm}
                    className="flex-1 rounded-2xl bg-surface-sage neu-inset py-3 text-sm font-semibold text-foreground/70 transition-all hover:bg-surface-leaf hover:text-primary active:scale-[0.98]"
                  >
                    {t("users.cancel")}
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={createUserMutation.isPending || updateUserMutation.isPending}
                    className="hf-btn-primary flex-1 py-3 text-sm"
                  >
                    {(createUserMutation.isPending || updateUserMutation.isPending) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    {t("users.save")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* ═══ DELETE CONFIRM MODAL ═══ */}
      {userToDelete && (
        <ModalPortal>
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="user-delete-title"
        >
          {/* Backdrop overlay — separate layer like irrigation settings */}
          <div className="absolute inset-0 bg-black/50 transition-opacity" onClick={() => !deleteUserMutation.isPending && setUserToDelete(null)} aria-hidden="true" />
          <div
            className="relative w-full max-w-[90vw] sm:max-w-sm bg-surface-sage rounded-2xl border-[3px] border-white/60 animate-in zoom-in-95 overflow-hidden flex flex-col neu-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 md:p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 neu-inset mx-auto">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <h3 id="user-delete-title" className="text-center text-lg md:text-xl font-bold text-foreground mb-2">
                {t("users.deleteConfirmTitle")}
              </h3>
              <p className="text-center text-sm text-foreground/70 mb-6">
                {t("users.deleteConfirmPrefix")}{" "}
                <span className="font-semibold text-foreground">{userToDelete.email}</span>
                {t("users.deleteConfirmSuffix")}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setUserToDelete(null)}
                  disabled={deleteUserMutation.isPending}
                  className="flex-1 rounded-2xl bg-surface-sage neu-inset py-3 text-sm font-semibold text-foreground/70 transition-all hover:bg-surface-leaf hover:text-primary active:scale-[0.98] disabled:opacity-50"
                >
                  {t("users.cancel")}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleteUserMutation.isPending}
                  className="flex-1 rounded-2xl bg-destructive py-3 text-sm font-semibold text-white transition-all hover:bg-destructive/90 hover:shadow-md hover:shadow-destructive/25 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {deleteUserMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  {t("users.delete")}
                </button>
              </div>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* ═══ DISABLE 2FA CONFIRM MODAL ═══ */}
      {userToDisable2fa && (
        <ModalPortal>
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="user-disable-2fa-title"
        >
          <div className="absolute inset-0 bg-black/50 transition-opacity" onClick={() => !disable2faMutation.isPending && setUserToDisable2fa(null)} aria-hidden="true" />
          <div
            className="relative w-full max-w-[90vw] sm:max-w-sm bg-surface-sage rounded-2xl border-[3px] border-white/60 animate-in zoom-in-95 overflow-hidden flex flex-col neu-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 md:p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 neu-inset mx-auto">
                <ShieldOff className="h-6 w-6 text-orange-600" />
              </div>
              <h3 id="user-disable-2fa-title" className="text-center text-lg md:text-xl font-bold text-foreground mb-2">
                {t("users.disable2faTitle")}
              </h3>
              <p className="text-center text-sm text-foreground/70 mb-6">
                {t("users.disable2faConfirmPrefix")}{" "}
                <span className="font-semibold text-foreground">{userToDisable2fa.email}</span>
                {t("users.disable2faConfirmSuffix")}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setUserToDisable2fa(null)}
                  disabled={disable2faMutation.isPending}
                  className="flex-1 rounded-2xl bg-surface-sage neu-inset py-3 text-sm font-semibold text-foreground/70 transition-all hover:bg-surface-leaf hover:text-primary active:scale-[0.98] disabled:opacity-50"
                >
                  {t("users.cancel")}
                </button>
                <button
                  onClick={handleDisable2fa}
                  disabled={disable2faMutation.isPending}
                  className="flex-1 rounded-2xl bg-orange-500 py-3 text-sm font-semibold text-white transition-all hover:bg-orange-600 hover:shadow-md hover:shadow-orange-500/25 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {disable2faMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldOff className="h-4 w-4" />}
                  {t("users.disable2faAction")}
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
