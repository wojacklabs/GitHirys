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
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // 현재 지갑이 소유자인지 확인
  const isOwner = currentWallet === owner;

  // 노출 권한 정보 로드
  useEffect(() => {
    const loadVisibility = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const visibilityInfo = await getRepositoryVisibility(
          repositoryName,
          owner
        );
        setVisibility(visibilityInfo);
      } catch (err) {
        console.error('노출 권한 정보 로드 오류:', err);
        setError('노출 권한 정보를 불러오는데 실패했습니다.');
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
      setError(null);
      setSuccessMessage(null);

      const result = await updateRepositoryVisibility(uploader, {
        repository: repositoryName,
        owner,
        visibility: newVisibility,
        existingRootTxId: visibility?.rootTxId,
      });

      if (result.success) {
        setSuccessMessage(
          `저장소가 ${newVisibility === 'public' ? '공개' : '비공개'}로 설정되었습니다.`
        );

        // 노출 권한 정보 새로고침
        setTimeout(async () => {
          const updatedVisibility = await getRepositoryVisibility(
            repositoryName,
            owner
          );
          setVisibility(updatedVisibility);
        }, 1000);
      } else {
        setError(result.error || '노출 권한 업데이트에 실패했습니다.');
      }
    } catch (err) {
      console.error('노출 권한 업데이트 오류:', err);
      setError('노출 권한 업데이트 중 오류가 발생했습니다.');
    } finally {
      setIsUpdating(false);
    }
  };

  // 소유자가 아닌 경우 표시하지 않음
  if (!isOwner) {
    return null;
  }

  return (
    <div className={styles.visibilityManager}>
      <h3 className={styles.title}>👁️ 저장소 노출 권한</h3>

      {isLoading ? (
        <div className={styles.loading}>
          <p>노출 권한 정보를 불러오는 중...</p>
        </div>
      ) : (
        <div className={styles.content}>
          <div className={styles.currentStatus}>
            <p className={styles.statusLabel}>현재 노출 상태:</p>
            <div
              className={`${styles.statusBadge} ${visibility?.visibility === 'public' ? styles.public : styles.private}`}
            >
              {visibility?.visibility === 'public'
                ? '🌐 Public (공개)'
                : '🔒 Private (비공개)'}
            </div>
          </div>

          <div className={styles.description}>
            <p className={styles.descriptionText}>
              {visibility?.visibility === 'public'
                ? '누구나 이 저장소를 볼 수 있습니다.'
                : '편집 권한이 있는 사용자만 이 저장소를 볼 수 있습니다.'}
            </p>
          </div>

          {successMessage && (
            <div className={styles.successMessage}>✅ {successMessage}</div>
          )}

          {error && <div className={styles.errorMessage}>❌ {error}</div>}

          <div className={styles.actions}>
            <button
              onClick={() => handleVisibilityUpdate('public')}
              disabled={isUpdating || visibility?.visibility === 'public'}
              className={`${styles.button} ${styles.publicButton}`}
            >
              {isUpdating ? '업데이트 중...' : '🌐 Public으로 설정'}
            </button>

            <button
              onClick={() => handleVisibilityUpdate('private')}
              disabled={isUpdating || visibility?.visibility === 'private'}
              className={`${styles.button} ${styles.privateButton}`}
            >
              {isUpdating ? '업데이트 중...' : '🔒 Private로 설정'}
            </button>
          </div>

          <div className={styles.info}>
            <h4 className={styles.infoTitle}>💡 노출 권한 설명</h4>
            <ul className={styles.infoList}>
              <li>
                <strong>🌐 Public (공개):</strong> 누구나 저장소를 볼 수
                있습니다.
              </li>
              <li>
                <strong>🔒 Private (비공개):</strong> 편집 권한이 있는 사용자만
                저장소를 볼 수 있습니다.
              </li>
              <li>
                Private 저장소는 지갑을 연결하지 않은 사용자에게는 표시되지
                않습니다.
              </li>
              <li>소유자는 항상 자신의 저장소를 볼 수 있습니다.</li>
            </ul>
          </div>

          {visibility?.mutableAddress && (
            <div className={styles.technicalInfo}>
              <h4 className={styles.technicalTitle}>🔧 기술 정보</h4>
              <p className={styles.technicalText}>
                Mutable 주소:{' '}
                <code className={styles.code}>{visibility.mutableAddress}</code>
              </p>
              <p className={styles.technicalText}>
                마지막 업데이트:{' '}
                {new Date(visibility.timestamp * 1000).toLocaleString('en-US')}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
