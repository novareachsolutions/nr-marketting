import { forwardRef, InputHTMLAttributes, useState } from 'react';
import { cn } from '@/lib/utils';
import { Eye, EyeOff } from 'lucide-react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        'flex h-11 w-full rounded-md border bg-bg-input px-3.5 text-sm text-text-primary placeholder:text-text-tertiary transition-all duration-fast',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:border-transparent',
        error
          ? 'border-accent-danger focus-visible:ring-accent-danger'
          : 'border-border-input',
        className
      )}
      {...props}
    />
  )
);
Input.displayName = 'Input';

export interface InputFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

function InputField({ label, error, type, id, className, ...props }: InputFieldProps) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const fieldId = id || label.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label
        htmlFor={fieldId}
        className="text-[13px] font-medium text-text-secondary tracking-wide"
      >
        {label}
      </label>
      <div className="relative flex items-center">
        <Input
          id={fieldId}
          type={isPassword && showPassword ? 'text' : type}
          error={!!error}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            className="absolute right-3 text-text-tertiary hover:text-text-primary transition-colors"
            onClick={() => setShowPassword(!showPassword)}
            tabIndex={-1}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
      {error && (
        <span className="text-xs text-accent-danger mt-0.5">{error}</span>
      )}
    </div>
  );
}

export { Input, InputField };
