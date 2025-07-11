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
    hasNickName?: boolean;
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

// Realistic space background with enhanced stars
function UniverseBackground() {
  const distantStarsRef = useRef<THREE.Points>(null);

  // Create distant star field with enhanced visibility
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

      // Enhanced star colors with higher brightness
      const starType = Math.random();
      const brightnessBoost = 1.3; // Increase overall brightness

      if (starType < 0.3) {
        // Blue-white stars - brighter
        colors[i * 3] = (0.9 + Math.random() * 0.1) * brightnessBoost;
        colors[i * 3 + 1] = (0.95 + Math.random() * 0.05) * brightnessBoost;
        colors[i * 3 + 2] = 1.0 * brightnessBoost;
      } else if (starType < 0.6) {
        // Yellow-white stars - brighter
        colors[i * 3] = 1.0 * brightnessBoost;
        colors[i * 3 + 1] = (0.95 + Math.random() * 0.05) * brightnessBoost;
        colors[i * 3 + 2] = (0.8 + Math.random() * 0.2) * brightnessBoost;
      } else {
        // Red stars - brighter
        colors[i * 3] = 1.0 * brightnessBoost;
        colors[i * 3 + 1] = (0.6 + Math.random() * 0.3) * brightnessBoost;
        colors[i * 3 + 2] = (0.4 + Math.random() * 0.2) * brightnessBoost;
      }
    }

    return { positions, colors };
  }, []);

  // Star field animation
  useFrame(() => {
    if (distantStarsRef.current) {
      distantStarsRef.current.rotation.y += 0.0001;
    }
  });

  return (
    <>
      {/* Enhanced distant star field */}
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
          size={1.5}
          vertexColors
          transparent
          opacity={1.0}
          sizeAttenuation
        />
      </points>
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
  const [tooltipData, setTooltipData] = useState<{
    type: 'star' | 'planet';
    user: any;
    repo?: any;
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

  const handleShowStarTooltip = (user: any) => {
    setTooltipData({ type: 'star', user });
  };

  const handleShowPlanetTooltip = (user: any, repo: any) => {
    setTooltipData({ type: 'planet', user, repo });
  };

  const handleHideTooltip = () => {
    setTooltipData(null);
  };

  const handleVisitStar = () => {
    if (tooltipData?.user) {
      const user = tooltipData.user;
      const targetUrl =
        user.hasNickName && user.nickname
          ? `/${user.nickname}`
          : `/${user.accountAddress}`;
      window.open(targetUrl, '_blank');
      handleHideTooltip();
    }
  };

  const handleVisitPlanet = () => {
    if (tooltipData?.user && tooltipData?.repo) {
      handlePlanetClick(
        tooltipData.user.nickname || tooltipData.user.accountAddress,
        tooltipData.repo.name
      );
      handleHideTooltip();
    }
  };

  // Empty functions since we now use click-based tooltips
  const handlePlanetHover = () => {};
  const handlePlanetLeave = () => {};

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

        {/* Enhanced lighting for realistic space with better star visibility */}
        <ambientLight intensity={0.25} color="#ffffff" />
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

        {/* Enhanced bright star field */}
        <Stars
          radius={600}
          depth={100}
          count={5000}
          factor={8}
          saturation={1.0}
          fade={false}
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
            onShowStarTooltip={handleShowStarTooltip}
            onShowPlanetTooltip={handleShowPlanetTooltip}
            onHideTooltip={handleHideTooltip}
            isFocused={
              focusedUser === user.accountAddress ||
              focusedUser === user.nickname
            }
          />
        ))}
      </Canvas>

      {/* Fixed bottom tooltip */}
      {tooltipData && (
        <div className={styles.fixedTooltip}>
          {tooltipData.type === 'star' ? (
            <div className={styles.tooltipContent}>
              {/* Profile image */}
              {tooltipData.user.profileImageUrl && (
                <img
                  src={tooltipData.user.profileImageUrl}
                  alt="Profile"
                  className={styles.profileImage}
                />
              )}

              {/* User info */}
              <div className={styles.tooltipInfo}>
                <div className={styles.tooltipTitle}>
                  {tooltipData.user.hasNickName
                    ? tooltipData.user.nickname
                    : `${tooltipData.user.accountAddress.substring(0, 4)}...${tooltipData.user.accountAddress.slice(-4)}`}
                </div>
                <div className={styles.tooltipSubtitle}>
                  {tooltipData.user.repositories?.length || 0} repositories
                </div>
                <div className={styles.tooltipAddress}>
                  {`${tooltipData.user.accountAddress.substring(0, 4)}...${tooltipData.user.accountAddress.slice(-4)}`}
                </div>
              </div>

              {/* Action buttons */}
              <div className={styles.tooltipActions}>
                <button
                  onClick={handleVisitStar}
                  className={styles.visitButton}
                >
                  Visit
                </button>
                <button
                  onClick={handleHideTooltip}
                  className={styles.closeButton}
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.tooltipContent}>
              {/* Planet info */}
              <div className={styles.tooltipInfo}>
                <div className={styles.tooltipTitle}>
                  {tooltipData.repo?.name}
                </div>
                <div className={styles.tooltipSubtitle}>
                  {tooltipData.repo?.branchCount ||
                    tooltipData.repo?.branches?.length ||
                    0}{' '}
                  branches
                </div>
                <div className={styles.tooltipAddress}>
                  Owner:{' '}
                  {tooltipData.user.hasNickName
                    ? tooltipData.user.nickname
                    : `${tooltipData.user.accountAddress.substring(0, 4)}...${tooltipData.user.accountAddress.slice(-4)}`}
                </div>
              </div>

              {/* Action buttons */}
              <div className={styles.tooltipActions}>
                <button
                  onClick={handleVisitPlanet}
                  className={styles.visitButton}
                >
                  Visit
                </button>
                <button
                  onClick={handleHideTooltip}
                  className={styles.closeButton}
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UniverseScene;
