import type { ReactNode } from "react";
import { CheckCircleIcon } from "@/components/icons/toast-icons";

type SuccessStateProps = {
  title?: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
};

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
      className={`flex flex-col items-center justify-center gap-5 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-10 text-center dark:border-emerald-900/60 dark:bg-emerald-950/30 ${className}`}
    >
      <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/60 dark:text-emerald-300">
        {icon ?? <CheckCircleIcon width={30} height={30} />}
      </span>
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-emerald-900 dark:text-emerald-100">
          {title}
        </h3>
        <p className="mx-auto max-w-sm text-sm text-emerald-700/90 dark:text-emerald-200/80">
          {description}
        </p>
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}
