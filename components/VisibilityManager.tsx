import { useState, useEffect } from 'react';
import {
  getRepositoryVisibility,
  updateRepositoryVisibility,
  RepositoryVisibility,
} from '../lib/irys';
import styles from '../styles/VisibilityManager.module.css';

interface VisibilityManagerProps {
  repositoryName: string;
  owner: string;
  currentWallet?: string;
  uploader?: any;
  initialVisibility?: 'public' | 'private';
}

export default function VisibilityManager({
  repositoryName,
  owner,
  currentWallet,
  uploader,
  initialVisibility,
}: VisibilityManagerProps) {
  const [visibility, setVisibility] = useState<RepositoryVisibility | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  // 현재 지갑이 소유자인지 확인
  const isOwner = currentWallet === owner;

  // 현재 가시성 상태 (기본값은 'public')
  const currentVisibility = visibility?.visibility || 'public';

  // 노출 권한 정보 로드
  useEffect(() => {
    const loadVisibility = async () => {
      try {
        setIsLoading(true);

        const visibilityInfo = await getRepositoryVisibility(
          repositoryName,
          owner
        );

        console.log('Visibility loaded:', visibilityInfo);

        // null인 경우 기본값 설정
        if (!visibilityInfo) {
          setVisibility({
            repository: repositoryName,
            owner,
            visibility: 'public',
            timestamp: Date.now(),
          });
        } else {
          setVisibility(visibilityInfo);
        }
      } catch (err) {
        console.error('노출 권한 정보 로드 오류:', err);
        // 오류 발생 시 기본값 설정
        setVisibility({
          repository: repositoryName,
          owner,
          visibility: 'public',
          timestamp: Date.now(),
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (repositoryName && owner) {
      loadVisibility();
    }
  }, [repositoryName, owner]);

  // 노출 권한 업데이트
  const handleVisibilityUpdate = async (
    newVisibility: 'public' | 'private'
  ) => {
    if (!isOwner || !uploader || currentVisibility === newVisibility) return;

    try {
      setIsUpdating(true);

      const result = await updateRepositoryVisibility(uploader, {
        repository: repositoryName,
        owner,
        visibility: newVisibility,
      });

      if (result.success) {
        console.log('Visibility updated successfully:', newVisibility);

        // 즉시 UI 상태 업데이트
        setVisibility(prev => ({
          repository: repositoryName,
          owner,
          visibility: newVisibility,
          rootTxId: result.txId,
          timestamp: Date.now(),
        }));

        // 백그라운드에서 서버 데이터 새로고침
        setTimeout(async () => {
          try {
            const updatedVisibility = await getRepositoryVisibility(
              repositoryName,
              owner
            );
            if (updatedVisibility) {
              console.log(
                'Visibility refreshed from server:',
                updatedVisibility
              );
              setVisibility(updatedVisibility);
            }
          } catch (err) {
            console.error('백그라운드 새로고침 오류:', err);
          }
        }, 3000); // 3초 후 새로고침
      } else {
        console.error('Visibility update failed:', result.error);
      }
    } catch (err) {
      console.error('노출 권한 업데이트 오류:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  // 소유자가 아닌 경우 표시하지 않음
  if (!isOwner) {
    return null;
  }

  if (isLoading) {
    return (
      <div className={styles.toggleContainer}>
        <div className={styles.toggleLoading}>...</div>
      </div>
    );
  }

  return (
    <div className={styles.toggleContainer}>
      <div className={styles.toggleButtons}>
        <button
          onClick={() => handleVisibilityUpdate('public')}
          disabled={isUpdating}
          className={`${styles.toggleButton} ${
            currentVisibility === 'public' ? styles.active : ''
          }`}
          title={
            isUpdating
              ? 'Updating...'
              : `Set repository to ${currentVisibility === 'public' ? 'public (current)' : 'public'}`
          }
        >
          Public
        </button>
        <button
          onClick={() => handleVisibilityUpdate('private')}
          disabled={isUpdating}
          className={`${styles.toggleButton} ${
            currentVisibility === 'private' ? styles.active : ''
          }`}
          title={
            isUpdating
              ? 'Updating...'
              : `Set repository to ${currentVisibility === 'private' ? 'private (current)' : 'private'}`
          }
        >
          Private
        </button>
      </div>
      {isUpdating && (
        <div className={styles.updatingIndicator}>Updating...</div>
      )}
    </div>
  );
}
