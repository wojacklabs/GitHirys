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
  const [showStarTooltip, setShowStarTooltip] = useState(false);
  const [showPlanetTooltip, setShowPlanetTooltip] = useState(false);
  const [currentPlanet, setCurrentPlanet] = useState<any>(null);
  const [planetPosition, setPlanetPosition] = useState<
    [number, number, number]
  >([0, 0, 0]);

  // Use only actual repository data (remove dummy data)
  const repositories = user.repositories || [];

  // Calculate planet orbit information
  const planetOrbits = useMemo(() => {
    return repositories.map((repo, index) => {
      const radius = 6 + index * 3; // Larger orbit radius
      const speed = 0.2 / (radius * 0.2); // Orbit speed (slower)
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
    setShowStarTooltip(true);
    setShowPlanetTooltip(false);
  };

  const handleStarHover = (hover: boolean) => {
    // Remove hover tooltip functionality - tooltips only appear on click
  };

  const handlePlanetClick = (
    repo: any,
    planetPos: [number, number, number]
  ) => {
    setCurrentPlanet(repo);
    setPlanetPosition(planetPos);
    setShowPlanetTooltip(true);
    setShowStarTooltip(false);
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
    setShowStarTooltip(false);
  };

  const handleVisitPlanet = () => {
    if (currentPlanet) {
      onPlanetClick(user.nickname || user.accountAddress, currentPlanet.name);
      setShowPlanetTooltip(false);
      setCurrentPlanet(null);
    }
  };

  const handleCloseTooltips = () => {
    setShowStarTooltip(false);
    setShowPlanetTooltip(false);
    setCurrentPlanet(null);
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

      {/* Render orbits and planets only if repositories exist */}
      {repositories.length > 0 && (
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
            />
          ))}
        </>
      )}

      {/* User information (when star is clicked) */}
      {showStarTooltip && (
        <Html position={[0, 3, 0]} center>
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.9)',
              color: 'white',
              padding: '12px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              whiteSpace: 'nowrap',
              border: '1px solid rgba(0, 212, 255, 0.3)',
              backdropFilter: 'blur(10px)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              maxWidth: '300px',
            }}
          >
            {/* Profile image */}
            {user.profileImageUrl && (
              <img
                src={user.profileImageUrl}
                alt="Profile"
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '2px solid #00d4ff',
                  flexShrink: 0,
                }}
              />
            )}

            {/* User info */}
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontWeight: 'bold',
                  marginBottom: '4px',
                  color: '#white',
                }}
              >
                {user.hasNickName
                  ? user.nickname
                  : `${user.accountAddress.substring(0, 4)}...${user.accountAddress.slice(-4)}`}
              </div>
              <div style={{ opacity: 0.8, marginBottom: '2px' }}>
                {repositories.length} repositories
              </div>
              <div
                style={{
                  opacity: 0.6,
                  fontSize: '11px',
                  fontFamily: 'monospace',
                }}
              >
                {`${user.accountAddress.substring(0, 4)}...${user.accountAddress.slice(-4)}`}
              </div>
            </div>

            {/* Action buttons */}
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
            >
              <button
                onClick={handleVisitStar}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#00d4ff',
                  color: 'black',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 'bold',
                }}
              >
                Visit
              </button>
              <button
                onClick={handleCloseTooltips}
                style={{
                  padding: '4px 8px',
                  backgroundColor: 'transparent',
                  color: 'rgba(255, 255, 255, 0.7)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '10px',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </Html>
      )}

      {/* Planet tooltip (when planet is clicked) */}
      {showPlanetTooltip && currentPlanet && (
        <Html position={planetPosition} center>
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.9)',
              color: 'white',
              padding: '12px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              whiteSpace: 'nowrap',
              border: '1px solid rgba(0, 212, 255, 0.3)',
              backdropFilter: 'blur(10px)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              maxWidth: '300px',
            }}
          >
            {/* Planet info */}
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontWeight: 'bold',
                  marginBottom: '4px',
                  color: '#00d4ff',
                }}
              >
                {currentPlanet.name}
              </div>
              <div style={{ opacity: 0.8, marginBottom: '2px' }}>
                {currentPlanet.branchCount ||
                  currentPlanet.branches?.length ||
                  0}{' '}
                branches
              </div>
              <div
                style={{
                  opacity: 0.6,
                  fontSize: '11px',
                }}
              >
                Owner:{' '}
                {user.hasNickName
                  ? user.nickname
                  : `${user.accountAddress.substring(0, 4)}...${user.accountAddress.slice(-4)}`}
              </div>
            </div>

            {/* Action buttons */}
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
            >
              <button
                onClick={handleVisitPlanet}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#00d4ff',
                  color: 'black',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 'bold',
                }}
              >
                Visit
              </button>
              <button
                onClick={handleCloseTooltips}
                style={{
                  padding: '4px 8px',
                  backgroundColor: 'transparent',
                  color: 'rgba(255, 255, 255, 0.7)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '10px',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </Html>
      )}
    </group>
  );
};

export default StarSystem;
