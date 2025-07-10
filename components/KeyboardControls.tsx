import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface KeyboardControlsProps {
  speed?: number;
}

const KeyboardControls: React.FC<KeyboardControlsProps> = ({ speed = 2 }) => {
  const { camera } = useThree();
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const velocity = useRef(new THREE.Vector3());
  const direction = useRef(new THREE.Vector3());

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      keysPressed.current[event.code.toLowerCase()] = true;
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      keysPressed.current[event.code.toLowerCase()] = false;
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useFrame((state, delta) => {
    const keys = keysPressed.current;

    // 카메라의 현재 방향 벡터들 계산
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);

    camera.getWorldDirection(forward);
    right.crossVectors(forward, up).normalize();

    // 속도 초기화
    velocity.current.set(0, 0, 0);

    // WASD 키 입력에 따른 이동
    if (keys['keyw']) {
      velocity.current.add(forward.multiplyScalar(speed));
    }
    if (keys['keys']) {
      velocity.current.add(forward.multiplyScalar(-speed));
    }
    if (keys['keya']) {
      velocity.current.add(right.multiplyScalar(-speed));
    }
    if (keys['keyd']) {
      velocity.current.add(right.multiplyScalar(speed));
    }
    if (keys['space']) {
      velocity.current.y += speed;
    }
    if (keys['shiftleft']) {
      velocity.current.y -= speed;
    }

    // 카메라 위치 업데이트
    if (velocity.current.length() > 0) {
      camera.position.add(velocity.current.clone().multiplyScalar(delta));
    }
  });

  return null;
};

export default KeyboardControls;
