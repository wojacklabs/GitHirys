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

// Camera controller with smooth animation
function CameraController({
  focusedUser,
  users,
  userPositions,
}: {
  focusedUser?: string;
  users: any[];
  userPositions: [number, number, number][];
}) {
  const controlsRef = useRef<any>();
  const targetPosition = useRef(new THREE.Vector3());
  const cameraPosition = useRef(new THREE.Vector3());
  const isAnimating = useRef(false);

  useEffect(() => {
    if (focusedUser && controlsRef.current && users.length > 0) {
      // Find focused user position
      const userIndex = users.findIndex(
        u => u.accountAddress === focusedUser || u.nickname === focusedUser
      );

      if (userIndex !== -1 && userPositions[userIndex]) {
        const [x, y, z] = userPositions[userIndex];

        // Set target position for smooth animation
        targetPosition.current.set(x, y, z);

        // Position camera at a good viewing distance
        const cameraOffset = new THREE.Vector3(30, 20, 30);
        cameraPosition.current.copy(targetPosition.current).add(cameraOffset);

        isAnimating.current = true;

        // Smooth animation to target
        const animateCamera = () => {
          if (controlsRef.current && isAnimating.current) {
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
          }
        };

        requestAnimationFrame(animateCamera);
      }
    }
  }, [focusedUser, users, userPositions]);

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={true}
      enableZoom={true}
      enableRotate={true}
      minDistance={10}
      maxDistance={800}
      autoRotate={!focusedUser && !isAnimating.current}
      autoRotateSpeed={0.1}
      enableDamping={true}
      dampingFactor={0.05}
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
  const handleSelectUser = useCallback((result: UserSearchResult) => {
    setInternalFocusedUser(result.walletAddress);
    setSearchQuery(result.displayName);
    setShowSearchResults(false);
  }, []);

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
  }, []);

  // Update internal focused user when prop changes
  useEffect(() => {
    setInternalFocusedUser(focusedUser);
  }, [focusedUser]);

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
        <CameraController
          focusedUser={internalFocusedUser}
          users={validUsers}
          userPositions={starSystemPositions}
        />

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
              internalFocusedUser === user.accountAddress ||
              internalFocusedUser === user.nickname
            }
            currentWallet={currentWallet}
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
