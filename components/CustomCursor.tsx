import React, { useEffect, useState } from 'react';
import styles from './CustomCursor.module.css';

const CustomCursor: React.FC = () => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    // 터치 디바이스 감지
    const checkTouchDevice = () => {
      return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    };

    setIsTouchDevice(checkTouchDevice());

    // 터치 디바이스라면 커서를 표시하지 않음
    if (checkTouchDevice()) {
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
      setIsVisible(true);
    };

    const handleMouseLeave = () => {
      setIsVisible(false);
    };

    const handleMouseEnter = () => {
      setIsVisible(true);
    };

    // 터치 이벤트 감지 시 커서 숨기기
    const handleTouchStart = () => {
      setIsVisible(false);
    };

    // 마우스 이벤트 등록
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mouseenter', handleMouseEnter);
    document.addEventListener('touchstart', handleTouchStart);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseenter', handleMouseEnter);
      document.removeEventListener('touchstart', handleTouchStart);
    };
  }, []);

  // 터치 디바이스에서는 커서를 렌더링하지 않음
  if (isTouchDevice) {
    return null;
  }

  return (
    <div
      className={`${styles.customCursor} ${isVisible ? styles.visible : ''}`}
      style={{
        left: mousePosition.x,
        top: mousePosition.y,
      }}
    >
      <img src="/Sprite.webp" alt="커서" className={styles.cursorImage} />
      <span className={styles.blind}>커서</span>
    </div>
  );
};

export default CustomCursor;
