import { InputHTMLAttributes, useState } from 'react';
import styles from './InputField.module.css';

interface InputFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export function InputField({ label, error, type, id, ...props }: InputFieldProps) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const fieldId = id || label.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className={styles.group}>
      <label htmlFor={fieldId} className={styles.label}>
        {label}
      </label>
      <div className={styles.inputWrapper}>
        <input
          id={fieldId}
          type={isPassword && showPassword ? 'text' : type}
          className={`${styles.input} ${error ? styles.inputError : ''}`}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            className={styles.togglePassword}
            onClick={() => setShowPassword(!showPassword)}
            tabIndex={-1}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? '🙈' : '👁'}
          </button>
        )}
      </div>
      {error && <span className={styles.error}>{error}</span>}
    </div>
  );
}
