import type { InputHTMLAttributes } from 'react'

type Props = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }

/** Campo con etiqueta y error junto al propio campo (specs/auth · «Errores junto al campo»). */
export function Input({ label, error, id, className = '', ...props }: Props) {
  const inputId = id ?? props.name
  const errorId = error ? `${inputId}-error` : undefined
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className={`min-h-11 rounded-md border bg-card px-3 text-base outline-none focus:ring-2 focus:ring-accent ${error ? 'border-danger' : 'border-border'} ${className}`}
        {...props}
      />
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}
