// src/components/ActiveTimer.tsx
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
      let totalSeconds = accumulatedSeconds || 0;
      
      if (isActive && startedAt) {
        const startMs = new Date(startedAt).getTime();
        if (!isNaN(startMs)) {
          totalSeconds += Math.floor((Date.now() - startMs) / 1000);
        }
      }

      totalSeconds = Math.max(0, totalSeconds);

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