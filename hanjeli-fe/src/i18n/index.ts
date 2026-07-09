import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import id from './locales/id.json'
import en from './locales/en.json'
// Force HMR reload

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      id: { translation: id },
      en: { translation: en },
    },
    // Default SELALU Bahasa Indonesia. Deteksi hanya membaca pilihan
    // eksplisit user di localStorage — bahasa browser (navigator) sengaja
    // diabaikan agar pengunjung baru tidak otomatis mendapat bahasa Inggris.
    fallbackLng: 'id',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage'],
      caches: ['localStorage'],
    },
  })

export default i18n
