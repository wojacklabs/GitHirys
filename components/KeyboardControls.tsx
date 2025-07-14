import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface KeyboardControlsProps {
  speed?: number;
  enabled?: boolean;
}

const KeyboardControls: React.FC<KeyboardControlsProps> = ({
  speed = 2,
  enabled = true,
}) => {
  const { camera } = useThree();
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const velocity = useRef(new THREE.Vector3());
  const direction = useRef(new THREE.Vector3());

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore keyboard events when input elements are focused
      const target = event.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT')
      ) {
        return;
      }

      keysPressed.current[event.code.toLowerCase()] = true;
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      // Ignore keyboard events when input elements are focused
      const target = event.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT')
      ) {
        return;
      }

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
    // Skip if controls are disabled
    if (!enabled) return;

    const keys = keysPressed.current;

    // Calculate camera's current direction vectors
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);

    camera.getWorldDirection(forward);
    right.crossVectors(forward, up).normalize();

    // Initialize velocity
    velocity.current.set(0, 0, 0);

    // WASD key movement
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

    // Update camera position
    if (velocity.current.length() > 0) {
      camera.position.add(velocity.current.clone().multiplyScalar(delta));
    }
  });

  return null;
};

export default KeyboardControls;
