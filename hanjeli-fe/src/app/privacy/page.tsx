"use client"

import { useTranslation } from "react-i18next"
import { ShieldCheck } from "lucide-react"
import { LegalShell, LegalSections, type LegalSection } from "@/components/legal/legal-shell"

export default function PrivacyPage() {
  const { t } = useTranslation()
  const intro = t("legal.privacy.intro")
  const sections = t("legal.privacy.sections", { returnObjects: true }) as LegalSection[]

  return (
    <LegalShell current="privacy" icon={<ShieldCheck className="h-8 w-8" strokeWidth={1.75} />}>
      <p className="mb-8 text-pretty text-sm leading-relaxed text-foreground/80 sm:text-[15px] sm:leading-7">
        {intro}
      </p>
      <LegalSections sections={Array.isArray(sections) ? sections : []} />
    </LegalShell>
  )
}
