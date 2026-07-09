import type { ReactNode } from "react"
import { InboxIcon } from "@/components/icons/toast-icons"
import { cn } from "@/lib/utils"

type EmptyStateProps = {
  title?: string
  description?: string
  icon?: ReactNode
  action?: ReactNode
  className?: string
}

export function EmptyState({
  title = "Belum ada data",
  description = "Belum ada catatan untuk ditampilkan. Tambahkan data pertama Anda untuk memulai.",
  icon,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-5 rounded-2xl border border-dashed border-surface-muted bg-white/60 p-10 text-center max-w-sm w-full mx-auto",
        className
      )}
    >
      <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-surface-muted text-primary/50">
        {icon ?? <InboxIcon width={30} height={30} />}
      </span>
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-foreground">
          {title}
        </h3>
        <p className="mx-auto max-w-sm text-sm text-foreground/60">
          {description}
        </p>
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  )
}
