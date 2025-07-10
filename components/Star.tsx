import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface StarProps {
  user: {
    accountAddress: string;
    nickname?: string;
    profileImageUrl?: string;
    repositories?: Array<{
      name: string;
      owner: string;
      branches: string[];
      defaultBranch: string;
    }>;
  };
  onClick: () => void;
  onHover: (hover: boolean) => void;
  isHovered: boolean;
  isFocused: boolean;
}

const Star: React.FC<StarProps> = ({
  user,
  onClick,
  onHover,
  isHovered,
  isFocused,
}) => {
  const starRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const coronaRef = useRef<THREE.Mesh>(null);

  // 태양 색상 결정 (태양 계열 색상만 사용)
  const starColor = useMemo(() => {
    const hash = user.accountAddress.split('').reduce((acc, char) => {
      return acc + char.charCodeAt(0);
    }, 0);

    const sunColors = [
      '#FFD700', // 금색 태양
      '#FFA500', // 주황색 태양
      '#FFFF00', // 노란색 태양
      '#FF8C00', // 다크 오렌지 태양
      '#FFB347', // 복숭아색 태양
      '#FFCC33', // 황금색 태양
      '#FF7F00', // 주황색 태양
      '#FFAA00', // 앰버색 태양
    ];

    return sunColors[hash % sunColors.length];
  }, [user.accountAddress]);

  // 태양 크기와 밝기 결정 (저장소 수에 따라)
  const starProperties = useMemo(() => {
    const repositoryCount = user.repositories?.length || 0;
    const baseSize = 1.2; // 태양은 기본적으로 더 크게
    const maxSize = 3.0;

    // 저장소가 많을수록 큰 크기
    const size = Math.max(
      baseSize,
      Math.min(baseSize + repositoryCount * 0.3, maxSize)
    );

    // 태양의 강한 발광 효과
    const brightness = Math.min(1.5 + repositoryCount * 0.2, 2.5);
    const brightColor = new THREE.Color(starColor).multiplyScalar(brightness);

    return { size, brightColor };
  }, [user.repositories, starColor]);

  // 태양 표면 활동 애니메이션
  useFrame(state => {
    if (starRef.current && glowRef.current && coronaRef.current) {
      const time = state.clock.getElapsedTime();

      // 태양 표면의 다층 활동 시뮬레이션
      const mainPulse = Math.sin(time * 1.2) * 0.03 + 1;
      const surfaceActivity = Math.sin(time * 2.8) * 0.02 + 1;
      const coronaFlare = Math.sin(time * 0.6) * 0.15 + 1;
      const solarWind = Math.sin(time * 3.5) * 0.05 + 1;

      // 호버 및 포커스 효과
      const hoverScale = isHovered ? 1.15 : 1;
      const focusScale = isFocused ? 1.25 : 1;

      // 복합적인 태양 활동 효과
      const surfaceScale =
        mainPulse * surfaceActivity * hoverScale * focusScale;
      const glowScale = surfaceScale * solarWind * 1.3;
      const coronaScale = coronaFlare * hoverScale * 1.6;

      starRef.current.scale.setScalar(surfaceScale);
      glowRef.current.scale.setScalar(glowScale);
      coronaRef.current.scale.setScalar(coronaScale);

      // 태양의 자전과 코로나 회전
      starRef.current.rotation.y += 0.01;
      starRef.current.rotation.x += 0.002;
      coronaRef.current.rotation.y -= 0.008;
      coronaRef.current.rotation.z += 0.003;
    }
  });

  return (
    <group>
      {/* 항성 코로나 (외곽 효과) */}
      <mesh
        ref={coronaRef}
        scale={[
          starProperties.size * 1.5,
          starProperties.size * 1.5,
          starProperties.size * 1.5,
        ]}
      >
        <sphereGeometry args={[1, 24, 24]} />
        <meshBasicMaterial
          color={starProperties.brightColor}
          transparent
          opacity={0.25}
        />
      </mesh>

      {/* 항성 글로우 효과 */}
      <mesh
        ref={glowRef}
        scale={[
          starProperties.size * 1.2,
          starProperties.size * 1.2,
          starProperties.size * 1.2,
        ]}
      >
        <sphereGeometry args={[1, 20, 20]} />
        <meshBasicMaterial
          color={starProperties.brightColor}
          transparent
          opacity={0.8}
        />
      </mesh>

      {/* 항성 본체 - 스스로 빛을 내는 효과 */}
      <mesh
        ref={starRef}
        scale={[starProperties.size, starProperties.size, starProperties.size]}
        onPointerEnter={() => onHover(true)}
        onPointerLeave={() => onHover(false)}
        onClick={onClick}
      >
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial
          color={starProperties.brightColor}
          emissive={starProperties.brightColor}
          emissiveIntensity={1.0}
          roughness={0.02}
          metalness={0.0}
        />
      </mesh>

      {/* 태양 주변 강력한 라이트 효과 */}
      <pointLight
        position={[0, 0, 0]}
        intensity={starProperties.size * 2.0}
        color={starProperties.brightColor}
        distance={starProperties.size * 25}
        decay={1.8}
      />

      {/* 추가 태양 라이트 (더 넓은 범위) */}
      <pointLight
        position={[0, 0, 0]}
        intensity={starProperties.size * 0.8}
        color={starProperties.brightColor}
        distance={starProperties.size * 40}
        decay={2.2}
      />
    </group>
  );
};

export default Star;
