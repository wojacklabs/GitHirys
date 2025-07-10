import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface PlanetProps {
  repo: {
    name: string;
    owner: string;
    branches: string[];
    defaultBranch: string;
  };
  user: {
    accountAddress: string;
    nickname?: string;
  };
  orbitRadius: number;
  orbitSpeed: number;
  initialAngle: number;
  inclination: number;
  onPlanetClick: (user: string, repo: string) => void;
  onPlanetHover: (repo: any, position: [number, number, number]) => void;
  onPlanetLeave: () => void;
  isFocused: boolean;
}

const Planet: React.FC<PlanetProps> = ({
  repo,
  user,
  orbitRadius,
  orbitSpeed,
  initialAngle,
  inclination,
  onPlanetClick,
  onPlanetHover,
  onPlanetLeave,
  isFocused,
}) => {
  const planetRef = useRef<THREE.Mesh>(null);
  const ringsRef = useRef<THREE.Mesh>(null);
  const atmosphereRef = useRef<THREE.Mesh>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);
  const oceansRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);

  // 실제 행성 타입과 색상 결정 (저장소 이름 기반)
  const planetType = useMemo(() => {
    const hash = repo.name.split('').reduce((acc, char) => {
      return acc + char.charCodeAt(0);
    }, 0);

    const planetTypes = [
      {
        name: 'Earth-like',
        color: '#4F94CD',
        atmosphere: '#87CEEB',
        hasOceans: true,
        hasClouds: true,
      }, // 지구형
      {
        name: 'Mars-like',
        color: '#CD5C5C',
        atmosphere: '#F4A460',
        hasOceans: false,
        hasClouds: false,
      }, // 화성형
      {
        name: 'Gas Giant',
        color: '#DAA520',
        atmosphere: '#FFA500',
        hasOceans: false,
        hasClouds: true,
      }, // 가스형 (목성)
      {
        name: 'Ice Planet',
        color: '#E0FFFF',
        atmosphere: '#B0E0E6',
        hasOceans: false,
        hasClouds: false,
      }, // 얼음형
      {
        name: 'Venus-like',
        color: '#FFA500',
        atmosphere: '#FFFF99',
        hasOceans: false,
        hasClouds: true,
      }, // 금성형
      {
        name: 'Desert',
        color: '#DEB887',
        atmosphere: '#F5DEB3',
        hasOceans: false,
        hasClouds: false,
      }, // 사막형
      {
        name: 'Ocean World',
        color: '#0066CC',
        atmosphere: '#4169E1',
        hasOceans: true,
        hasClouds: true,
      }, // 해양형
      {
        name: 'Rocky',
        color: '#696969',
        atmosphere: '#A9A9A9',
        hasOceans: false,
        hasClouds: false,
      }, // 암석형
    ];

    return planetTypes[hash % planetTypes.length];
  }, [repo.name]);

  // 행성 크기와 속성 결정 (브랜치 수와 행성 타입에 따라)
  const planetProperties = useMemo(() => {
    const branchCount = repo.branches?.length || 0;
    let baseSize = 0.4;
    let maxSize = 1.2;

    // 가스형 행성은 더 크게
    if (planetType.name === 'Gas Giant') {
      baseSize = 0.6;
      maxSize = 1.8;
    }

    // 브랜치가 많을수록 큰 크기
    const size = Math.max(
      baseSize,
      Math.min(baseSize + branchCount * 0.08, maxSize)
    );

    // 행성 타입에 따른 색상
    const planetColor = new THREE.Color(planetType.color);
    const atmosphereColor = new THREE.Color(planetType.atmosphere);

    // 브랜치 3개 이상이면 링 효과 (가스형은 더 쉽게 링 생성)
    const hasRings =
      planetType.name === 'Gas Giant' ? branchCount >= 2 : branchCount >= 4;

    return {
      size,
      planetColor,
      atmosphereColor,
      hasRings,
      planetType,
    };
  }, [repo.branches, planetType]);

  // 애니메이션 (공전, 자전, 대기, 구름, 해양 효과)
  useFrame(state => {
    if (groupRef.current && planetRef.current && atmosphereRef.current) {
      const time = state.clock.getElapsedTime();

      // 공전 애니메이션
      const angle = initialAngle + time * orbitSpeed;
      const x = Math.cos(angle) * orbitRadius;
      const z = Math.sin(angle) * orbitRadius;
      const y = Math.sin(angle * 2) * inclination;

      groupRef.current.position.set(x, y, z);

      // 자전 효과 (행성 타입에 따라 다른 속도)
      const rotationSpeed =
        planetProperties.planetType.name === 'Gas Giant' ? 0.02 : 0.01;
      planetRef.current.rotation.y += rotationSpeed;

      // 대기 효과 (반대 방향 회전)
      atmosphereRef.current.rotation.y -= 0.005;

      // 구름 효과 (있을 경우)
      if (cloudsRef.current && planetProperties.planetType.hasClouds) {
        cloudsRef.current.rotation.y += 0.008;
        cloudsRef.current.rotation.x += 0.002;
      }

      // 해양 효과 (있을 경우)
      if (oceansRef.current && planetProperties.planetType.hasOceans) {
        oceansRef.current.rotation.y += 0.003;
      }

      // 호버 효과
      const hoverScale = isFocused ? 1.2 : 1;
      const pulse = Math.sin(time * 3) * 0.03 + 1;

      planetRef.current.scale.setScalar(hoverScale * pulse);
      atmosphereRef.current.scale.setScalar(hoverScale * pulse * 1.3);

      // 링 회전 (있을 경우)
      if (ringsRef.current) {
        ringsRef.current.rotation.z += 0.02;
        ringsRef.current.rotation.y += 0.005;
      }
    }
  });

  const handleClick = () => {
    onPlanetClick(user.nickname || user.accountAddress, repo.name);
  };

  const handlePointerEnter = () => {
    if (groupRef.current) {
      const position = groupRef.current.position;
      onPlanetHover(repo, [position.x, position.y, position.z]);
    }
  };

  const handlePointerLeave = () => {
    onPlanetLeave();
  };

  return (
    <group ref={groupRef}>
      {/* 대기층 (행성 타입에 따라) */}
      <mesh
        ref={atmosphereRef}
        scale={[
          planetProperties.size * 1.4,
          planetProperties.size * 1.4,
          planetProperties.size * 1.4,
        ]}
      >
        <sphereGeometry args={[1, 24, 24]} />
        <meshBasicMaterial
          color={planetProperties.atmosphereColor}
          transparent
          opacity={0.2}
        />
      </mesh>

      {/* 해양 레이어 (해양 행성의 경우) */}
      {planetProperties.planetType.hasOceans && (
        <mesh
          ref={oceansRef}
          scale={[
            planetProperties.size * 1.05,
            planetProperties.size * 1.05,
            planetProperties.size * 1.05,
          ]}
        >
          <sphereGeometry args={[1, 28, 28]} />
          <meshStandardMaterial
            color="#1E90FF"
            transparent
            opacity={0.8}
            roughness={0.1}
            metalness={0.9}
            envMapIntensity={0.8}
          />
        </mesh>
      )}

      {/* 구름 레이어 (구름이 있는 행성의 경우) */}
      {planetProperties.planetType.hasClouds && (
        <mesh
          ref={cloudsRef}
          scale={[
            planetProperties.size * 1.1,
            planetProperties.size * 1.1,
            planetProperties.size * 1.1,
          ]}
        >
          <sphereGeometry args={[1, 20, 20]} />
          <meshBasicMaterial color="#FFFFFF" transparent opacity={0.3} />
        </mesh>
      )}

      {/* 행성 본체 */}
      <mesh
        ref={planetRef}
        scale={[
          planetProperties.size,
          planetProperties.size,
          planetProperties.size,
        ]}
        onClick={handleClick}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
      >
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial
          color={planetProperties.planetColor}
          roughness={
            planetProperties.planetType.name === 'Gas Giant' ? 0.3 : 0.8
          }
          metalness={
            planetProperties.planetType.name === 'Ice Planet' ? 0.6 : 0.2
          }
          envMapIntensity={0.4}
        />
      </mesh>

      {/* 링 시스템 (조건에 따라) */}
      {planetProperties.hasRings && (
        <mesh
          ref={ringsRef}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[
            planetProperties.size * 2.2,
            planetProperties.size * 2.2,
            planetProperties.size * 2.2,
          ]}
        >
          <ringGeometry args={[1.3, 2.0, 64]} />
          <meshStandardMaterial
            color={
              planetProperties.planetType.name === 'Gas Giant'
                ? '#DAA520'
                : '#C0C0C0'
            }
            transparent
            opacity={0.6}
            roughness={0.8}
            metalness={0.3}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  );
};

export default Planet;
