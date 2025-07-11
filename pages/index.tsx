// pages/index.tsx
import type { NextPage } from 'next';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import { useClientWallet } from '../lib/useClientWallet';
import Head from 'next/head';
import {
  createIrysUploader,
  getRecentUsers,
  getRecentRepositories,
  searchRepositories,
  RecentUser,
  RecentRepository,
} from '../lib/irys';
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
  const [userRepositories, setUserRepositories] = useState<Map<string, any[]>>(
    new Map()
  );

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

  // Load detailed repository data for each user
  useEffect(() => {
    const loadUserRepositories = async () => {
      if (recentUsers.length === 0) return;

      try {
        const userRepoMap = new Map<string, any[]>();

        // Load repositories for each user in parallel
        const repositoryPromises = recentUsers.map(async user => {
          try {
            const repos = await searchRepositories(user.accountAddress);
            return { userAddress: user.accountAddress, repositories: repos };
          } catch (error) {
            console.error(
              `Error loading repos for user ${user.accountAddress}:`,
              error
            );
            return { userAddress: user.accountAddress, repositories: [] };
          }
        });

        const results = await Promise.all(repositoryPromises);

        results.forEach(({ userAddress, repositories }) => {
          if (repositories.length > 0) {
            userRepoMap.set(userAddress, repositories);
          }
        });

        setUserRepositories(userRepoMap);
      } catch (error) {
        console.error('User repositories load error:', error);
      }
    };

    loadUserRepositories();
  }, [recentUsers]);

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

    // Add recentUsers first with their detailed repositories
    recentUsers.forEach(user => {
      const repositories = userRepositories.get(user.accountAddress) || [];
      userMap.set(user.accountAddress, {
        accountAddress: user.accountAddress,
        nickname: user.nickname,
        hasNickName: true, // Real nickname from user profile
        profileImageUrl: user.profileImageUrl,
        repositories: repositories,
      });
    });

    // Group remaining recentRepositories by user (only for users not already in recentUsers)
    recentRepositories.forEach(repo => {
      if (!userMap.has(repo.owner)) {
        // Create new user - no real nickname, just wallet address
        userMap.set(repo.owner, {
          accountAddress: repo.owner,
          nickname: repo.owner, // Store wallet address as placeholder
          hasNickName: false, // Indicates this is not a real nickname
          repositories: [repo],
        });
      }
    });

    return Array.from(userMap.values());
  }, [recentUsers, recentRepositories, userRepositories]);

  const handlePlanetClick = (user: string, repo: string) => {
    router.push(`/${user}/${repo}`);
  };

  return (
    <>
      <Head>
        <title>GitHirys</title>
      </Head>

      {/* 3D Universe Environment */}
      <UniverseScene users={universeUsers} onPlanetClick={handlePlanetClick} />
    </>
  );
};

export default Home;
