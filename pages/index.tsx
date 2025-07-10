// pages/index.tsx
import type { NextPage } from 'next';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import { useClientWallet } from '../lib/useClientWallet';
import Head from 'next/head';
import Header from '../components/Header';
import {
  createIrysUploader,
  getRecentUsers,
  getRecentRepositories,
  RecentUser,
  RecentRepository,
} from '../lib/irys';
import styles from '../styles/HomePage.module.css';
import UniverseScene from '../components/UniverseScene';

const Home: NextPage = () => {
  const router = useRouter();
  const wallet = useClientWallet();
  const [uploader, setUploader] = useState<any>(null);

  // Recent users and repositories state
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [recentRepositories, setRecentRepositories] = useState<
    RecentRepository[]
  >([]);

  // Load recent users and repositories
  useEffect(() => {
    const loadRecentData = async () => {
      try {
        const [users, repositories] = await Promise.all([
          getRecentUsers(),
          getRecentRepositories(),
        ]);
        setRecentUsers(users);
        setRecentRepositories(repositories);
      } catch (error) {
        console.error('Recent data load error:', error);
      }
    };

    loadRecentData();
  }, []);

  // Create uploader when wallet changes
  useEffect(() => {
    const initUploader = async () => {
      if (!wallet.connected) {
        setUploader(null);
        return;
      }

      try {
        const newUploader = await createIrysUploader(wallet);
        setUploader(newUploader);
      } catch (error) {
        console.error('Irys uploader creation failed:', error);
        setUploader(null);
      }
    };

    initUploader();
  }, [wallet.connected, wallet]);

  // Prepare user data for 3D universe environment - group repositories by user
  const universeUsers = useMemo(() => {
    const userMap = new Map();

    // Add recentUsers first (initialize with empty repositories array)
    recentUsers.forEach(user => {
      userMap.set(user.accountAddress, {
        accountAddress: user.accountAddress,
        nickname: user.nickname,
        profileImageUrl: user.profileImageUrl,
        repositories: [],
      });
    });

    // Group recentRepositories by user and add them
    recentRepositories.forEach(repo => {
      if (userMap.has(repo.owner)) {
        // Add to existing user's repositories
        userMap.get(repo.owner).repositories.push(repo);
      } else {
        // Create new user
        userMap.set(repo.owner, {
          accountAddress: repo.owner,
          nickname: repo.owner,
          repositories: [repo],
        });
      }
    });

    return Array.from(userMap.values());
  }, [recentUsers, recentRepositories]);

  // Use only actual user data (remove dummy data)
  const finalUniverseUsers = universeUsers;

  const handlePlanetClick = (user: string, repo: string) => {
    router.push(`/${user}/${repo}`);
  };

  return (
    <>
      <Head>
        <title>GitHirys - 3D Universe</title>
      </Head>

      <div className="container">
        <Header />

        {/* 3D Universe Environment */}
        <div className={styles.universeContainer}>
          <UniverseScene
            users={finalUniverseUsers}
            onPlanetClick={handlePlanetClick}
          />
        </div>
      </div>
    </>
  );
};

export default Home;
