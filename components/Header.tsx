import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useClientWallet, useClientWalletModal } from '../lib/useClientWallet';
import Link from 'next/link';
import {
  createIrysUploader,
  getProfileByAddress,
  searchRepositories,
  getProfileByNickname,
  ProfileUtils,
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

  // 프로필 이미지 로드
  useEffect(() => {
    const loadProfileImage = async () => {
      if (!wallet.connected || !wallet.publicKey) {
        setProfileImage(null);
        return;
      }

      try {
        const profile = await getProfileByAddress(wallet.publicKey.toBase58());
        if (profile?.profileImageUrl) {
          setProfileImage(profile.profileImageUrl);
        } else {
          setProfileImage(null);
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
        if (!ProfileUtils.isValidNickname(searchQuery.trim())) {
          setSearchError(
            'Not a valid nickname. (3-20 english letter, number, underbar)'
          );
          return;
        }

        try {
          const profile = await getProfileByNickname(searchQuery.trim());
          if (profile) {
            setSearchResults([
              {
                ...profile,
                type: 'profile',
              },
            ]);
            setShowSearchResults(true);
          } else {
            setSearchError(`Nickname called '${searchQuery}' not found`);
          }
        } catch (error) {
          setSearchError('Error occurred while searching');
        }
      } else {
        if (wallet.publicKey) {
          const publicKeyString = wallet.publicKey.toBase58();
          const repos = await searchRepositories(
            publicKeyString,
            publicKeyString
          );
          const matchingRepos = repos.filter(repo =>
            repo.name.toLowerCase().includes(searchQuery.toLowerCase())
          );

          if (matchingRepos.length > 0) {
            setSearchResults(
              matchingRepos.map(repo => ({
                ...repo,
                type: 'repository',
              }))
            );
            setShowSearchResults(true);
          } else {
            setSearchError(`Repository called '${searchQuery}' not found`);
          }
        } else {
          setSearchError('Connect your wallet to search repositories.');
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
                          by {result.owner.substring(0, 8)}...
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
                            <span className={styles.dropdownIcon}>👤</span>
                            My Profile
                          </Link>
                          <Link
                            href={`/${wallet.publicKey?.toBase58()}`}
                            className={styles.dropdownItem}
                          >
                            <span className={styles.dropdownIcon}>📁</span>
                            My Repositories
                          </Link>
                        </>
                      )}

                      <div className={styles.dropdownDivider} />

                      <button
                        onClick={handleDisconnect}
                        className={`${styles.dropdownItem} ${styles.disconnectButton}`}
                      >
                        <span className={styles.dropdownIcon}>🔌</span>
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
