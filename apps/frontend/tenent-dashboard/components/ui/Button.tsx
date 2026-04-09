import { forwardRef, ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 font-semibold transition-all duration-fast cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus',
  {
    variants: {
      variant: {
        primary:
          'bg-accent-primary text-white hover:bg-accent-primary-hover shadow-sm rounded-lg',
        secondary:
          'bg-bg-card text-text-secondary border border-border hover:bg-bg-hover hover:text-text-primary rounded-lg',
        danger:
          'bg-accent-danger text-white hover:opacity-90 rounded-lg',
        ghost:
          'bg-transparent text-text-secondary hover:bg-bg-hover hover:text-text-primary rounded-lg',
        link:
          'bg-transparent text-text-link hover:text-accent-primary-hover underline-offset-4 hover:underline p-0 h-auto',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4 text-sm',
        lg: 'h-11 px-6 text-sm',
        icon: 'h-10 w-10',
        'icon-sm': 'h-7 w-7 text-xs',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
);
Button.displayName = 'Button';

export { Button, buttonVariants };
