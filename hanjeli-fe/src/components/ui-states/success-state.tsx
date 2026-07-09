import type { ReactNode } from "react"
import { CheckCircleIcon } from "@/components/icons/toast-icons"

type SuccessStateProps = {
  title?: string
  description?: string
  icon?: ReactNode
  action?: ReactNode
  className?: string
}

export function SuccessState({
  title = "Berhasil",
  description = "Permintaan Anda telah diproses dengan sukses.",
  icon,
  action,
  className = "",
}: SuccessStateProps) {
  return (
    <div
      role="status"
      className={`flex flex-col items-center justify-center gap-5 rounded-2xl border border-success/50 bg-success/10 p-10 text-center ${className}`}
    >
      <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-success/30 text-primary">
        {icon ?? <CheckCircleIcon width={30} height={30} />}
      </span>
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-primary">
          {title}
        </h3>
        <p className="mx-auto max-w-sm text-sm text-primary/70">
          {description}
        </p>
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  )
}
