"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "@/lib/notifications/toast";
import { LoadingState, SkeletonCard } from "@/components/ui-states/loading-state";
import { EmptyState } from "@/components/ui-states/empty-state";
import { ErrorState } from "@/components/ui-states/error-state";
import { SuccessState } from "@/components/ui-states/success-state";
import {
  fetchSensorReadings,
  fetchSensorReadingsEmpty,
  fetchSensorReadingsFailing,
  type SensorReading,
} from "@/services/sensors";
import { requestPasswordReset } from "@/services/auth";

type DemoState = "idle" | "loading" | "success" | "empty" | "error";

export function PlaygroundClient() {
  const [demoState, setDemoState] = useState<DemoState>("idle");
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [isPending, startTransition] = useTransition();

  function runDemo(mode: "success" | "empty" | "error") {
    setDemoState("loading");
    setReadings([]);
    startTransition(async () => {
      try {
        const result = await (mode === "success"
          ? fetchSensorReadings()
          : mode === "empty"
            ? fetchSensorReadingsEmpty()
            : fetchSensorReadingsFailing());
        setReadings(result);
        setDemoState(result.length === 0 ? "empty" : "success");
      } catch {
        setDemoState("error");
      }
    });
  }

  function triggerPromiseToast() {
    toast.promise(requestPasswordReset({ email: "petani@hanjeli.id" }), {
      loading: "Mengirim tautan reset password...",
      success: "Tautan reset password berhasil dikirim",
      error: "Gagal mengirim tautan reset",
    });
  }

  return (
    <main className="min-h-[calc(100dvh-1px)] bg-gradient-to-b from-zinc-50 to-white px-4 py-10 dark:from-zinc-950 dark:to-black sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl space-y-10">
        <header className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Internal · Dev only
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
            UI Playground
          </h1>
          <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400 sm:text-base">
            Sandbox untuk men-trigger semua varian Sonner toast dan menguji UI
            states (Loading / Empty / Error / Success). Halaman ini diabaikan
            oleh search engine dan hanya dipakai saat development.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Link
              href="/"
              className="inline-flex items-center rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              ← Beranda
            </Link>
            <Link
              href="/reset-password/success?email=petani@hanjeli.id"
              className="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
            >
              Lihat halaman Reset Password Berhasil →
            </Link>
          </div>
        </header>

        <Section
          title="1. Toast — Standard Variants"
          subtitle="Empat varian dasar dengan ikon kontekstual dan styling yang dapat dibedakan."
        >
          <ButtonGrid>
            <DemoButton
              tone="success"
              onClick={() =>
                toast.success({
                  title: "Data berhasil disimpan",
                  description: "Perubahan jadwal irigasi telah diperbarui.",
                })
              }
            >
              Success
            </DemoButton>
            <DemoButton
              tone="error"
              onClick={() =>
                toast.error({
                  title: "Gagal menyimpan data",
                  description:
                    "Pastikan koneksi Anda stabil lalu coba kirim ulang.",
                  action: {
                    label: "Coba lagi",
                    onClick: () =>
                      toast.info({ title: "Mencoba kembali..." }),
                  },
                })
              }
            >
              Error
            </DemoButton>
            <DemoButton
              tone="warning"
              onClick={() =>
                toast.warning({
                  title: "Baterai sensor menipis",
                  description: "Zona Greenhouse B berada di 18%.",
                })
              }
            >
              Warning
            </DemoButton>
            <DemoButton
              tone="info"
              onClick={() =>
                toast.info({
                  title: "Update firmware tersedia",
                  description: "Versi 2.4.1 dirilis untuk gateway IoT.",
                })
              }
            >
              Info
            </DemoButton>
          </ButtonGrid>
        </Section>

        <Section
          title="2. Toast — Contextual Smartfarm"
          subtitle="Notifikasi dengan SVG icon spesifik konteks: termometer, droplet, matahari, daun, koneksi."
        >
          <ButtonGrid>
            <DemoButton
              tone="warning"
              onClick={() =>
                toast.temperature({
                  title: "Suhu Greenhouse B 33.7°C",
                  description: "Melebihi ambang batas 32°C selama 10 menit.",
                })
              }
            >
              Suhu Tinggi
            </DemoButton>
            <DemoButton
              tone="info"
              onClick={() =>
                toast.humidity({
                  title: "Kelembapan turun ke 58%",
                  description: "Disarankan menyalakan kabut otomatis.",
                })
              }
            >
              Kelembapan
            </DemoButton>
            <DemoButton
              tone="warning"
              onClick={() =>
                toast.sunlight({
                  title: "Intensitas cahaya rendah",
                  description: "Outdoor Plot menerima 12.000 lux pagi ini.",
                })
              }
            >
              Cahaya
            </DemoButton>
            <DemoButton
              tone="success"
              onClick={() =>
                toast.harvest({
                  title: "Siklus panen siap",
                  description: "Bayam zona A telah memenuhi indikator panen.",
                })
              }
            >
              Panen Siap
            </DemoButton>
            <DemoButton
              tone="error"
              onClick={() =>
                toast.connectivity({
                  title: "Gateway IoT offline",
                  description:
                    "Tidak ada heartbeat dari hub utama selama 2 menit.",
                })
              }
            >
              Konektivitas
            </DemoButton>
            <DemoButton
              tone="success"
              onClick={() =>
                toast.passwordReset({
                  title: "Password berhasil direset",
                  description: "Silakan login dengan password baru Anda.",
                })
              }
            >
              Password Reset
            </DemoButton>
            <DemoButton
              tone="info"
              onClick={() =>
                toast.emailSent({
                  title: "Tautan reset telah dikirim",
                  description: "Periksa inbox petani@hanjeli.id",
                })
              }
            >
              Email Terkirim
            </DemoButton>
          </ButtonGrid>
        </Section>

        <Section
          title="3. Toast — Async & Loading"
          subtitle="Pola promise: loading → success/error secara otomatis."
        >
          <ButtonGrid>
            <DemoButton tone="info" onClick={triggerPromiseToast}>
              Promise Toast
            </DemoButton>
            <DemoButton
              tone="info"
              onClick={() => {
                const id = toast.loading({
                  title: "Sinkronisasi data...",
                  description: "Menarik 1.428 sample dari sensor.",
                });
                setTimeout(() => {
                  toast.dismiss(id);
                  toast.success({
                    title: "Sinkronisasi selesai",
                    description: "1.428 sample diperbarui.",
                  });
                }, 2200);
              }}
            >
              Loading → Success
            </DemoButton>
            <DemoButton tone="error" onClick={() => toast.dismiss()}>
              Dismiss Semua
            </DemoButton>
          </ButtonGrid>
        </Section>

        <Section
          title="4. UI States — Live Preview"
          subtitle="Trigger dan lihat empat state inti pada satu container."
        >
          <div className="flex flex-wrap gap-2 pb-5">
            <DemoButton tone="info" onClick={() => runDemo("success")}>
              Load → Success
            </DemoButton>
            <DemoButton tone="info" onClick={() => runDemo("empty")}>
              Load → Empty
            </DemoButton>
            <DemoButton tone="error" onClick={() => runDemo("error")}>
              Load → Error
            </DemoButton>
            <DemoButton
              tone="success"
              onClick={() => {
                setDemoState("idle");
                setReadings([]);
              }}
            >
              Reset
            </DemoButton>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
            {demoState === "idle" && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </div>
            )}
            {demoState === "loading" && <LoadingState />}
            {demoState === "empty" && (
              <EmptyState
                title="Tidak ada pembacaan sensor"
                description="Belum ada data sensor yang tercatat untuk periode ini. Pastikan gateway aktif dan sensor terdaftar."
                action={
                  <button
                    type="button"
                    className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
                    onClick={() => runDemo("success")}
                  >
                    Muat ulang
                  </button>
                }
              />
            )}
            {demoState === "error" && (
              <ErrorState
                title="Gateway tidak merespons"
                description="Server pengelola sensor sedang tidak dapat dihubungi. Periksa koneksi atau coba beberapa saat lagi."
                action={
                  <button
                    type="button"
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                    onClick={() => runDemo("success")}
                  >
                    Coba lagi
                  </button>
                }
              />
            )}
            {demoState === "success" && (
              <div className="space-y-4">
                <SuccessState
                  title={`${readings.length} pembacaan sensor dimuat`}
                  description="Data berikut diambil dari mock service. Siap dihubungkan ke API real."
                />
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {readings.map((reading) => (
                    <div
                      key={reading.id}
                      className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-900/60"
                    >
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        {reading.zone}
                      </p>
                      <dl className="mt-3 space-y-1.5 text-sm">
                        <Stat label="Suhu" value={`${reading.temperatureC}°C`} />
                        <Stat
                          label="Kelembapan"
                          value={`${reading.humidityPct}%`}
                        />
                        <Stat
                          label="Soil moisture"
                          value={`${reading.soilMoisturePct}%`}
                        />
                        <Stat
                          label="Cahaya"
                          value={`${reading.lightLux.toLocaleString("id-ID")} lux`}
                        />
                      </dl>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          {isPending && (
            <p className="pt-3 text-xs text-zinc-500">Menjalankan service...</p>
          )}
        </Section>
      </div>
    </main>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 sm:text-xl">
          {title}
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function ButtonGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
      {children}
    </div>
  );
}

const toneClasses = {
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/60",
  error:
    "border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950/60",
  warning:
    "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-950/60",
  info: "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950/60",
} as const;

function DemoButton({
  tone,
  onClick,
  children,
}: {
  tone: keyof typeof toneClasses;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-11 items-center justify-center rounded-xl border px-4 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${toneClasses[tone]}`}
    >
      {children}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="font-semibold text-zinc-900 dark:text-zinc-100">{value}</dd>
    </div>
  );
}
