import React, {
  useRef,
  useMemo,
  useEffect,
  useState,
  useCallback,
} from 'react';
import { Canvas, useFrame, extend } from '@react-three/fiber';
import { OrbitControls, Stars, Text, Html } from '@react-three/drei';
import { useRouter } from 'next/router';
import * as THREE from 'three';
import StarSystem from './StarSystem';
import KeyboardControls from './KeyboardControls';
import { searchUsers, UserSearchResult } from '../lib/irys';
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
  currentWallet?: string;
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

  // Star field animation - slow rotation for dynamic background
  useFrame((state, delta) => {
    if (distantStarsRef.current) {
      // Slow rotation of background stars around Y axis
      distantStarsRef.current.rotation.y += delta * 0.005; // Very slow rotation
      distantStarsRef.current.rotation.x += delta * 0.002; // Even slower X rotation
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

// Comet tail particle system
function CometTail({
  velocity,
  cometType,
  distance,
}: {
  velocity: THREE.Vector3;
  cometType: string;
  distance: number;
}) {
  const particlesRef = useRef<THREE.Points>(null);
  const particleCount = 60;

  const particleData = useMemo(() => {
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);
    const ages = new Float32Array(particleCount);
    const maxAges = new Float32Array(particleCount);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 0.5;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 0.5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 0.5;

      ages[i] = Math.random() * 2;
      maxAges[i] = 0.5 + Math.random() * 1.5;
      sizes[i] = 0;

      // More varied colors based on comet type
      const variation = 0.2;
      switch (cometType) {
        case 'ice':
          colors[i * 3] = 0.7 + Math.random() * variation;
          colors[i * 3 + 1] = 0.9 + Math.random() * variation;
          colors[i * 3 + 2] = 1.0;
          break;
        case 'dust':
          colors[i * 3] = 1.0;
          colors[i * 3 + 1] = 0.8 + Math.random() * variation;
          colors[i * 3 + 2] = 0.5 + Math.random() * variation;
          break;
        case 'rock':
          colors[i * 3] = 0.6 + Math.random() * variation;
          colors[i * 3 + 1] = 0.5 + Math.random() * variation;
          colors[i * 3 + 2] = 0.4 + Math.random() * variation;
          break;
      }
    }

    return { positions, velocities, ages, maxAges, colors, sizes };
  }, [particleCount, cometType]);

  useFrame((state, delta) => {
    if (!particlesRef.current) return;

    const positions = particlesRef.current.geometry.attributes.position;
    const sizes = particlesRef.current.geometry.attributes.size;
    const ages = particlesRef.current.geometry.attributes.age;
    const maxAges = particlesRef.current.geometry.attributes.maxAge;

    const hasVelocity = velocity.length() > 0.01;
    const tailDir = hasVelocity
      ? velocity.clone().normalize().multiplyScalar(-1)
      : new THREE.Vector3(0, 0, -1);
    const speed = velocity.length();

    // Tail intensity based on distance (closer = more intense)
    const intensityFactor = Math.max(0.3, 1 - distance / 200);

    for (let i = 0; i < particleCount; i++) {
      let age = ages.array[i];
      const maxAge = maxAges.array[i];
      age += delta * (1 + intensityFactor);

      if (age > maxAge) {
        positions.array[i * 3] = (Math.random() - 0.5) * 0.5;
        positions.array[i * 3 + 1] = (Math.random() - 0.5) * 0.5;
        positions.array[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
        age = 0;

        const spread = 0.5 * intensityFactor;
        const vel = new THREE.Vector3(
          tailDir.x + (Math.random() - 0.5) * spread,
          tailDir.y + (Math.random() - 0.5) * spread,
          tailDir.z + (Math.random() - 0.5) * spread
        ).normalize();

        const particleSpeed = speed * (2 + intensityFactor * 3);
        particleData.velocities[i * 3] = vel.x * particleSpeed;
        particleData.velocities[i * 3 + 1] = vel.y * particleSpeed;
        particleData.velocities[i * 3 + 2] = vel.z * particleSpeed;
      }

      const ageRatio = age / maxAge;
      const ageMultiplier = 1 + ageRatio * intensityFactor * 2;

      positions.array[i * 3] +=
        particleData.velocities[i * 3] * delta * ageMultiplier;
      positions.array[i * 3 + 1] +=
        particleData.velocities[i * 3 + 1] * delta * ageMultiplier;
      positions.array[i * 3 + 2] +=
        particleData.velocities[i * 3 + 2] * delta * ageMultiplier;

      sizes.array[i] =
        Math.pow(1 - ageRatio, 0.5) * 0.5 * (1 + intensityFactor);
      ages.array[i] = age;
    }

    positions.needsUpdate = true;
    sizes.needsUpdate = true;
    ages.needsUpdate = true;
    if (maxAges) maxAges.needsUpdate = true;
  });

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={particleData.positions}
          count={particleCount}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          array={particleData.colors}
          count={particleCount}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-size"
          array={particleData.sizes}
          count={particleCount}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-age"
          array={particleData.ages}
          count={particleCount}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-maxAge"
          array={particleData.maxAges}
          count={particleCount}
          itemSize={1}
        />
      </bufferGeometry>
      <pointsMaterial
        vertexColors
        size={0.4}
        sizeAttenuation
        transparent
        opacity={0.7}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

// Enhanced comet component with realistic physics
function Comet({
  id,
  onComplete,
}: {
  id: number;
  onComplete: (id: number) => void;
}) {
  const cometRef = useRef<THREE.Group>(null);
  const positionRef = useRef(new THREE.Vector3());
  const velocityRef = useRef(new THREE.Vector3());
  const [currentVelocity, setCurrentVelocity] = useState(new THREE.Vector3());
  const [currentDistance, setCurrentDistance] = useState(500);

  // More comet types with different behaviors
  const cometData = useMemo(() => {
    const types = [
      {
        type: 'ice',
        behavior: 'normal',
        color: '#b0e0ff',
        glow: '#88ccff',
        size: 0.4,
      },
      {
        type: 'dust',
        behavior: 'capture',
        color: '#ffcc88',
        glow: '#ffaa44',
        size: 0.5,
      },
      {
        type: 'rock',
        behavior: 'absorb',
        color: '#8b7355',
        glow: '#a0826d',
        size: 0.6,
      },
    ];

    return types[Math.floor(Math.random() * types.length)];
  }, []);

  // Initialize position and velocity
  useEffect(() => {
    const angle = Math.random() * Math.PI * 2;
    const distance = 350 + Math.random() * 150;
    const height = (Math.random() - 0.5) * 40;

    positionRef.current.set(
      Math.cos(angle) * distance,
      height,
      Math.sin(angle) * distance
    );

    let speed, targetAngle;
    switch (cometData.behavior) {
      case 'capture':
        targetAngle = angle + Math.PI + (Math.random() - 0.5) * 0.3;
        speed = 0.5 + Math.random() * 0.3;
        break;
      case 'absorb':
        targetAngle = angle + Math.PI + (Math.random() - 0.5) * 0.1;
        speed = 0.3 + Math.random() * 0.2;
        break;
      default: // 'normal'
        targetAngle = angle + Math.PI + (Math.random() - 0.5) * 0.3;
        speed = 0.8 + Math.random() * 0.4;
    }

    velocityRef.current.set(
      Math.cos(targetAngle) * speed,
      (Math.random() - 0.5) * 0.2,
      Math.sin(targetAngle) * speed
    );
  }, [cometData]);

  // Physics with realistic gravity
  useFrame((state, delta) => {
    if (!cometRef.current) return;

    const pos = positionRef.current;
    const vel = velocityRef.current;
    const distance = pos.length();

    setCurrentDistance(distance);

    // Check absorption
    if (cometData.behavior === 'absorb' && distance < 8) {
      onComplete(id);
      return;
    }

    // Realistic gravity (stronger when closer)
    const baseGravity = cometData.behavior === 'absorb' ? 100 : 60;
    const gravity = baseGravity / (distance * distance);
    const gravityDirection = pos.clone().normalize().multiplyScalar(-1);
    const gravityAccel = gravityDirection.multiplyScalar(gravity);

    vel.add(gravityAccel.multiplyScalar(delta));

    // Dynamic max speed based on distance
    const distanceFactor = Math.max(0.5, Math.min(2, 100 / distance));
    const baseMaxSpeed = 3;
    const maxSpeed = baseMaxSpeed * distanceFactor;

    if (vel.length() > maxSpeed) {
      vel.normalize().multiplyScalar(maxSpeed);
    }

    pos.add(vel.clone().multiplyScalar(delta * 60));
    cometRef.current.position.copy(pos);
    setCurrentVelocity(vel.clone());

    // Remove if too far
    if (distance > 600 && cometData.behavior !== 'capture') {
      onComplete(id);
    }

    // Capture behavior - elliptical orbit
    if (cometData.behavior === 'capture' && distance > 300) {
      onComplete(id);
    }
  });

  // Brightness based on distance
  const brightness = Math.max(0.3, 1 - currentDistance / 400);

  return (
    <group ref={cometRef}>
      <mesh>
        <sphereGeometry args={[cometData.size, 12, 12]} />
        <meshBasicMaterial color={cometData.color} />
      </mesh>
      <mesh>
        <sphereGeometry args={[cometData.size * 2, 12, 12]} />
        <meshBasicMaterial
          color={cometData.glow}
          transparent
          opacity={0.5 * brightness}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <CometTail
        velocity={currentVelocity}
        cometType={cometData.type}
        distance={currentDistance}
      />
      <pointLight
        intensity={0.5 * brightness}
        color={cometData.glow}
        distance={10}
        decay={2}
      />
    </group>
  );
}

// Star connection particle beam
function StarConnection({
  startPos,
  endPos,
  progress,
}: {
  startPos: [number, number, number];
  endPos: [number, number, number];
  progress: number;
}) {
  const particlesRef = useRef<THREE.Points>(null);
  const particleCount = 200;

  // Store only random data that shouldn't change
  const randomData = useMemo(() => {
    const offsets = new Float32Array(particleCount);
    const randomFactors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      offsets[i] = Math.random();
      // Store random spread factors for each particle - much smaller spread
      randomFactors[i * 3] = (Math.random() - 0.5) * 0.1;
      randomFactors[i * 3 + 1] = (Math.random() - 0.5) * 0.1;
      randomFactors[i * 3 + 2] = (Math.random() - 0.5) * 0.1;
    }

    return { offsets, randomFactors };
  }, [particleCount]);

  // Create initial positions array
  const positions = useMemo(
    () => new Float32Array(particleCount * 3),
    [particleCount]
  );

  useFrame(state => {
    if (!particlesRef.current) return;

    const material = particlesRef.current.material as THREE.PointsMaterial;
    const positionsAttr = particlesRef.current.geometry.attributes.position;

    // Update positions based on current star positions
    for (let i = 0; i < particleCount; i++) {
      const t = i / (particleCount - 1);

      // Interpolate between start and end positions
      positionsAttr.array[i * 3] =
        startPos[0] +
        (endPos[0] - startPos[0]) * t +
        randomData.randomFactors[i * 3];
      positionsAttr.array[i * 3 + 1] =
        startPos[1] +
        (endPos[1] - startPos[1]) * t +
        randomData.randomFactors[i * 3 + 1];
      positionsAttr.array[i * 3 + 2] =
        startPos[2] +
        (endPos[2] - startPos[2]) * t +
        randomData.randomFactors[i * 3 + 2];
    }

    positionsAttr.needsUpdate = true;

    // Fade in and out effect - faster transitions using size instead of opacity
    let fadeEffect = 0;
    if (progress < 0.15) {
      fadeEffect = progress / 0.15; // Fade in (15% of duration)
    } else if (progress > 0.85) {
      fadeEffect = (1 - progress) / 0.15; // Fade out (last 15% of duration)
    } else {
      fadeEffect = 1; // Full effect
    }

    // Update particle sizes based on progress and offset
    const sizes = particlesRef.current.geometry.attributes.size;
    const time = state.clock.elapsedTime;

    for (let i = 0; i < particleCount; i++) {
      const offset = randomData.offsets[i];
      const pulse = Math.sin((time * 2 + offset * Math.PI * 2) * 2) * 0.5 + 0.5;
      sizes.array[i] = (0.05 + pulse * 0.03) * fadeEffect; // Much smaller size
    }

    sizes.needsUpdate = true;
  });

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={positions}
          count={particleCount}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-size"
          array={new Float32Array(particleCount).fill(0.05)}
          count={particleCount}
          itemSize={1}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#00d4ff"
        size={0.1}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

// Galactic Center with Black Hole and Accretion Disk
function GalacticCenter() {
  const blackHoleRef = useRef<THREE.Mesh>(null);
  const accretionDiskRef = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<THREE.Points>(null);

  // Create accretion disk particles
  const particles = useMemo(() => {
    const count = 4000;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const velocities = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      // Distribute particles in disk shape with spiral pattern
      const radius = 15 + Math.random() * 35; // 15-50 radius
      const angle = Math.random() * Math.PI * 2;
      const spiralOffset = (radius - 15) * 0.1; // Spiral effect
      const finalAngle = angle + spiralOffset;
      const height = (Math.random() - 0.5) * 2 * Math.exp(-radius / 20); // Thinner at edges

      positions[i * 3] = Math.cos(finalAngle) * radius;
      positions[i * 3 + 1] = height;
      positions[i * 3 + 2] = Math.sin(finalAngle) * radius;

      // Orbital velocity (faster near center)
      const velocity = 0.008 / Math.sqrt(radius / 15); // Reduced from 0.02
      velocities[i * 3] = -Math.sin(finalAngle) * velocity;
      velocities[i * 3 + 1] = 0;
      velocities[i * 3 + 2] = Math.cos(finalAngle) * velocity;

      // Colors - gradient from hot white-orange center to cooler red edges
      const colorIntensity = 1 - (radius - 15) / 35;
      colors[i * 3] = 1.0; // Red channel always full
      colors[i * 3 + 1] = 0.4 + colorIntensity * 0.4; // Orange gradient
      colors[i * 3 + 2] = 0.1 + colorIntensity * 0.2; // Slight yellow near center

      sizes[i] = (Math.random() * 0.3 + 0.2) * (1 + colorIntensity * 0.3); // Much smaller particles
    }

    return { positions, colors, sizes, velocities };
  }, []);

  useFrame(state => {
    // Rotate accretion disk with differential rotation
    if (accretionDiskRef.current) {
      accretionDiskRef.current.rotation.y += 0.0005; // Reduced from 0.003
    }

    // Update particle positions for orbital motion
    if (particlesRef.current) {
      const positions = particlesRef.current.geometry.attributes.position;
      const velocities = particles.velocities;

      for (let i = 0; i < particles.positions.length / 3; i++) {
        // Get current position
        const x = positions.array[i * 3];
        const y = positions.array[i * 3 + 1];
        const z = positions.array[i * 3 + 2];

        // Calculate radius
        const radius = Math.sqrt(x * x + z * z);

        // Update position with orbital velocity
        if (radius > 0) {
          const angle = Math.atan2(z, x);
          const angularVelocity = 0.008 / Math.sqrt(radius / 15); // Reduced from 0.02
          const newAngle = angle + angularVelocity;

          positions.array[i * 3] = Math.cos(newAngle) * radius;
          positions.array[i * 3 + 2] = Math.sin(newAngle) * radius;
        }
      }

      positions.needsUpdate = true;
    }

    // Rotate event horizon effect (removed pulsing)
    if (blackHoleRef.current) {
      // Keep scale fixed at 1 (no pulsing)
      blackHoleRef.current.scale.setScalar(1);

      // Rotate event horizon effect
      blackHoleRef.current.rotation.y += 0.0003; // Reduced from 0.001
    }
  });

  return (
    <group position={[0, 0, 0]}>
      {/* Black Hole Core with event horizon */}
      <mesh ref={blackHoleRef}>
        <sphereGeometry args={[8, 64, 64]} />
        <meshStandardMaterial
          color="#000000"
          emissive="#110022"
          emissiveIntensity={0.3}
          roughness={0}
          metalness={1}
        />
      </mesh>

      {/* Event Horizon Distortion Effect */}
      <mesh>
        <sphereGeometry args={[10, 32, 32]} />
        <meshBasicMaterial
          color="#220066"
          transparent
          opacity={0.4}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Gravitational Lensing Effect */}
      <mesh>
        <sphereGeometry args={[14, 32, 32]} />
        <meshBasicMaterial
          color="#4400aa"
          transparent
          opacity={0.2}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Accretion Disk Particles */}
      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            array={particles.positions}
            count={particles.positions.length / 3}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            array={particles.colors}
            count={particles.colors.length / 3}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-size"
            array={particles.sizes}
            count={particles.sizes.length}
            itemSize={1}
          />
        </bufferGeometry>
        <pointsMaterial
          vertexColors
          size={0.3}
          sizeAttenuation
          transparent
          opacity={0.7}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Central Bright Light */}
      <pointLight
        position={[0, 0, 0]}
        intensity={3}
        color="#ff8800"
        distance={300}
      />
    </group>
  );
}

