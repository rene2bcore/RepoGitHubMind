import type { ButtonHTMLAttributes } from 'react'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' }

const styles: Record<NonNullable<Props['variant']>, string> = {
  primary: 'bg-accent text-accent-fg hover:opacity-90',
  ghost: 'border border-border bg-transparent hover:bg-card',
  danger: 'bg-danger text-white hover:opacity-90',
}

/** Botón táctil: 44 px de alto mínimo para el móvil (prompt maestro §67). */
export function Button({ variant = 'primary', className = '', ...props }: Props) {
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center rounded-md px-4 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${styles[variant]} ${className}`}
      {...props}
    />
  )
}
