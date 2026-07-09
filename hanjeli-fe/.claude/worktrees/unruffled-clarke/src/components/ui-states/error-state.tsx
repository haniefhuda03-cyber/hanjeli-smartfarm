import type { ReactNode } from "react";
import { AlertTriangleIcon } from "@/components/icons/toast-icons";

type ErrorStateProps = {
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function ErrorState({
  title = "Terjadi kesalahan",
  description = "Kami tidak dapat memuat data saat ini. Coba lagi atau hubungi tim dukungan.",
  action,
  className = "",
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center gap-5 rounded-2xl border border-red-200 bg-red-50/70 p-10 text-center dark:border-red-900/60 dark:bg-red-950/30 ${className}`}
    >
      <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/60 dark:text-red-300">
        <AlertTriangleIcon width={30} height={30} />
      </span>
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-red-900 dark:text-red-100">
          {title}
        </h3>
        <p className="mx-auto max-w-sm text-sm text-red-700/90 dark:text-red-200/80">
          {description}
        </p>
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}
