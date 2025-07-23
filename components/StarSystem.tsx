import React, { useRef, useMemo, useState, useEffect } from 'react';
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
    hasNickName?: boolean;
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
  onShowStarTooltip: (user: any) => void;
  onShowPlanetTooltip: (user: any, repo: any) => void;
  onHideTooltip: () => void;
  isFocused: boolean;
  currentWallet?: string;
  starLoaded?: boolean;
  planetsStartLoading?: boolean;
}

const StarSystem: React.FC<StarSystemProps> = ({
  position,
  user,
  onPlanetClick,
  onPlanetHover,
  onPlanetLeave,
  onShowStarTooltip,
  onShowPlanetTooltip,
  onHideTooltip,
  isFocused,
  currentWallet,
  starLoaded = true,
  planetsStartLoading = false,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const [loadedPlanets, setLoadedPlanets] = useState<Set<string>>(new Set());

  // Use only actual repository data (remove dummy data)
  const repositories = user.repositories || [];

  // Check if this is the current user's star
  const isCurrentUser = Boolean(
    currentWallet && user.accountAddress === currentWallet
  );

  // Load planets sequentially after stars are loaded
  useEffect(() => {
    if (planetsStartLoading && repositories.length > 0) {
      setLoadedPlanets(new Set()); // Reset loaded planets

      repositories.forEach((repo, index) => {
        setTimeout(() => {
          setLoadedPlanets(prev => new Set([...prev, repo.name]));
        }, index * 150); // 150ms delay between each planet
      });
    } else if (!planetsStartLoading) {
      setLoadedPlanets(new Set()); // Clear loaded planets when not loading
    }
  }, [planetsStartLoading, repositories]);

  // Calculate planet orbit information
  const planetOrbits = useMemo(() => {
    return repositories.map((repo, index) => {
      const radius = 6 + index * 3; // Larger orbit radius
      const speed = 0.1 / (radius * 0.2); // Orbit speed - faster (increased from 0.05)
      const initialAngle = (index / repositories.length) * Math.PI * 2;
      const inclination = (Math.random() - 0.5) * 0.5; // Reduced orbit inclination

      return {
        radius,
        speed,
        initialAngle,
        inclination,
        repo,
      };
    });
  }, [repositories]);

  // Animation frame
  useFrame(state => {
    if (groupRef.current) {
      // Animation based on focus state
      if (isFocused) {
        groupRef.current.scale.lerp(new THREE.Vector3(1.5, 1.5, 1.5), 0.02);
      } else {
        groupRef.current.scale.lerp(new THREE.Vector3(1, 1, 1), 0.02);
      }
    }
  });

  const handleStarClick = () => {
    onShowStarTooltip(user);
  };

  const handleStarHover = (hover: boolean) => {
    // Remove hover tooltip functionality - tooltips only appear on click
  };

  const handlePlanetClick = (
    repo: any,
    planetPos: [number, number, number]
  ) => {
    onShowPlanetTooltip(user, repo);
  };

  const handlePlanetHover = (
    repo: any,
    planetPos: [number, number, number]
  ) => {
    // Remove hover tooltip functionality - tooltips only appear on click
  };

  const handlePlanetLeave = () => {
    // Remove hover tooltip functionality - tooltips only appear on click
  };

  const handleVisitStar = () => {
    const targetUrl =
      user.hasNickName && user.nickname
        ? `/${user.nickname}`
        : `/${user.accountAddress}`;
    window.open(targetUrl, '_blank');
  };

  const handleVisitPlanet = (repo: any) => {
    onPlanetClick(user.nickname || user.accountAddress, repo.name);
  };

  // Display name logic using hasNickName to distinguish real nicknames from wallet addresses
  const getDisplayName = () => {
    if (user.hasNickName && user.nickname && user.nickname.trim() !== '') {
      return user.nickname;
    }
    // Always return abbreviated address if no real nickname
    return `${user.accountAddress.substring(0, 4)}...${user.accountAddress.slice(-4)}`;
  };

  return (
    <group ref={groupRef} position={position}>
      {/* Star (user) */}
      <Star
        user={user}
        onClick={handleStarClick}
        onHover={handleStarHover}
        isHovered={false} // Always false for click-only tooltips
        isFocused={isFocused}
        isCurrentUser={isCurrentUser}
        isVisible={starLoaded}
      />

      {/* User nickname display */}
      <Text
        position={[0, -2, 0]}
        fontSize={0.5}
        color={isFocused ? '#00d4ff' : '#b3b3b3'}
        anchorX="center"
        anchorY="middle"
      >
        {getDisplayName()}
      </Text>

      {/* Render orbits and planets only if repositories exist and planets should start loading */}
      {repositories.length > 0 && planetsStartLoading && (
        <>
          {/* Enhanced orbital rings (around star) */}
          {planetOrbits.map((orbit, index) => (
            <mesh
              key={`orbit-${orbit.repo.name}`}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <ringGeometry
                args={[orbit.radius - 0.05, orbit.radius + 0.05, 128]}
              />
              <meshBasicMaterial
                color={isFocused ? '#00d4ff' : '#88ccff'}
                transparent
                opacity={isFocused ? 0.9 : 0.6}
                side={THREE.DoubleSide}
              />
            </mesh>
          ))}

          {/* Enhanced orbit glow effect (when focused) */}
          {isFocused &&
            planetOrbits.map((orbit, index) => (
              <mesh
                key={`orbit-glow-${orbit.repo.name}`}
                rotation={[Math.PI / 2, 0, 0]}
              >
                <ringGeometry
                  args={[orbit.radius - 0.15, orbit.radius + 0.15, 128]}
                />
                <meshBasicMaterial
                  color="#00d4ff"
                  transparent
                  opacity={0.3}
                  side={THREE.DoubleSide}
                />
              </mesh>
            ))}

          {/* Additional orbit visibility enhancement */}
          {planetOrbits.map((orbit, index) => (
            <mesh
              key={`orbit-bright-${orbit.repo.name}`}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <ringGeometry
                args={[orbit.radius - 0.02, orbit.radius + 0.02, 64]}
              />
              <meshBasicMaterial
                color="#ffffff"
                transparent
                opacity={isFocused ? 0.5 : 0.3}
                side={THREE.DoubleSide}
              />
            </mesh>
          ))}

          {/* Planets (repositories) */}
          {planetOrbits.map((orbit, index) => (
            <Planet
              key={orbit.repo.name}
              repo={orbit.repo}
              user={user}
              orbitRadius={orbit.radius}
              orbitSpeed={orbit.speed}
              initialAngle={orbit.initialAngle}
              inclination={orbit.inclination}
              onPlanetClick={handlePlanetClick}
              onPlanetHover={handlePlanetHover}
              onPlanetLeave={handlePlanetLeave}
              isFocused={isFocused}
              isVisible={loadedPlanets.has(orbit.repo.name)}
            />
          ))}
        </>
      )}

      {/* User information (when star is clicked) */}
      {/* Removed local tooltip state and Html tooltips */}

      {/* Planet tooltip (when planet is clicked) */}
      {/* Removed local tooltip state and Html tooltips */}
    </group>
  );
};

export default StarSystem;
