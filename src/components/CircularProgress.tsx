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
  strokeWidth = 4,
  status = 'healthy',
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedPercentage = Math.max(0, Math.min(100, percentage));
  const strokeDashoffset = circumference - (clampedPercentage / 100) * circumference;

  let strokeColor = '#10b981'; // emerald-500
  let bgColor = 'rgba(16, 185, 129, 0.12)';

  if (clampedPercentage <= 10 || status === 'exhausted') {
    strokeColor = '#f43f5e'; // rose-500
    bgColor = 'rgba(244, 63, 94, 0.12)';
  } else if (clampedPercentage <= 30 || status === 'warning') {
    strokeColor = '#f59e0b'; // amber-500
    bgColor = 'rgba(245, 158, 11, 0.12)';
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
          className="transition-all duration-700 ease-out"
        />
      </svg>
    </div>
  );
};
