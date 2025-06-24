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
  searchRepositoriesAsArray,
  preloadRepositoryPermissions,
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
        const currentWallet = wallet.connected
          ? wallet.publicKey?.toBase58()
          : undefined;

        // 순차적으로 각 사용자의 저장소 로드 (CORS 에러 방지)
        for (const user of recentUsers) {
          try {
            const repos = await searchRepositoriesAsArray(
              user.accountAddress,
              currentWallet
            );

            if (repos.length > 0) {
              userRepoMap.set(user.accountAddress, repos);

              // 백그라운드에서 권한 정보 미리 로드
              preloadRepositoryPermissions(repos, currentWallet).catch(err =>
                console.error('권한 미리 로드 실패:', err)
              );
            }

            // 상태 업데이트 (각 사용자별로)
            setUserRepositories(new Map(userRepoMap));
          } catch (error) {
            console.error(
              `Error loading repos for user ${user.accountAddress}:`,
              error
            );
          }
        }
      } catch (error) {
        console.error('User repositories load error:', error);
      }
    };

    loadUserRepositories();
  }, [recentUsers, wallet.connected, wallet.publicKey]);

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
        <title>GitHirys - 분산형 Git 저장소 호스팅 서비스</title>
        <meta
          property="og:title"
          content="GitHirys - 분산형 Git 저장소 호스팅 서비스"
        />
        <meta property="og:url" content="https://githirys.xyz" />
        <meta
          name="twitter:title"
          content="GitHirys - 분산형 Git 저장소 호스팅 서비스"
        />
      </Head>

      {/* 3D Universe Environment */}
      <UniverseScene
        users={universeUsers}
        onPlanetClick={handlePlanetClick}
        currentWallet={
          wallet.connected ? wallet.publicKey?.toBase58() : undefined
        }
      />
    </>
  );
};

export default Home;
