interface HelpButtonProps {
  onClick: () => void;
}

export function HelpButton({ onClick }: HelpButtonProps) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        border: '1px solid var(--border-primary)',
        background: 'var(--bg-card)',
        color: 'var(--text-tertiary)',
        fontSize: 14,
        fontWeight: 700,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      title="How to use this tool"
    >
      ?
    </button>
  );
}
