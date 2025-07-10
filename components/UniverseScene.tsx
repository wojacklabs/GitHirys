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

// Realistic space background with stars and nebulae
function UniverseBackground() {
  const nebulaRef = useRef<THREE.Mesh>(null);
  const distantStarsRef = useRef<THREE.Points>(null);

  // Create distant star field
  const distantStars = useMemo(() => {
    const positions = new Float32Array(8000 * 3);
    const colors = new Float32Array(8000 * 3);

    for (let i = 0; i < 8000; i++) {
      // Distribute stars in a large sphere
      const radius = 800 + Math.random() * 400;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);

      // Star colors (realistic star colors)
      const starType = Math.random();
      if (starType < 0.3) {
        // Blue-white stars
        colors[i * 3] = 0.8 + Math.random() * 0.2;
        colors[i * 3 + 1] = 0.9 + Math.random() * 0.1;
        colors[i * 3 + 2] = 1.0;
      } else if (starType < 0.6) {
        // Yellow-white stars
        colors[i * 3] = 1.0;
        colors[i * 3 + 1] = 0.9 + Math.random() * 0.1;
        colors[i * 3 + 2] = 0.7 + Math.random() * 0.2;
      } else {
        // Red stars
        colors[i * 3] = 1.0;
        colors[i * 3 + 1] = 0.5 + Math.random() * 0.3;
        colors[i * 3 + 2] = 0.3 + Math.random() * 0.2;
      }
    }

    return { positions, colors };
  }, []);

  // Nebula animation
  useFrame(state => {
    if (nebulaRef.current) {
      const time = state.clock.getElapsedTime();
      nebulaRef.current.rotation.y += 0.0005;
      nebulaRef.current.rotation.x += 0.0002;

      // Subtle nebula breathing effect
      const scale = 1 + Math.sin(time * 0.1) * 0.02;
      nebulaRef.current.scale.setScalar(scale);
    }

    if (distantStarsRef.current) {
      distantStarsRef.current.rotation.y += 0.0001;
    }
  });

  return (
    <>
      {/* Distant star field */}
      <points ref={distantStarsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            array={distantStars.positions}
            count={distantStars.positions.length / 3}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            array={distantStars.colors}
            count={distantStars.colors.length / 3}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.8}
          vertexColors
          transparent
          opacity={0.8}
          sizeAttenuation
        />
      </points>

      {/* Nebula background */}
      <mesh ref={nebulaRef} position={[0, 0, -300]}>
        <sphereGeometry args={[200, 32, 32]} />
        <meshBasicMaterial
          color="#1a0033"
          transparent
          opacity={0.15}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Additional nebula layers */}
      <mesh position={[150, 100, -250]} rotation={[0.5, 0.3, 0]}>
        <sphereGeometry args={[80, 16, 16]} />
        <meshBasicMaterial
          color="#330066"
          transparent
          opacity={0.08}
          side={THREE.BackSide}
        />
      </mesh>

      <mesh position={[-120, -80, -280]} rotation={[0.8, -0.4, 0.2]}>
        <sphereGeometry args={[60, 16, 16]} />
        <meshBasicMaterial
          color="#003366"
          transparent
          opacity={0.06}
          side={THREE.BackSide}
        />
      </mesh>
    </>
  );
}

// Camera controller
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
      // Find focused user position and move camera
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
      maxDistance={800}
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

  // Handle empty user array
  const validUsers = users || [];

  // Calculate user positions in wide 3D space
  const starSystemPositions = useMemo(() => {
    if (validUsers.length === 0) return [];

    return validUsers.map((user, index) => {
      // Wider circular arrangement
      const angle = (index / validUsers.length) * Math.PI * 2;
      const radius = 80 + Math.random() * 40; // 80-120 range random distance
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = (Math.random() - 0.5) * 40; // Larger height variation

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
          background:
            'linear-gradient(135deg, #0c0c0c 0%, #1a1a2e 25%, #16213e 50%, #0f0f23 75%, #000000 100%)',
        }}
        gl={{ antialias: true, alpha: false }}
        dpr={[1, 2]}
      >
        <UniverseBackground />

        {/* Enhanced lighting for realistic space */}
        <ambientLight intensity={0.15} color="#ffffff" />
        <directionalLight
          position={[200, 200, 200]}
          intensity={0.3}
          color="#ffffff"
          castShadow
        />

        {/* Multiple directional lights for depth */}
        <directionalLight
          position={[-100, 100, -100]}
          intensity={0.2}
          color="#4169e1"
        />
        <directionalLight
          position={[100, -100, 100]}
          intensity={0.15}
          color="#ff6b6b"
        />

        {/* Bright star field */}
        <Stars
          radius={600}
          depth={100}
          count={3000}
          factor={4}
          saturation={0.8}
          fade={true}
        />

        {/* WASD keyboard controls */}
        <KeyboardControls speed={50} />

        {/* Camera controls */}
        <CameraController focusedUser={focusedUser} users={validUsers} />

        {/* Render star systems */}
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

        {/* Tooltip */}
        {hoveredPlanet && (
          <Html position={hoveredPlanet.position}>
            <div className={styles.tooltip}>
              <h3>{hoveredPlanet.repo.name}</h3>
              <p>Owner: {hoveredPlanet.repo.owner}</p>
              <p>
                Branches:{' '}
                {Array.isArray(hoveredPlanet.repo.branches)
                  ? hoveredPlanet.repo.branches.length
                  : 0}
              </p>
              <p>Default: {hoveredPlanet.repo.defaultBranch || 'N/A'}</p>
            </div>
          </Html>
        )}
      </Canvas>
    </div>
  );
};

export default UniverseScene;
