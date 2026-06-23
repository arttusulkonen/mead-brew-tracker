import React, { useEffect, useState } from 'react';

interface ActiveTimerProps {
  startedAt?: string | null;
  accumulatedSeconds?: number;
  isActive?: boolean;
}

export const ActiveTimer: React.FC<ActiveTimerProps> = ({
  startedAt,
  accumulatedSeconds = 0,
  isActive = false
}) => {
  const [displayTime, setDisplayTime] = useState<string>('');

  useEffect(() => {
    const calculateTime = () => {
      let totalSeconds = accumulatedSeconds;
      
      if (isActive && startedAt) {
        totalSeconds += Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
      }

      const h = Math.floor(totalSeconds / 3600);
      const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
      const s = (totalSeconds % 60).toString().padStart(2, '0');
      
      setDisplayTime(h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`);
    };

    calculateTime();

    if (!isActive) return;

    const intervalId = setInterval(calculateTime, 1000);
    return () => clearInterval(intervalId);
  }, [startedAt, accumulatedSeconds, isActive]);

  return <span className="active-timer">{displayTime}</span>;
};