import React, { useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Html } from '@react-three/drei';
import * as THREE from 'three';
import Planet from './Planet';
import Star from './Star';

interface StarSystemProps {
  position: [number, number, number];
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
  onPlanetClick: (user: string, repo: string) => void;
  onPlanetHover: (repo: any, position: [number, number, number]) => void;
  onPlanetLeave: () => void;
  isFocused: boolean;
}

const StarSystem: React.FC<StarSystemProps> = ({
  position,
  user,
  onPlanetClick,
  onPlanetHover,
  onPlanetLeave,
  isFocused,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  // 실제 저장소 데이터만 사용 (더미 데이터 제거)
  const repositories = user.repositories || [];

  // 공전 궤도 시각적 표시

  // 행성들의 궤도 정보 계산
  const planetOrbits = useMemo(() => {
    return repositories.map((repo, index) => {
      const radius = 6 + index * 3; // 궤도 반지름 더 크게
      const speed = 0.2 / (radius * 0.2); // 궤도 속도 (더 느리게)
      const initialAngle = (index / repositories.length) * Math.PI * 2;
      const inclination = (Math.random() - 0.5) * 0.5; // 궤도 경사 줄임

      return {
        radius,
        speed,
        initialAngle,
        inclination,
        repo,
      };
    });
  }, [repositories]);

  // 애니메이션 프레임
  useFrame(state => {
    if (groupRef.current) {
      // 포커스 상태에 따른 애니메이션
      if (isFocused) {
        groupRef.current.scale.lerp(new THREE.Vector3(1.5, 1.5, 1.5), 0.02);
      } else {
        groupRef.current.scale.lerp(new THREE.Vector3(1, 1, 1), 0.02);
      }
    }
  });

  const handleStarClick = () => {
    // 사용자 프로필 페이지로 이동
    window.open(`/${user.nickname || user.accountAddress}`, '_blank');
  };

  const handleStarHover = (hover: boolean) => {
    setHovered(hover);
  };

  return (
    <group ref={groupRef} position={position}>
      {/* 항성 (사용자) */}
      <Star
        user={user}
        onClick={handleStarClick}
        onHover={handleStarHover}
        isHovered={hovered}
        isFocused={isFocused}
      />

      {/* 사용자 닉네임 표시 */}
      <Text
        position={[0, -2, 0]}
        fontSize={0.5}
        color={isFocused ? '#00d4ff' : '#ffffff'}
        anchorX="center"
        anchorY="middle"
        opacity={isFocused ? 1 : 0.7}
      >
        {user.nickname || `${user.accountAddress.substring(0, 8)}...`}
      </Text>

      {/* 저장소가 있는 경우에만 궤도와 행성 렌더링 */}
      {repositories.length > 0 && (
        <>
          {/* 공전 궤도들 (항성 중심) */}
          {planetOrbits.map((orbit, index) => (
            <mesh
              key={`orbit-${orbit.repo.name}`}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <ringGeometry
                args={[orbit.radius - 0.03, orbit.radius + 0.03, 64]}
              />
              <meshBasicMaterial
                color={isFocused ? '#88ddff' : '#5588aa'}
                transparent
                opacity={isFocused ? 0.7 : 0.4}
                side={THREE.DoubleSide}
              />
            </mesh>
          ))}

          {/* 궤도 글로우 효과 (포커스 상태일 때) */}
          {isFocused &&
            planetOrbits.map((orbit, index) => (
              <mesh
                key={`orbit-glow-${orbit.repo.name}`}
                rotation={[Math.PI / 2, 0, 0]}
              >
                <ringGeometry
                  args={[orbit.radius - 0.08, orbit.radius + 0.08, 64]}
                />
                <meshBasicMaterial
                  color="#88ddff"
                  transparent
                  opacity={0.2}
                  side={THREE.DoubleSide}
                />
              </mesh>
            ))}

          {/* 행성들 (저장소) */}
          {planetOrbits.map((orbit, index) => (
            <Planet
              key={orbit.repo.name}
              repo={orbit.repo}
              user={user}
              orbitRadius={orbit.radius}
              orbitSpeed={orbit.speed}
              initialAngle={orbit.initialAngle}
              inclination={orbit.inclination}
              onPlanetClick={onPlanetClick}
              onPlanetHover={onPlanetHover}
              onPlanetLeave={onPlanetLeave}
              isFocused={isFocused}
            />
          ))}
        </>
      )}

      {/* 사용자 정보 (항성 호버 상태일 때) */}
      {hovered && (
        <Html position={[0, 3, 0]} center>
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.8)',
              color: 'white',
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              whiteSpace: 'nowrap',
              border: '1px solid rgba(255, 255, 255, 0.2)',
            }}
          >
            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
              👤 {user.nickname || 'Anonymous User'}
            </div>
            <div style={{ opacity: 0.8 }}>
              📊 {repositories.length} repositories
            </div>
            <div style={{ opacity: 0.6, fontSize: '10px', marginTop: '2px' }}>
              {user.accountAddress.substring(0, 8)}...
              {user.accountAddress.slice(-4)}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
};

export default StarSystem;
