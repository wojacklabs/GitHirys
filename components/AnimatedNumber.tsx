import { useEffect, useState } from 'react';

interface AnimatedNumberProps {
  value: number;
  duration?: number; // 애니메이션 지속 시간 (ms)
  className?: string;
}

const AnimatedNumber: React.FC<AnimatedNumberProps> = ({ 
  value, 
  duration = 1000,
  className = '' 
}) => {
  const [displayValue, setDisplayValue] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);

  useEffect(() => {
    if (value === 0) {
      setDisplayValue(0);
      return;
    }

    setStartTime(Date.now());
    
    const animateValue = () => {
      const now = Date.now();
      const startTimeValue = startTime || now;
      const elapsed = now - startTimeValue;
      
      if (elapsed < duration) {
        // easeOutQuart 애니메이션 함수 사용
        const progress = elapsed / duration;
        const easedProgress = 1 - Math.pow(1 - progress, 4);
        const currentValue = Math.floor(easedProgress * value);
        
        setDisplayValue(currentValue);
        requestAnimationFrame(animateValue);
      } else {
        setDisplayValue(value);
      }
    };

    if (startTime) {
      animateValue();
    }
  }, [value, duration, startTime]);

  useEffect(() => {
    if (value > 0) {
      setStartTime(Date.now());
    }
  }, [value]);

  return (
    <span className={className}>
      {displayValue.toLocaleString()}
    </span>
  );
};

export default AnimatedNumber; 