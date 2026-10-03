import React from 'react';

interface CircularProgressProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  status?: 'healthy' | 'warning' | 'exhausted';
}

export const CircularProgress: React.FC<CircularProgressProps> = ({
  percentage,
  size = 40,
  strokeWidth = 4.5,
  status = 'healthy',
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedPercentage = Math.max(0, Math.min(100, percentage));
  const strokeDashoffset = circumference - (clampedPercentage / 100) * circumference;

  let strokeColor = '#22C55E'; // luminous emerald
  let bgColor = '#1B1E22';
  let glowColor = 'rgba(34, 197, 94, 0.25)';

  if (clampedPercentage <= 30 || status === 'exhausted') {
    strokeColor = '#EF4444'; // vivid red
    bgColor = '#261B1B';
    glowColor = 'rgba(239, 68, 68, 0.25)';
  } else if (clampedPercentage <= 70 || status === 'warning') {
    strokeColor = '#F59E0B'; // warm amber
    bgColor = '#26221A';
    glowColor = 'rgba(245, 158, 11, 0.25)';
  }

  return (
    <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background track circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={bgColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress active stroke circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="none"
          style={{ filter: `drop-shadow(0 0 3px ${glowColor})` }}
          className="transition-all duration-700 ease-out"
        />
      </svg>
    </div>
  );
};
