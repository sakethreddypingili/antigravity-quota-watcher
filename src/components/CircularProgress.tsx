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

  let strokeColor = '#25D98B'; // status-success
  let bgColor = '#252B28';
  let glowColor = 'rgba(37, 217, 139, 0.12)';

  if (clampedPercentage <= 30 || status === 'exhausted') {
    strokeColor = '#D86666'; // status-error (0-30%)
    bgColor = '#2B2323';
    glowColor = 'rgba(216, 102, 102, 0.12)';
  } else if (clampedPercentage <= 70 || status === 'warning') {
    strokeColor = '#D6A85A'; // status-warning (30-70%)
    bgColor = '#2B2720';
    glowColor = 'rgba(214, 168, 90, 0.12)';
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
          style={{ filter: `drop-shadow(0 0 2.5px ${glowColor})` }}
          className="transition-all duration-700 ease-out"
        />
      </svg>
    </div>
  );
};
