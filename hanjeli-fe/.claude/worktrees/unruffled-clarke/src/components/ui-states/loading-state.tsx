import { LoaderIcon } from "@/components/icons/toast-icons";

type LoadingStateProps = {
  title?: string;
  description?: string;
  className?: string;
};

export function LoadingState({
  title = "Memuat data...",
  description = "Sedang mengambil informasi terbaru dari kebun Anda.",
  className = "",
}: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-zinc-200 bg-white/60 p-8 text-center dark:border-zinc-800 dark:bg-zinc-900/40 ${className}`}
    >
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300">
        <LoaderIcon width={26} height={26} />
      </span>
      <div className="space-y-1">
        <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          {title}
        </p>
        <p className="max-w-xs text-sm text-zinc-500 dark:text-zinc-400">
          {description}
        </p>
      </div>
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="animate-pulse space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="h-4 w-1/3 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-3 w-2/3 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-3 w-1/2 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-4 h-24 rounded-xl bg-zinc-100 dark:bg-zinc-800/60" />
    </div>
  );
}
