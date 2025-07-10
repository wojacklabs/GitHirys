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
  const surfaceDetailRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);

  // Realistic planet type and color determination (based on repository name)
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
        surfaceRoughness: 0.8,
        metalness: 0.1,
      }, // Earth-type
      {
        name: 'Mars-like',
        color: '#CD5C5C',
        atmosphere: '#F4A460',
        hasOceans: false,
        hasClouds: false,
        surfaceRoughness: 0.9,
        metalness: 0.2,
      }, // Mars-type
      {
        name: 'Gas Giant',
        color: '#DAA520',
        atmosphere: '#FFA500',
        hasOceans: false,
        hasClouds: true,
        surfaceRoughness: 0.1,
        metalness: 0.0,
      }, // Gas giant (Jupiter-like)
      {
        name: 'Ice Planet',
        color: '#E0FFFF',
        atmosphere: '#B0E0E6',
        hasOceans: false,
        hasClouds: false,
        surfaceRoughness: 0.1,
        metalness: 0.8,
      }, // Ice world
      {
        name: 'Venus-like',
        color: '#FFA500',
        atmosphere: '#FFFF99',
        hasOceans: false,
        hasClouds: true,
        surfaceRoughness: 0.7,
        metalness: 0.0,
      }, // Venus-type
      {
        name: 'Desert',
        color: '#DEB887',
        atmosphere: '#F5DEB3',
        hasOceans: false,
        hasClouds: false,
        surfaceRoughness: 0.95,
        metalness: 0.1,
      }, // Desert world
      {
        name: 'Ocean World',
        color: '#0066CC',
        atmosphere: '#4169E1',
        hasOceans: true,
        hasClouds: true,
        surfaceRoughness: 0.2,
        metalness: 0.6,
      }, // Ocean world
      {
        name: 'Rocky',
        color: '#696969',
        atmosphere: '#A9A9A9',
        hasOceans: false,
        hasClouds: false,
        surfaceRoughness: 1.0,
        metalness: 0.3,
      }, // Rocky world
    ];

    return planetTypes[hash % planetTypes.length];
  }, [repo.name]);

  // Planet size and properties (based on branch count and planet type)
  const planetProperties = useMemo(() => {
    const branchCount = repo.branches?.length || 0;
    let baseSize = 0.5;
    let maxSize = 1.4;

    // Gas giants are larger
    if (planetType.name === 'Gas Giant') {
      baseSize = 0.8;
      maxSize = 2.2;
    }

    // Size increases with more branches
    const size = Math.max(
      baseSize,
      Math.min(baseSize + branchCount * 0.1, maxSize)
    );

    // Planet type-based colors
    const planetColor = new THREE.Color(planetType.color);
    const atmosphereColor = new THREE.Color(planetType.atmosphere);

    // Ring system (gas giants get rings more easily)
    const hasRings =
      planetType.name === 'Gas Giant' ? branchCount >= 2 : branchCount >= 4;

    // Surface detail based on planet type
    const hasSurfaceDetail =
      !planetType.hasOceans && planetType.name !== 'Gas Giant';

    return {
      size,
      planetColor,
      atmosphereColor,
      hasRings,
      planetType,
      hasSurfaceDetail,
    };
  }, [repo.branches, planetType]);

  // Advanced animation (orbit, rotation, atmosphere, clouds, ocean effects)
  useFrame(state => {
    if (groupRef.current && planetRef.current && atmosphereRef.current) {
      const time = state.clock.getElapsedTime();

      // Orbital animation
      const angle = initialAngle + time * orbitSpeed;
      const x = Math.cos(angle) * orbitRadius;
      const z = Math.sin(angle) * orbitRadius;
      const y = Math.sin(angle * 2) * inclination;

      groupRef.current.position.set(x, y, z);

      // Rotation effects (different speeds based on planet type)
      const rotationSpeed =
        planetProperties.planetType.name === 'Gas Giant' ? 0.025 : 0.012;
      planetRef.current.rotation.y += rotationSpeed;

      // Atmospheric effects (counter-rotation)
      atmosphereRef.current.rotation.y -= 0.006;

      // Cloud effects (if present)
      if (cloudsRef.current && planetProperties.planetType.hasClouds) {
        cloudsRef.current.rotation.y += 0.01;
        cloudsRef.current.rotation.x += 0.003;
      }

      // Ocean effects (if present)
      if (oceansRef.current && planetProperties.planetType.hasOceans) {
        oceansRef.current.rotation.y += 0.004;

        // Ocean wave simulation
        const waveEffect = Math.sin(time * 2.5) * 0.02 + 1;
        oceansRef.current.scale.setScalar(
          planetProperties.size * 1.05 * waveEffect
        );
      }

      // Surface detail animation
      if (surfaceDetailRef.current && planetProperties.hasSurfaceDetail) {
        surfaceDetailRef.current.rotation.y += rotationSpeed * 0.8;
      }

      // Enhanced hover effects
      const hoverScale = isFocused ? 1.25 : 1;
      const atmosphericPulse = Math.sin(time * 2.8) * 0.04 + 1;

      planetRef.current.scale.setScalar(hoverScale * atmosphericPulse);
      atmosphereRef.current.scale.setScalar(
        hoverScale * atmosphericPulse * 1.4
      );

      // Ring rotation (if present)
      if (ringsRef.current) {
        ringsRef.current.rotation.z += 0.015;
        ringsRef.current.rotation.y += 0.003;

        // Ring particle effect
        const ringPulse = Math.sin(time * 1.8) * 0.05 + 1;
        ringsRef.current.scale.setScalar(
          planetProperties.size * 2.2 * ringPulse
        );
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
      {/* Atmospheric layer (varies by planet type) */}
      <mesh
        ref={atmosphereRef}
        scale={[
          planetProperties.size * 1.5,
          planetProperties.size * 1.5,
          planetProperties.size * 1.5,
        ]}
      >
        <icosahedronGeometry args={[1, 2]} />
        <meshBasicMaterial
          color={planetProperties.atmosphereColor}
          transparent
          opacity={
            planetProperties.planetType.name === 'Venus-like' ? 0.4 : 0.15
          }
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Ocean layer (for ocean worlds) */}
      {planetProperties.planetType.hasOceans && (
        <mesh
          ref={oceansRef}
          scale={[
            planetProperties.size * 1.05,
            planetProperties.size * 1.05,
            planetProperties.size * 1.05,
          ]}
        >
          <icosahedronGeometry args={[1, 3]} />
          <meshStandardMaterial
            color="#1E90FF"
            transparent
            opacity={0.85}
            roughness={0.05}
            metalness={0.8}
            envMapIntensity={1.2}
            clearcoat={1.0}
            clearcoatRoughness={0.1}
          />
        </mesh>
      )}

      {/* Cloud layer (for planets with clouds) */}
      {planetProperties.planetType.hasClouds && (
        <mesh
          ref={cloudsRef}
          scale={[
            planetProperties.size * 1.12,
            planetProperties.size * 1.12,
            planetProperties.size * 1.12,
          ]}
        >
          <icosahedronGeometry args={[1, 2]} />
          <meshBasicMaterial
            color="#FFFFFF"
            transparent
            opacity={
              planetProperties.planetType.name === 'Gas Giant' ? 0.6 : 0.25
            }
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}

      {/* Surface detail layer (for rocky planets) */}
      {planetProperties.hasSurfaceDetail && (
        <mesh
          ref={surfaceDetailRef}
          scale={[
            planetProperties.size * 1.01,
            planetProperties.size * 1.01,
            planetProperties.size * 1.01,
          ]}
        >
          <icosahedronGeometry args={[1, 3]} />
          <meshStandardMaterial
            color={planetProperties.planetColor.clone().multiplyScalar(0.8)}
            roughness={0.95}
            metalness={0.1}
            transparent
            opacity={0.8}
          />
        </mesh>
      )}

      {/* Planet core - high detail surface */}
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
        <icosahedronGeometry args={[1, 4]} />
        <meshStandardMaterial
          color={planetProperties.planetColor}
          roughness={planetProperties.planetType.surfaceRoughness}
          metalness={planetProperties.planetType.metalness}
          envMapIntensity={0.6}
          clearcoat={
            planetProperties.planetType.name === 'Ice Planet' ? 0.9 : 0.0
          }
          clearcoatRoughness={0.1}
        />
      </mesh>

      {/* Ring system (conditional) */}
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
          <ringGeometry args={[1.4, 2.2, 128]} />
          <meshStandardMaterial
            color={
              planetProperties.planetType.name === 'Gas Giant'
                ? '#DAA520'
                : '#C0C0C0'
            }
            transparent
            opacity={0.7}
            roughness={0.6}
            metalness={0.4}
            side={THREE.DoubleSide}
            envMapIntensity={0.8}
          />
        </mesh>
      )}

      {/* Planetary lighting (subtle) */}
      {planetProperties.planetType.name !== 'Gas Giant' && (
        <pointLight
          position={[0, 0, 0]}
          intensity={0.1}
          color={planetProperties.planetColor}
          distance={planetProperties.size * 8}
          decay={2.0}
        />
      )}
    </group>
  );
};

export default Planet;
