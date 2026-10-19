import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary:
    'bg-ink text-paper hover:bg-sage-700 disabled:bg-muted/40 disabled:text-paper/70',
  secondary:
    'border border-line bg-surface text-ink hover:border-ink/30 hover:bg-paper',
  ghost: 'text-muted hover:bg-surface hover:text-ink',
  danger: 'border border-clay/30 text-clay hover:bg-clay/5',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-sm rounded-full',
  md: 'h-11 px-5 text-sm rounded-full',
  lg: 'h-12 px-6 text-base rounded-full',
};

export function buttonClass(
  variant: Variant = 'primary',
  size: Size = 'md',
  className?: string,
): string {
  return cn(
    'inline-flex items-center justify-center gap-2 font-medium transition-colors duration-200 disabled:cursor-not-allowed',
    variants[variant],
    sizes[size],
    className,
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button className={buttonClass(variant, size, className)} {...props}>
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = 'primary',
  size = 'md',
  className,
  children,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)}>
      {children}
    </Link>
  );
}
