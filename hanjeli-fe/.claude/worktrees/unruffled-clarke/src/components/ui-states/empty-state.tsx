import type { ReactNode } from "react";
import { InboxIcon } from "@/components/icons/toast-icons";

type EmptyStateProps = {
  title?: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({
  title = "Belum ada data",
  description = "Belum ada catatan untuk ditampilkan. Tambahkan data pertama Anda untuk memulai.",
  icon,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-5 rounded-2xl border border-dashed border-zinc-200 bg-white/60 p-10 text-center dark:border-zinc-800 dark:bg-zinc-900/40 ${className}`}
    >
      <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
        {icon ?? <InboxIcon width={30} height={30} />}
      </span>
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          {title}
        </h3>
        <p className="mx-auto max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
          {description}
        </p>
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}
