import { LoaderIcon } from "@/components/icons/toast-icons"
import { cn } from "@/lib/utils"

type LoadingStateProps = {
  title?: string
  description?: string
  className?: string
}

export function LoadingState({
  title = "Memuat data...",
  description = "Sedang mengambil informasi terbaru dari server.",
  className = "",
}: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-primary/20 bg-primary/3 p-8 text-center max-w-sm w-full mx-auto",
        className
      )}
    >
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <LoaderIcon width={26} height={26} />
      </span>
      <div className="space-y-1">
        <p className="text-base font-semibold text-primary">
          {title}
        </p>
        <p className="max-w-xs text-sm text-primary/60">
          {description}
        </p>
      </div>
    </div>
  )
}

export function SkeletonCard() {
  return (
    <div className="animate-pulse space-y-3 rounded-2xl border border-surface-muted bg-white p-5">
      <div className="h-4 w-1/3 rounded bg-surface-muted" />
      <div className="h-3 w-2/3 rounded bg-surface-muted" />
      <div className="h-3 w-1/2 rounded bg-surface-muted" />
      <div className="mt-4 h-24 rounded-2xl bg-surface-muted/60" />
    </div>
  )
}
