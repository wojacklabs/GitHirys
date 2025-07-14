// components/RepoList.tsx
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import {
  searchRepositories,
  testIrysConnection,
  Repository,
  RepoBranch,
  TimestampUtils,
} from '../lib/irys';
import styles from '../styles/RepoList.module.css';

export default function RepoList({
  uploader,
  owner,
  currentWallet,
}: {
  uploader: any | null; // Optional Irys uploader type
  owner: string;
  currentWallet?: string; // 현재 연결된 지갑 주소
}) {
  const router = useRouter();
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const [searchProgress, setSearchProgress] = useState<string>('');
  const [selectedBranches, setSelectedBranches] = useState<{
    [repoName: string]: string;
  }>({});

  const addDebugInfo = (message: string) => {
    setDebugInfo(prev => [
      ...prev,
      `${new Date().toLocaleTimeString('en-US')}: ${message}`,
    ]);
    setSearchProgress(message);
  };

  const handleRepoClick = (repo: Repository, branch?: RepoBranch) => {
    const selectedBranch =
      branch ||
      repo.branches.find(b => b.name === repo.defaultBranch) ||
      repo.branches[0];

    // 선택된 저장소와 브랜치 정보를 sessionStorage에 저장
    if (typeof window !== 'undefined') {
      const repoData = {
        name: repo.name,
        cid: selectedBranch.transactionId,
        tags: selectedBranch.tags,
        timestamp: selectedBranch.timestamp,
        owner: repo.owner,
        repository: repo,
        selectedBranch: selectedBranch,
        isLatest: true, // 최신 데이터임을 나타내는 플래그
      };
      sessionStorage.setItem('selectedRepo', JSON.stringify(repoData));
    }

    // 현재 URL에서 사용자 식별자 추출 (닉네임 또는 지갑 주소)
    const currentPath = router.asPath;
    const userIdentifier = currentPath.split('/')[1]; // /user 형태에서 user 부분 추출

    // 새로운 URL 구조로 이동: /사용자식별자/저장소명
    router.push(`/${userIdentifier}/${repo.name}`);
  };

  const handleBranchChange = (repoName: string, branchName: string) => {
    setSelectedBranches(prev => ({
      ...prev,
      [repoName]: branchName,
    }));
  };

  useEffect(() => {
    const loadRepos = async () => {
      try {
        setLoading(true);
        setError(null);
        setDebugInfo([]);

        addDebugInfo(`🔍 Searching repositories for ${owner}...`);

        // Test connection first
        addDebugInfo('🌐 Connecting to Irys network...');
        const canConnect = await testIrysConnection();
        addDebugInfo(
          canConnect ? '✅ Connected to Irys' : '❌ Failed to connect to Irys'
        );

        // Search repositories using enhanced GraphQL API
        addDebugInfo('📂 Fetching repository data...');
        const foundRepos = await searchRepositories(owner, currentWallet);

        if (foundRepos.length > 0) {
          const totalBranches = foundRepos.reduce(
            (sum, repo) => sum + repo.branches.length,
            0
          );
          addDebugInfo(
            `✅ Found ${foundRepos.length} repositories with ${totalBranches} branches`
          );

          // 각 저장소의 기본 브랜치를 선택된 브랜치로 설정
          const initialSelectedBranches: { [repoName: string]: string } = {};
          foundRepos.forEach(repo => {
            initialSelectedBranches[repo.name] = repo.defaultBranch;
          });
          setSelectedBranches(initialSelectedBranches);

          // Log details for debugging
          foundRepos.forEach((repo, idx) => {
            addDebugInfo(
              `📦 ${repo.name} (${repo.branches.length} ${repo.branches.length === 1 ? 'branch' : 'branches'})`
            );
          });
        } else {
          addDebugInfo('❌ No repositories found');
        }

        setRepositories(foundRepos);
      } catch (error) {
        console.error('저장소 목록 로딩 오류:', error);
        const errorMessage =
          error instanceof Error
            ? error.message
            : '알 수 없는 오류가 발생했습니다.';
        setError(`Failed to fetch repositories: ${errorMessage}`);
        addDebugInfo(`❌ Error: ${errorMessage}`);
      } finally {
        setLoading(false);
        setSearchProgress('');
      }
    };

    if (owner) {
      loadRepos();
    }
  }, [owner]);

  if (loading) {
    return (
      <div>
        <h3>Repositories</h3>
        <div className={styles.repoGrid}>
          {/* Skeleton Cards */}
          {[1, 2, 3].map(index => (
            <div key={index} className="skeleton-repo-card">
              <div className="skeleton skeleton-repo-title"></div>
              <div className="skeleton-repo-meta">
                <div className="skeleton-repo-meta-line">
                  <div className="skeleton skeleton-repo-meta-label"></div>
                  <div className="skeleton skeleton-repo-meta-value"></div>
                </div>
                <div className="skeleton-repo-meta-line">
                  <div className="skeleton skeleton-repo-meta-label"></div>
                  <div className="skeleton skeleton-repo-meta-value"></div>
                </div>
                <div className="skeleton-repo-meta-line">
                  <div className="skeleton skeleton-repo-meta-label"></div>
                  <div className="skeleton skeleton-repo-meta-value"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
        {searchProgress && (
          <div className={styles.loading} style={{ marginTop: 20 }}>
            {searchProgress}
          </div>
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.error}>
        <p>{error}</p>
        <button
          onClick={() => window.location.reload()}
          className={styles.errorButton}
        >
          Retry
        </button>

        {debugInfo.length > 0 && (
          <details className={styles.debugInfo}>
            <summary className={styles.debugSummary}>Debug Info</summary>
            <div className={styles.debugContent}>
              {debugInfo.map((info, idx) => (
                <div
                  key={idx}
                  className={`${styles.debugLine} ${
                    info.includes('❌')
                      ? styles.debugLineError
                      : info.includes('✅')
                        ? styles.debugLineSuccess
                        : info.includes('⚠️')
                          ? styles.debugLineWarning
                          : styles.debugLineInfo
                  }`}
                >
                  {info}
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    );
  }

  if (!repositories.length) {
    return (
      <div>
        <p>
          {currentWallet && currentWallet === owner
            ? 'No Repository on this address.'
            : 'No Repository on this address.'}
        </p>

        {debugInfo.length > 0 && (
          <details className={styles.debugInfo}>
            <summary className={styles.debugSummary}>🔍 Search History</summary>
            <div className={styles.debugContent}>
              {debugInfo.map((info, idx) => (
                <div
                  key={idx}
                  className={`${styles.debugLine} ${
                    info.includes('❌')
                      ? styles.debugLineError
                      : info.includes('✅')
                        ? styles.debugLineSuccess
                        : info.includes('⚠️')
                          ? styles.debugLineWarning
                          : styles.debugLineInfo
                  }`}
                >
                  {info}
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    );
  }

  const formatDate = (timestamp: number) => {
    return TimestampUtils.format(timestamp, 'en-US');
  };

  return (
    <div>
      <h3>
        {currentWallet && currentWallet === owner
          ? 'My Repositories'
          : 'Repositories'}{' '}
        ({repositories.length})
      </h3>
      <div className={styles.repoGrid}>
        {repositories.map(repo => {
          const selectedBranch =
            repo.branches.find(b => b.name === selectedBranches[repo.name]) ||
            repo.branches[0];

          return (
            <div key={repo.name} className={styles.repoCard}>
              <div className={styles.repoHeader}>
                <div className={styles.repoHeaderLeft}>
                  <h4 className={styles.repoTitle}>
                    <button
                      onClick={() => handleRepoClick(repo, selectedBranch)}
                      className={styles.repoNameButton}
                    >
                      {repo.name}
                    </button>
                    <span className={styles.repoBranchCount}>
                      {repo.branches.length} branches
                    </span>
                    {selectedBranch.mutableAddress && (
                      <span className={styles.repoMutableBadge}>Mutable</span>
                    )}
                  </h4>

                  {/* 브랜치 선택 드롭다운 */}
                  <div className={styles.repoBranchSelector}>
                    <label className={styles.repoBranchLabel}>Branch :</label>
                    <select
                      value={selectedBranches[repo.name] || repo.defaultBranch}
                      onChange={e =>
                        handleBranchChange(repo.name, e.target.value)
                      }
                      className={styles.repoBranchSelect}
                    >
                      {repo.branches.map(branch => (
                        <option key={branch.name} value={branch.name}>
                          {branch.name}
                          {branch.name === repo.defaultBranch && ' (default)'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.repoMeta}>
                    <p className={styles.repoMetaRow}>
                      <b className={styles.repoMetaTitle}>Owner</b>
                      <span className={styles.repoMetaCode}>{repo.owner}</span>
                    </p>
                    {selectedBranch.commitHash && (
                      <p className={styles.repoMetaRow}>
                        <b className={styles.repoMetaTitle}>Commit hash</b>
                        <span className={styles.repoMetaCode}>
                          {selectedBranch.commitHash.substring(0, 8)}
                        </span>
                      </p>
                    )}
                    {selectedBranch.commitMessage && (
                      <p className={styles.repoMetaRow}>
                        <b className={styles.repoMetaTitle}>Commit msg</b>
                        <span className={styles.repoMetaCode}>
                          {selectedBranch.commitMessage.substring(0, 50)}
                          {selectedBranch.commitMessage.length > 50
                            ? '...'
                            : ''}
                        </span>
                      </p>
                    )}
                    {selectedBranch.author && (
                      <p className={styles.repoMetaRow}>
                        <b className={styles.repoMetaTitle}>Commiter</b>
                        <span className={styles.repoMetaCode}>
                          {selectedBranch.author}
                        </span>
                      </p>
                    )}
                    <p className={styles.repoMetaRow}>
                      <b className={styles.repoMetaTitle}>Tx ID</b>
                      <span className={styles.repoMetaCode}>
                        {selectedBranch.transactionId.substring(0, 12)}...
                      </span>
                    </p>
                    <p className={styles.repoMetaRow}>
                      <b className={styles.repoMetaTitle}>Last Updated</b>
                      {TimestampUtils.formatRelative(selectedBranch.timestamp)}
                    </p>
                  </div>
                </div>
              </div>
              <div className={styles.repoActions}>
                <button
                  onClick={() => handleRepoClick(repo, selectedBranch)}
                  className={styles.repoViewButton}
                >
                  Visit
                </button>
                <button
                  onClick={() => {
                    const currentPath = router.asPath;
                    const userIdentifier = currentPath.split('/')[1];
                    navigator.clipboard.writeText(
                      `igit clone githirys.xyz/${userIdentifier}/${repo.name}`
                    );
                  }}
                  className={styles.repoCloneButton}
                >
                  Copy Clone
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {debugInfo.length > 0 && (
        <details className={styles.debugInfo}>
          <summary className={styles.debugSummary}>🔍 Search History</summary>
          <div className={styles.debugContent}>
            {debugInfo.map((info, idx) => (
              <div
                key={idx}
                className={`${styles.debugLine} ${
                  info.includes('❌')
                    ? styles.debugLineError
                    : info.includes('✅')
                      ? styles.debugLineSuccess
                      : info.includes('⚠️')
                        ? styles.debugLineWarning
                        : styles.debugLineInfo
                }`}
              >
                {info}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
