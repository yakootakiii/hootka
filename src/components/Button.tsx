import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-grape-500 text-white',
  secondary: 'bg-white text-ink',
  ghost: 'bg-transparent text-ink shadow-none active:translate-y-0',
  danger: 'bg-answer-red text-white',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
}

export function Button({ variant = 'primary', className = '', children, ...rest }: ButtonProps) {
  return (
    <button type="button" {...rest} className={`btn-chunky ${VARIANTS[variant]} ${className}`}>
      {children}
    </button>
  );
}
