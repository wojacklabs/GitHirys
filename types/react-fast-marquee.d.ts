declare module 'react-fast-marquee' {
  import { ReactNode } from 'react';

  export interface MarqueeProps {
    children?: ReactNode;
    className?: string;
    style?: React.CSSProperties;
    speed?: number;
    delay?: number;
    direction?: 'left' | 'right' | 'up' | 'down';
    loop?: number;
    gradient?: boolean;
    gradientColor?: string;
    gradientWidth?: number | string;
    pauseOnHover?: boolean;
    pauseOnClick?: boolean;
    autoFill?: boolean;
    play?: boolean;
    onFinish?: () => void;
    onCycleComplete?: () => void;
    onMount?: () => void;
  }

  declare const Marquee: React.FC<MarqueeProps>;
  export default Marquee;
}
