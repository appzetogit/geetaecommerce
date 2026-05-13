import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'default' | 'lg' | 'icon';
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center rounded-full font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

    const variants = {
      default: 'bg-[var(--customer-primary-dark)] text-white hover:bg-[var(--customer-primary-darker)]',
      outline: 'border-2 border-[var(--customer-primary-dark)] text-[var(--customer-primary-dark)] bg-transparent hover:bg-[var(--customer-primary-alpha-10)]',
      ghost: 'hover:bg-neutral-100 text-neutral-900',
      destructive: 'bg-[var(--customer-primary)] text-white hover:bg-[var(--customer-primary-dark)]',
    };

    const sizes = {
      sm: 'h-7 px-3 text-xs',
      default: 'h-10 px-4 py-2 text-sm',
      lg: 'h-12 px-6 text-base',
      icon: 'h-10 w-10',
    };

    return (
      <button
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';

export default Button;


