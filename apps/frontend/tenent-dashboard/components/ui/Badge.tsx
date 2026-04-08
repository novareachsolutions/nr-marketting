import { HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center font-semibold uppercase tracking-wide',
  {
    variants: {
      variant: {
        default: 'bg-bg-tertiary text-text-tertiary',
        primary: 'bg-accent-primary-light text-accent-primary',
        success: 'bg-accent-success-light text-accent-success',
        warning: 'bg-accent-warning-light text-accent-warning',
        danger: 'bg-accent-danger-light text-accent-danger',
        wordpress: 'bg-[#dbeafe] text-[#2563eb]',
        github: 'bg-bg-tertiary text-text-primary',
      },
      size: {
        sm: 'text-[10px] px-2 py-0.5 rounded-full',
        md: 'text-xs px-2.5 py-1 rounded-full',
        lg: 'text-[13px] px-3 py-1 rounded-full normal-case font-normal',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'sm',
    },
  }
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size, className }))} {...props} />
  );
}

export { Badge, badgeVariants };
