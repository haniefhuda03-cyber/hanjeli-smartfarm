"use client"

import { useTranslation } from "react-i18next"
import { Sparkles, AlertCircle, MessageCircle, HelpCircle, FileText } from "lucide-react"
import { cn } from "@/lib/utils"

const ChatbotIcon = ({ className }: { className?: string }) => (
  <div 
    className={cn("bg-current inline-block shrink-0", className)} 
    style={{ 
      maskImage: 'url(/chatbot.png)', 
      WebkitMaskImage: 'url(/chatbot.png)', 
      maskSize: 'contain', 
      WebkitMaskSize: 'contain', 
      maskRepeat: 'no-repeat', 
      WebkitMaskRepeat: 'no-repeat',
      maskPosition: 'center',
      WebkitMaskPosition: 'center',
      filter: 'drop-shadow(0px 0px 0.5px currentColor) drop-shadow(0px 0px 1px currentColor)'
    }} 
  />
)

export default function AIChatbotPage() {
  const { t } = useTranslation()

  return (
    <div className="relative min-h-screen w-full bg-page px-5 md:px-6 lg:px-8 pt-16 lg:pt-6 pb-28 lg:pb-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
          <ChatbotIcon className="h-7 w-7 md:h-8 md:w-8 text-primary" />
          {t('nav.ai_chatbot', 'Layanan AI Chatbot')}
        </h1>
        <p className="text-sm md:text-base text-foreground/60 mt-1.5 max-w-2xl">
          {t('ai.chatbotSubtitle', 'Asisten cerdas Hanjeli yang siap menjawab semua pertanyaan seputar pertanian, kendala teknis, dan informasi sistem IoT kapan pun Anda butuhkan.')}
        </p>
      </div>

      {/* Hero Empty State */}
      <div className="bg-surface-sage rounded-4xl p-8 lg:p-16 border border-white/70 neu-raised flex flex-col items-center justify-center text-center relative overflow-hidden">
        {/* Background decorative elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
          <div className="absolute top-[-10%] left-[-5%] w-64 h-64 bg-primary/20 rounded-full blur-3xl"></div>
          <div className="absolute bottom-[-10%] right-[-5%] w-64 h-64 bg-blue-500/20 rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10 flex flex-col items-center">
          <div className="h-24 w-24 bg-white/50 backdrop-blur-sm border border-white rounded-full flex items-center justify-center mb-6 shadow-xl relative">
            <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping opacity-75"></div>
            <ChatbotIcon className="h-10 w-10 text-primary relative z-10" />
          </div>
          
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3 font-display">
            {t('ai.chatbotEmptyTitle', 'Asisten AI Sedang Dikonfigurasi')}
          </h2>

          <p className="text-sm md:text-base text-foreground/70 max-w-xl mx-auto mb-8 leading-relaxed">
            {t('ai.chatbotEmptyDesc', 'Layanan AI Chatbot sedang dalam tahap pelatihan Natural Language Processing (NLP) agar dapat berkomunikasi menggunakan bahasa yang natural dan relevan dengan pertanian Hanjeli.')}
          </p>

          <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-100 text-amber-700 border border-amber-200/50 rounded-full text-xs md:text-sm font-bold shadow-sm uppercase tracking-wide">
            <AlertCircle className="h-4 w-4" />
            {t('ai.comingSoonBadge', 'Dalam Tahap Pengembangan (Coming Soon)')}
          </div>
        </div>
      </div>

      {/* Fitur yang akan datang */}
      <div className="mt-8">
        <h3 className="text-lg font-bold text-foreground mb-4 pl-2 border-l-4 border-primary">{t('ai.chatbotUpcomingHeading', 'Apa yang bisa dilakukan asisten ini nanti?')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            {
              title: t('ai.chatbotFeature1Title', 'Konsultasi Pertanian'),
              desc: t('ai.chatbotFeature1Desc', 'Tanyakan langsung masalah tanaman Anda, mulai dari daun menguning, jadwal panen, hingga takaran pupuk.'),
              icon: MessageCircle,
              color: "text-blue-600",
              bg: "bg-blue-100"
            },
            {
              title: t('ai.chatbotFeature2Title', 'Panduan Teknis IoT'),
              desc: t('ai.chatbotFeature2Desc', 'Bantuan langkah demi langkah jika sensor mati, pompa air gagal menyala, atau koneksi terputus.'),
              icon: HelpCircle,
              color: "text-amber-600",
              bg: "bg-amber-100"
            },
            {
              title: t('ai.chatbotFeature3Title', 'Ekstraksi Laporan'),
              desc: t('ai.chatbotFeature3Desc', "Cukup ketik 'Buatkan laporan suhu bulan ini' dan asisten akan menarik datanya langsung ke layar Anda."),
              icon: FileText,
              color: "text-emerald-600",
              bg: "bg-emerald-100"
            }
          ].map((feature, i) => (
            <div key={i} className="bg-surface-sage rounded-2xl p-5 border border-white/60 neu-raised-shallow flex flex-col items-start opacity-70 cursor-not-allowed">
              <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center mb-3 neu-inset-light", feature.bg)}>
                <feature.icon className={cn("h-5 w-5", feature.color)} />
              </div>
              <h4 className="font-bold text-foreground text-sm mb-1">{feature.title}</h4>
              <p className="text-xs text-foreground/60 leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
