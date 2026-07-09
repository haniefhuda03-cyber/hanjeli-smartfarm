import * as React from 'react'

import { cn } from '@/lib/utils'

type NeuInputVariant = 'default' | 'flat' | 'soft'

interface NeuInputProps extends Omit<React.ComponentProps<'input'>, 'size'> {
  variant?: NeuInputVariant
  size?: 'sm' | 'md' | 'lg'
}

const variantStyles: Record<NeuInputVariant, string> = {
  default:
    'rounded-2xl border border-surface-muted bg-white text-foreground placeholder:text-foreground/40',
  flat:
    'rounded-2xl border border-white/60 bg-white text-foreground placeholder:text-foreground/40',
  soft:
    'rounded-2xl border border-transparent bg-surface-sage text-foreground placeholder:text-foreground/40 shadow-[inset_3px_3px_6px_rgba(143,139,120,0.45),inset_-3px_-3px_6px_rgba(255,255,255,0.95)]',
}

const sizeStyles = {
  sm: 'px-3 py-2 text-sm',
  md: 'px-4 py-3 text-sm md:text-base',
  lg: 'px-4 py-3.5 text-base',
}

const NeuInput = React.forwardRef<HTMLInputElement, NeuInputProps>(
  ({ className, variant = 'default', size = 'md', type, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        data-slot="neu-input"
        className={cn(
          'w-full transition-[border-color,box-shadow,background-color] outline-none',
          'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary',
          'disabled:cursor-not-allowed disabled:opacity-60',
          'aria-invalid:border-destructive aria-invalid:ring-destructive/25 aria-invalid:focus:ring-destructive/40',
          variantStyles[variant],
          sizeStyles[size],
          className,
        )}
        {...props}
      />
    )
  },
)

NeuInput.displayName = 'NeuInput'

export { NeuInput }
export type { NeuInputProps }
