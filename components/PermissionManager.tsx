import { useState, useEffect, useRef } from 'react';
import {
  getRepositoryPermissions,
  updateRepositoryPermissions,
  searchUsers,
  getProfileByAddress,
  RepositoryPermissions,
  UserSearchResult,
  UserProfile,
} from '../lib/irys';
import styles from '../styles/PermissionManager.module.css';

interface PermissionManagerProps {
  repositoryName: string;
  owner: string;
  currentWallet?: string;
  uploader: any;
  initialPermissions?: RepositoryPermissions | null;
  onPermissionsUpdate?: () => void;
}

interface ContributorWithProfile {
  address: string;
  profile?: UserProfile;
}

export default function PermissionManager({
  repositoryName,
  owner,
  currentWallet,
  uploader,
  initialPermissions,
  onPermissionsUpdate,
}: PermissionManagerProps) {
  const [permissions, setPermissions] = useState<RepositoryPermissions | null>(
    null
  );
  const [contributors, setContributors] = useState<ContributorWithProfile[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // 사용자 검색 관련 상태
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  const isOwner = currentWallet === owner;

  // 권한 정보 로드
  useEffect(() => {
    const loadPermissions = async () => {
      try {
        setIsLoading(true);

        // initialPermissions가 있으면 사용, 없으면 로드
        let permissionsData = initialPermissions;

        if (!permissionsData) {
          permissionsData = await getRepositoryPermissions(
            repositoryName,
            owner
          );
        }

        setPermissions(permissionsData);

        if (permissionsData) {
          // 각 contributor의 프로필 정보를 순차적으로 가져옴 (프로필과 동일한 방식)
          const contributorsWithProfiles: ContributorWithProfile[] = [];

          for (const address of permissionsData.contributors) {
            const profile = await getProfileByAddress(address);
            contributorsWithProfiles.push({
              address,
              profile: profile || undefined,
            });
          }

          setContributors(contributorsWithProfiles);
        }
      } catch (error) {
        console.error('권한 정보 로딩 오류:', error);
        setMessage({
          type: 'error',
          text: 'Failed to load permission.',
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (repositoryName && owner) {
      loadPermissions();
    }
  }, [repositoryName, owner, initialPermissions]);

  // 사용자 검색
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchUsers(searchQuery.trim());
        setSearchResults(results);
        setShowSearchResults(true);
      } catch (error) {
        console.error('사용자 검색 오류:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // 사용자 추가
  const handleAddUser = (user: UserSearchResult) => {
    const userAddress = user.walletAddress;

    // 이미 추가된 사용자인지 확인
    if (contributors.some(contributor => contributor.address === userAddress)) {
      setMessage({ type: 'error', text: 'Already authorized' });
      return;
    }

    // 새 사용자 추가
    const newContributor: ContributorWithProfile = {
      address: userAddress,
      profile: user.nickname
        ? {
            nickname: user.nickname,
            twitterHandle: user.twitterHandle || '',
            accountAddress: userAddress,
            profileImageUrl: user.profileImageUrl,
            timestamp: Date.now(),
          }
        : undefined,
    };

    setContributors(prev => [...prev, newContributor]);
    setSearchQuery('');
    setShowSearchResults(false);
    setMessage({
      type: 'success',
      text: `Added ${user.displayName}`,
    });
  };

  // 사용자 제거
  const handleRemoveUser = (address: string) => {
    if (address === owner) {
      setMessage({
        type: 'error',
        text: `Can't edit owner.`,
      });
      return;
    }

    setContributors(prev =>
      prev.filter(contributor => contributor.address !== address)
    );
    setMessage({ type: 'success', text: 'User removed.' });
  };

  // 권한 저장
  const handleSavePermissions = async () => {
    if (!uploader || !permissions) return;

    try {
      setIsSaving(true);
      setMessage(null);

      const contributorAddresses = contributors.map(c => c.address);

      const result = await updateRepositoryPermissions(uploader, {
        repository: repositoryName,
        owner: owner,
        contributors: contributorAddresses,
      });

      if (result.success) {
        setMessage({
          type: 'success',
          text: 'Permission updated',
        });
        // 권한 정보 새로고침
        const updatedPermissions = await getRepositoryPermissions(
          repositoryName,
          owner
        );
        setPermissions(updatedPermissions);

        // 부모 컴포넌트에 업데이트 알림
        if (onPermissionsUpdate) {
          onPermissionsUpdate();
        }
      } else {
        setMessage({
          type: 'error',
          text: result.error || 'Permission update failed.',
        });
      }
    } catch (error) {
      console.error('권한 저장 오류:', error);
      setMessage({ type: 'error', text: 'Error updating permission.' });
    } finally {
      setIsSaving(false);
    }
  };

  // 변경 취소
  const handleCancel = () => {
    if (permissions) {
      // 원래 상태로 복원
      const originalContributors = permissions.contributors.map(address => ({
        address,
        profile: contributors.find(c => c.address === address)?.profile,
      }));
      setContributors(originalContributors);
      setMessage(null);
    }
  };

  if (isLoading) {
    return (
      <div className={styles.permissionSection}>
        <p>Fetching Permissions...</p>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className={styles.permissionSection}>
        <div className={styles.ownerOnlyMessage}>
          Only the owner can manage permissions.
        </div>

        {/* 현재 권한자 목록 표시 (읽기 전용) */}
        <div className={styles.contributorsList}>
          <h4 className={styles.contributorsTitle}>Contributors</h4>
          {contributors.map(contributor => (
            <div key={contributor.address} className={styles.contributorItem}>
              <div className={styles.contributorInfo}>
                {contributor.profile?.profileImageUrl ? (
                  <img
                    src={contributor.profile.profileImageUrl}
                    alt="프로필"
                    className={styles.contributorAvatar}
                  />
                ) : (
                  <div className={styles.contributorAvatarPlaceholder}>
                    {contributor.profile?.nickname?.charAt(0).toUpperCase() ||
                      '👤'}
                  </div>
                )}
                <div className={styles.contributorDetails}>
                  <div className={styles.contributorName}>
                    {contributor.profile?.nickname ||
                      `${contributor.address.substring(0, 8)}...`}
                    {contributor.address === owner && (
                      <span className={styles.ownerBadge}>Owner</span>
                    )}
                  </div>
                  <div className={styles.contributorAddress}>
                    {contributor.address}
                  </div>
                  {contributor.profile?.twitterHandle && (
                    <div className={styles.contributorTwitter}>
                      @{contributor.profile.twitterHandle}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const hasChanges =
    permissions &&
    JSON.stringify(contributors.map(c => c.address).sort()) !==
      JSON.stringify(permissions.contributors.sort());

  return (
    <div className={styles.permissionSection}>
      {/* 상태 메시지 */}
      {message && (
        <div
          className={`${styles.statusMessage} ${message.type === 'success' ? styles.successMessage : styles.errorMessage}`}
        >
          {message.text}
        </div>
      )}

      {/* 현재 권한자 목록 */}
      <div className={styles.contributorsList}>
        <h4 className={styles.contributorsTitle}>
          Contributor ({contributors.length})
        </h4>
        {contributors.map(contributor => (
          <div key={contributor.address} className={styles.contributorItem}>
            <div className={styles.contributorInfo}>
              {contributor.profile?.profileImageUrl ? (
                <img
                  src={contributor.profile.profileImageUrl}
                  alt="프로필"
                  className={styles.contributorAvatar}
                />
              ) : (
                <div className={styles.contributorAvatarPlaceholder}>
                  {contributor.profile?.nickname?.charAt(0).toUpperCase() ||
                    '👤'}
                </div>
              )}
              <div className={styles.contributorDetails}>
                <div className={styles.contributorName}>
                  {contributor.profile?.nickname ||
                    `${contributor.address.substring(0, 8)}...`}
                  {contributor.address === owner && (
                    <span className={styles.ownerBadge}>Owner</span>
                  )}
                </div>
                <div className={styles.contributorAddress}>
                  {contributor.address}
                </div>
                {contributor.profile?.twitterHandle && (
                  <div className={styles.contributorTwitter}>
                    @{contributor.profile.twitterHandle}
                  </div>
                )}
              </div>
            </div>
            {contributor.address !== owner && (
              <button
                onClick={() => handleRemoveUser(contributor.address)}
                className={styles.removeButton}
                disabled={isSaving}
              >
                delete
              </button>
            )}
          </div>
        ))}
      </div>

      {/* 사용자 추가 섹션 */}
      <div className={styles.addUserSection}>
        <h4 className={styles.addUserTitle}>Add Contributor</h4>
        <div className={styles.searchContainer}>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Nickname or Sol Address..."
            className={styles.searchInput}
            disabled={isSaving}
          />

          {/* 검색 결과 */}
          {showSearchResults && (
            <div className={styles.searchResults}>
              {isSearching ? (
                <div className={styles.searchingMessage}>Searching...</div>
              ) : searchResults.length > 0 ? (
                searchResults.map((user, index) => (
                  <div
                    key={index}
                    onClick={() => handleAddUser(user)}
                    className={styles.searchResultItem}
                  >
                    {user.profileImageUrl ? (
                      <img
                        src={user.profileImageUrl}
                        alt="프로필"
                        className={styles.searchResultAvatar}
                      />
                    ) : (
                      <div
                        className={styles.contributorAvatarPlaceholder}
                        style={{
                          width: '24px',
                          height: '24px',
                          fontSize: '12px',
                        }}
                      >
                        {user.nickname?.charAt(0).toUpperCase() || '👤'}
                      </div>
                    )}
                    <div className={styles.searchResultDetails}>
                      <div className={styles.searchResultName}>
                        {user.displayName}
                      </div>
                      <div className={styles.searchResultInfo}>
                        {user.type === 'nickname'
                          ? `Wallet: ${user.walletAddress.substring(0, 8)}...`
                          : 'Wallet Address'}
                        {user.twitterHandle && ` • @${user.twitterHandle}`}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className={styles.noResultsMessage}>No results found</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 저장/취소 버튼 */}
      {hasChanges && (
        <div className={styles.saveSection}>
          <button
            onClick={handleSavePermissions}
            disabled={isSaving}
            className={styles.saveButton}
          >
            {isSaving ? (
              <>
                <div className={styles.loadingSpinner}></div>
                Saving...
              </>
            ) : (
              'Save'
            )}
          </button>
          <button
            onClick={handleCancel}
            disabled={isSaving}
            className={styles.cancelButton}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
