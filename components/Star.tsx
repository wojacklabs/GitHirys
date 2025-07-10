import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface StarProps {
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
  onClick: () => void;
  onHover: (hover: boolean) => void;
  isHovered: boolean;
  isFocused: boolean;
}

const Star: React.FC<StarProps> = ({
  user,
  onClick,
  onHover,
  isHovered,
  isFocused,
}) => {
  const starRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const coronaRef = useRef<THREE.Mesh>(null);
  const flareRef = useRef<THREE.Mesh>(null);

  // Determine star color and type (using only solar colors)
  const starProperties = useMemo(() => {
    const hash = user.accountAddress.split('').reduce((acc, char) => {
      return acc + char.charCodeAt(0);
    }, 0);

    const starTypes = [
      { color: '#FFD700', name: 'G-type', temp: 5778 }, // Sun-like
      { color: '#FFA500', name: 'K-type', temp: 4500 }, // Orange dwarf
      { color: '#FFFF00', name: 'F-type', temp: 6500 }, // Yellow-white
      { color: '#FF8C00', name: 'K-type', temp: 4000 }, // Orange
      { color: '#FFB347', name: 'G-type', temp: 5200 }, // Yellowish
      { color: '#FFCC33', name: 'G-type', temp: 5900 }, // Golden
      { color: '#FF7F00', name: 'K-type', temp: 4200 }, // Orange
      { color: '#FFAA00', name: 'G-type', temp: 5600 }, // Amber
    ];

    const starType = starTypes[hash % starTypes.length];
    const repositoryCount = user.repositories?.length || 0;

    // Size calculation based on repositories
    const baseSize = 1.5;
    const maxSize = 4.0;
    const size = Math.max(
      baseSize,
      Math.min(baseSize + repositoryCount * 0.4, maxSize)
    );

    // Brightness calculation
    const brightness = Math.min(2.0 + repositoryCount * 0.3, 3.5);
    const baseColor = new THREE.Color(starType.color);
    const brightColor = baseColor.clone().multiplyScalar(brightness);

    return {
      size,
      brightColor,
      baseColor,
      starType,
      brightness,
    };
  }, [user.accountAddress, user.repositories]);

  // Advanced star animation with realistic stellar activity
  useFrame(state => {
    if (
      starRef.current &&
      glowRef.current &&
      coronaRef.current &&
      flareRef.current
    ) {
      const time = state.clock.getElapsedTime();

      // Complex stellar activity simulation
      const corePulse = Math.sin(time * 1.5) * 0.04 + 1;
      const surfaceConvection = Math.sin(time * 3.2) * 0.02 + 1;
      const magneticField = Math.sin(time * 0.8) * 0.08 + 1;
      const coronalMass = Math.sin(time * 4.1) * 0.03 + 1;
      const solarFlare = Math.sin(time * 2.7) * 0.06 + 1;

      // Interaction effects
      const hoverScale = isHovered ? 1.2 : 1;
      const focusScale = isFocused ? 1.3 : 1;
      const interactionScale = hoverScale * focusScale;

      // Apply multi-layered stellar effects
      const coreScale = corePulse * surfaceConvection * interactionScale;
      const glowScale = coreScale * magneticField * 1.4;
      const coronaScale = magneticField * coronalMass * interactionScale * 1.8;
      const flareScale = solarFlare * interactionScale * 2.2;

      starRef.current.scale.setScalar(coreScale);
      glowRef.current.scale.setScalar(glowScale);
      coronaRef.current.scale.setScalar(coronaScale);
      flareRef.current.scale.setScalar(flareScale);

      // Realistic stellar rotation
      starRef.current.rotation.y += 0.008;
      starRef.current.rotation.x += 0.002;
      coronaRef.current.rotation.y -= 0.006;
      coronaRef.current.rotation.z += 0.004;
      flareRef.current.rotation.x += 0.012;
      flareRef.current.rotation.z -= 0.008;

      // Dynamic material properties
      if (starRef.current.material instanceof THREE.MeshStandardMaterial) {
        const emissiveIntensity = 1.2 + Math.sin(time * 2.1) * 0.3;
        starRef.current.material.emissiveIntensity = emissiveIntensity;
      }
    }
  });

  return (
    <group>
      {/* Outer stellar flare (most distant layer) */}
      <mesh
        ref={flareRef}
        scale={[
          starProperties.size * 2.5,
          starProperties.size * 2.5,
          starProperties.size * 2.5,
        ]}
      >
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial
          color={starProperties.baseColor}
          transparent
          opacity={0.08}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Corona layer (magnetic field visualization) */}
      <mesh
        ref={coronaRef}
        scale={[
          starProperties.size * 1.8,
          starProperties.size * 1.8,
          starProperties.size * 1.8,
        ]}
      >
        <sphereGeometry args={[1, 20, 20]} />
        <meshBasicMaterial
          color={starProperties.brightColor}
          transparent
          opacity={0.15}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Photosphere glow */}
      <mesh
        ref={glowRef}
        scale={[
          starProperties.size * 1.3,
          starProperties.size * 1.3,
          starProperties.size * 1.3,
        ]}
      >
        <sphereGeometry args={[1, 24, 24]} />
        <meshBasicMaterial
          color={starProperties.brightColor}
          transparent
          opacity={0.6}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Star core - high detail surface */}
      <mesh
        ref={starRef}
        scale={[starProperties.size, starProperties.size, starProperties.size]}
        onPointerEnter={() => onHover(true)}
        onPointerLeave={() => onHover(false)}
        onClick={onClick}
      >
        <icosahedronGeometry args={[1, 4]} />
        <meshStandardMaterial
          color={starProperties.baseColor}
          emissive={starProperties.brightColor}
          emissiveIntensity={1.5}
          roughness={0.1}
          metalness={0.0}
          transparent
          opacity={0.95}
        />
      </mesh>

      {/* Primary stellar light */}
      <pointLight
        position={[0, 0, 0]}
        intensity={starProperties.brightness * starProperties.size * 3.0}
        color={starProperties.brightColor}
        distance={starProperties.size * 40}
        decay={1.5}
        castShadow
      />

      {/* Secondary ambient light */}
      <pointLight
        position={[0, 0, 0]}
        intensity={starProperties.brightness * starProperties.size * 1.2}
        color={starProperties.baseColor}
        distance={starProperties.size * 60}
        decay={2.0}
      />

      {/* Stellar wind simulation */}
      <pointLight
        position={[0, 0, 0]}
        intensity={starProperties.brightness * 0.5}
        color={starProperties.brightColor}
        distance={starProperties.size * 80}
        decay={2.5}
      />
    </group>
  );
};

export default Star;