// Camera controller with smooth animation
const CameraController = React.forwardRef<
  any,
  {
    focusedUser?: string;
    users: any[];
    userPositions: [number, number, number][];
    trackingTarget?: {
      type: 'star' | 'planet';
      userId: string;
      repoName?: string;
    } | null;
    starSystemRefs: React.MutableRefObject<Map<string, THREE.Group>>;
  }
>(
  (
    { focusedUser, users, userPositions, trackingTarget, starSystemRefs },
    ref
  ) => {
    const controlsRef = useRef<any>();
    const targetPosition = useRef(new THREE.Vector3());
    const cameraPosition = useRef(new THREE.Vector3());
    const isAnimating = useRef(false);
    const isTracking = useRef(false);

    // Expose controlsRef through ref
    React.useImperativeHandle(
      ref,
      () => ({
        controlsRef: controlsRef,
      }),
      []
    );

    // Track selected star/planet
    useFrame(() => {
      if (!controlsRef.current) return;

      if (trackingTarget && starSystemRefs.current) {
        const systemRef = starSystemRefs.current.get(trackingTarget.userId);

        if (systemRef) {
          // Get the world position of the tracked object
          const worldPosition = new THREE.Vector3();
          systemRef.getWorldPosition(worldPosition);

          // Adjust target position to show star higher on screen
          const targetOffset = new THREE.Vector3(0, -15, 0); // Look below the star
          const adjustedTarget = worldPosition.clone().add(targetOffset);

          // Smoothly follow the target
          controlsRef.current.target.lerp(adjustedTarget, 0.1);

          // Keep camera at a good viewing distance
          const cameraOffset = new THREE.Vector3(30, 20, 30);
          const desiredCameraPos = worldPosition.clone().add(cameraOffset);
          controlsRef.current.object.position.lerp(desiredCameraPos, 0.05);

          controlsRef.current.update();
          isTracking.current = true;
        }
      } else if (isTracking.current) {
        // When tracking stops, immediately stop all movement
        isTracking.current = false;

        // Get current values
        const currentTarget = controlsRef.current.target.clone();
        const currentPosition = controlsRef.current.object.position.clone();

        // Disable damping to stop momentum
        controlsRef.current.enableDamping = false;

        // Set exact positions
        controlsRef.current.target.set(
          currentTarget.x,
          currentTarget.y,
          currentTarget.z
        );
        controlsRef.current.object.position.set(
          currentPosition.x,
          currentPosition.y,
          currentPosition.z
        );

        // Force update
        controlsRef.current.update();

        // Re-enable damping after ensuring stop
        requestAnimationFrame(() => {
          if (controlsRef.current) {
            controlsRef.current.enableDamping = true;
            controlsRef.current.dampingFactor = 0.05;
            controlsRef.current.update();
          }
        });

        // Stop any other animations
        isAnimating.current = false;
      }
    });

    // Handle tracking target changes - stop immediately when tracking ends
    useEffect(() => {
      if (!trackingTarget && controlsRef.current) {
        // Immediately stop any animations
        isAnimating.current = false;
        isTracking.current = false;

        // Get current state
        const currentTarget = controlsRef.current.target.clone();
        const currentPosition = controlsRef.current.object.position.clone();

        // Disable damping to prevent momentum
        controlsRef.current.enableDamping = false;

        // Set exact positions
        controlsRef.current.target.set(
          currentTarget.x,
          currentTarget.y,
          currentTarget.z
        );
        controlsRef.current.object.position.set(
          currentPosition.x,
          currentPosition.y,
          currentPosition.z
        );

        // Force immediate update
        controlsRef.current.update();

        // Re-enable damping on next frame
        requestAnimationFrame(() => {
          if (controlsRef.current) {
            controlsRef.current.enableDamping = true;
            controlsRef.current.dampingFactor = 0.05;
            controlsRef.current.update();
          }
        });
      }
    }, [trackingTarget]);

    useEffect(() => {
      if (
        focusedUser &&
        controlsRef.current &&
        users.length > 0 &&
        !trackingTarget
      ) {
        // Find focused user position
        const userIndex = users.findIndex(
          u => u.accountAddress === focusedUser || u.nickname === focusedUser
        );

        if (userIndex !== -1 && userPositions[userIndex]) {
          const [x, y, z] = userPositions[userIndex];

          // Set target position for smooth animation with offset to show star higher
          targetPosition.current.set(x, y - 15, z); // Look below the star

          // Position camera at a good viewing distance
          const cameraOffset = new THREE.Vector3(30, 20, 30);
          cameraPosition.current.set(x + 30, y + 20, z + 30); // Camera at actual star position + offset

          isAnimating.current = true;

          // Smooth animation to target
          const animateCamera = () => {
            if (
              controlsRef.current &&
              isAnimating.current &&
              !isTracking.current &&
              !trackingTarget
            ) {
              // Animate target
              controlsRef.current.target.lerp(targetPosition.current, 0.05);

              // Animate camera position
              const currentCameraPos = controlsRef.current.object.position;
              currentCameraPos.lerp(cameraPosition.current, 0.05);

              controlsRef.current.update();

              // Check if animation is close enough to stop
              if (
                controlsRef.current.target.distanceTo(targetPosition.current) <
                0.1
              ) {
                isAnimating.current = false;
              } else {
                requestAnimationFrame(animateCamera);
              }
            } else {
              // Stop animation if tracking started
              isAnimating.current = false;
            }
          };

          requestAnimationFrame(animateCamera);
        }
      }
    }, [focusedUser, users, userPositions, trackingTarget]);

    return (
      <OrbitControls
        ref={controlsRef}
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={10}
        maxDistance={3000}
        autoRotate={false}
        autoRotateSpeed={0.1}
        enableDamping={true}
        dampingFactor={0.05}
        mouseButtons={{
          LEFT: THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN,
        }}
      />
    );
  }
);

