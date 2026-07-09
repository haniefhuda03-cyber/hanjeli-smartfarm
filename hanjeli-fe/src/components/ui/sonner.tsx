'use client'

import { Toaster as Sonner, ToasterProps } from 'sonner'

/**
 * Custom Sonner Toaster — Hanjeli Smart Farm
 * 
 * Configured for:
 * - Top-center positioning on ALL screen sizes
 * - Safe-area inset for mobile notch
 * - Expand mode for stacked toasts
 * - unstyled=true because we render via toast.custom() with inline styles
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="hanjeli-toaster"
      position="top-center"
      expand
      richColors={false}
      closeButton
      gap={10}
      visibleToasts={4}
      duration={4500}
      offset={{
        top: "max(env(safe-area-inset-top), 16px)",
      }}
      mobileOffset={{
        top: "max(env(safe-area-inset-top), 16px)",
      }}
      toastOptions={{
        unstyled: true,
      }}
      {...props}
    />
  )
}

export { Toaster }
