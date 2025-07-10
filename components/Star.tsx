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
  const solarWindRef = useRef<THREE.Points>(null);

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
    const baseSize = 1.8;
    const maxSize = 5.0;
    const size = Math.max(
      baseSize,
      Math.min(baseSize + repositoryCount * 0.5, maxSize)
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

  // Solar wind particle system
  const solarWindParticles = useMemo(() => {
    const particleCount = 2000;
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const lifetimes = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      // Start particles near the star surface
      const phi = Math.random() * Math.PI * 2;
      const theta = Math.random() * Math.PI;
      const startRadius = starProperties.size * 1.2;

      positions[i * 3] = Math.sin(theta) * Math.cos(phi) * startRadius;
      positions[i * 3 + 1] = Math.sin(theta) * Math.sin(phi) * startRadius;
      positions[i * 3 + 2] = Math.cos(theta) * startRadius;

      // Random velocity direction (outward from star)
      const speed = 0.5 + Math.random() * 1.5;
      velocities[i * 3] = (positions[i * 3] / startRadius) * speed;
      velocities[i * 3 + 1] = (positions[i * 3 + 1] / startRadius) * speed;
      velocities[i * 3 + 2] = (positions[i * 3 + 2] / startRadius) * speed;

      // Particle color based on star color
      colors[i * 3] = starProperties.baseColor.r;
      colors[i * 3 + 1] = starProperties.baseColor.g;
      colors[i * 3 + 2] = starProperties.baseColor.b;

      // Random lifetime
      lifetimes[i] = Math.random() * 10;
    }

    return { positions, velocities, colors, lifetimes };
  }, [starProperties]);

  // Advanced star animation with realistic stellar activity
  useFrame(state => {
    if (
      starRef.current &&
      glowRef.current &&
      coronaRef.current &&
      flareRef.current &&
      solarWindRef.current
    ) {
      const time = state.clock.getElapsedTime();
      const deltaTime = state.clock.getDelta();

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

      // Solar wind particle animation
      const geometry = solarWindRef.current.geometry;
      const positions = geometry.attributes.position.array as Float32Array;
      const velocities = solarWindParticles.velocities;
      const lifetimes = solarWindParticles.lifetimes;

      for (let i = 0; i < positions.length / 3; i++) {
        // Update particle positions
        positions[i * 3] += velocities[i * 3] * deltaTime;
        positions[i * 3 + 1] += velocities[i * 3 + 1] * deltaTime;
        positions[i * 3 + 2] += velocities[i * 3 + 2] * deltaTime;

        // Update lifetime
        lifetimes[i] -= deltaTime;

        // Reset particle if lifetime expired or too far from star
        const distance = Math.sqrt(
          positions[i * 3] ** 2 +
            positions[i * 3 + 1] ** 2 +
            positions[i * 3 + 2] ** 2
        );

        if (lifetimes[i] <= 0 || distance > starProperties.size * 15) {
          // Reset particle near star surface
          const phi = Math.random() * Math.PI * 2;
          const theta = Math.random() * Math.PI;
          const startRadius = starProperties.size * 1.2;

          positions[i * 3] = Math.sin(theta) * Math.cos(phi) * startRadius;
          positions[i * 3 + 1] = Math.sin(theta) * Math.sin(phi) * startRadius;
          positions[i * 3 + 2] = Math.cos(theta) * startRadius;

          // New velocity
          const speed = 0.5 + Math.random() * 1.5;
          velocities[i * 3] = (positions[i * 3] / startRadius) * speed;
          velocities[i * 3 + 1] = (positions[i * 3 + 1] / startRadius) * speed;
          velocities[i * 3 + 2] = (positions[i * 3 + 2] / startRadius) * speed;

          // Reset lifetime
          lifetimes[i] = 8 + Math.random() * 4;
        }
      }

      geometry.attributes.position.needsUpdate = true;

      // Dynamic material properties
      if (starRef.current.material instanceof THREE.MeshStandardMaterial) {
        const emissiveIntensity = 2.5 + Math.sin(time * 2.1) * 0.5;
        starRef.current.material.emissiveIntensity = emissiveIntensity;
      }
    }
  });

  return (
    <group>
      {/* Solar wind particles */}
      <points ref={solarWindRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            array={solarWindParticles.positions}
            count={solarWindParticles.positions.length / 3}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            array={solarWindParticles.colors}
            count={solarWindParticles.colors.length / 3}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.2}
          vertexColors
          transparent
          opacity={0.7}
          sizeAttenuation
          blending={THREE.AdditiveBlending}
        />
      </points>

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
        onClick={onClick}
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
    </group>
  );
};

export default Star;
