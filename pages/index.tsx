// pages/index.tsx
import type { NextPage } from 'next';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useClientWallet } from '../lib/useClientWallet';
import Head from 'next/head';
import Marquee from 'react-fast-marquee';
import {
  createIrysUploader,
  searchRepositories,
  searchAllRepositories,
  getProfileByNickname,
  ProfileUtils,
  getDashboardStats,
  DashboardStats,
  getRecentUsers,
  getRecentRepositories,
  RecentUser,
  RecentRepository,
} from '../lib/irys';
import styles from '../styles/HomePage.module.css';
import AnimatedNumber from '../components/AnimatedNumber';

const Home: NextPage = () => {
  const router = useRouter();
  const wallet = useClientWallet();
  const [uploader, setUploader] = useState<any>(null);

  // Dashboard statistics state
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(
    null
  );

  // Recent users and repositories state
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [recentRepositories, setRecentRepositories] = useState<
    RecentRepository[]
  >([]);

  // Search related state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<
    'repository' | 'wallet' | 'nickname'
  >('repository');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Load dashboard statistics
  useEffect(() => {
    const loadDashboardStats = async () => {
      try {
        const stats = await getDashboardStats();
        setDashboardStats(stats);
      } catch (error) {
        console.error('Dashboard statistics load error:', error);
      }
    };

    loadDashboardStats();
  }, []);

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

  // Solana wallet address format validation
  const isValidSolanaAddress = (address: string): boolean => {
    // Solana address is 32-44 character Base58 string
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    return base58Regex.test(address);
  };

  // Search function
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchError('Type something to search');
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setSearchResults([]);

    try {
      if (searchType === 'wallet') {
        // Wallet address search
        if (isValidSolanaAddress(searchQuery.trim())) {
          // Display wallet information in result list
          const walletAddress = searchQuery.trim();
          setSearchResults([
            {
              type: 'wallet',
              address: walletAddress,
              displayName: `${walletAddress.substring(0, 8)}...${walletAddress.slice(-4)}`,
              fullAddress: walletAddress,
            },
          ]);
        } else {
          setSearchError('Not a valid Solana address.');
        }
      } else if (searchType === 'nickname') {
        // Nickname search (exact match only)
        // Nickname format validation
        if (!ProfileUtils.isValidNickname(searchQuery.trim())) {
          setSearchError(
            'Not a valid nickname. (3-20 english letter, number, underbar)'
          );
          return;
        }

        try {
          // Exact nickname search
          const profile = await getProfileByNickname(searchQuery.trim());
          if (profile) {
            // Display profile in result list
            setSearchResults([
              {
                ...profile,
                type: 'profile',
              },
            ]);
          } else {
            setSearchError(`Nickname called '${searchQuery}' not found`);
          }
        } catch (error) {
          setSearchError('Error occurred while searching');
        }
      } else {
        // Repository search - search all repositories

        try {
          const currentWallet = wallet.publicKey?.toBase58() || undefined;
          const repos = await searchAllRepositories(searchQuery, currentWallet);

          if (repos.length > 0) {
            setSearchResults(
              repos.map(repo => ({
                ...repo,
                type: 'repository',
              }))
            );
          } else {
            setSearchError(`Repository called '${searchQuery}' not found`);
          }
        } catch (error) {
          setSearchError('Error occurred while searching repositories');
        }
      }
    } catch (error) {
      setSearchError('Error occurred while searching');
    } finally {
      setIsSearching(false);
    }
  };

  // Enter key handling
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Search result click handling
  const handleSearchResultClick = (result: any) => {
    if (result.type === 'profile') {
      // Navigate to nickname page for profile result
      router.push(`/${result.nickname}`);
    } else if (result.type === 'wallet') {
      // Navigate to wallet page for wallet result
      router.push(`/${result.address}`);
    } else if (result.type === 'repository') {
      // Navigate to repository page for repository result
      router.push(`/${result.owner}/${result.name}`);
    }
  };

  return (
    <>
      <Head>
        <title>GitHirys (✧ᴗ✧)</title>
      </Head>
      <div className="container">
        {/* Search section */}
        <div className={styles.area_search}>
          {/* Search input */}
          <div className={styles.area_input_search}>
            <select
              value={searchType}
              onChange={e =>
                setSearchType(
                  e.target.value as 'repository' | 'nickname' | 'wallet'
                )
              }
              className={styles.searchTypeSelect}
              disabled={isSearching}
            >
              <option value="repository">Repository</option>
              <option value="nickname">Nickname</option>
              <option value="wallet">Wallet Address(sol)</option>
            </select>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={
                searchType === 'wallet'
                  ? 'Solana Address'
                  : searchType === 'nickname'
                    ? 'User Name... ex) alice, bob123'
                    : 'Repository Name... ex) my-project'
              }
              className={styles.input_search}
              disabled={isSearching}
            />
            <button
              onClick={handleSearch}
              disabled={isSearching || !searchQuery.trim()}
              className={`${styles.button_search} ${isSearching || !searchQuery.trim() ? styles.searchButtonDisabled : styles.searchButtonActive}`}
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </div>
          {/* Search error */}
          {searchError && (
            <div className={styles.searchError}>{searchError}</div>
          )}
          {/* Search results */}
          {searchResults.length > 0 && (
            <div className={styles.searchResults}>
              <h3 className={styles.searchResultsTitle}>
                Result ({searchResults.length})
              </h3>
              <div className={styles.searchResultsGrid}>
                {searchResults.map((result, index) => (
                  <div
                    key={index}
                    onClick={() => handleSearchResultClick(result)}
                    className={styles.searchResultItem}
                  >
                    {result.type === 'profile' ? (
                      // Profile result display
                      <div className={styles.profileResult}>
                        {result.profileImageUrl && (
                          <img
                            src={result.profileImageUrl}
                            alt={`${result.nickname}'s profile`}
                            className={styles.profileImage}
                          />
                        )}
                        <div className={styles.profileInfo}>
                          <div className={styles.profileNickname}>
                            <span className={styles.profileNicknameText}>
                              {result.nickname}
                            </span>
                            {result.twitterHandle && (
                              <span className={styles.profileTwitter}>
                                @{result.twitterHandle}
                              </span>
                            )}
                          </div>
                          <div className={styles.profileWallet}>
                            Wallet Address:{' '}
                            {result.accountAddress.substring(0, 8)}...
                            {result.accountAddress.slice(-4)}
                          </div>
                        </div>
                      </div>
                    ) : result.type === 'wallet' ? (
                      // Wallet result display
                      <div className={styles.walletResult}>
                        <div>
                          <div className={styles.walletDisplayName}>
                            {result.displayName}
                          </div>
                        </div>
                      </div>
                    ) : (
                      // Repository result display
                      <div className={styles.repoResult}>
                        <span>📁</span>
                        <span className={styles.repoName}>{result.name}</span>
                        <span className={styles.repoOwner}>
                          by {result.owner.substring(0, 8)}...
                        </span>
                        <span className={styles.repoBranches}>
                          ({result.branches.length} branches)
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Recent users section */}
        <div className={styles.area_recent_users}>
          <h2 className={styles.title_recent}>Recent Users</h2>
          <div className={styles.marquee_container}>
            {recentUsers.length > 0 ? (
              <Marquee speed={30} gradient={false} pauseOnHover={true}>
                {recentUsers.map((user, index) => (
                  <div
                    key={index}
                    className={styles.recent_user_item}
                    onClick={() => router.push(`/${user.nickname}`)}
                  >
                    <div className={styles.user_image_container}>
                      {user.profileImageUrl ? (
                        <img
                          src={user.profileImageUrl}
                          alt={`${user.nickname}'s profile`}
                          className={styles.user_image}
                        />
                      ) : (
                        <div className={styles.user_image_placeholder}>
                          {user.nickname.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className={styles.user_info}>
                      <div className={styles.user_nickname}>
                        {user.nickname}
                      </div>
                      {user.twitterHandle && (
                        <div className={styles.user_twitter}>
                          @{user.twitterHandle}
                        </div>
                      )}
                      <div className={styles.user_wallet}>
                        {user.accountAddress.substring(0, 8)}...
                      </div>
                    </div>
                  </div>
                ))}
              </Marquee>
            ) : (
              <div className={styles.empty_state}>
                <div className={styles.empty_text}>No recent users found</div>
              </div>
            )}
          </div>
        </div>

        {/* Recent repositories section */}
        <div className={styles.area_recent_repositories}>
          <h2 className={styles.title_recent}>Recent Repositories</h2>
          <div className={styles.marquee_container}>
            {recentRepositories.length > 0 ? (
              <Marquee
                speed={30}
                gradient={false}
                pauseOnHover={true}
                direction="right"
              >
                {recentRepositories.map((repo, index) => (
                  <div
                    key={index}
                    className={styles.recent_repo_item}
                    onClick={() => router.push(`/${repo.owner}/${repo.name}`)}
                  >
                    <div className={styles.repo_icon}>📁</div>
                    <div className={styles.repo_info}>
                      <div className={styles.repo_name}>{repo.name}</div>
                      <div className={styles.repo_owner}>
                        by {repo.owner.substring(0, 8)}...
                      </div>
                      <div className={styles.repo_details}>
                        {repo.branchCount} branches • {repo.defaultBranch}
                      </div>
                    </div>
                  </div>
                ))}
              </Marquee>
            ) : (
              <div className={styles.empty_state}>
                <div className={styles.empty_text}>
                  No recent repositories found
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Dashboard section */}
        <div className={styles.area_dashboard}>
          <h2 className={styles.title_dashboard}>Statistics</h2>
          <ul className={styles.list_stats}>
            <li className={styles.item_stats}>
              <div className={styles.stats_number}>
                <AnimatedNumber value={dashboardStats?.repositoryCount || 0} />
              </div>
              <p className={styles.stats_name}>Repo Number</p>
            </li>
            <li className={styles.item_stats}>
              <div className={styles.stats_number}>
                <AnimatedNumber value={dashboardStats?.userCount || 0} />
              </div>
              <p className={styles.stats_name}>User Number</p>
            </li>
            <li className={styles.item_stats}>
              <div className={styles.stats_number}>
                <AnimatedNumber value={dashboardStats?.commitCount || 0} />
              </div>
              <p className={styles.stats_name}>Commit Number</p>
            </li>
          </ul>
        </div>
      </div>
    </>
  );
};

export default Home;
