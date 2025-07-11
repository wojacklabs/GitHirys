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
  isCurrentUser?: boolean;
}

const Star: React.FC<StarProps> = ({
  user,
  onClick,
  onHover,
  isHovered,
  isFocused,
  isCurrentUser,
}) => {
  const starRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const coronaRef = useRef<THREE.Mesh>(null);
  const flareRef = useRef<THREE.Mesh>(null);
  const currentUserIndicatorRef = useRef<THREE.Mesh>(null);

  // Create star shape geometry for current user indicator
  const createStarShape = useMemo(() => {
    const starShape = new THREE.Shape();
    const outerRadius = 0.5;
    const innerRadius = 0.2;
    const points = 5;

    for (let i = 0; i < points * 2; i++) {
      const angle = (i / (points * 2)) * Math.PI * 2;
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;

      if (i === 0) {
        starShape.moveTo(x, y);
      } else {
        starShape.lineTo(x, y);
      }
    }

    const geometry = new THREE.ShapeGeometry(starShape);
    return geometry;
  }, []);

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

    // Increased size calculation based on repositories
    const baseSize = 3.0;
    const maxSize = 8.0;
    const size = Math.max(
      baseSize,
      Math.min(baseSize + repositoryCount * 0.8, maxSize)
    );

    // Enhanced brightness calculation
    const brightness = Math.min(3.5 + repositoryCount * 0.4, 6.0);
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
        const emissiveIntensity = 2.5 + Math.sin(time * 2.1) * 0.5;
        starRef.current.material.emissiveIntensity = emissiveIntensity;
      }

      // Animate current user indicator
      if (currentUserIndicatorRef.current && isCurrentUser) {
        const indicatorPulse = Math.sin(time * 2.5) * 0.1 + 1;
        const indicatorScale = 1.5 + indicatorPulse * 0.3;
        currentUserIndicatorRef.current.scale.setScalar(indicatorScale);
        currentUserIndicatorRef.current.rotation.z += 0.02;

        // Floating animation
        const floatOffset = Math.sin(time * 1.8) * 0.5;
        currentUserIndicatorRef.current.position.y =
          starProperties.size * 0.825 + floatOffset;
      }
    }
  });

  const handleClick = () => {
    // Call the onClick prop to trigger StarSystem's handleStarClick
    onClick();
  };

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
        <sphereGeometry args={[1, 24, 24]} />
        <meshBasicMaterial
          color={starProperties.baseColor}
          transparent
          opacity={0.12}
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
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial
          color={starProperties.brightColor}
          transparent
          opacity={0.25}
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
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial
          color={starProperties.brightColor}
          transparent
          opacity={0.8}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Star core - high detail surface */}
      <mesh
        ref={starRef}
        scale={[starProperties.size, starProperties.size, starProperties.size]}
        onPointerEnter={() => onHover(true)}
        onPointerLeave={() => onHover(false)}
        onClick={handleClick}
      >
        <icosahedronGeometry args={[1, 5]} />
        <meshStandardMaterial
          color={starProperties.baseColor}
          emissive={starProperties.brightColor}
          emissiveIntensity={2.8}
          roughness={0.05}
          metalness={0.0}
        />
      </mesh>

      {/* Primary stellar light */}
      <pointLight
        position={[0, 0, 0]}
        intensity={starProperties.brightness * starProperties.size * 5.0}
        color={starProperties.brightColor}
        distance={starProperties.size * 50}
        decay={1.2}
        castShadow
      />

      {/* Secondary ambient light */}
      <pointLight
        position={[0, 0, 0]}
        intensity={starProperties.brightness * starProperties.size * 2.5}
        color={starProperties.baseColor}
        distance={starProperties.size * 80}
        decay={1.8}
      />

      {/* Stellar wind simulation */}
      <pointLight
        position={[0, 0, 0]}
        intensity={starProperties.brightness * 1.2}
        color={starProperties.brightColor}
        distance={starProperties.size * 120}
        decay={2.2}
      />

      {/* Current user indicator - star shape above user's star */}
      {isCurrentUser && (
        <mesh
          ref={currentUserIndicatorRef}
          position={[0, starProperties.size * 0.825, 0]}
          rotation={[0, 0, 0]}
        >
          <primitive object={createStarShape} />
          <meshBasicMaterial
            color="#FFD700"
            transparent
            opacity={0.9}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Current user indicator glow effect */}
      {isCurrentUser && (
        <mesh
          position={[0, starProperties.size * 0.825, 0]}
          rotation={[0, 0, 0]}
        >
          <primitive object={createStarShape} />
          <meshBasicMaterial
            color="#FFD700"
            transparent
            opacity={0.3}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}
    </group>
  );
};

export default Star;
