import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useClientWallet, useClientWalletModal } from '../lib/useClientWallet';
import Link from 'next/link';
import {
  createIrysUploader,
  getProfileByAddress,
  getProfileImageUrl,
  searchRepositories,
  searchAllRepositories,
  getProfileByNickname,
  ProfileUtils,
  URLUtils,
} from '../lib/irys';
import styles from './Header.module.css';

interface HeaderProps {
  onConnect?: (wallet: any, publicKey: string) => void;
  showSearch?: boolean;
}

const Header: React.FC<HeaderProps> = ({ onConnect, showSearch = true }) => {
  const wallet = useClientWallet();
  const { setVisible } = useClientWalletModal();
  const router = useRouter();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [uploader, setUploader] = useState<any>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 검색 관련 상태
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<
    'repository' | 'wallet' | 'nickname'
  >('repository');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // 지갑 연결 처리
  useEffect(() => {
    if (wallet.connected && wallet.publicKey) {
      onConnect?.(wallet, wallet.publicKey.toBase58());
      setIsConnecting(false);
    }
  }, [wallet.connected, wallet.publicKey, onConnect, wallet]);

  // Irys 업로더 초기화
  useEffect(() => {
    const initUploader = async () => {
      if (!wallet || !wallet.connected) {
        setUploader(null);
        return;
      }

      try {
        const newUploader = await createIrysUploader(wallet);
        setUploader(newUploader);
      } catch (error) {
        console.error('Irys 업로더 생성 실패:', error);
        setUploader(null);
      }
    };

    initUploader();
  }, [wallet]);

  // 프로필 이미지 로드 (개선된 버전)
  useEffect(() => {
    const loadProfileImage = async () => {
      if (!wallet.connected || !wallet.publicKey) {
        setProfileImage(null);
        return;
      }

      try {
        // 프로필 이미지 전용 함수 사용
        const imageUrl = await getProfileImageUrl(wallet.publicKey.toBase58());

        if (imageUrl) {
          setProfileImage(imageUrl);
        } else {
          // 프로필 이미지가 없는 경우 전체 프로필 조회를 통해 확인
          const profile = await getProfileByAddress(
            wallet.publicKey.toBase58()
          );
          if (profile?.profileImageUrl) {
            setProfileImage(profile.profileImageUrl);
          } else {
            setProfileImage(null);
          }
        }
      } catch (error) {
        console.error('프로필 이미지 로드 오류:', error);
        setProfileImage(null);
      }
    };

    loadProfileImage();
  }, [wallet.connected, wallet.publicKey]);

  // 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setShowSearchResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleConnect = () => {
    setIsConnecting(true);
    setVisible(true);
  };

  const handleDisconnect = async () => {
    try {
      await wallet.disconnect();
      setIsDropdownOpen(false);
    } catch (error) {
      console.error('Wallet disconnection error:', error);
    }
  };

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  // 기본 프로필 이미지 생성 (이니셜 기반)
  const generateDefaultProfileImage = () => {
    if (!wallet.publicKey) return '';

    const address = wallet.publicKey.toBase58();
    const initial = address.charAt(0).toUpperCase();

    // SVG로 기본 프로필 이미지 생성
    const svg = `
      <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
        <rect width="40" height="40" fill="#6366f1" rx="20"/>
        <text x="20" y="26" text-anchor="middle" fill="white" font-size="16" font-weight="bold" font-family="Arial, sans-serif">
          ${initial}
        </text>
      </svg>
    `;

    return `data:image/svg+xml;base64,${btoa(svg)}`;
  };

  // 솔라나 지갑 주소 형식 검증
  const isValidSolanaAddress = (address: string): boolean => {
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    return base58Regex.test(address);
  };

  // 검색 함수
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
        if (isValidSolanaAddress(searchQuery.trim())) {
          const walletAddress = searchQuery.trim();
          setSearchResults([
            {
              type: 'wallet',
              address: walletAddress,
              displayName: `${walletAddress.substring(0, 8)}...${walletAddress.slice(-4)}`,
              fullAddress: walletAddress,
            },
          ]);
          setShowSearchResults(true);
        } else {
          setSearchError('Not a valid Solana address.');
        }
      } else if (searchType === 'nickname') {
        try {
          const endpoint = 'https://uploader.irys.xyz/graphql';
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              query: `
                query getAllNicknames {
                  transactions(
                    tags: [{ name: "App-Name", values: ["irys-git-nickname"] }],
                    first: 1000,
                    order: DESC
                  ) {
                    edges {
                      node {
                        id
                        tags {
                          name
                          value
                        }
                        timestamp
                      }
                    }
                  }
                }
              `,
            }),
          });

          if (response.ok) {
            const result = await response.json();

            if (!result.errors) {
              const nicknameTransactions =
                result.data?.transactions?.edges || [];

              // 고유한 프로필 맵 생성 (중복 제거)
              const uniqueProfiles = new Map<string, any>();

              for (const edge of nicknameTransactions) {
                const node = edge.node;
                const nicknameTag = node.tags?.find(
                  (tag: any) => tag.name === 'githirys_nickname'
                );
                const accountTag = node.tags?.find(
                  (tag: any) => tag.name === 'githirys_account_address'
                );
                const twitterTag = node.tags?.find(
                  (tag: any) => tag.name === 'githirys_twitter'
                );
                const rootTxTag = node.tags?.find(
                  (tag: any) => tag.name === 'Root-TX'
                );

                if (nicknameTag && accountTag) {
                  const rootTxId = rootTxTag?.value || node.id;

                  // 안전한 프로필 이미지 URL 생성 (URLUtils 사용)
                  const profileImageUrl =
                    URLUtils.createSafeProfileImageUrl(rootTxId);

                  const profile = {
                    nickname: nicknameTag.value,
                    accountAddress: accountTag.value,
                    twitterHandle: twitterTag?.value || '',
                    profileImageUrl,
                    rootTxId,
                    timestamp: node.timestamp,
                  };

                  // 같은 지갑 주소의 최신 프로필만 유지
                  const existingProfile = uniqueProfiles.get(accountTag.value);
                  if (
                    !existingProfile ||
                    profile.timestamp > existingProfile.timestamp
                  ) {
                    uniqueProfiles.set(accountTag.value, profile);
                  }
                }
              }

              // 검색 쿼리와 매칭 처리 (case-insensitive)
              const matchingProfiles = [];
              const lowerSearchQuery = searchQuery.toLowerCase();

              for (const profile of Array.from(uniqueProfiles.values())) {
                const nickname = profile.nickname.toLowerCase();
                const walletAddress = profile.accountAddress.toLowerCase();

                if (
                  nickname.includes(lowerSearchQuery) ||
                  walletAddress.includes(lowerSearchQuery)
                ) {
                  matchingProfiles.push({
                    ...profile,
                    type: 'profile',
                  });
                }
              }

              if (matchingProfiles.length > 0) {
                setSearchResults(matchingProfiles);
                setShowSearchResults(true);
              } else {
                setSearchError(`No nickname found for '${searchQuery}'`);
              }
            } else {
              setSearchError('Error occurred while searching');
            }
          } else {
            setSearchError('Error occurred while searching');
          }
        } catch (error) {
          setSearchError('Error occurred while searching');
        }
      } else {
        const currentWallet = wallet.publicKey?.toBase58();
        const repos = await searchAllRepositories(
          searchQuery.trim(),
          currentWallet
        );

        if (repos.length > 0) {
          // 각 저장소의 소유자 닉네임 정보를 가져옴
          const reposWithNicknames = await Promise.all(
            repos.map(async repo => {
              try {
                const ownerProfile = await getProfileByAddress(repo.owner);
                return {
                  ...repo,
                  type: 'repository',
                  ownerNickname: ownerProfile?.nickname || null,
                };
              } catch (error) {
                return {
                  ...repo,
                  type: 'repository',
                  ownerNickname: null,
                };
              }
            })
          );

          setSearchResults(reposWithNicknames);
          setShowSearchResults(true);
        } else {
          setSearchError(`Repository called '${searchQuery}' not found`);
        }
      }
    } catch (error) {
      setSearchError('Error occurred while searching');
    } finally {
      setIsSearching(false);
    }
  };

  // 엔터키 처리
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // 검색 결과 클릭 처리
  const handleSearchResultClick = (result: any) => {
    if (result.type === 'profile') {
      router.push(`/${result.nickname}`);
    } else if (result.type === 'wallet') {
      router.push(`/${result.address}`);
    } else if (result.type === 'repository') {
      router.push(`/${result.owner}/${result.name}`);
    }
    setShowSearchResults(false);
    setSearchQuery('');
  };

  const currentProfileImage = profileImage || generateDefaultProfileImage();

  return (
    <header className={styles.header}>
      <div className={styles.headerContent}>
        <Link href="/" className={styles.logo}>
          <h1>GitHirys</h1>
        </Link>

        {/* 검색 섹션 */}
        {showSearch && (
          <div className={styles.searchSection} ref={searchRef}>
            <div className={styles.searchContainer}>
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
                <option value="repository">Repo</option>
                <option value="nickname">Nickname</option>
                <option value="wallet">Sol Wallet</option>
              </select>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                onFocus={() => {
                  if (searchResults.length > 0) {
                    setShowSearchResults(true);
                  }
                }}
                placeholder={
                  searchType === 'wallet'
                    ? 'Solana Address'
                    : searchType === 'nickname'
                      ? 'User Name'
                      : 'Repository Name'
                }
                className={styles.searchInput}
                disabled={isSearching}
              />
              <button
                onClick={handleSearch}
                disabled={isSearching || !searchQuery.trim()}
                className={styles.searchButton}
              >
                {isSearching ? 'Searching...' : 'Search'}
              </button>
            </div>

            {/* 검색 오류 */}
            {searchError && (
              <div className={styles.searchError}>❌ {searchError}</div>
            )}

            {/* 검색 결과 */}
            {showSearchResults && searchResults.length > 0 && (
              <div className={styles.searchResults}>
                {searchResults.map((result, index) => (
                  <div
                    key={index}
                    onClick={() => handleSearchResultClick(result)}
                    className={styles.searchResultItem}
                  >
                    {result.type === 'profile' ? (
                      <div className={styles.profileResult}>
                        {result.profileImageUrl && (
                          <img
                            src={result.profileImageUrl}
                            alt={`${result.nickname}'s profile`}
                            className={styles.profileImage}
                          />
                        )}
                        <div className={styles.profileInfo}>
                          <div className={styles.profileName}>
                            {result.nickname}
                            {result.twitterHandle && (
                              <span className={styles.profileTwitter}>
                                @{result.twitterHandle}
                              </span>
                            )}
                          </div>
                          <div className={styles.profileAddress}>
                            {result.accountAddress.substring(0, 8)}...
                            {result.accountAddress.slice(-4)}
                          </div>
                        </div>
                      </div>
                    ) : result.type === 'wallet' ? (
                      <div className={styles.walletResult}>
                        <div className={styles.walletName}>
                          {result.displayName}
                        </div>
                      </div>
                    ) : (
                      <div className={styles.repoResult}>
                        <span>📁</span>
                        <span className={styles.repoName}>{result.name}</span>
                        <span className={styles.repoOwner}>
                          by{' '}
                          {result.ownerNickname ||
                            `${result.owner.substring(0, 8)}...`}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className={styles.headerRight}>
          {wallet.connected ? (
            <div className={styles.profileSection} ref={dropdownRef}>
              <button
                onClick={toggleDropdown}
                className={styles.profileButton}
                aria-label="프로필 메뉴"
              >
                <img
                  src={currentProfileImage}
                  alt="Profile"
                  className={styles.profileImage}
                />
              </button>

              {isDropdownOpen && (
                <div className={styles.dropdown}>
                  <div className={styles.dropdownContent}>
                    <div className={styles.dropdownHeader}>
                      <img
                        src={currentProfileImage}
                        alt="Profile"
                        className={styles.dropdownProfileImage}
                      />
                      <div className={styles.walletInfo}>
                        <span className={styles.walletAddress}>
                          {wallet.publicKey?.toBase58().substring(0, 8)}...
                          {wallet.publicKey?.toBase58().slice(-4)}
                        </span>
                      </div>
                    </div>

                    <div className={styles.dropdownDivider} />

                    <div className={styles.dropdownMenu}>
                      {uploader && (
                        <>
                          <Link href="/profile" className={styles.dropdownItem}>
                            My Profile
                          </Link>
                          <Link
                            href={`/${wallet.publicKey?.toBase58()}`}
                            className={styles.dropdownItem}
                          >
                            My Repositories
                          </Link>
                        </>
                      )}

                      <a
                        href="https://irys-git-docs.vercel.app"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.dropdownItem}
                      >
                        Docs
                      </a>

                      <div className={styles.dropdownDivider} />

                      <button
                        onClick={handleDisconnect}
                        className={`${styles.dropdownItem} ${styles.disconnectButton}`}
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              className={styles.connectButton}
              onClick={handleConnect}
              disabled={isConnecting}
            >
              {isConnecting ? 'Connecting...' : 'Connect Wallet'}
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
