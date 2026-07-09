import type { Metadata } from "next";
import { PlaygroundClient } from "./playground-client";

export const metadata: Metadata = {
  title: "Dev Playground — Hanjeli Smartfarm",
  description: "Internal sandbox untuk menguji notifikasi & UI states.",
  robots: { index: false, follow: false },
};

export default function PlaygroundPage() {
  return <PlaygroundClient />;
}
