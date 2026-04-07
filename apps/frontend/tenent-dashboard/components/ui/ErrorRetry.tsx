interface ErrorRetryProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorRetry({ message, onRetry }: ErrorRetryProps) {
  return (
    <div style={{
      textAlign: 'center',
      padding: 32,
      background: 'var(--bg-card)',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border-primary)',
    }}>
      <div style={{ color: 'var(--accent-danger)', fontSize: 14, marginBottom: onRetry ? 12 : 0 }}>
        {message || 'Something went wrong. Please try again.'}
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            height: 36,
            padding: '0 20px',
            background: 'var(--accent-primary)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Try Again
        </button>
      )}
    </div>
  );
}
