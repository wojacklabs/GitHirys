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
    // Navigate to user profile page
    window.open(`/${user.nickname || user.accountAddress}`, '_blank');
  };

  const handleStarHover = (hover: boolean) => {
    setHovered(hover);
  };

  // Create abbreviated display name while keeping full address for links
  const displayName =
    user.nickname ||
    `${user.accountAddress.substring(0, 6)}...${user.accountAddress.slice(-4)}`;

  return (
    <group ref={groupRef} position={position}>
      {/* Star (user) */}
      <Star
        user={user}
        onClick={handleStarClick}
        onHover={handleStarHover}
        isHovered={hovered}
        isFocused={isFocused}
      />

      {/* User nickname display */}
      <Text
        position={[0, -2, 0]}
        fontSize={0.5}
        color={isFocused ? '#00d4ff' : '#ffffff'}
        anchorX="center"
        anchorY="middle"
        opacity={isFocused ? 1 : 0.7}
      >
        {displayName}
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
              onPlanetClick={onPlanetClick}
              onPlanetHover={onPlanetHover}
              onPlanetLeave={onPlanetLeave}
              isFocused={isFocused}
            />
          ))}
        </>
      )}

      {/* User information (when star is hovered) */}
      {hovered && (
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
            <div>
              <div
                style={{
                  fontWeight: 'bold',
                  marginBottom: '4px',
                  color: '#00d4ff',
                }}
              >
                👤 {user.nickname || 'Anonymous User'}
              </div>
              <div style={{ opacity: 0.8, marginBottom: '2px' }}>
                📊 {repositories.length} repositories
              </div>
              <div
                style={{
                  opacity: 0.6,
                  fontSize: '11px',
                  fontFamily: 'monospace',
                }}
              >
                {user.accountAddress.substring(0, 8)}...
                {user.accountAddress.slice(-4)}
              </div>
            </div>
          </div>
        </Html>
      )}
    </group>
  );
};

export default StarSystem;
