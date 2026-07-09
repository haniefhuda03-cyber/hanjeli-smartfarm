import { LoaderIcon } from "@/components/icons/toast-icons"

export default function Loading() {
  return (
    <div className="min-h-screen w-full bg-surface-soft flex items-center justify-center p-5">
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-primary/20 bg-primary/3 p-8 text-center max-w-sm w-full">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <LoaderIcon className="h-6.5 w-6.5" />
        </span>
        <div className="space-y-1">
          <p className="text-base font-semibold text-primary">
            Memuat data...
          </p>
          <p className="max-w-xs text-xs text-primary/60">
            Sedang mengambil informasi terbaru dari server.
          </p>
        </div>
      </div>
    </div>
  )
}
