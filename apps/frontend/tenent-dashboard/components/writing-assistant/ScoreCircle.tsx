interface ScoreCircleProps {
  score: number | null;
  size?: number;
  strokeWidth?: number;
  label?: string;
}

function getScoreColor(score: number | null): string {
  if (score === null) return 'var(--text-tertiary)';
  if (score >= 70) return '#22c55e';
  if (score >= 40) return '#eab308';
  return '#ef4444';
}

export function ScoreCircle({
  score,
  size = 80,
  strokeWidth = 6,
  label,
}: ScoreCircleProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = score !== null ? (score / 100) * circumference : 0;
  const offset = circumference - progress;
  const color = getScoreColor(score);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border-primary)"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.3s ease' }}
        />
        {/* Score text */}
        <text
          x={size / 2}
          y={size / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fill={color}
          fontSize={size * 0.28}
          fontWeight={700}
          style={{ transform: 'rotate(90deg)', transformOrigin: 'center' }}
        >
          {score !== null ? Math.round(score) : '--'}
        </text>
      </svg>
      {label && (
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500 }}>
          {label}
        </span>
      )}
    </div>
  );
}
