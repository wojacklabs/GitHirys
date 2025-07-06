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
}

export default function VisibilityManager({
  repositoryName,
  owner,
  currentWallet,
  uploader,
}: VisibilityManagerProps) {
  const [visibility, setVisibility] = useState<RepositoryVisibility | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  // 현재 지갑이 소유자인지 확인
  const isOwner = currentWallet === owner;

  // 노출 권한 정보 로드
  useEffect(() => {
    const loadVisibility = async () => {
      try {
        setIsLoading(true);

        const visibilityInfo = await getRepositoryVisibility(
          repositoryName,
          owner
        );
        setVisibility(visibilityInfo);
      } catch (err) {
        console.error('노출 권한 정보 로드 오류:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadVisibility();
  }, [repositoryName, owner]);

  // 노출 권한 업데이트
  const handleVisibilityUpdate = async (
    newVisibility: 'public' | 'private'
  ) => {
    if (!isOwner || !uploader) return;

    try {
      setIsUpdating(true);

      const result = await updateRepositoryVisibility(uploader, {
        repository: repositoryName,
        owner,
        visibility: newVisibility,
        existingRootTxId: visibility?.rootTxId,
      });

      if (result.success) {
        // 노출 권한 정보 새로고침
        setTimeout(async () => {
          const updatedVisibility = await getRepositoryVisibility(
            repositoryName,
            owner
          );
          setVisibility(updatedVisibility);
        }, 1000);
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
            visibility?.visibility === 'public' ? styles.active : ''
          }`}
        >
          Public
        </button>
        <button
          onClick={() => handleVisibilityUpdate('private')}
          disabled={isUpdating}
          className={`${styles.toggleButton} ${
            visibility?.visibility === 'private' ? styles.active : ''
          }`}
        >
          Private
        </button>
      </div>
    </div>
  );
}
