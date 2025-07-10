import React, { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame, extend } from '@react-three/fiber';
import { OrbitControls, Stars, Text, Html } from '@react-three/drei';
import { useRouter } from 'next/router';
import * as THREE from 'three';
import StarSystem from './StarSystem';
import KeyboardControls from './KeyboardControls';
import styles from './UniverseScene.module.css';

extend({ OrbitControls });

interface UniverseSceneProps {
  users: Array<{
    accountAddress: string;
    nickname?: string;
    profileImageUrl?: string;
    repositories?: Array<{
      name: string;
      owner: string;
      branches: string[];
      defaultBranch: string;
    }>;
  }>;
  focusedUser?: string;
  onPlanetClick?: (user: string, repo: string) => void;
}

// 우주 배경 컴포넌트 (fog 효과 제거로 거리 제한 없음)
function UniverseBackground() {
  return <></>;
}

// 카메라 컨트롤러
function CameraController({
  focusedUser,
  users,
}: {
  focusedUser?: string;
  users: any[];
}) {
  const controlsRef = useRef<any>();

  useEffect(() => {
    if (focusedUser && controlsRef.current && users.length > 0) {
      // 포커스된 사용자의 위치를 찾아서 카메라 이동
      const userIndex = users.findIndex(
        u => u.accountAddress === focusedUser || u.nickname === focusedUser
      );

      if (userIndex !== -1) {
        const angle = (userIndex / users.length) * Math.PI * 2;
        const radius = 80 + Math.random() * 40;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;

        controlsRef.current.target.set(x, 0, z);
        controlsRef.current.update();
      }
    }
  }, [focusedUser, users]);

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={true}
      enableZoom={true}
      enableRotate={true}
      minDistance={20}
      maxDistance={500}
      autoRotate={!focusedUser}
      autoRotateSpeed={0.1}
    />
  );
}

const UniverseScene: React.FC<UniverseSceneProps> = ({
  users,
  focusedUser,
  onPlanetClick,
}) => {
  const router = useRouter();
  const [hoveredPlanet, setHoveredPlanet] = useState<{
    repo: any;
    position: [number, number, number];
  } | null>(null);

  // 빈 사용자 배열 처리
  const validUsers = users || [];

  // 사용자 배치 계산

  // 사용자들을 넓은 3D 공간에 배치하는 위치 계산
  const starSystemPositions = useMemo(() => {
    if (validUsers.length === 0) return [];

    return validUsers.map((user, index) => {
      // 더 넓은 원형 배치
      const angle = (index / validUsers.length) * Math.PI * 2;
      const radius = 80 + Math.random() * 40; // 80-120 범위의 랜덤 거리
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = (Math.random() - 0.5) * 40; // 더 큰 높이 변화

      return [x, y, z] as [number, number, number];
    });
  }, [validUsers]);

  const handlePlanetClick = (user: string, repo: string) => {
    if (onPlanetClick) {
      onPlanetClick(user, repo);
    } else {
      router.push(`/${user}/${repo}`);
    }
  };

  const handlePlanetHover = (repo: any, position: [number, number, number]) => {
    setHoveredPlanet({ repo, position });
  };

  const handlePlanetLeave = () => {
    setHoveredPlanet(null);
  };

  return (
    <div className={styles.universeContainer}>
      <Canvas
        camera={{ position: [0, 50, 200], fov: 75 }}
        style={{
          background: 'radial-gradient(circle, #000428 0%, #000000 100%)',
        }}
        gl={{ antialias: true, alpha: false }}
        dpr={[1, 2]}
      >
        <UniverseBackground />

        {/* 조명 개선 - 3D 효과 강화 */}
        <ambientLight intensity={0.3} color="#ffffff" />
        <directionalLight
          position={[50, 50, 50]}
          intensity={0.8}
          color="#ffffff"
          castShadow
        />
        <pointLight
          position={[100, 100, 100]}
          intensity={0.6}
          color="#ffffff"
        />
        <pointLight
          position={[-100, -100, -100]}
          intensity={0.4}
          color="#aaccff"
        />
        <pointLight position={[0, 100, 0]} intensity={0.3} color="#ffeeaa" />

        {/* WASD 키보드 컨트롤 */}
        <KeyboardControls speed={50} />

        {/* 카메라 컨트롤 */}
        <CameraController focusedUser={focusedUser} users={validUsers} />

        {/* 행성계들 렌더링 */}
        {validUsers.map((user, index) => (
          <StarSystem
            key={user.accountAddress}
            position={starSystemPositions[index]}
            user={user}
            onPlanetClick={handlePlanetClick}
            onPlanetHover={handlePlanetHover}
            onPlanetLeave={handlePlanetLeave}
            isFocused={
              focusedUser === user.accountAddress ||
              focusedUser === user.nickname
            }
          />
        ))}

        {/* 툴팁 */}
        {hoveredPlanet && (
          <Html position={hoveredPlanet.position}>
            <div className={styles.tooltip}>
              <h3>{hoveredPlanet.repo.name}</h3>
              <p>Owner: {hoveredPlanet.repo.owner}</p>
              <p>Branches: {hoveredPlanet.repo.branches?.length || 0}</p>
              <p>Default: {hoveredPlanet.repo.defaultBranch || 'N/A'}</p>
            </div>
          </Html>
        )}
      </Canvas>
    </div>
  );
};

export default UniverseScene;
