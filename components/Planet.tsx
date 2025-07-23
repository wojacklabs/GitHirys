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
  onPlanetClick: (repo: any, position: [number, number, number]) => void;
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
  const atmosphereRef = useRef<THREE.Mesh>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);
  const oceansRef = useRef<THREE.Mesh>(null);
  const surfaceDetailRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);

  // Expanded realistic planet type determination (based on repository name)
  const planetType = useMemo(() => {
    const hash = repo.name.split('').reduce((acc, char) => {
      return acc + char.charCodeAt(0);
    }, 0);

    const planetTypes = [
      // Terrestrial Planets
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
        name: 'Venus-like',
        color: '#FFA500',
        atmosphere: '#FFFF99',
        hasOceans: false,
        hasClouds: true,
        surfaceRoughness: 0.7,
        metalness: 0.0,
      }, // Venus-type
      {
        name: 'Desert World',
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
        name: 'Rocky World',
        color: '#696969',
        atmosphere: '#A9A9A9',
        hasOceans: false,
        hasClouds: false,
        surfaceRoughness: 1.0,
        metalness: 0.3,
      }, // Rocky world
      // Ice Worlds
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
        name: 'Frozen Ocean',
        color: '#B0E0E6',
        atmosphere: '#87CEEB',
        hasOceans: true,
        hasClouds: false,
        surfaceRoughness: 0.2,
        metalness: 0.7,
      }, // Frozen ocean world
      {
        name: 'Arctic World',
        color: '#F0F8FF',
        atmosphere: '#E6E6FA',
        hasOceans: false,
        hasClouds: true,
        surfaceRoughness: 0.3,
        metalness: 0.6,
      }, // Arctic world
      // Exotic Worlds
      {
        name: 'Volcanic World',
        color: '#DC143C',
        atmosphere: '#FF6347',
        hasOceans: false,
        hasClouds: true,
        surfaceRoughness: 0.9,
        metalness: 0.2,
      }, // Volcanic world
      {
        name: 'Crystal World',
        color: '#E6E6FA',
        atmosphere: '#F0F8FF',
        hasOceans: false,
        hasClouds: false,
        surfaceRoughness: 0.1,
        metalness: 0.9,
      }, // Crystal world
      {
        name: 'Metal World',
        color: '#708090',
        atmosphere: '#778899',
        hasOceans: false,
        hasClouds: false,
        surfaceRoughness: 0.2,
        metalness: 0.95,
      }, // Metal world
      {
        name: 'Jungle World',
        color: '#228B22',
        atmosphere: '#90EE90',
        hasOceans: true,
        hasClouds: true,
        surfaceRoughness: 0.8,
        metalness: 0.1,
      }, // Jungle world
      {
        name: 'Toxic World',
        color: '#9ACD32',
        atmosphere: '#ADFF2F',
        hasOceans: false,
        hasClouds: true,
        surfaceRoughness: 0.7,
        metalness: 0.3,
      }, // Toxic world
      {
        name: 'Lava World',
        color: '#FF4500',
        atmosphere: '#FF6347',
        hasOceans: false,
        hasClouds: false,
        surfaceRoughness: 0.8,
        metalness: 0.1,
      }, // Lava world
      {
        name: 'Carbon World',
        color: '#2F4F4F',
        atmosphere: '#696969',
        hasOceans: false,
        hasClouds: false,
        surfaceRoughness: 0.9,
        metalness: 0.4,
      }, // Carbon world
      {
        name: 'Plasma World',
        color: '#FF1493',
        atmosphere: '#FF69B4',
        hasOceans: false,
        hasClouds: true,
        surfaceRoughness: 0.1,
        metalness: 0.0,
      }, // Plasma world
      {
        name: 'Cloud City',
        color: '#F5F5DC',
        atmosphere: '#FFFACD',
        hasOceans: false,
        hasClouds: true,
        surfaceRoughness: 0.1,
        metalness: 0.0,
      }, // Cloud city
      {
        name: 'Rogue Planet',
        color: '#191970',
        atmosphere: '#483D8B',
        hasOceans: false,
        hasClouds: false,
        surfaceRoughness: 0.95,
        metalness: 0.2,
      }, // Rogue planet
    ];

    return planetTypes[hash % planetTypes.length];
  }, [repo.name]);

  // Planet size and properties (based on branch count and planet type)
  const planetProperties = useMemo(() => {
    const branchCount = Array.isArray(repo.branches) ? repo.branches.length : 0;
    const baseSize = 0.6;
    const maxSize = 1.6;

    // Size increases with more branches
    const size = Math.max(
      baseSize,
      Math.min(baseSize + branchCount * 0.12, maxSize)
    );

    // Planet type-based colors
    const planetColor = new THREE.Color(planetType.color);
    const atmosphereColor = new THREE.Color(planetType.atmosphere);

    // Surface detail based on planet type
    const hasSurfaceDetail =
      !planetType.hasOceans && planetType.name !== 'Cloud City';

    return {
      size,
      planetColor,
      atmosphereColor,
      planetType,
      hasSurfaceDetail,
      branchCount, // Store branch count for debugging
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

      // Rotation effects (different speeds based on planet type) - faster
      const rotationSpeed = planetType.name.includes('Giant') ? 0.04 : 0.025; // Further increased
      planetRef.current.rotation.y += rotationSpeed;

      // Atmospheric effects (counter-rotation) - faster
      atmosphereRef.current.rotation.y -= 0.008; // Increased from 0.006

      // Cloud effects (if present) - faster
      if (cloudsRef.current && planetProperties.planetType.hasClouds) {
        cloudsRef.current.rotation.y += 0.01; // Increased from 0.008
        cloudsRef.current.rotation.x += 0.003; // Increased from 0.002
      }

      // Ocean effects (if present) - faster
      if (oceansRef.current && planetProperties.planetType.hasOceans) {
        oceansRef.current.rotation.y += 0.005; // Increased from 0.004

        // Ocean wave simulation
        const waveEffect = Math.sin(time * 2.5) * 0.02 + 1;
        oceansRef.current.scale.setScalar(
          planetProperties.size * 1.05 * waveEffect
        );
      }

      // Surface detail animation - faster
      if (surfaceDetailRef.current && planetProperties.hasSurfaceDetail) {
        surfaceDetailRef.current.rotation.y += rotationSpeed * 0.8;
      }

      // Simple hover effect (no atmospheric pulse)
      const hoverScale = isFocused ? 1.3 : 1.0;

      planetRef.current.scale.setScalar(hoverScale);
      atmosphereRef.current.scale.setScalar(hoverScale * 1.5);
    }
  });

  const handlePointerEnter = () => {
    if (groupRef.current) {
      const position = groupRef.current.position;
      // Properly calculate branch count and ensure it's passed correctly
      const actualBranchCount = Array.isArray(repo.branches)
        ? repo.branches.length
        : 0;
      const repoWithBranchInfo = {
        ...repo,
        branches: Array.isArray(repo.branches) ? repo.branches : [],
        actualBranchCount: actualBranchCount, // Explicit branch count
        debugInfo: {
          originalBranches: repo.branches,
          isArray: Array.isArray(repo.branches),
          length: actualBranchCount,
        },
      };
      onPlanetHover(repoWithBranchInfo, [position.x, position.y, position.z]);
    }
  };

  const handlePointerLeave = () => {
    onPlanetLeave();
  };

  const handleClick = () => {
    // Show tooltip instead of direct navigation
    if (groupRef.current) {
      const position = groupRef.current.position;
      const actualBranchCount = Array.isArray(repo.branches)
        ? repo.branches.length
        : 0;
      const repoWithBranchInfo = {
        ...repo,
        branches: Array.isArray(repo.branches) ? repo.branches : [],
        actualBranchCount: actualBranchCount,
        branchCount: actualBranchCount,
        debugInfo: {
          originalBranches: repo.branches,
          isArray: Array.isArray(repo.branches),
          length: actualBranchCount,
        },
      };
      onPlanetClick(repoWithBranchInfo, [position.x, position.y, position.z]);
    }
  };

  return (
    <group ref={groupRef}>
      {/* Enhanced atmospheric layer */}
      <mesh
        ref={atmosphereRef}
        scale={[
          planetProperties.size * 1.6,
          planetProperties.size * 1.6,
          planetProperties.size * 1.6,
        ]}
      >
        <icosahedronGeometry args={[1, 3]} />
        <meshBasicMaterial
          color={planetProperties.atmosphereColor}
          transparent
          opacity={
            planetType.name === 'Venus-like' ||
            planetType.name === 'Toxic World'
              ? 0.5
              : 0.2
          }
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Ocean layer (for ocean worlds) */}
      {planetProperties.planetType.hasOceans && (
        <mesh
          ref={oceansRef}
          scale={[
            planetProperties.size * 1.06,
            planetProperties.size * 1.06,
            planetProperties.size * 1.06,
          ]}
        >
          <icosahedronGeometry args={[1, 4]} />
          <meshStandardMaterial
            color={planetType.name === 'Frozen Ocean' ? '#87CEEB' : '#1E90FF'}
            transparent
            opacity={0.9}
            roughness={0.03}
            metalness={0.85}
            envMapIntensity={1.5}
          />
        </mesh>
      )}

      {/* Enhanced cloud layer */}
      {planetProperties.planetType.hasClouds && (
        <mesh
          ref={cloudsRef}
          scale={[
            planetProperties.size * 1.15,
            planetProperties.size * 1.15,
            planetProperties.size * 1.15,
          ]}
        >
          <icosahedronGeometry args={[1, 3]} />
          <meshBasicMaterial
            color={planetType.name === 'Storm Giant' ? '#8B4513' : '#FFFFFF'}
            transparent
            opacity={planetType.name.includes('Giant') ? 0.7 : 0.3}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}

      {/* Enhanced surface detail layer */}
      {planetProperties.hasSurfaceDetail && (
        <mesh
          ref={surfaceDetailRef}
          scale={[
            planetProperties.size * 1.02,
            planetProperties.size * 1.02,
            planetProperties.size * 1.02,
          ]}
        >
          <icosahedronGeometry args={[1, 4]} />
          <meshStandardMaterial
            color={planetProperties.planetColor.clone().multiplyScalar(0.7)}
            roughness={0.98}
            metalness={0.05}
            transparent
            opacity={0.9}
          />
        </mesh>
      )}

      {/* High-quality planet core */}
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
        <icosahedronGeometry args={[1, 5]} />
        <meshStandardMaterial
          color={planetProperties.planetColor}
          roughness={planetProperties.planetType.surfaceRoughness}
          metalness={planetProperties.planetType.metalness}
          envMapIntensity={0.8}
          emissive={
            planetType.name === 'Lava World' ||
            planetType.name === 'Plasma World'
              ? planetProperties.planetColor.clone().multiplyScalar(0.3)
              : new THREE.Color(0x000000)
          }
          emissiveIntensity={
            planetType.name === 'Lava World' ||
            planetType.name === 'Plasma World'
              ? 0.5
              : 0.0
          }
        />
      </mesh>

      {/* Enhanced planetary lighting */}
      <pointLight
        position={[0, 0, 0]}
        intensity={0.15}
        color={planetProperties.planetColor}
        distance={planetProperties.size * 10}
        decay={1.8}
      />
    </group>
  );
};

export default Planet;