// Orbiting Star System component
function OrbitingStarSystem({
  systemData,
  user,
  onPlanetClick,
  onPlanetHover,
  onPlanetLeave,
  onShowStarTooltip,
  onShowPlanetTooltip,
  onHideTooltip,
  isFocused,
  currentWallet,
  onRef,
}: {
  systemData: {
    position: [number, number, number];
    orbitRadius: number;
    orbitSpeed: number;
    initialAngle: number;
  };
  user: any;
  onPlanetClick: (user: string, repo: string) => void;
  onPlanetHover: (repo: any, position: [number, number, number]) => void;
  onPlanetLeave: () => void;
  onShowStarTooltip: (user: any) => void;
  onShowPlanetTooltip: (user: any, repo: any) => void;
  onHideTooltip: () => void;
  isFocused: boolean;
  currentWallet?: string;
  onRef?: (ref: THREE.Group | null) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const angleRef = useRef(systemData.initialAngle);

  // Register ref
  useEffect(() => {
    if (onRef && groupRef.current) {
      onRef(groupRef.current);
    }
  }, [onRef]);

  useFrame((state, delta) => {
    if (groupRef.current) {
      // Update angle for galactic orbit
      angleRef.current += systemData.orbitSpeed;

      // Calculate new position on galactic orbit
      const x = Math.cos(angleRef.current) * systemData.orbitRadius;
      const z = Math.sin(angleRef.current) * systemData.orbitRadius;
      const y = systemData.position[1]; // Keep original height

      groupRef.current.position.set(x, y, z);
    }
  });

  return (
    <group ref={groupRef}>
      <StarSystem
        position={[0, 0, 0]} // Local position within the orbiting group
        user={user}
        onPlanetClick={onPlanetClick}
        onPlanetHover={onPlanetHover}
        onPlanetLeave={onPlanetLeave}
        onShowStarTooltip={onShowStarTooltip}
        onShowPlanetTooltip={onShowPlanetTooltip}
        onHideTooltip={onHideTooltip}
        isFocused={isFocused}
        currentWallet={currentWallet}
      />
    </group>
  );
}

// Wrapper component for star connections to handle refs properly
function StarConnectionWrapper({
  connection,
  users,
  starSystemRefs,
}: {
  connection: {
    id: number;
    startIndex: number;
    endIndex: number;
    startTime: number;
    duration: number;
  };
  users: any[];
  starSystemRefs: React.MutableRefObject<Map<string, THREE.Group>>;
}) {
  const [positions, setPositions] = useState<{
    start: [number, number, number];
    end: [number, number, number];
  } | null>(null);

  // Calculate initial positions
  useEffect(() => {
    const startUser = users[connection.startIndex];
    const endUser = users[connection.endIndex];

    const startRef = starSystemRefs.current.get(startUser?.accountAddress);
    const endRef = starSystemRefs.current.get(endUser?.accountAddress);

    if (startRef && endRef) {
      const startWorldPos = new THREE.Vector3();
      const endWorldPos = new THREE.Vector3();
      startRef.getWorldPosition(startWorldPos);
      endRef.getWorldPosition(endWorldPos);

      setPositions({
        start: [startWorldPos.x, startWorldPos.y, startWorldPos.z],
        end: [endWorldPos.x, endWorldPos.y, endWorldPos.z],
      });
    }
  }, [connection, users, starSystemRefs]);

  useFrame(() => {
    const startUser = users[connection.startIndex];
    const endUser = users[connection.endIndex];

    const startRef = starSystemRefs.current.get(startUser?.accountAddress);
    const endRef = starSystemRefs.current.get(endUser?.accountAddress);

    if (startRef && endRef) {
      const startWorldPos = new THREE.Vector3();
      const endWorldPos = new THREE.Vector3();
      startRef.getWorldPosition(startWorldPos);
      endRef.getWorldPosition(endWorldPos);

      setPositions({
        start: [startWorldPos.x, startWorldPos.y, startWorldPos.z],
        end: [endWorldPos.x, endWorldPos.y, endWorldPos.z],
      });
    }
  });

  if (!positions) return null;

  // Calculate progress based on elapsed time
  const elapsed = Date.now() - connection.startTime;
  const progress = Math.min(1, elapsed / connection.duration);

  return (
    <StarConnection
      startPos={positions.start}
      endPos={positions.end}
      progress={progress}
    />
  );
}

const UniverseScene: React.FC<UniverseSceneProps> = ({
  users,
  focusedUser,
  onPlanetClick,
  currentWallet,
}) => {
  const router = useRouter();
  const [tooltipData, setTooltipData] = useState<{
    type: 'star' | 'planet';
    user: any;
    repo?: any;
  } | null>(null);

  // Camera tracking state
  const [trackingTarget, setTrackingTarget] = useState<{
    type: 'star' | 'planet';
    userId: string;
    repoName?: string;
  } | null>(null);

  // Refs for star systems
  const starSystemRefs = useRef<Map<string, THREE.Group>>(new Map());

  // Ref for camera controller
  const cameraControllerRef = useRef<any>(null);

  // Ref for tooltip container
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Comet management
  const [comets, setComets] = useState<number[]>([]);
  const nextCometIdRef = useRef(0);

  // Star connections management
  const [starConnections, setStarConnections] = useState<
    Array<{
      id: number;
      startIndex: number;
      endIndex: number;
      startTime: number;
      duration: number;
    }>
  >([]);
  const nextConnectionIdRef = useRef(0);

  // Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [internalFocusedUser, setInternalFocusedUser] = useState<
    string | undefined
  >(focusedUser);

  // Handle empty user array
  const validUsers = users || [];

  // Generate deterministic hash from string
  const hashCode = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  };

  // Generate pseudo-random number from seed
  const seededRandom = (seed: number) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };

  // Sort users by accountAddress to ensure consistent ordering
  const sortedUsers = useMemo(() => {
    return [...validUsers].sort((a, b) =>
      a.accountAddress.localeCompare(b.accountAddress)
    );
  }, [validUsers]); // Depend on full validUsers array to catch repository updates

  // Spawn comets periodically
  useEffect(() => {
    const spawnComet = () => {
      setComets(prev => [...prev, nextCometIdRef.current++]);
    };

    // Initial comet after 5 seconds
    const initialTimeout = setTimeout(spawnComet, 5000);

    // Then spawn every 20-30 seconds
    const interval = setInterval(
      () => {
        spawnComet();
      },
      20000 + Math.random() * 10000
    );

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, []);

  // Spawn star connections periodically
  useEffect(() => {
    if (sortedUsers.length < 2) return;

    const spawnConnection = () => {
      // Select two random different stars
      const indices = Array.from({ length: sortedUsers.length }, (_, i) => i);
      const startIndex = Math.floor(Math.random() * indices.length);
      indices.splice(startIndex, 1);
      const endIndex = indices[Math.floor(Math.random() * indices.length)];

      setStarConnections(prev => [
        ...prev,
        {
          id: nextConnectionIdRef.current++,
          startIndex,
          endIndex,
          startTime: Date.now(),
          duration: 3000 + Math.random() * 2000, // 3-5 seconds
        },
      ]);
    };

    // Initial connection after 2 seconds
    const initialTimeout = setTimeout(spawnConnection, 2000);

    // Then spawn every 5-10 seconds
    const interval = setInterval(
      () => {
        spawnConnection();
      },
      5000 + Math.random() * 5000
    );

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [sortedUsers.length]);

  // Clean up completed connections
  useEffect(() => {
    const cleanup = setInterval(() => {
      const now = Date.now();
      setStarConnections(prev =>
        prev.filter(conn => now - conn.startTime < conn.duration)
      );
    }, 1000);

    return () => clearInterval(cleanup);
  }, []);

  // Handle comet completion
  const handleCometComplete = useCallback((id: number) => {
    setComets(prev => prev.filter(cometId => cometId !== id));
  }, []);

  // Search functionality
  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchUsers(query);
      setSearchResults(results);
      setShowSearchResults(true);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      performSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, performSearch]);

  // Handle search result selection
  const handleSelectUser = useCallback(
    (result: UserSearchResult) => {
      setInternalFocusedUser(result.walletAddress);
      setSearchQuery(result.displayName);
      setShowSearchResults(false);

      // Find the user in the sorted users array
      const selectedUser = sortedUsers.find(
        u => u.accountAddress === result.walletAddress
      );

      if (selectedUser) {
        // Show tooltip and start tracking like when clicking a star
        setTooltipData({ type: 'star', user: selectedUser });
        setTrackingTarget({
          type: 'star',
          userId: selectedUser.accountAddress,
        });
      }
    },
    [sortedUsers]
  );

  // Handle search input changes
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    if (!value.trim()) {
      setShowSearchResults(false);
    }
  }, []);

  // Handle clear search
  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
    setShowSearchResults(false);
    setInternalFocusedUser(undefined);
    // Stop tracking when clearing search
    setTrackingTarget(null);
    setTooltipData(null);
  }, []);

  // Handle hiding tooltip
  const handleHideTooltip = useCallback(() => {
    setTooltipData(null);
    // Stop tracking when tooltip is closed
    setTrackingTarget(null);

    // Clear focused user to stop any ongoing animations
    setInternalFocusedUser(undefined);

    // Force camera to stop at current position
    if (
      cameraControllerRef.current &&
      cameraControllerRef.current.controlsRef?.current
    ) {
      const controls = cameraControllerRef.current.controlsRef.current;
      const currentTarget = controls.target.clone();
      const currentPosition = controls.object.position.clone();

      // Disable damping temporarily
      controls.enableDamping = false;
      controls.target.set(currentTarget.x, currentTarget.y, currentTarget.z);
      controls.object.position.set(
        currentPosition.x,
        currentPosition.y,
        currentPosition.z
      );
      controls.update();

      // Re-enable damping after ensuring position is locked
      requestAnimationFrame(() => {
        if (controls) {
          controls.enableDamping = true;
          controls.dampingFactor = 0.05;
          controls.update();
        }
      });
    }
  }, []);

  // Handle ESC key to stop tracking
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setTrackingTarget(null);
        setTooltipData(null);
        setInternalFocusedUser(undefined);

        // Force camera to stop at current position
        if (
          cameraControllerRef.current &&
          cameraControllerRef.current.controlsRef?.current
        ) {
          const controls = cameraControllerRef.current.controlsRef.current;
          const currentTarget = controls.target.clone();
          const currentPosition = controls.object.position.clone();

          // Disable damping temporarily
          controls.enableDamping = false;
          controls.target.set(
            currentTarget.x,
            currentTarget.y,
            currentTarget.z
          );
          controls.object.position.set(
            currentPosition.x,
            currentPosition.y,
            currentPosition.z
          );
          controls.update();

          // Re-enable damping after ensuring position is locked
          requestAnimationFrame(() => {
            if (controls) {
              controls.enableDamping = true;
              controls.dampingFactor = 0.05;
              controls.update();
            }
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle click outside tooltip to close it
  useEffect(() => {
    if (!tooltipData) return;

    const handleClickOutside = (e: MouseEvent) => {
      // Check if click is on the tooltip itself
      if (tooltipRef.current) {
        const rect = tooltipRef.current.getBoundingClientRect();
        const x = e.clientX;
        const y = e.clientY;

        // Check if click is outside the tooltip bounds
        if (
          x < rect.left ||
          x > rect.right ||
          y < rect.top ||
          y > rect.bottom
        ) {
          handleHideTooltip();
        }
      }
    };

    // Small delay to prevent immediate closing when tooltip opens
    const timeoutId = setTimeout(() => {
      // Use capture phase to catch events before Three.js
      document.addEventListener('mousedown', handleClickOutside, true);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside, true);
    };
  }, [tooltipData, handleHideTooltip]);

  // Update internal focused user when prop changes
  useEffect(() => {
    setInternalFocusedUser(focusedUser);
  }, [focusedUser]);

  // Create a stable key based on user addresses to prevent unnecessary recalculation
  const userAddressesKey = useMemo(() => {
    return sortedUsers.map(u => u.accountAddress).join(',');
  }, [sortedUsers]);

  // Calculate user positions in wide 3D space - deterministic based on user ID
  const starSystemPositions = useMemo(() => {
    if (sortedUsers.length === 0) return [];

    return sortedUsers.map((user, index) => {
      // Use user's account address as seed for deterministic positioning
      const seed = hashCode(user.accountAddress);

      // Wider circular arrangement around galactic center
      const angle = (index / sortedUsers.length) * Math.PI * 2;
      const radiusVariation = seededRandom(seed) * 60;
      const radius = 120 + radiusVariation; // 120-180 range for orbit around galaxy center
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const yVariation = (seededRandom(seed + 1) - 0.5) * 10;
      const y = yVariation; // Reduced from 30 to 10 for flatter distribution

      return {
        position: [x, y, z] as [number, number, number],
        orbitRadius: radius,
        orbitSpeed: 0.0008, // Fixed speed for all star systems
        initialAngle: angle,
      };
    });
  }, [userAddressesKey, sortedUsers.length]); // Only recalculate when user list changes

  const handlePlanetClick = (user: string, repo: string) => {
    if (onPlanetClick) {
      onPlanetClick(user, repo);
    } else {
      router.push(`/${user}/${repo}`);
    }
  };

  const handleShowStarTooltip = (user: any) => {
    setTooltipData({ type: 'star', user });
    // Start tracking the star
    setTrackingTarget({
      type: 'star',
      userId: user.accountAddress,
    });
  };

  const handleShowPlanetTooltip = (user: any, repo: any) => {
    setTooltipData({ type: 'planet', user, repo });
    // Start tracking the planet
    setTrackingTarget({
      type: 'planet',
      userId: user.accountAddress,
      repoName: repo.name,
    });
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
      {/* Search UI */}
      <div className={styles.searchContainer}>
        <div className={styles.searchInputWrapper}>
          <input
            type="text"
            value={searchQuery}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder="Search users or addresses..."
            className={styles.searchInput}
          />
          {searchQuery && (
            <button onClick={handleClearSearch} className={styles.clearButton}>
              ✕
            </button>
          )}
          {isSearching && <div className={styles.searchSpinner}>⟳</div>}
        </div>

        {/* Search Results */}
        {showSearchResults && searchResults.length > 0 && (
          <div className={styles.searchResults}>
            {searchResults.slice(0, 10).map((result, index) => (
              <div
                key={`${result.walletAddress}-${index}`}
                className={styles.searchResultItem}
                onClick={() => handleSelectUser(result)}
              >
                {result.profileImageUrl && (
                  <img
                    src={result.profileImageUrl}
                    alt="Profile"
                    className={styles.resultAvatar}
                  />
                )}
                <div className={styles.resultInfo}>
                  <div className={styles.resultDisplayName}>
                    {result.displayName}
                  </div>
                  <div className={styles.resultWalletAddress}>
                    {result.walletAddress.substring(0, 4)}...
                    {result.walletAddress.slice(-4)}
                  </div>
                  {result.twitterHandle && (
                    <div className={styles.resultTwitter}>
                      @{result.twitterHandle}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* No Results */}
        {showSearchResults &&
          searchResults.length === 0 &&
          !isSearching &&
          searchQuery.trim() && (
            <div className={styles.searchResults}>
              <div className={styles.noResults}>
                No users found for "{searchQuery}"
              </div>
            </div>
          )}
      </div>

      <Canvas
        camera={{ position: [0, 100, 300], fov: 75, near: 0.1, far: 10000 }}
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
          radius={3000}
          depth={200}
          count={8000}
          factor={8}
          saturation={1.0}
          fade={false}
        />

        {/* Galactic Center */}
        <GalacticCenter />

        {/* WASD keyboard controls - disabled during tracking */}
        <KeyboardControls speed={50} enabled={!trackingTarget} />

        {/* Camera controls */}
        <CameraController
          ref={cameraControllerRef}
          focusedUser={internalFocusedUser}
          users={sortedUsers}
          userPositions={starSystemPositions.map(s => s.position)}
          trackingTarget={trackingTarget}
          starSystemRefs={starSystemRefs}
        />

        {/* Render star systems with galactic orbit */}
        {sortedUsers.map((user, index) => {
          const systemData = starSystemPositions[index];
          return (
            <OrbitingStarSystem
              key={user.accountAddress}
              systemData={systemData}
              user={user}
              onPlanetClick={handlePlanetClick}
              onPlanetHover={handlePlanetHover}
              onPlanetLeave={handlePlanetLeave}
              onShowStarTooltip={handleShowStarTooltip}
              onShowPlanetTooltip={handleShowPlanetTooltip}
              onHideTooltip={handleHideTooltip}
              isFocused={
                internalFocusedUser === user.accountAddress ||
                internalFocusedUser === user.nickname
              }
              currentWallet={currentWallet}
              onRef={ref => {
                if (ref) {
                  starSystemRefs.current.set(user.accountAddress, ref);
                } else {
                  starSystemRefs.current.delete(user.accountAddress);
                }
              }}
            />
          );
        })}

        {/* Render comets */}
        {comets.map(id => (
          <Comet key={id} id={id} onComplete={handleCometComplete} />
        ))}

        {/* Render star connections */}
        {starConnections.map(conn => (
          <StarConnectionWrapper
            key={conn.id}
            connection={conn}
            users={sortedUsers}
            starSystemRefs={starSystemRefs}
          />
        ))}
      </Canvas>

      {/* Fixed bottom tooltip */}
      {tooltipData && (
        <div className={styles.fixedTooltip} ref={tooltipRef}>
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
