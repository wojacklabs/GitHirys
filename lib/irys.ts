// lib/irys.ts
import { WebUploader } from '@irys/web-upload';
import { WebSolana } from '@irys/web-upload-solana';

// Timestamp 처리 유틸리티 함수들
export const TimestampUtils = {
  // 다양한 형식의 timestamp를 Unix timestamp (초)로 정규화
  normalize: (timestamp: any): number => {
    if (!timestamp) {
      return Math.floor(Date.now() / 1000); // 현재 시간을 기본값으로
    }

    // 이미 숫자인 경우
    if (typeof timestamp === 'number') {
      // 밀리초인지 초인지 판단 (13자리 이상이면 밀리초로 가정)
      if (timestamp.toString().length >= 13) {
        return Math.floor(timestamp / 1000); // 밀리초 → 초
      }
      return timestamp; // 이미 초 단위
    }

    // 문자열인 경우
    if (typeof timestamp === 'string') {
      // ISO 형식인지 확인
      if (timestamp.includes('T') || timestamp.includes('-')) {
        return Math.floor(new Date(timestamp).getTime() / 1000);
      }
      // 숫자 문자열인 경우
      const num = parseInt(timestamp, 10);
      if (!isNaN(num)) {
        return TimestampUtils.normalize(num);
      }
    }

    // 파싱할 수 없는 경우 현재 시간 반환
    return Math.floor(Date.now() / 1000);
  },

  // Unix timestamp (초)를 Date 객체로 변환
  toDate: (timestamp: any): Date => {
    const normalizedTimestamp = TimestampUtils.normalize(timestamp);
    return new Date(normalizedTimestamp * 1000);
  },

  // Unix timestamp (초)를 로케일 형식으로 포맷
  format: (timestamp: any, locale: string = 'en-US'): string => {
    const date = TimestampUtils.toDate(timestamp);
    return date.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  },

  // Unix timestamp (초)를 상대 시간으로 포맷 (예: "2시간 전")
  formatRelative: (timestamp: any): string => {
    const now = Math.floor(Date.now() / 1000);
    const normalizedTimestamp = TimestampUtils.normalize(timestamp);
    const diff = now - normalizedTimestamp;

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} mins ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    if (diff < 2592000) return `${Math.floor(diff / 86400)} days ago`;
    if (diff < 31536000) return `${Math.floor(diff / 2592000)} months ago`;
    return `${Math.floor(diff / 31536000)} years ago`;
  },

  // 디버깅용 - timestamp 정보 출력 (개발환경에서만)
  debug: (timestamp: any, label: string = 'timestamp'): void => {
    if (process.env.NODE_ENV === 'development') {
      // 개발환경에서의 디버깅 로그 제거
    }
  },
};

// 브랜치 정보를 포함한 인터페이스 정의
export interface RepoBranch {
  name: string;
  transactionId: string;
  mutableAddress: string | null;
  timestamp: number; // 항상 Unix timestamp (초) 형식
  commitHash?: string;
  commitMessage?: string;
  author?: string;
  tags: any[];
}

export interface Repository {
  name: string;
  owner: string;
  branches: RepoBranch[];
  defaultBranch: string;
  tags: any[];
}

// 브랜치 트랜잭션 데이터 타입 정의
interface BranchTransactionData {
  name: string;
  transactionId: string;
  mutableAddress: string | null;
  timestamp: string;
  commitHash: string;
  commitMessage: string;
  author: string;
  tags: any[];
  nodeTimestamp: number;
}

export async function createIrysUploader(wallet?: any) {
  try {
    if (!wallet) {
      // For read-only operations without wallet
      return await WebUploader(WebSolana);
    }

    if (!wallet.connected) {
      throw new Error('Wallet not connected');
    }

    // Use the wallet object directly with withProvider as per documentation
    const irysUploader = await WebUploader(WebSolana).withProvider(wallet);

    return irysUploader;
  } catch (error) {
    console.error('Error connecting to Irys:', error);
    throw new Error('Error connecting to Irys');
  }
}

// Test function to check if we can connect to Irys GraphQL
export async function testIrysConnection(): Promise<boolean> {
  const testQuery = `
    query {
      transactions(limit: 1) {
        edges {
          node {
            id
          }
        }
      }
    }
  `;

  try {
    const response = await fetch('https://uploader.irys.xyz/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: testQuery }),
    });

    const result = await response.json();
    return response.ok && !result.errors;
  } catch (error) {
    return false;
  }
}

// Search all repositories across all owners (for global search) - 최적화된 버전
export async function searchAllRepositories(
  query: string,
  currentWallet?: string
): Promise<Repository[]> {
  // If query is empty or too short, return empty results
  if (!query.trim() || query.trim().length < 1) {
    return [];
  }

  // 캐시 확인
  const cacheKey = getCacheKey('search-all', {
    query: query.toLowerCase(),
    currentWallet,
  });
  const cached = getFromCache<Repository[]>(cacheKey);
  if (cached) return cached;

  // Test Irys connection first
  const canConnect = await testIrysConnection();

  const endpoint = 'https://uploader.irys.xyz/graphql';

  try {
    // 병렬로 닉네임과 저장소 데이터 로드 - 쿼리 크기 최적화
    const [nicknameData, repositoryData] = await Promise.all([
      // 닉네임 데이터 로드 - 크기 최적화
      fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            query getAllNicknames {
              transactions(
                tags: [{ name: "App-Name", values: ["irys-git-nickname"] }],
                first: 200,
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
      }),
      // 저장소 데이터 로드 - 크기 최적화
      fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            query getAllRepositories {
              transactions(
                tags: [{ name: "App-Name", values: ["irys-git"] }],
                first: 300,
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
      }),
    ]);

    if (!nicknameData.ok || !repositoryData.ok) {
      return [];
    }

    const [nicknameResult, repositoryResult] = await Promise.all([
      nicknameData.json(),
      repositoryData.json(),
    ]);

    if (nicknameResult.errors || repositoryResult.errors) {
      return [];
    }

    const nicknameTransactions = nicknameResult.data?.transactions?.edges || [];
    const repositoryTransactions =
      repositoryResult.data?.transactions?.edges || [];

    // 닉네임 맵 생성 (wallet address -> nickname)
    const nicknameMap = new Map<string, string>();
    for (const edge of nicknameTransactions) {
      const node = edge.node;
      const nicknameTag = node.tags?.find(
        (tag: any) => tag.name === 'githirys_nickname'
      );
      const accountTag = node.tags?.find(
        (tag: any) => tag.name === 'githirys_account_address'
      );

      if (nicknameTag && accountTag) {
        nicknameMap.set(accountTag.value, nicknameTag.value);
      }
    }

    // 저장소별로 그룹핑
    const repositoryMap = new Map<string, Repository>();
    const branchTransactionMap = new Map<
      string,
      Map<string, BranchTransactionData>
    >();

    for (const edge of repositoryTransactions) {
      const node = edge.node;

      // 태그에서 필요한 정보 추출
      const repositoryTag = node.tags?.find(
        (tag: any) => tag.name === 'Repository'
      );
      const ownerTag = node.tags?.find((tag: any) => tag.name === 'git-owner');
      const branchTag = node.tags?.find((tag: any) => tag.name === 'Branch');
      const timestampTag = node.tags?.find(
        (tag: any) => tag.name === 'Timestamp'
      );
      const mutableTag = node.tags?.find(
        (tag: any) => tag.name === 'Mutable-Address'
      );
      const commitHashTag = node.tags?.find(
        (tag: any) => tag.name === 'Commit-Hash'
      );
      const commitMsgTag = node.tags?.find(
        (tag: any) => tag.name === 'Commit-Message'
      );
      const authorTag = node.tags?.find((tag: any) => tag.name === 'Author');

      if (!repositoryTag || !ownerTag) {
        continue;
      }

      const repoName = repositoryTag.value;
      const owner = ownerTag.value;
      const branchName = branchTag?.value || 'main';

      // Timestamp 처리 개선
      const rawTimestamp = timestampTag?.value || node.timestamp;
      const normalizedTimestamp = TimestampUtils.normalize(rawTimestamp);

      const mutableAddress = mutableTag?.value || null;

      // 저장소 고유 키 생성 (owner + repoName)
      const repoKey = `${owner}/${repoName}`;

      // 저장소별 브랜치 맵 초기화
      if (!branchTransactionMap.has(repoKey)) {
        branchTransactionMap.set(
          repoKey,
          new Map<string, BranchTransactionData>()
        );
      }

      const repoBranches = branchTransactionMap.get(repoKey)!;

      // 브랜치별로 최신 트랜잭션만 유지
      const existingBranch = repoBranches.get(branchName);
      const shouldUpdate =
        !existingBranch ||
        normalizedTimestamp >
          TimestampUtils.normalize(existingBranch.timestamp);

      if (shouldUpdate) {
        repoBranches.set(branchName, {
          name: branchName,
          transactionId: node.id,
          mutableAddress: mutableAddress,
          timestamp:
            timestampTag?.value ||
            TimestampUtils.toDate(node.timestamp).toISOString(),
          commitHash: commitHashTag?.value || '',
          commitMessage: commitMsgTag?.value || '',
          author: authorTag?.value || '',
          tags: node.tags || [],
          nodeTimestamp: normalizedTimestamp,
        });
      }
    }

    // Repository 객체 생성
    for (const [repoKey, branches] of Array.from(
      branchTransactionMap.entries()
    )) {
      const [owner, repoName] = repoKey.split('/');

      const branchInfos: RepoBranch[] = Array.from(branches.values()).map(
        (branchData: BranchTransactionData) => ({
          name: branchData.name,
          transactionId: branchData.transactionId,
          mutableAddress: branchData.mutableAddress,
          timestamp: branchData.nodeTimestamp,
          commitHash: branchData.commitHash,
          commitMessage: branchData.commitMessage,
          author: branchData.author,
          tags: branchData.tags,
        })
      );

      // 기본 브랜치 결정
      let defaultBranch = 'main';
      if (branchInfos.find(b => b.name === 'main')) {
        defaultBranch = 'main';
      } else if (branchInfos.find(b => b.name === 'master')) {
        defaultBranch = 'master';
      } else if (branchInfos.length > 0) {
        defaultBranch = branchInfos[0].name;
      }

      // 브랜치 정렬
      branchInfos.sort((a, b) => {
        if (a.name === defaultBranch) return -1;
        if (b.name === defaultBranch) return 1;
        return a.name.localeCompare(b.name);
      });

      repositoryMap.set(repoKey, {
        name: repoName,
        owner: owner,
        branches: branchInfos,
        defaultBranch: defaultBranch,
        tags: branchInfos[0]?.tags || [],
      });
    }

    const allRepositories = Array.from(repositoryMap.values());

    // 권한 필터링 최적화 - 배치로 권한/가시성 정보 조회
    const visibleRepositories: Repository[] = [];

    // 소유자가 아닌 저장소들만 권한 체크 필요
    const ownedRepos = allRepositories.filter(
      repo => repo.owner === currentWallet
    );
    const otherRepos = allRepositories.filter(
      repo => repo.owner !== currentWallet
    );

    // 소유자 저장소는 바로 추가
    visibleRepositories.push(...ownedRepos);

    if (otherRepos.length > 0) {
      // 배치로 권한/가시성 정보 조회
      const repoList = otherRepos.map(r => ({ name: r.name, owner: r.owner }));
      const permissionsMap = await batchGetRepositoryPermissions(repoList);

      // 권한 기반 필터링
      for (const repo of otherRepos) {
        const key = `${repo.owner}/${repo.name}`;
        const { permissions, visibility } = permissionsMap.get(key) || {};

        // 가시성 확인
        if (!visibility || visibility.visibility === 'public') {
          visibleRepositories.push(repo);
        } else if (visibility.visibility === 'private' && currentWallet) {
          // private인 경우 권한 확인
          if (permissions && permissions.contributors.includes(currentWallet)) {
            visibleRepositories.push(repo);
          }
        }
      }
    }

    // 검색 쿼리와 매칭 처리
    const searchQuery = query.toLowerCase();
    const matchingRepositories: Repository[] = [];

    for (const repo of visibleRepositories) {
      const repoName = repo.name.toLowerCase();
      const ownerAddress = repo.owner.toLowerCase();
      const ownerNickname = nicknameMap.get(repo.owner)?.toLowerCase() || '';

      // 저장소명, 소유자 주소, 닉네임 중 하나라도 매칭되면 포함
      if (
        repoName.includes(searchQuery) ||
        ownerAddress.includes(searchQuery) ||
        ownerNickname.includes(searchQuery)
      ) {
        matchingRepositories.push(repo);
      }
    }

    // Limit results to prevent overwhelming UI and cache the results
    const limitedResults = matchingRepositories.slice(0, 50);

    // 결과 캐싱 (검색 결과는 1분간 캐싱)
    setCache(cacheKey, limitedResults, 1 * 60 * 1000);

    return limitedResults;
  } catch (error) {
    return [];
  }
}

// Search repositories by connected wallet address and group by repository and branch (irys-git 방식) - 최적화된 버전
export async function searchRepositories(
  owner: string,
  currentWallet?: string
): Promise<Repository[]> {
  // 캐시 확인 (소유자별로 캐싱)
  const cacheKey = getCacheKey('repositories', { owner, currentWallet });
  const cached = getFromCache<Repository[]>(cacheKey);
  if (cached) return cached;

  // Test Irys connection first
  const canConnect = await testIrysConnection();

  const searchStrategy = {
    name: 'irys-git 태그로 검색 - 최적화된 버전',
    endpoint: 'https://uploader.irys.xyz/graphql',
    query: `
      query getTagsWithAnd($owners: [String!]!) {
        transactions(
          tags: [{ name: "App-Name", values: ["irys-git"] }, { name: "git-owner", values: $owners }],
          first: 100,
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
    variables: { owners: [owner] },
  };

  try {
    // 병렬로 저장소 데이터와 권한 정보를 가져옴
    const [repositoryResponse, permissionsPromise] = await Promise.all([
      fetch(searchStrategy.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: searchStrategy.query,
          variables: searchStrategy.variables,
        }),
      }),
      // 권한 정보를 미리 캐싱하기 위한 Promise (오류 무시)
      Promise.resolve().then(async () => {
        try {
          // 가능한 저장소들의 권한을 미리 조회 (최대 20개까지만)
          const quickRepoQuery = `
            query getQuickRepos($owners: [String!]!) {
              transactions(
                tags: [{ name: "App-Name", values: ["irys-git"] }, { name: "git-owner", values: $owners }],
                first: 20,
                order: DESC
              ) {
                edges {
                  node {
                    tags {
                      name
                      value
                    }
                  }
                }
              }
            }
          `;

          const quickResponse = await fetch(searchStrategy.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query: quickRepoQuery,
              variables: searchStrategy.variables,
            }),
          });

          if (quickResponse.ok) {
            const quickResult = await quickResponse.json();
            const quickTransactions =
              quickResult.data?.transactions?.edges || [];

            // 저장소 이름들 추출
            const repoNames = new Set<string>();
            for (const edge of quickTransactions) {
              const repositoryTag = edge.node.tags?.find(
                (tag: any) => tag.name === 'Repository'
              );
              if (repositoryTag) {
                repoNames.add(repositoryTag.value);
              }
            }

            // 권한 정보 병렬 로드 (에러 무시)
            const repoList = Array.from(repoNames).slice(0, 10); // 최대 10개 저장소만
            return Promise.allSettled(
              repoList.map(repoName =>
                getRepositoryPermissions(repoName, owner).catch(() => null)
              )
            );
          }
        } catch {
          return null;
        }
      }),
    ]);

    if (!repositoryResponse.ok) {
      return [];
    }

    const result = await repositoryResponse.json();

    if (result.errors) {
      return [];
    }

    const transactions = result.data?.transactions?.edges || [];

    if (transactions.length === 0) {
      return [];
    }

    // 저장소별로 그룹핑 - 최적화된 처리
    const repositoryMap = new Map<string, Repository>();
    const branchTransactionMap = new Map<
      string,
      Map<string, BranchTransactionData>
    >();

    // 첫 번째 패스: 트랜잭션 그룹핑
    for (const edge of transactions) {
      const node = edge.node;

      // 태그에서 필요한 정보 추출
      const repositoryTag = node.tags?.find(
        (tag: any) => tag.name === 'Repository'
      );
      const branchTag = node.tags?.find((tag: any) => tag.name === 'Branch');
      const timestampTag = node.tags?.find(
        (tag: any) => tag.name === 'Timestamp'
      );
      const mutableTag = node.tags?.find(
        (tag: any) => tag.name === 'Mutable-Address'
      );
      const commitHashTag = node.tags?.find(
        (tag: any) => tag.name === 'Commit-Hash'
      );
      const commitMsgTag = node.tags?.find(
        (tag: any) => tag.name === 'Commit-Message'
      );
      const authorTag = node.tags?.find((tag: any) => tag.name === 'Author');

      if (!repositoryTag) {
        continue;
      }

      const repoName = repositoryTag.value;
      const branchName = branchTag?.value || 'main';

      // Timestamp 처리 개선 - 태그의 Timestamp를 우선하고, 없으면 node.timestamp 사용
      const rawTimestamp = timestampTag?.value || node.timestamp;
      const normalizedTimestamp = TimestampUtils.normalize(rawTimestamp);

      const mutableAddress = mutableTag?.value || null;

      // 저장소별 브랜치 맵 초기화
      if (!branchTransactionMap.has(repoName)) {
        branchTransactionMap.set(
          repoName,
          new Map<string, BranchTransactionData>()
        );
      }

      const repoBranches = branchTransactionMap.get(repoName)!;

      // 브랜치별로 최신 트랜잭션만 유지 (정규화된 timestamp로 비교)
      const existingBranch = repoBranches.get(branchName);
      const shouldUpdate =
        !existingBranch ||
        normalizedTimestamp >
          TimestampUtils.normalize(existingBranch.timestamp);

      if (shouldUpdate) {
        repoBranches.set(branchName, {
          name: branchName,
          transactionId: node.id,
          mutableAddress: mutableAddress,
          timestamp:
            timestampTag?.value ||
            TimestampUtils.toDate(node.timestamp).toISOString(),
          commitHash: commitHashTag?.value || '',
          commitMessage: commitMsgTag?.value || '',
          author: authorTag?.value || '',
          tags: node.tags || [],
          nodeTimestamp: normalizedTimestamp,
        });
      }
    }

    // 두 번째 패스: Repository 객체 생성
    for (const [repoName, branches] of Array.from(
      branchTransactionMap.entries()
    )) {
      const branchInfos: RepoBranch[] = Array.from(branches.values()).map(
        (branchData: BranchTransactionData) => ({
          name: branchData.name,
          transactionId: branchData.transactionId,
          mutableAddress: branchData.mutableAddress,
          timestamp: branchData.nodeTimestamp,
          commitHash: branchData.commitHash,
          commitMessage: branchData.commitMessage,
          author: branchData.author,
          tags: branchData.tags,
        })
      );

      // 기본 브랜치 결정
      let defaultBranch = 'main';
      if (branchInfos.find(b => b.name === 'main')) {
        defaultBranch = 'main';
      } else if (branchInfos.find(b => b.name === 'master')) {
        defaultBranch = 'master';
      } else if (branchInfos.length > 0) {
        defaultBranch = branchInfos[0].name;
      }

      // 브랜치 정렬 (기본 브랜치 우선, 그 다음 이름순)
      branchInfos.sort((a, b) => {
        if (a.name === defaultBranch) return -1;
        if (b.name === defaultBranch) return 1;
        return a.name.localeCompare(b.name);
      });

      repositoryMap.set(repoName, {
        name: repoName,
        owner: owner,
        branches: branchInfos,
        defaultBranch: defaultBranch,
        tags: branchInfos[0]?.tags || [],
      });
    }

    const repositories = Array.from(repositoryMap.values());

    // 권한 필터링 최적화 - 소유자인 경우 권한 체크 스킵
    if (owner === currentWallet) {
      // 소유자는 모든 저장소에 접근 가능하므로 바로 반환
      setCache(cacheKey, repositories, 5 * 60 * 1000); // 5분 캐싱
      return repositories;
    }

    // 비소유자인 경우 배치로 권한/가시성 정보 조회
    const repoList = repositories.map(r => ({ name: r.name, owner: r.owner }));
    const permissionsMap = await batchGetRepositoryPermissions(repoList);

    // 권한 기반 필터링
    const filteredRepositories: Repository[] = [];

    for (const repo of repositories) {
      const key = `${repo.owner}/${repo.name}`;
      const { permissions, visibility } = permissionsMap.get(key) || {};

      // 가시성 확인
      if (!visibility || visibility.visibility === 'public') {
        filteredRepositories.push(repo);
      } else if (visibility.visibility === 'private' && currentWallet) {
        // private인 경우 권한 확인
        if (permissions && permissions.contributors.includes(currentWallet)) {
          filteredRepositories.push(repo);
        }
      }
    }

    const finalRepositories = filteredRepositories;

    // 결과 캐싱 (더 짧은 시간)
    setCache(cacheKey, finalRepositories, 2 * 60 * 1000); // 2분 캐싱

    return finalRepositories;
  } catch (error) {
    return [];
  }
}

// Get transaction details by ID with correct Irys syntax
export async function getTransactionById(
  transactionId: string
): Promise<any | null> {
  const strategy = {
    name: 'Irys GraphQL',
    endpoint: 'https://uploader.irys.xyz/graphql',
    query: `
      query getByIds {
        transactions(ids: ["${transactionId}"]) {
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
  };

  try {
    const response = await fetch(strategy.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: strategy.query,
      }),
    });

    if (!response.ok) {
      return null;
    }

    const result = await response.json();

    if (result.errors) {
      return null;
    }

    const transactions = result.data?.transactions?.edges || [];
    if (transactions.length > 0) {
      const tx = transactions[0].node;

      // Timestamp 정규화
      const normalizedTimestamp = TimestampUtils.normalize(tx.timestamp);

      return {
        ...tx,
        timestamp: normalizedTimestamp, // 정규화된 timestamp 반환
        owner: { address: tx.address },
      };
    }
  } catch (error) {
    // 에러가 발생하면 null 반환
  }

  return null;
}

// [Deprecated] resolveMutableAddress - 더 이상 mutable 기능을 사용하지 않음
// 이 함수는 하위 호환성을 위해 유지되지만, 사용하지 않을 것을 권장합니다.
async function resolveMutableAddress(
  mutableAddress: string,
  timeoutMs: number = 5000
): Promise<string | null> {
  console.warn(
    'resolveMutableAddress is deprecated. Using direct transaction URLs instead.'
  );
  return mutableAddress;
}

// Download data from Irys gateway (개선된 버전 - mutable 기능 제거)
export async function downloadData(
  transactionId: string,
  mutableAddress?: string | null,
  forceRefresh?: boolean
): Promise<ArrayBuffer | null> {
  // 캐시 키 생성
  const cacheKey = getCacheKey('download', { transactionId });

  // 강제 새로고침이 아닌 경우 캐시 확인
  if (!forceRefresh) {
    const cached = getFromCache<ArrayBuffer>(cacheKey);
    if (cached) return cached;
  }

  // 캐시 방지를 위한 쿼리 파라미터 추가
  const cacheBypass = forceRefresh ? `?t=${Date.now()}` : '';

  try {
    const response = await fetch(
      `https://gateway.irys.xyz/${transactionId}${cacheBypass}`,
      {
        // 캐시 방지 헤더 추가
        ...(forceRefresh && {
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache',
            Expires: '0',
          },
        }),
      }
    );

    if (response.ok) {
      const data = await response.arrayBuffer();

      // 크기가 적절하면 캐싱
      if (!forceRefresh && data.byteLength < 10 * 1024 * 1024) {
        // 10MB 이하
        setCache(cacheKey, data);
      }

      return data;
    }
  } catch (error) {
    console.error('Error downloading data:', error);
  }

  return null;
}

// 프로필 관련 인터페이스
export interface UserProfile {
  nickname: string;
  twitterHandle: string;
  accountAddress: string;
  profileImageUrl?: string;
  rootTxId?: string;
  mutableAddress?: string; // [Deprecated] 더 이상 사용되지 않음
  timestamp: number;
}

// 프로필 이미지만 별도로 조회하는 함수 (개선된 버전)
export async function getProfileImageUrl(
  address: string
): Promise<string | undefined> {
  // 별도의 캐시 키 사용
  const cacheKey = getCacheKey('profile-image', { address });
  const cached = getFromCache<string>(cacheKey);
  if (cached) return cached;

  const query = `
    query getProfileImage($address: String!) {
      transactions(
        tags: [
          { name: "githirys_account_address", values: [$address] },
          { name: "Content-Type", values: ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"] }
        ],
        first: 1,
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
  `;

  try {
    const response = await fetch('https://uploader.irys.xyz/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: { address },
      }),
    });

    const result = await response.json();
    const transactions = result.data?.transactions?.edges || [];

    if (transactions.length > 0) {
      const latestTx = transactions[0].node;

      if (latestTx.id && URLUtils.isValidTransactionId(latestTx.id)) {
        const imageUrl = `https://gateway.irys.xyz/${latestTx.id}`;

        // 이미지 URL 캐싱 (5분)
        setCache(cacheKey, imageUrl, 5 * 60 * 1000);

        return imageUrl;
      }
    }

    return undefined;
  } catch (error) {
    console.error('Error fetching profile image:', error);
    return undefined;
  }
}

// 프로필 관련 유틸리티 함수들
export const ProfileUtils = {
  // 닉네임 유효성 검사 (형식)
  isValidNickname: (nickname: string): boolean => {
    // 3-20자, 영문자/숫자/언더스코어만 허용
    const nicknameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    return nicknameRegex.test(nickname);
  },

  // 트위터 핸들 유효성 검사
  isValidTwitterHandle: (handle: string): boolean => {
    if (!handle) return true; // 선택사항
    // @는 선택사항, 1-15자, 영문자/숫자/언더스코어만 허용
    const cleanHandle = handle.startsWith('@') ? handle.slice(1) : handle;
    const twitterRegex = /^[a-zA-Z0-9_]{1,15}$/;
    return twitterRegex.test(cleanHandle);
  },

  // 트위터 핸들 정규화 (@ 제거)
  normalizeTwitterHandle: (handle: string): string => {
    if (!handle) return '';
    return handle.startsWith('@') ? handle.slice(1) : handle;
  },

  // Profile image validation (no size restriction)
  validateImageSize: (file: File): Promise<boolean> => {
    return Promise.resolve(true);
  },

  // Estimate upload cost (simplified)
  estimateUploadCost: (sizeInBytes: number): number => {
    // Simple cost estimation: approximately 0.0001 SOL per KB
    const sizeInKB = sizeInBytes / 1024;
    return Math.max(0.0001, sizeInKB * 0.0001);
  },

  // Format cost for display
  formatCost: (cost: number): string => {
    return `${cost.toFixed(6)} SOL`;
  },

  // Check if cost is effectively free
  isEffectivelyFree: (cost: number): boolean => {
    return cost < 0.001; // Less than 0.001 SOL considered free
  },
};

// 닉네임 중복 검사
export async function checkNicknameAvailability(
  nickname: string
): Promise<boolean> {
  const query = `
    query checkNickname($nickname: String!) {
      transactions(
        tags: [
          { name: "githirys_nickname", values: [$nickname] }
        ],
        first: 1
      ) {
        edges {
          node {
            id
          }
        }
      }
    }
  `;

  try {
    const response = await fetch('https://uploader.irys.xyz/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: { nickname },
      }),
    });

    const result = await response.json();
    const transactions = result.data?.transactions?.edges || [];

    const isAvailable = transactions.length === 0;
    return isAvailable;
  } catch (error) {
    return false;
  }
}

// 지갑 주소로 프로필 정보 조회 - 개선된 버전 (visibility/permissions 방식 적용)
export async function getProfileByAddress(
  address: string
): Promise<UserProfile | null> {
  // 캐시 확인
  const cacheKey = getCacheKey('profile-address', { address });
  const cached = getFromCache<UserProfile>(cacheKey);
  if (cached) return cached;

  const query = `
    query getProfileByAddress($address: String!) {
      transactions(
        tags: [
          { name: "githirys_account_address", values: [$address] }
        ],
        first: 10,
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
  `;

  try {
    const response = await fetch('https://uploader.irys.xyz/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: { address },
      }),
    });

    const result = await response.json();
    const transactions = result.data?.transactions?.edges || [];

    if (transactions.length === 0) {
      return null;
    }

    // 가장 최신 프로필 정보 사용
    const latestTx = transactions[0].node;
    const tags = latestTx.tags || [];

    const nickname =
      tags.find((tag: any) => tag.name === 'githirys_nickname')?.value || '';
    const twitterHandle =
      tags.find((tag: any) => tag.name === 'githirys_twitter')?.value || '';
    const accountAddress =
      tags.find((tag: any) => tag.name === 'githirys_account_address')?.value ||
      '';
    const rootTxId =
      tags.find((tag: any) => tag.name === 'Root-TX')?.value || latestTx.id;

    // 개선된 프로필 이미지 URL 생성 - 일반 트랜잭션 URL 사용
    let profileImageUrl: string | undefined;
    if (latestTx.id && URLUtils.isValidTransactionId(latestTx.id)) {
      // 최신 트랜잭션 ID를 직접 사용 (mutable URL 대신)
      profileImageUrl = `https://gateway.irys.xyz/${latestTx.id}`;
    }

    const profile: UserProfile = {
      nickname,
      twitterHandle,
      accountAddress,
      profileImageUrl,
      rootTxId: rootTxId,
      mutableAddress: undefined, // mutable 기능 사용하지 않음
      timestamp: TimestampUtils.normalize(latestTx.timestamp),
    };

    // 캐시에 저장 (프로필은 더 오래 캐싱)
    setCache(cacheKey, profile, 10 * 60 * 1000); // 10분

    return profile;
  } catch (error) {
    return null;
  }
}

// 닉네임으로 프로필 정보 조회 - 개선된 버전 (visibility/permissions 방식 적용)
export async function getProfileByNickname(
  nickname: string
): Promise<UserProfile | null> {
  // 캐시 확인
  const cacheKey = getCacheKey('profile-nickname', { nickname });
  const cached = getFromCache<UserProfile>(cacheKey);
  if (cached) return cached;

  const query = `
    query getProfileByNickname($nickname: String!) {
      transactions(
        tags: [
          { name: "githirys_nickname", values: [$nickname] }
        ],
        first: 10,
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
  `;

  try {
    const response = await fetch('https://uploader.irys.xyz/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: { nickname },
      }),
    });

    const result = await response.json();
    const transactions = result.data?.transactions?.edges || [];

    if (transactions.length === 0) {
      return null;
    }

    // 가장 최신 프로필 정보 사용
    const latestTx = transactions[0].node;
    const tags = latestTx.tags || [];

    const twitterHandle =
      tags.find((tag: any) => tag.name === 'githirys_twitter')?.value || '';
    const accountAddress =
      tags.find((tag: any) => tag.name === 'githirys_account_address')?.value ||
      '';
    const rootTxId =
      tags.find((tag: any) => tag.name === 'Root-TX')?.value || latestTx.id;

    // 개선된 프로필 이미지 URL 생성 - 일반 트랜잭션 URL 사용
    let profileImageUrl: string | undefined;
    if (latestTx.id && URLUtils.isValidTransactionId(latestTx.id)) {
      // 최신 트랜잭션 ID를 직접 사용 (mutable URL 대신)
      profileImageUrl = `https://gateway.irys.xyz/${latestTx.id}`;
    }

    const profile: UserProfile = {
      nickname,
      twitterHandle,
      accountAddress,
      profileImageUrl,
      rootTxId: rootTxId,
      mutableAddress: undefined, // mutable 기능 사용하지 않음
      timestamp: TimestampUtils.normalize(latestTx.timestamp),
    };

    // 캐시에 저장 (프로필은 더 오래 캐싱)
    setCache(cacheKey, profile, 10 * 60 * 1000); // 10분

    return profile;
  } catch (error) {
    return null;
  }
}

// 프로필 업로드
export async function uploadProfile(
  uploader: any,
  profileData: {
    nickname: string;
    twitterHandle: string;
    accountAddress: string;
    profileImage?: File;
    existingRootTxId?: string;
    existingProfileImageUrl?: string;
  }
): Promise<{ success: boolean; txId?: string; error?: string }> {
  try {
    let uploadData: File | Blob;
    let contentType: string;

    if (profileData.profileImage) {
      // 새로운 프로필 이미지가 있는 경우 - File 객체를 직접 사용
      uploadData = profileData.profileImage;
      contentType = profileData.profileImage.type;
    } else if (profileData.existingProfileImageUrl) {
      // 기존 프로필 이미지를 사용하는 경우
      try {
        const response = await fetch(profileData.existingProfileImageUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch existing image: ${response.status}`);
        }
        uploadData = await response.blob();
        contentType = response.headers.get('Content-Type') || 'image/png';
      } catch (fetchError) {
        // 기존 이미지 로드 실패 시 기본 이미지 생성으로 fallback
        const defaultImageData = await generateDefaultProfileImage(
          profileData.nickname
        );
        uploadData = defaultImageData.blob;
        contentType = defaultImageData.contentType;
      }
    } else {
      // 기본 프로필 이미지 생성
      const defaultImageData = await generateDefaultProfileImage(
        profileData.nickname
      );
      uploadData = defaultImageData.blob;
      contentType = defaultImageData.contentType;
    }

    // 태그 구성
    const tags = [
      { name: 'App-Name', value: 'irys-git-nickname' },
      { name: 'githirys_nickname', value: profileData.nickname },
      {
        name: 'githirys_twitter',
        value: ProfileUtils.normalizeTwitterHandle(profileData.twitterHandle),
      },
      { name: 'githirys_account_address', value: profileData.accountAddress },
      { name: 'Content-Type', value: contentType },
    ];

    // 기존 프로필이 있는 경우 Root-TX 태그 추가
    if (profileData.existingRootTxId) {
      tags.push({ name: 'Root-TX', value: profileData.existingRootTxId });
    }

    // Irys에 업로드 - File/Blob 객체를 직접 전달
    const result = await uploader.uploadFile(uploadData, { tags });

    return {
      success: true,
      txId: result.id,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : '알 수 없는 오류가 발생했습니다.',
    };
  }
}

// 기본 프로필 이미지 생성 함수
async function generateDefaultProfileImage(
  nickname: string
): Promise<{ blob: Blob; contentType: string }> {
  try {
    // Canvas를 사용하여 기본 이미지 생성
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Canvas context를 생성할 수 없습니다.');
    }

    // 배경 그리기
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(0, 0, 400, 400);

    // 초기 문자 추가
    ctx.fillStyle = '#6b7280';
    ctx.font = 'bold 120px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(nickname.charAt(0).toUpperCase(), 200, 200);

    // Canvas를 Blob으로 변환
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        blob => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Canvas를 Blob으로 변환할 수 없습니다.'));
          }
        },
        'image/png',
        0.95
      );
    });

    return {
      blob: blob,
      contentType: 'image/png',
    };
  } catch (error) {
    // Canvas 생성 실패 시 최소한의 PNG 이미지를 Blob으로 생성
    // 1x1 투명 PNG의 최소 데이터
    const minimalPngData = new Uint8Array([
      0x89,
      0x50,
      0x4e,
      0x47,
      0x0d,
      0x0a,
      0x1a,
      0x0a, // PNG signature
      0x00,
      0x00,
      0x00,
      0x0d, // IHDR chunk length
      0x49,
      0x48,
      0x44,
      0x52, // IHDR
      0x00,
      0x00,
      0x01,
      0x90, // width: 400
      0x00,
      0x00,
      0x01,
      0x90, // height: 400
      0x08,
      0x06,
      0x00,
      0x00,
      0x00, // bit depth, color type, compression, filter, interlace
      0x4e,
      0x15,
      0x5d,
      0x82, // CRC
      0x00,
      0x00,
      0x00,
      0x0a, // IDAT chunk length
      0x49,
      0x44,
      0x41,
      0x54, // IDAT
      0x78,
      0x9c,
      0x63,
      0x00,
      0x01,
      0x00,
      0x00,
      0x05,
      0x00,
      0x01, // compressed data
      0x0d,
      0x0a,
      0x2d,
      0xb4, // CRC
      0x00,
      0x00,
      0x00,
      0x00, // IEND chunk length
      0x49,
      0x45,
      0x4e,
      0x44, // IEND
      0xae,
      0x42,
      0x60,
      0x82, // CRC
    ]);

    // Uint8Array를 Blob으로 변환
    const fallbackBlob = new Blob([minimalPngData], { type: 'image/png' });

    return {
      blob: fallbackBlob,
      contentType: 'image/png',
    };
  }
}

// 저장소 권한 관리 관련 인터페이스
export interface RepositoryPermissions {
  repository: string;
  owner: string;
  contributors: string[]; // 지갑 주소 배열
  rootTxId?: string;
  mutableAddress?: string;
  timestamp: number;
}

// 저장소 노출 권한 관리 관련 인터페이스
export interface RepositoryVisibility {
  repository: string;
  owner: string;
  visibility: 'public' | 'private';
  rootTxId?: string;
  mutableAddress?: string;
  timestamp: number;
}

export interface RepositoryDescription {
  repository: string;
  owner: string;
  description: string;
  rootTxId?: string;
  mutableAddress?: string;
  timestamp: number;
}

export interface UserSearchResult {
  type: 'nickname' | 'wallet';
  displayName: string;
  walletAddress: string;
  nickname?: string;
  profileImageUrl?: string;
  twitterHandle?: string;
}

// Issue-related interfaces
export interface Issue {
  id: string;
  repository: string;
  owner: string;
  issueCount: number;
  title: string;
  content: string;
  author: string;
  createdAt: number;
  updatedAt: number;
  rootTxId?: string;
  mutableAddress?: string;
  commentCount?: number;
  tags?: any[];
}

export interface IssueComment {
  id: string;
  repository: string;
  owner: string;
  issueCount: number;
  issueTitle: string;
  issueAuthor: string;
  commentCount: number;
  content: string;
  author: string;
  createdAt: number;
  updatedAt: number;
  rootTxId?: string;
  mutableAddress?: string;
  tags?: any[];
}

// 저장소 권한 정보 조회
export async function getRepositoryPermissions(
  repository: string,
  owner: string
): Promise<RepositoryPermissions | null> {
  const query = `
    query getRepositoryPermissions($repository: String!, $owner: String!) {
      transactions(
        tags: [
          { name: "App-Name", values: ["irys-git-permissions"] },
          { name: "Repository", values: [$repository] },
          { name: "git-owner", values: [$owner] }
        ],
        first: 1,
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
  `;

  try {
    const response = await fetch('https://uploader.irys.xyz/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: { repository, owner },
      }),
    });

    const result = await response.json();
    const transactions = result.data?.transactions?.edges || [];

    if (transactions.length === 0) {
      // 권한 정보가 없으면 기본값 반환 (소유자만 포함)
      return {
        repository,
        owner,
        contributors: [owner],
        timestamp: TimestampUtils.normalize(Date.now()),
      };
    }

    // 가장 최신 권한 정보 사용
    const latestTx = transactions[0].node;
    const tags = latestTx.tags || [];

    const contributorsTag = tags.find(
      (tag: any) => tag.name === 'igit-repo-contributor'
    )?.value;
    const rootTxIdTag = tags.find((tag: any) => tag.name === 'Root-TX')?.value;

    let contributors: string[] = [owner]; // 기본적으로 소유자 포함

    if (contributorsTag) {
      try {
        // JSON 문자열로 저장된 경우
        if (
          typeof contributorsTag === 'string' &&
          contributorsTag.startsWith('[')
        ) {
          contributors = JSON.parse(contributorsTag);
        }
        // 배열로 저장된 경우
        else if (Array.isArray(contributorsTag)) {
          contributors = contributorsTag;
        }
        // 문자열로 저장된 경우 (쉼표로 구분)
        else if (typeof contributorsTag === 'string') {
          contributors = contributorsTag.split(',').map(addr => addr.trim());
        }
      } catch (parseError) {
        contributors = [owner];
      }
    }

    // 소유자가 contributors에 없으면 추가
    if (!contributors.includes(owner)) {
      contributors.unshift(owner);
    }

    const permissions: RepositoryPermissions = {
      repository,
      owner,
      contributors,
      rootTxId: rootTxIdTag || latestTx.id,
      mutableAddress: rootTxIdTag
        ? `https://gateway.irys.xyz/mutable/${rootTxIdTag}`
        : undefined,
      timestamp: TimestampUtils.normalize(latestTx.timestamp),
    };

    return permissions;
  } catch (error) {
    return null;
  }
}

// 저장소 권한 업데이트
export async function updateRepositoryPermissions(
  uploader: any,
  permissionsData: {
    repository: string;
    owner: string;
    contributors: string[];
    existingRootTxId?: string;
  }
): Promise<{ success: boolean; txId?: string; error?: string }> {
  try {
    // === 권고사항 B: 업로드 단계에서 소유자 지갑 검증 ===
    if (!uploader?.address || uploader.address !== permissionsData.owner) {
      return {
        success: false,
        error: '지갑 주소가 저장소 소유자가 아닙니다.',
      };
    }

    // 최소한의 JSON 데이터 생성 (권한 정보)
    const permissionsJson = {
      repository: permissionsData.repository,
      owner: permissionsData.owner,
      contributors: permissionsData.contributors,
      timestamp: Math.floor(Date.now() / 1000),
    };

    const jsonData = JSON.stringify(permissionsJson, null, 2);
    const dataBlob = new Blob([jsonData], { type: 'application/json' });

    // 태그 구성
    const tags = [
      { name: 'App-Name', value: 'irys-git-permissions' },
      { name: 'Repository', value: permissionsData.repository },
      { name: 'git-owner', value: permissionsData.owner },
      {
        name: 'igit-repo-contributor',
        value: JSON.stringify(permissionsData.contributors),
      },
      { name: 'Content-Type', value: 'application/json' },
    ];

    // 업데이트인 경우 Root-TX 태그 추가
    if (permissionsData.existingRootTxId) {
      tags.push({ name: 'Root-TX', value: permissionsData.existingRootTxId });
    }

    // Irys에 업로드
    const result = await uploader.uploadFile(dataBlob, { tags });

    return {
      success: true,
      txId: result.id,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : '알 수 없는 오류가 발생했습니다.',
    };
  }
}

// 사용자 검색 (닉네임 또는 지갑 주소) - 부분검색 지원
export async function searchUsers(query: string): Promise<UserSearchResult[]> {
  const results: UserSearchResult[] = [];

  if (!query.trim()) {
    return results;
  }

  const searchQuery = query.toLowerCase();

  // 솔라나 지갑 주소 형식인지 확인
  const isWalletAddress = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(query);

  if (isWalletAddress) {
    // 지갑 주소로 검색
    const profile = await getProfileByAddress(query);

    if (profile) {
      results.push({
        type: 'wallet',
        displayName:
          profile.nickname || `${query.substring(0, 8)}...${query.slice(-4)}`,
        walletAddress: query,
        nickname: profile.nickname,
        profileImageUrl: profile.profileImageUrl,
        twitterHandle: profile.twitterHandle,
      });
    } else {
      // 프로필이 없어도 지갑 주소는 표시
      results.push({
        type: 'wallet',
        displayName: `${query.substring(0, 8)}...${query.slice(-4)}`,
        walletAddress: query,
      });
    }
  } else {
    // 닉네임으로 부분검색 지원
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
          const nicknameTransactions = result.data?.transactions?.edges || [];

          // 고유한 프로필 맵 생성 (중복 제거)
          const uniqueProfiles = new Map<string, UserProfile>();

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

              // 개선된 프로필 이미지 URL 생성 - 일반 트랜잭션 URL 사용
              let profileImageUrl: string | undefined;
              if (node.id && URLUtils.isValidTransactionId(node.id)) {
                // 최신 트랜잭션 ID를 직접 사용 (mutable URL 대신)
                profileImageUrl = `https://gateway.irys.xyz/${node.id}`;
              }

              const profile: UserProfile = {
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
          for (const profile of Array.from(uniqueProfiles.values())) {
            const nickname = profile.nickname.toLowerCase();
            const walletAddress = profile.accountAddress.toLowerCase();

            if (
              nickname.includes(searchQuery) ||
              walletAddress.includes(searchQuery)
            ) {
              results.push({
                type: 'nickname',
                displayName: profile.nickname,
                walletAddress: profile.accountAddress,
                nickname: profile.nickname,
                profileImageUrl: profile.profileImageUrl,
                twitterHandle: profile.twitterHandle,
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('Search error:', error);
    }
  }

  return results;
}

// 저장소 노출 권한 정보 조회
export async function getRepositoryVisibility(
  repository: string,
  owner: string
): Promise<RepositoryVisibility | null> {
  const query = `
    query getRepositoryVisibility($repository: String!, $owner: String!) {
      transactions(
        tags: [
          { name: "App-Name", values: ["irys-git-visibility"] },
          { name: "Repository", values: [$repository] },
          { name: "git-owner", values: [$owner] }
        ],
        first: 1,
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
  `;

  try {
    const response = await fetch('https://uploader.irys.xyz/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: { repository, owner },
      }),
    });

    const result = await response.json();
    const transactions = result.data?.transactions?.edges || [];

    if (transactions.length === 0) {
      // 노출 권한 정보가 없으면 기본값 반환 (public)
      return {
        repository,
        owner,
        visibility: 'public',
        timestamp: TimestampUtils.normalize(Date.now()),
      };
    }

    // 가장 최신 노출 권한 정보 사용
    const latestTx = transactions[0].node;
    const tags = latestTx.tags || [];

    const visibilityTag = tags.find(
      (tag: any) => tag.name === 'git-repo-visibility'
    )?.value;
    const rootTxIdTag = tags.find((tag: any) => tag.name === 'Root-TX')?.value;

    const visibility: RepositoryVisibility = {
      repository,
      owner,
      visibility:
        visibilityTag === 'private' || visibilityTag === 'public'
          ? visibilityTag
          : 'public',
      rootTxId: rootTxIdTag || latestTx.id,
      mutableAddress: rootTxIdTag
        ? `https://gateway.irys.xyz/mutable/${rootTxIdTag}`
        : undefined,
      timestamp: TimestampUtils.normalize(latestTx.timestamp),
    };

    return visibility;
  } catch (error) {
    return null;
  }
}

// 저장소 노출 권한 업데이트
export async function updateRepositoryVisibility(
  uploader: any,
  visibilityData: {
    repository: string;
    owner: string;
    visibility: 'public' | 'private';
    existingRootTxId?: string;
  }
): Promise<{ success: boolean; txId?: string; error?: string }> {
  try {
    // === 권고사항 B: 업로드 단계에서 소유자 지갑 검증 ===
    if (!uploader?.address || uploader.address !== visibilityData.owner) {
      return {
        success: false,
        error: '지갑 주소가 저장소 소유자가 아닙니다.',
      };
    }

    // 최소한의 JSON 데이터 생성 (노출 권한 정보)
    const visibilityJson = {
      repository: visibilityData.repository,
      owner: visibilityData.owner,
      visibility: visibilityData.visibility,
      timestamp: Math.floor(Date.now() / 1000),
    };

    const jsonData = JSON.stringify(visibilityJson, null, 2);
    const dataBlob = new Blob([jsonData], { type: 'application/json' });

    // 태그 구성
    const tags = [
      { name: 'App-Name', value: 'irys-git-visibility' },
      { name: 'Repository', value: visibilityData.repository },
      { name: 'git-owner', value: visibilityData.owner },
      { name: 'git-repo-visibility', value: visibilityData.visibility },
      { name: 'Content-Type', value: 'application/json' },
    ];

    // 업데이트인 경우 Root-TX 태그 추가
    if (visibilityData.existingRootTxId) {
      tags.push({ name: 'Root-TX', value: visibilityData.existingRootTxId });
    }

    // Irys에 업로드
    const result = await uploader.uploadFile(dataBlob, { tags });

    return {
      success: true,
      txId: result.id,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : '알 수 없는 오류가 발생했습니다.',
    };
  }
}

// Get repository description
export async function getRepositoryDescription(
  repository: string,
  owner: string
): Promise<RepositoryDescription | null> {
  const query = `
    query getRepositoryDescription($repository: String!, $owner: String!) {
      transactions(
        tags: [
          { name: "App-Name", values: ["irys-git-repo-description"] },
          { name: "Repository", values: [$repository] },
          { name: "git-owner", values: [$owner] }
        ],
        first: 1,
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
  `;

  try {
    const response = await fetch('https://uploader.irys.xyz/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: { repository, owner },
      }),
    });

    const result = await response.json();
    const transactions = result.data?.transactions?.edges || [];

    if (transactions.length === 0) {
      return null;
    }

    // Get the latest description data
    const latestTx = transactions[0].node;
    const tags = latestTx.tags || [];

    const descriptionTag = tags.find(
      (tag: any) => tag.name === 'git-repo-description'
    )?.value;
    const rootTxIdTag = tags.find((tag: any) => tag.name === 'Root-TX')?.value;

    const description: RepositoryDescription = {
      repository,
      owner,
      description: descriptionTag || '',
      rootTxId: rootTxIdTag || latestTx.id,
      mutableAddress: rootTxIdTag
        ? `https://gateway.irys.xyz/mutable/${rootTxIdTag}`
        : undefined,
      timestamp: TimestampUtils.normalize(latestTx.timestamp),
    };

    return description;
  } catch (error) {
    return null;
  }
}

// Update repository description
export async function updateRepositoryDescription(
  uploader: any,
  descriptionData: {
    repository: string;
    owner: string;
    description: string;
    existingRootTxId?: string;
  }
): Promise<{ success: boolean; txId?: string; error?: string }> {
  try {
    // Verify owner wallet address
    if (!uploader?.address || uploader.address !== descriptionData.owner) {
      return {
        success: false,
        error: 'Wallet address is not the repository owner.',
      };
    }

    // Create JSON data for description
    const descriptionJson = {
      repository: descriptionData.repository,
      owner: descriptionData.owner,
      description: descriptionData.description,
      timestamp: Math.floor(Date.now() / 1000),
    };

    const jsonData = JSON.stringify(descriptionJson, null, 2);
    const dataBlob = new Blob([jsonData], { type: 'application/json' });

    // Configure tags
    const tags = [
      { name: 'App-Name', value: 'irys-git-repo-description' },
      { name: 'Repository', value: descriptionData.repository },
      { name: 'git-owner', value: descriptionData.owner },
      { name: 'git-repo-description', value: descriptionData.description },
      { name: 'Content-Type', value: 'application/json' },
    ];

    // Add Root-TX tag if updating existing description
    if (descriptionData.existingRootTxId) {
      tags.push({ name: 'Root-TX', value: descriptionData.existingRootTxId });
    }

    // Upload to Irys
    const result = await uploader.uploadFile(dataBlob, { tags });

    return {
      success: true,
      txId: result.id,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'An unknown error occurred.',
    };
  }
}

// 대시보드 통계 정보 인터페이스
export interface DashboardStats {
  repositoryCount: number;
  userCount: number;
  commitCount: number;
}

// 저장소 수 통계 가져오기
export async function getRepositoryStats(): Promise<number> {
  const query = `
    query getRepositoryStats {
      transactions(
        tags: [{ name: "App-Name", values: ["irys-git"] }],
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
          }
        }
      }
    }
  `;

  try {
    const response = await fetch('https://uploader.irys.xyz/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      return 0;
    }

    const result = await response.json();

    if (result.errors) {
      return 0;
    }

    const transactions = result.data?.transactions?.edges || [];

    // 고유한 저장소 수 계산 (Repository + Author 조합으로 구분)
    const repositories = new Set<string>();

    for (const edge of transactions) {
      const node = edge.node;
      const repositoryTag = node.tags?.find(
        (tag: any) => tag.name === 'Repository'
      );
      const authorTag = node.tags?.find((tag: any) => tag.name === 'Author');

      if (repositoryTag && authorTag) {
        const repoKey = `${authorTag.value}/${repositoryTag.value}`;
        repositories.add(repoKey);
      }
    }

    const count = repositories.size;
    return count;
  } catch (error) {
    return 0;
  }
}

// 실제 데이터 디버깅을 위한 함수들
export async function debugAllTags(): Promise<void> {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  const query = `
    query debugAllTags {
      transactions(
        first: 100,
        order: DESC
      ) {
        edges {
          node {
            id
            tags {
              name
              value
            }
          }
        }
      }
    }
  `;

  try {
    const response = await fetch('https://uploader.irys.xyz/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      return;
    }

    const result = await response.json();

    if (result.errors) {
      return;
    }

    const transactions = result.data?.transactions?.edges || [];

    const tagCounts = new Map<string, number>();

    for (const edge of transactions) {
      const node = edge.node;
      const tags = node.tags || [];

      for (const tag of tags) {
        const tagName = tag.name;
        tagCounts.set(tagName, (tagCounts.get(tagName) || 0) + 1);
      }
    }

    Array.from(tagCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .forEach(([tagName, count]) => {
        // 태그 정보 출력 로그 제거
      });
  } catch (error) {
    // 태그 디버깅 오류 로그 제거
  }
}

// 사용자 수 통계 가져오기 (개선된 버전)
export async function getUserStats(): Promise<number> {
  // App-Name이 "c"인 트랜잭션들만 쿼리
  const query = `
    query getUserStats {
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
          }
        }
      }
    }
  `;

  try {
    const response = await fetch('https://uploader.irys.xyz/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      return 0;
    }

    const result = await response.json();

    if (result.errors) {
      return 0;
    }

    const transactions = result.data?.transactions?.edges || [];

    // 고유한 사용자 수 계산 (githirys_account_address로 구분)
    const users = new Set<string>();

    for (const edge of transactions) {
      const node = edge.node;
      const accountTag = node.tags?.find(
        (tag: any) => tag.name === 'githirys_account_address'
      );

      if (accountTag && accountTag.value) {
        users.add(accountTag.value);
      }
    }

    const count = users.size;
    return count;
  } catch (error) {
    return 0;
  }
}

// 커밋 수 통계 가져오기 (개선된 버전)
export async function getCommitStats(): Promise<number> {
  // 먼저 App-Name이 irys-git인 트랜잭션들을 모두 가져와서 Commit-Hash가 있는지 확인
  const query = `
    query getCommitStats {
      transactions(
        tags: [{ name: "App-Name", values: ["irys-git"] }],
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
          }
        }
      }
    }
  `;

  try {
    const response = await fetch('https://uploader.irys.xyz/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      return 0;
    }

    const result = await response.json();

    if (result.errors) {
      return 0;
    }

    const transactions = result.data?.transactions?.edges || [];

    // Commit-Hash 태그가 있는 트랜잭션들만 필터링
    const commitTransactions = transactions.filter((edge: any) => {
      const node = edge.node;
      const commitHashTag = node.tags?.find(
        (tag: any) => tag.name === 'Commit-Hash'
      );
      return commitHashTag && commitHashTag.value;
    });

    // 방법 1: Commit-Hash가 있는 트랜잭션들로 커밋 수 계산
    const commits = new Set<string>();

    for (const edge of commitTransactions) {
      const node = edge.node;
      const repositoryTag = node.tags?.find(
        (tag: any) => tag.name === 'Repository'
      );
      const authorTag = node.tags?.find((tag: any) => tag.name === 'Author');
      const commitHashTag = node.tags?.find(
        (tag: any) => tag.name === 'Commit-Hash'
      );

      if (repositoryTag && authorTag && commitHashTag) {
        const commitKey = `${authorTag.value}/${repositoryTag.value}/${commitHashTag.value}`;
        commits.add(commitKey);
      }
    }

    let count = commits.size;

    // 방법 2: Commit-Hash가 없다면 Branch 태그가 있는 트랜잭션들을 커밋으로 계산
    if (count === 0) {
      const branchCommits = new Set<string>();

      for (const edge of transactions) {
        const node = edge.node;
        const repositoryTag = node.tags?.find(
          (tag: any) => tag.name === 'Repository'
        );
        const authorTag = node.tags?.find((tag: any) => tag.name === 'Author');
        const branchTag = node.tags?.find((tag: any) => tag.name === 'Branch');

        if (repositoryTag && authorTag && branchTag) {
          // Branch 기준으로 커밋 수 계산 (각 브랜치별 업로드를 커밋으로 간주)
          const branchCommitKey = `${authorTag.value}/${repositoryTag.value}/${branchTag.value}/${node.id}`;
          branchCommits.add(branchCommitKey);
        }
      }

      count = branchCommits.size;
    }

    return count;
  } catch (error) {
    return 0;
  }
}

// 모든 대시보드 통계 가져오기 (디버깅 포함)
export async function getDashboardStats(): Promise<DashboardStats> {
  try {
    // 디버깅을 위해 태그 정보 출력 (개발 환경에서만)
    if (
      typeof window !== 'undefined' &&
      window.location.hostname === 'localhost'
    ) {
      await debugAllTags();
    }

    // 병렬로 모든 통계 가져오기
    const [repositoryCount, userCount, commitCount] = await Promise.all([
      getRepositoryStats(),
      getUserStats(),
      getCommitStats(),
    ]);

    const stats = {
      repositoryCount,
      userCount,
      commitCount,
    };

    return stats;
  } catch (error) {
    return {
      repositoryCount: 0,
      userCount: 0,
      commitCount: 0,
    };
  }
}

// Recent users and repositories for homepage marquee
export interface RecentUser {
  nickname: string;
  twitterHandle: string;
  accountAddress: string;
  profileImageUrl?: string;
  timestamp: number;
}

export interface RecentRepository {
  name: string;
  owner: string;
  timestamp: number;
  branchCount: number;
  defaultBranch: string;
}

// Get recent users (last 10 users by timestamp)
export async function getRecentUsers(): Promise<RecentUser[]> {
  const query = `
    query getRecentUsers {
      transactions(
        tags: [{ name: "App-Name", values: ["irys-git-nickname"] }],
        first: 50,
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
  `;

  try {
    const response = await fetch('https://uploader.irys.xyz/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      return [];
    }

    const result = await response.json();

    if (result.errors) {
      return [];
    }

    const transactions = result.data?.transactions?.edges || [];

    // Track latest profile for each user
    const userMap = new Map<string, RecentUser>();

    for (const edge of transactions) {
      const node = edge.node;
      const tags = node.tags || [];

      const nickname = tags.find(
        (tag: any) => tag.name === 'githirys_nickname'
      )?.value;
      const accountAddress = tags.find(
        (tag: any) => tag.name === 'githirys_account_address'
      )?.value;
      const twitterHandle =
        tags.find((tag: any) => tag.name === 'githirys_twitter')?.value || '';
      const rootTxId =
        tags.find((tag: any) => tag.name === 'Root-TX')?.value || node.id;

      if (!nickname || !accountAddress) {
        continue;
      }

      const normalizedTimestamp = TimestampUtils.normalize(node.timestamp);

      // Only keep the latest profile for each user
      const existingUser = userMap.get(accountAddress);
      if (!existingUser || normalizedTimestamp > existingUser.timestamp) {
        // 개선된 프로필 이미지 URL 생성 - 일반 트랜잭션 URL 사용
        let profileImageUrl: string | undefined;
        if (node.id && URLUtils.isValidTransactionId(node.id)) {
          // 최신 트랜잭션 ID를 직접 사용 (mutable URL 대신)
          profileImageUrl = `https://gateway.irys.xyz/${node.id}`;
        }

        userMap.set(accountAddress, {
          nickname,
          twitterHandle,
          accountAddress,
          profileImageUrl,
          timestamp: normalizedTimestamp,
        });
      }
    }

    // Sort by timestamp (newest first) and return top 10
    const recentUsers = Array.from(userMap.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 100);

    return recentUsers;
  } catch (error) {
    return [];
  }
}

// Get recent repositories (last 10 repositories by timestamp)
export async function getRecentRepositories(): Promise<RecentRepository[]> {
  const query = `
    query getRecentRepositories {
      transactions(
        tags: [{ name: "App-Name", values: ["irys-git"] }],
        first: 500,
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
  `;

  try {
    const response = await fetch('https://uploader.irys.xyz/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      return [];
    }

    const result = await response.json();

    if (result.errors) {
      return [];
    }

    const transactions = result.data?.transactions?.edges || [];

    // Track repositories and their branches
    const repositoryMap = new Map<
      string,
      {
        name: string;
        owner: string;
        branches: Set<string>;
        latestTimestamp: number;
      }
    >();

    for (const edge of transactions) {
      const node = edge.node;
      const tags = node.tags || [];

      const repositoryTag = tags.find((tag: any) => tag.name === 'Repository');
      const ownerTag = tags.find((tag: any) => tag.name === 'git-owner');
      const branchTag = tags.find((tag: any) => tag.name === 'Branch');

      if (!repositoryTag || !ownerTag) {
        continue;
      }

      const repoName = repositoryTag.value;
      const owner = ownerTag.value;
      const branchName = branchTag?.value || 'main';
      const repoKey = `${owner}/${repoName}`;

      const normalizedTimestamp = TimestampUtils.normalize(node.timestamp);

      if (!repositoryMap.has(repoKey)) {
        repositoryMap.set(repoKey, {
          name: repoName,
          owner,
          branches: new Set(),
          latestTimestamp: normalizedTimestamp,
        });
      }

      const repoData = repositoryMap.get(repoKey)!;
      repoData.branches.add(branchName);

      // Update latest timestamp if this is newer
      if (normalizedTimestamp > repoData.latestTimestamp) {
        repoData.latestTimestamp = normalizedTimestamp;
      }
    }

    // Convert to RecentRepository format and sort by timestamp
    const recentRepositories = Array.from(repositoryMap.values())
      .map(repo => ({
        name: repo.name,
        owner: repo.owner,
        timestamp: repo.latestTimestamp,
        branchCount: repo.branches.size,
        defaultBranch: repo.branches.has('main')
          ? 'main'
          : repo.branches.has('master')
            ? 'master'
            : Array.from(repo.branches)[0] || 'main',
      }))
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10);

    return recentRepositories;
  } catch (error) {
    return [];
  }
}

// Issue-related functions
export async function getRepositoryIssues(
  repository: string,
  owner: string
): Promise<Issue[]> {
  const searchStrategy = {
    name: 'irys-git-issues 태그로 이슈 검색',
    endpoint: 'https://uploader.irys.xyz/graphql',
    query: `
      query getRepositoryIssues($repository: String!, $owner: String!) {
        transactions(
          tags: [
            { name: "App-Name", values: ["irys-git-issues"] },
            { name: "Repository", values: [$repository] },
            { name: "git-owner", values: [$owner] }
          ],
          first: 100,
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
    variables: { repository, owner },
  };

  try {
    const response = await fetch(searchStrategy.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: searchStrategy.query,
        variables: searchStrategy.variables,
      }),
    });

    if (!response.ok) {
      return [];
    }

    const result = await response.json();

    if (result.errors) {
      return [];
    }

    const transactions = result.data?.transactions?.edges || [];
    const issueMap = new Map<number, Issue>();

    for (const edge of transactions) {
      const node = edge.node;
      const issueCountTag = node.tags?.find(
        (tag: any) => tag.name === 'issue-count'
      );
      const issueNameTag = node.tags?.find(
        (tag: any) => tag.name === 'issue-name'
      );
      const issueOwnerTag = node.tags?.find(
        (tag: any) => tag.name === 'issue-owner'
      );
      const rootTxTag = node.tags?.find((tag: any) => tag.name === 'Root-TX');

      if (!issueCountTag || !issueNameTag || !issueOwnerTag) {
        continue;
      }

      const issueCount = parseInt(issueCountTag.value, 10);
      const issueTitle = issueNameTag.value;
      const issueAuthor = issueOwnerTag.value;
      const rootTxId = rootTxTag?.value;
      const timestamp = TimestampUtils.normalize(node.timestamp);

      const existingIssue = issueMap.get(issueCount);
      if (!existingIssue || timestamp > existingIssue.updatedAt) {
        // Load issue content
        const issueContent = await downloadData(node.id);
        const content = issueContent
          ? new TextDecoder().decode(issueContent)
          : '';

        issueMap.set(issueCount, {
          id: node.id,
          repository,
          owner,
          issueCount,
          title: issueTitle,
          content,
          author: issueAuthor,
          createdAt: timestamp,
          updatedAt: timestamp,
          rootTxId,
          mutableAddress: node.id,
          tags: node.tags,
        });
      }
    }

    const issues = Array.from(issueMap.values());

    // Filter issues by visibility
    const visibleIssues: Issue[] = [];
    for (const issue of issues) {
      const isVisible = await getIssueVisibility(
        issue.repository,
        issue.owner,
        issue.issueCount,
        issue.title,
        issue.author
      );
      if (isVisible) {
        visibleIssues.push(issue);
      }
    }

    return visibleIssues.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (error) {
    console.error('Error fetching repository issues:', error);
    return [];
  }
}

export async function getIssueComments(
  repository: string,
  owner: string,
  issueCount: number,
  issueTitle: string,
  issueAuthor: string
): Promise<IssueComment[]> {
  const searchStrategy = {
    name: 'irys-git-issue-comments 태그로 이슈 댓글 검색',
    endpoint: 'https://uploader.irys.xyz/graphql',
    query: `
      query getIssueComments($repository: String!, $owner: String!, $issueCount: String!, $issueTitle: String!, $issueAuthor: String!) {
        transactions(
          tags: [
            { name: "App-Name", values: ["irys-git-issue-comments"] },
            { name: "Repository", values: [$repository] },
            { name: "git-owner", values: [$owner] },
            { name: "issue-count", values: [$issueCount] },
            { name: "issue-name", values: [$issueTitle] },
            { name: "issue-owner", values: [$issueAuthor] }
          ],
          first: 100,
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
    variables: {
      repository,
      owner,
      issueCount: issueCount.toString(),
      issueTitle,
      issueAuthor,
    },
  };

  try {
    const response = await fetch(searchStrategy.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: searchStrategy.query,
        variables: searchStrategy.variables,
      }),
    });

    if (!response.ok) {
      return [];
    }

    const result = await response.json();

    if (result.errors) {
      return [];
    }

    const transactions = result.data?.transactions?.edges || [];
    const commentMap = new Map<number, IssueComment>();

    for (const edge of transactions) {
      const node = edge.node;
      const commentCountTag = node.tags?.find(
        (tag: any) => tag.name === 'issue-comment-count'
      );
      const commentOwnerTag = node.tags?.find(
        (tag: any) => tag.name === 'issue-comment-owner'
      );
      const rootTxTag = node.tags?.find((tag: any) => tag.name === 'Root-TX');

      if (!commentCountTag || !commentOwnerTag) {
        continue;
      }

      const commentCount = parseInt(commentCountTag.value, 10);
      const commentAuthor = commentOwnerTag.value;
      const rootTxId = rootTxTag?.value;
      const timestamp = TimestampUtils.normalize(node.timestamp);

      const existingComment = commentMap.get(commentCount);
      if (!existingComment || timestamp > existingComment.updatedAt) {
        // Load comment content
        const commentContent = await downloadData(node.id);
        const content = commentContent
          ? new TextDecoder().decode(commentContent)
          : '';

        commentMap.set(commentCount, {
          id: node.id,
          repository,
          owner,
          issueCount,
          issueTitle,
          issueAuthor,
          commentCount,
          content,
          author: commentAuthor,
          createdAt: timestamp,
          updatedAt: timestamp,
          rootTxId,
          mutableAddress: node.id,
          tags: node.tags,
        });
      }
    }

    const comments = Array.from(commentMap.values());

    // Filter comments by visibility
    const visibleComments: IssueComment[] = [];
    for (const comment of comments) {
      const isVisible = await getCommentVisibility(
        comment.repository,
        comment.owner,
        comment.issueCount,
        comment.issueTitle,
        comment.issueAuthor,
        comment.commentCount,
        comment.author
      );
      if (isVisible) {
        visibleComments.push(comment);
      }
    }

    return visibleComments.sort((a, b) => a.createdAt - b.createdAt);
  } catch (error) {
    console.error('Error fetching issue comments:', error);
    return [];
  }
}

export async function createIssue(
  uploader: any,
  issueData: {
    repository: string;
    owner: string;
    title: string;
    content: string;
    author: string;
  }
): Promise<{ success: boolean; txId?: string; error?: string }> {
  try {
    // Get next issue count
    const existingIssues = await getRepositoryIssues(
      issueData.repository,
      issueData.owner
    );
    const nextIssueCount = existingIssues.length + 1;

    // Create tags
    const tags = [
      { name: 'App-Name', value: 'irys-git-issues' },
      { name: 'Repository', value: issueData.repository },
      { name: 'git-owner', value: issueData.owner },
      { name: 'issue-count', value: nextIssueCount.toString() },
      { name: 'issue-name', value: issueData.title },
      { name: 'issue-owner', value: issueData.author },
      { name: 'issue-visibility', value: 'true' },
      { name: 'Timestamp', value: new Date().toISOString() },
    ];

    // Upload issue - pass content as string directly
    const receipt = await uploader.upload(issueData.content, { tags });

    return {
      success: true,
      txId: receipt.id,
    };
  } catch (error) {
    console.error('Error creating issue:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function updateIssue(
  uploader: any,
  issueData: {
    repository: string;
    owner: string;
    issueCount: number;
    title: string;
    content: string;
    author: string;
    existingRootTxId?: string;
  }
): Promise<{ success: boolean; txId?: string; error?: string }> {
  try {
    // Create tags
    const tags = [
      { name: 'App-Name', value: 'irys-git-issues' },
      { name: 'Repository', value: issueData.repository },
      { name: 'git-owner', value: issueData.owner },
      { name: 'issue-count', value: issueData.issueCount.toString() },
      { name: 'issue-name', value: issueData.title },
      { name: 'issue-owner', value: issueData.author },
      { name: 'issue-visibility', value: 'true' },
      { name: 'Timestamp', value: new Date().toISOString() },
    ];

    // Add Root-TX tag if updating existing issue
    if (issueData.existingRootTxId) {
      tags.push({ name: 'Root-TX', value: issueData.existingRootTxId });
    }

    // Upload updated issue - pass content as string directly
    const receipt = await uploader.upload(issueData.content, { tags });

    return {
      success: true,
      txId: receipt.id,
    };
  } catch (error) {
    console.error('Error updating issue:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function createIssueComment(
  uploader: any,
  commentData: {
    repository: string;
    owner: string;
    issueCount: number;
    issueTitle: string;
    issueAuthor: string;
    content: string;
    author: string;
  }
): Promise<{ success: boolean; txId?: string; error?: string }> {
  try {
    // Get next comment count
    const existingComments = await getIssueComments(
      commentData.repository,
      commentData.owner,
      commentData.issueCount,
      commentData.issueTitle,
      commentData.issueAuthor
    );
    const nextCommentCount = existingComments.length + 1;

    // Create tags
    const tags = [
      { name: 'App-Name', value: 'irys-git-issue-comments' },
      { name: 'Repository', value: commentData.repository },
      { name: 'git-owner', value: commentData.owner },
      { name: 'issue-count', value: commentData.issueCount.toString() },
      { name: 'issue-name', value: commentData.issueTitle },
      { name: 'issue-owner', value: commentData.issueAuthor },
      { name: 'issue-comment-count', value: nextCommentCount.toString() },
      { name: 'issue-comment-owner', value: commentData.author },
      { name: 'issue-comment-visibility', value: 'true' },
      { name: 'Timestamp', value: new Date().toISOString() },
    ];

    // Upload comment - pass content as string directly
    const receipt = await uploader.upload(commentData.content, { tags });

    return {
      success: true,
      txId: receipt.id,
    };
  } catch (error) {
    console.error('Error creating issue comment:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function updateIssueComment(
  uploader: any,
  commentData: {
    repository: string;
    owner: string;
    issueCount: number;
    issueTitle: string;
    issueAuthor: string;
    commentCount: number;
    content: string;
    author: string;
    existingRootTxId?: string;
  }
): Promise<{ success: boolean; txId?: string; error?: string }> {
  try {
    // Create tags
    const tags = [
      { name: 'App-Name', value: 'irys-git-issue-comments' },
      { name: 'Repository', value: commentData.repository },
      { name: 'git-owner', value: commentData.owner },
      { name: 'issue-count', value: commentData.issueCount.toString() },
      { name: 'issue-name', value: commentData.issueTitle },
      { name: 'issue-owner', value: commentData.issueAuthor },
      {
        name: 'issue-comment-count',
        value: commentData.commentCount.toString(),
      },
      { name: 'issue-comment-owner', value: commentData.author },
      { name: 'issue-comment-visibility', value: 'true' },
      { name: 'Timestamp', value: new Date().toISOString() },
    ];

    // Add Root-TX tag if updating existing comment
    if (commentData.existingRootTxId) {
      tags.push({ name: 'Root-TX', value: commentData.existingRootTxId });
    }

    // Upload updated comment - pass content as string directly
    const receipt = await uploader.upload(commentData.content, { tags });

    return {
      success: true,
      txId: receipt.id,
    };
  } catch (error) {
    console.error('Error updating issue comment:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Issue visibility management functions
export async function updateIssueVisibility(
  uploader: any,
  visibilityData: {
    repository: string;
    owner: string;
    issueCount: number;
    issueTitle: string;
    issueAuthor: string;
    visibility: boolean;
    existingRootTxId?: string;
  }
): Promise<{ success: boolean; txId?: string; error?: string }> {
  try {
    // Create visibility update content
    const visibilityContent = JSON.stringify({
      visibility: visibilityData.visibility,
      updatedAt: new Date().toISOString(),
    });

    // Create tags
    const tags = [
      { name: 'App-Name', value: 'irys-git-issues' },
      { name: 'Repository', value: visibilityData.repository },
      { name: 'git-owner', value: visibilityData.owner },
      { name: 'issue-count', value: visibilityData.issueCount.toString() },
      { name: 'issue-name', value: visibilityData.issueTitle },
      { name: 'issue-owner', value: visibilityData.issueAuthor },
      { name: 'issue-visibility', value: visibilityData.visibility.toString() },
      { name: 'Timestamp', value: new Date().toISOString() },
    ];

    // Add Root-TX tag if updating existing visibility
    if (visibilityData.existingRootTxId) {
      tags.push({ name: 'Root-TX', value: visibilityData.existingRootTxId });
    }

    // Upload visibility update
    const receipt = await uploader.upload(visibilityContent, { tags });

    return {
      success: true,
      txId: receipt.id,
    };
  } catch (error) {
    console.error('Error updating issue visibility:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function updateCommentVisibility(
  uploader: any,
  visibilityData: {
    repository: string;
    owner: string;
    issueCount: number;
    issueTitle: string;
    issueAuthor: string;
    commentCount: number;
    commentAuthor: string;
    visibility: boolean;
    existingRootTxId?: string;
  }
): Promise<{ success: boolean; txId?: string; error?: string }> {
  try {
    // Create visibility update content
    const visibilityContent = JSON.stringify({
      visibility: visibilityData.visibility,
      updatedAt: new Date().toISOString(),
    });

    // Create tags
    const tags = [
      { name: 'App-Name', value: 'irys-git-issue-comments-visibility' },
      { name: 'Repository', value: visibilityData.repository },
      { name: 'git-owner', value: visibilityData.owner },
      { name: 'issue-count', value: visibilityData.issueCount.toString() },
      { name: 'issue-name', value: visibilityData.issueTitle },
      { name: 'issue-owner', value: visibilityData.issueAuthor },
      {
        name: 'issue-comment-count',
        value: visibilityData.commentCount.toString(),
      },
      { name: 'issue-comment-owner', value: visibilityData.commentAuthor },
      {
        name: 'issue-comment-visibility',
        value: visibilityData.visibility.toString(),
      },
      { name: 'Timestamp', value: new Date().toISOString() },
    ];

    // Add Root-TX tag if updating existing visibility
    if (visibilityData.existingRootTxId) {
      tags.push({ name: 'Root-TX', value: visibilityData.existingRootTxId });
    }

    // Upload visibility update
    const receipt = await uploader.upload(visibilityContent, { tags });

    return {
      success: true,
      txId: receipt.id,
    };
  } catch (error) {
    console.error('Error updating comment visibility:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Get issue visibility status
export async function getIssueVisibility(
  repository: string,
  owner: string,
  issueCount: number,
  issueTitle: string,
  issueAuthor: string
): Promise<boolean> {
  const searchStrategy = {
    name: 'Check issue visibility',
    endpoint: 'https://uploader.irys.xyz/graphql',
    query: `
      query getIssueVisibility($repository: String!, $owner: String!, $issueCount: String!, $issueTitle: String!, $issueAuthor: String!) {
        transactions(
          tags: [
            { name: "App-Name", values: ["irys-git-issues"] },
            { name: "Repository", values: [$repository] },
            { name: "git-owner", values: [$owner] },
            { name: "issue-count", values: [$issueCount] },
            { name: "issue-name", values: [$issueTitle] },
            { name: "issue-owner", values: [$issueAuthor] }
          ],
          first: 10,
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
    variables: {
      repository,
      owner,
      issueCount: issueCount.toString(),
      issueTitle,
      issueAuthor,
    },
  };

  try {
    const response = await fetch(searchStrategy.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: searchStrategy.query,
        variables: searchStrategy.variables,
      }),
    });

    if (!response.ok) {
      return true; // Default to visible if can't check
    }

    const result = await response.json();

    if (result.errors) {
      return true; // Default to visible if can't check
    }

    const transactions = result.data?.transactions?.edges || [];

    // Find the latest transaction with visibility tag
    let latestVisibility = true; // Default to visible
    let latestTimestamp = 0;

    for (const edge of transactions) {
      const node = edge.node;
      const visibilityTag = node.tags?.find(
        (tag: any) => tag.name === 'issue-visibility'
      );

      if (visibilityTag) {
        const timestamp = TimestampUtils.normalize(node.timestamp);
        if (timestamp > latestTimestamp) {
          latestTimestamp = timestamp;
          latestVisibility = visibilityTag.value === 'true';
        }
      }
    }

    return latestVisibility;
  } catch (error) {
    console.error('Error checking issue visibility:', error);
    return true; // Default to visible if error
  }
}

// Get comment visibility status
export async function getCommentVisibility(
  repository: string,
  owner: string,
  issueCount: number,
  issueTitle: string,
  issueAuthor: string,
  commentCount: number,
  commentAuthor: string
): Promise<boolean> {
  const searchStrategy = {
    name: 'Check comment visibility',
    endpoint: 'https://uploader.irys.xyz/graphql',
    query: `
      query getCommentVisibility($repository: String!, $owner: String!, $issueCount: String!, $issueTitle: String!, $issueAuthor: String!, $commentCount: String!, $commentAuthor: String!) {
        transactions(
          tags: [
            { name: "App-Name", values: ["irys-git-issue-comments-visibility"] },
            { name: "Repository", values: [$repository] },
            { name: "git-owner", values: [$owner] },
            { name: "issue-count", values: [$issueCount] },
            { name: "issue-name", values: [$issueTitle] },
            { name: "issue-owner", values: [$issueAuthor] },
            { name: "issue-comment-count", values: [$commentCount] },
            { name: "issue-comment-owner", values: [$commentAuthor] }
          ],
          first: 10,
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
    variables: {
      repository,
      owner,
      issueCount: issueCount.toString(),
      issueTitle,
      issueAuthor,
      commentCount: commentCount.toString(),
      commentAuthor,
    },
  };

  try {
    const response = await fetch(searchStrategy.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: searchStrategy.query,
        variables: searchStrategy.variables,
      }),
    });

    if (!response.ok) {
      return true; // Default to visible if can't check
    }

    const result = await response.json();

    if (result.errors) {
      return true; // Default to visible if can't check
    }

    const transactions = result.data?.transactions?.edges || [];

    // Find the latest transaction with visibility tag
    let latestVisibility = true; // Default to visible
    let latestTimestamp = 0;

    for (const edge of transactions) {
      const node = edge.node;
      const visibilityTag = node.tags?.find(
        (tag: any) => tag.name === 'issue-comment-visibility'
      );

      if (visibilityTag) {
        const timestamp = TimestampUtils.normalize(node.timestamp);
        if (timestamp > latestTimestamp) {
          latestTimestamp = timestamp;
          latestVisibility = visibilityTag.value === 'true';
        }
      }
    }

    return latestVisibility;
  } catch (error) {
    console.error('Error checking comment visibility:', error);
    return true; // Default to visible if error
  }
}

// 캐시 스토리지
const cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
const DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5분

// 캐시 헬퍼 함수
function getCacheKey(type: string, params: any): string {
  return `${type}:${JSON.stringify(params)}`;
}

function getFromCache<T>(key: string): T | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < cached.ttl) {
    return cached.data as T;
  }
  if (cached) {
    cache.delete(key);
  }
  return null;
}

function setCache(
  key: string,
  data: any,
  ttl: number = DEFAULT_CACHE_TTL
): void {
  cache.set(key, { data, timestamp: Date.now(), ttl });
}

// 캐시 정리 함수
export function clearExpiredCache(): void {
  const now = Date.now();
  const keysToDelete: string[] = [];

  cache.forEach((value, key) => {
    if (now - value.timestamp > value.ttl) {
      keysToDelete.push(key);
    }
  });

  keysToDelete.forEach(key => cache.delete(key));
}

// 특정 타입의 캐시 삭제
export function clearCacheByType(type: string): void {
  const keysToDelete: string[] = [];

  cache.forEach((_, key) => {
    if (key.startsWith(`${type}:`)) {
      keysToDelete.push(key);
    }
  });

  keysToDelete.forEach(key => cache.delete(key));
}

// 특정 주소의 프로필 관련 캐시 무효화
export function invalidateProfileCache(address: string): void {
  const keysToDelete: string[] = [];

  cache.forEach((_, key) => {
    // 프로필 관련 캐시 키들 제거
    if (
      key.includes(`"address":"${address}"`) ||
      (key.includes('profile-image:') && key.includes(address)) ||
      (key.includes('profile-address:') && key.includes(address)) ||
      (key.includes('profile-nickname:') && key.includes(address))
    ) {
      keysToDelete.push(key);
    }
  });

  keysToDelete.forEach(key => cache.delete(key));

  console.log(
    `Invalidated ${keysToDelete.length} profile cache entries for ${address}`
  );
}

// 특정 저장소의 캐시 무효화
export function invalidateRepositoryCache(
  repository: string,
  owner: string
): void {
  const keysToDelete: string[] = [];

  cache.forEach((_, key) => {
    // 저장소 관련 캐시 키들 제거
    if (
      (key.includes(`"repository":"${repository}"`) &&
        key.includes(`"owner":"${owner}"`)) ||
      (key.includes('repo-detail:') &&
        key.includes(repository) &&
        key.includes(owner)) ||
      (key.includes('repo-branches:') &&
        key.includes(repository) &&
        key.includes(owner)) ||
      (key.includes('permissions:') &&
        key.includes(repository) &&
        key.includes(owner)) ||
      (key.includes('visibility:') &&
        key.includes(repository) &&
        key.includes(owner)) ||
      (key.includes('repositories:') && key.includes(owner))
    ) {
      keysToDelete.push(key);
    }
  });

  keysToDelete.forEach(key => cache.delete(key));

  console.log(
    `Invalidated ${keysToDelete.length} repository cache entries for ${owner}/${repository}`
  );
}

// 전체 캐시 삭제
export function clearAllCache(): void {
  cache.clear();
}

// 저장소 상세 정보 조회 (최적화 버전)
export async function getRepositoryDetailInfo(
  repository: string,
  owner: string
): Promise<{
  permissions?: RepositoryPermissions;
  visibility?: RepositoryVisibility;
  description?: RepositoryDescription;
}> {
  // 캐시 확인
  const cacheKey = getCacheKey('repo-detail', { repository, owner });
  const cached = getFromCache<{
    permissions?: RepositoryPermissions;
    visibility?: RepositoryVisibility;
    description?: RepositoryDescription;
  }>(cacheKey);
  if (cached) return cached;

  // 병렬로 권한, 가시성, 설명을 조회
  const [permissions, visibility, description] = await Promise.all([
    getRepositoryPermissions(repository, owner),
    getRepositoryVisibility(repository, owner),
    getRepositoryDescription(repository, owner),
  ]);

  const result = {
    permissions: permissions || undefined,
    visibility: visibility || undefined,
    description: description || undefined,
  };

  // 캐시에 저장 (3분)
  setCache(cacheKey, result, 3 * 60 * 1000);

  return result;
}

// 저장소 브랜치 정보만 조회 (최적화 버전)
export async function getRepositoryBranches(
  repository: string,
  owner: string
): Promise<RepoBranch[]> {
  // 캐시 확인
  const cacheKey = getCacheKey('repo-branches', { repository, owner });
  const cached = getFromCache<RepoBranch[]>(cacheKey);
  if (cached) return cached;

  const query = `
    query getRepositoryBranches($repository: String!, $owner: String!) {
      transactions(
        tags: [
          { name: "App-Name", values: ["irys-git"] },
          { name: "Repository", values: [$repository] },
          { name: "git-owner", values: [$owner] }
        ],
        first: 50,
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
  `;

  try {
    const response = await fetch('https://uploader.irys.xyz/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: { repository, owner },
      }),
    });

    if (!response.ok) {
      return [];
    }

    const result = await response.json();
    const transactions = result.data?.transactions?.edges || [];

    // 브랜치별로 그룹핑
    const branchMap = new Map<string, BranchTransactionData>();

    for (const edge of transactions) {
      const node = edge.node;
      const tags = node.tags || [];

      const branchTag = tags.find((tag: any) => tag.name === 'Branch');
      const commitHashTag = tags.find((tag: any) => tag.name === 'Commit-Hash');
      const commitMsgTag = tags.find(
        (tag: any) => tag.name === 'Commit-Message'
      );
      const authorTag = tags.find((tag: any) => tag.name === 'Author');
      const timestampTag = tags.find((tag: any) => tag.name === 'Timestamp');

      const branchName = branchTag?.value || 'main';
      const normalizedTimestamp = TimestampUtils.normalize(node.timestamp);

      // 브랜치별로 최신 트랜잭션만 유지
      const existingBranch = branchMap.get(branchName);
      if (
        !existingBranch ||
        normalizedTimestamp > TimestampUtils.normalize(existingBranch.timestamp)
      ) {
        branchMap.set(branchName, {
          name: branchName,
          transactionId: node.id,
          mutableAddress: null, // mutable 기능 사용하지 않음
          timestamp:
            timestampTag?.value ||
            TimestampUtils.toDate(node.timestamp).toISOString(),
          commitHash: commitHashTag?.value || '',
          commitMessage: commitMsgTag?.value || '',
          author: authorTag?.value || '',
          tags: tags,
          nodeTimestamp: normalizedTimestamp,
        });
      }
    }

    // RepoBranch 배열로 변환
    const branches: RepoBranch[] = Array.from(branchMap.values()).map(
      branchData => ({
        name: branchData.name,
        transactionId: branchData.transactionId,
        mutableAddress: null,
        timestamp: branchData.nodeTimestamp,
        commitHash: branchData.commitHash,
        commitMessage: branchData.commitMessage,
        author: branchData.author,
        tags: branchData.tags,
      })
    );

    // 브랜치 정렬
    branches.sort((a, b) => {
      if (a.name === 'main') return -1;
      if (b.name === 'main') return 1;
      if (a.name === 'master') return -1;
      if (b.name === 'master') return 1;
      return a.name.localeCompare(b.name);
    });

    // 캐시에 저장 (5분)
    setCache(cacheKey, branches, 5 * 60 * 1000);

    return branches;
  } catch (error) {
    console.error('Error fetching repository branches:', error);
    return [];
  }
}

// 병렬 배치 처리를 위한 헬퍼
async function batchProcess<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  batchSize: number = 10
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);
  }

  return results;
}

// 권한 및 가시성 일괄 조회 함수
export async function batchGetRepositoryPermissions(
  repositories: { name: string; owner: string }[]
): Promise<
  Map<
    string,
    { permissions?: RepositoryPermissions; visibility?: RepositoryVisibility }
  >
> {
  const resultMap = new Map<
    string,
    { permissions?: RepositoryPermissions; visibility?: RepositoryVisibility }
  >();

  // 캐시에서 먼저 확인
  const uncachedRepos: { name: string; owner: string }[] = [];

  for (const repo of repositories) {
    const key = `${repo.owner}/${repo.name}`;
    const permCacheKey = getCacheKey('permissions', {
      name: repo.name,
      owner: repo.owner,
    });
    const visCacheKey = getCacheKey('visibility', {
      name: repo.name,
      owner: repo.owner,
    });

    const cachedPermissions = getFromCache<RepositoryPermissions>(permCacheKey);
    const cachedVisibility = getFromCache<RepositoryVisibility>(visCacheKey);

    if (cachedPermissions || cachedVisibility) {
      resultMap.set(key, {
        permissions: cachedPermissions || undefined,
        visibility: cachedVisibility || undefined,
      });
    } else {
      uncachedRepos.push(repo);
    }
  }

  // 캐시되지 않은 항목들을 병렬로 조회
  if (uncachedRepos.length > 0) {
    const query = `
      query batchGetPermissions($repositories: [String!]!, $owners: [String!]!) {
        permissions: transactions(
          tags: [
            { name: "App-Name", values: ["irys-git-permissions"] },
            { name: "Repository", values: $repositories },
            { name: "git-owner", values: $owners }
          ],
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
        visibility: transactions(
          tags: [
            { name: "App-Name", values: ["irys-git-visibility"] },
            { name: "Repository", values: $repositories },
            { name: "git-owner", values: $owners }
          ],
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
    `;

    try {
      const response = await fetch('https://uploader.irys.xyz/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          variables: {
            repositories: uncachedRepos.map(r => r.name),
            owners: uncachedRepos.map(r => r.owner),
          },
        }),
      });

      if (response.ok) {
        const result = await response.json();

        // 권한 정보 처리
        const permTransactions = result.data?.permissions?.edges || [];
        for (const edge of permTransactions) {
          const node = edge.node;
          const repoTag = node.tags?.find(
            (tag: any) => tag.name === 'Repository'
          );
          const ownerTag = node.tags?.find(
            (tag: any) => tag.name === 'git-owner'
          );
          const contributorsTag = node.tags?.find(
            (tag: any) => tag.name === 'git-contributors'
          );

          if (repoTag && ownerTag) {
            const key = `${ownerTag.value}/${repoTag.value}`;
            const permissions: RepositoryPermissions = {
              repository: repoTag.value,
              owner: ownerTag.value,
              contributors: contributorsTag
                ? contributorsTag.value.split(',').filter((c: string) => c)
                : [ownerTag.value],
              timestamp: TimestampUtils.normalize(node.timestamp),
            };

            const existing = resultMap.get(key) || {};
            resultMap.set(key, { ...existing, permissions });

            // 캐시에 저장
            const cacheKey = getCacheKey('permissions', {
              name: repoTag.value,
              owner: ownerTag.value,
            });
            setCache(cacheKey, permissions);
          }
        }

        // 가시성 정보 처리
        const visTransactions = result.data?.visibility?.edges || [];
        for (const edge of visTransactions) {
          const node = edge.node;
          const repoTag = node.tags?.find(
            (tag: any) => tag.name === 'Repository'
          );
          const ownerTag = node.tags?.find(
            (tag: any) => tag.name === 'git-owner'
          );
          const visibilityTag = node.tags?.find(
            (tag: any) => tag.name === 'git-visibility'
          );

          if (repoTag && ownerTag) {
            const key = `${ownerTag.value}/${repoTag.value}`;
            const visibility: RepositoryVisibility = {
              repository: repoTag.value,
              owner: ownerTag.value,
              visibility:
                (visibilityTag?.value as 'public' | 'private') || 'public',
              timestamp: TimestampUtils.normalize(node.timestamp),
            };

            const existing = resultMap.get(key) || {};
            resultMap.set(key, { ...existing, visibility });

            // 캐시에 저장
            const cacheKey = getCacheKey('visibility', {
              name: repoTag.value,
              owner: ownerTag.value,
            });
            setCache(cacheKey, visibility);
          }
        }
      }
    } catch (error) {
      console.error('Error in batch permissions fetch:', error);
    }
  }

  return resultMap;
}

// 저장소 접근 권한 체크 함수
export async function checkRepositoryAccess(
  repository: string,
  owner: string,
  currentWallet?: string
): Promise<{ canAccess: boolean; reason?: string }> {
  try {
    // 소유자는 항상 접근 가능
    if (currentWallet && currentWallet === owner) {
      return { canAccess: true };
    }

    // 저장소 가시성 확인
    const visibility = await getRepositoryVisibility(repository, owner);

    // 가시성 정보가 없거나 public인 경우 접근 허용
    if (!visibility || visibility.visibility === 'public') {
      return { canAccess: true };
    }

    // private 저장소인 경우
    if (visibility.visibility === 'private') {
      // 지갑이 연결되지 않은 경우 접근 거부
      if (!currentWallet) {
        return {
          canAccess: false,
          reason:
            'Please connect your wallet to access this private repository.',
        };
      }

      // 편집 권한 확인
      const permissions = await getRepositoryPermissions(repository, owner);
      if (permissions && permissions.contributors.includes(currentWallet)) {
        return { canAccess: true };
      }

      return {
        canAccess: false,
        reason: 'You do not have permission to access this private repository.',
      };
    }

    return { canAccess: true };
  } catch (error) {
    console.error('Error checking repository access:', error);
    // 오류 발생 시 안전을 위해 접근 거부
    return { canAccess: false, reason: 'Error checking repository access.' };
  }
}

// mutable 주소 최적화를 위한 헬퍼 함수들
export const MutableOptimizationUtils = {
  // mutable 주소 resolve 상태 확인
  getMutableResolveStats: (): {
    cacheHits: number;
    total: number;
    hitRate: string;
  } => {
    let cacheHits = 0;
    let total = 0;

    cache.forEach((value, key) => {
      if (key.startsWith('mutable-resolve:')) {
        total++;
        if (value.data) {
          cacheHits++;
        }
      }
    });

    const hitRate = total > 0 ? ((cacheHits / total) * 100).toFixed(1) : '0.0';

    return {
      cacheHits,
      total,
      hitRate: `${hitRate}%`,
    };
  },

  // mutable 주소들을 미리 resolve하여 캐시에 저장 (최적화용)
  preResolveMutableAddresses: async (
    mutableAddresses: string[]
  ): Promise<void> => {
    const unresolvedAddresses = mutableAddresses.filter(addr => {
      const cacheKey = getCacheKey('mutable-resolve', { mutableAddress: addr });
      return !getFromCache<string>(cacheKey);
    });

    if (unresolvedAddresses.length > 0) {
      console.log(
        `Pre-resolving ${unresolvedAddresses.length} mutable addresses...`
      );

      // 병렬로 resolve (최대 5개씩 처리)
      const batchSize = 5;
      for (let i = 0; i < unresolvedAddresses.length; i += batchSize) {
        const batch = unresolvedAddresses.slice(i, i + batchSize);
        await Promise.allSettled(
          batch.map(addr => resolveMutableAddress(addr))
        );
      }

      console.log(`Mutable address pre-resolution completed.`);
    }
  },

  // mutable 관련 캐시 정리
  clearMutableCache: (): void => {
    const keysToDelete: string[] = [];
    cache.forEach((_, key) => {
      if (key.startsWith('mutable-resolve:') || key.startsWith('download:')) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => cache.delete(key));
    console.log(
      `Cleared ${keysToDelete.length} mutable-related cache entries.`
    );
  },
};

// 성능 모니터링을 위한 디버깅 함수
export function logMutableOptimizationStats(): void {
  if (
    typeof window !== 'undefined' &&
    window.location.hostname === 'localhost'
  ) {
    const stats = MutableOptimizationUtils.getMutableResolveStats();
    console.log('🚀 Mutable Address Optimization Stats:', {
      'Cache Hits': stats.cacheHits,
      'Total Resolves': stats.total,
      'Hit Rate': stats.hitRate,
      Optimization: stats.cacheHits > 0 ? 'Active' : 'Not Active',
    });
  }
}

// URL 검증 상태 디버깅 함수
export function debugProfileImageUrls(): void {
  if (
    typeof window !== 'undefined' &&
    window.location.hostname === 'localhost'
  ) {
    const images = document.querySelectorAll('img');
    let validUrls = 0;
    let invalidUrls = 0;
    const invalidUrlList: string[] = [];

    images.forEach(img => {
      const src = img.src;
      if (src && src.includes('gateway.irys.xyz')) {
        if (URLUtils.isValidUrl(src)) {
          validUrls++;
        } else {
          invalidUrls++;
          invalidUrlList.push(src);
        }
      }
    });

    console.log('🖼️ Profile Image URL Debug:', {
      'Valid URLs': validUrls,
      'Invalid URLs': invalidUrls,
      'Invalid List': invalidUrlList.length > 0 ? invalidUrlList : 'None',
    });

    if (invalidUrlList.length > 0) {
      console.warn('❌ Invalid URLs found:', invalidUrlList);
    }
  }
}

// Mutable 주소 해결 상태 디버깅 함수
export function debugMutableResolveStatus(): void {
  if (
    typeof window !== 'undefined' &&
    window.location.hostname === 'localhost'
  ) {
    const allCacheKeys = Object.keys(localStorage).filter(key =>
      key.includes('mutable-resolve:')
    );

    const resolveStats = {
      totalCached: allCacheKeys.length,
      recentlyResolved: 0,
      expired: 0,
    };

    allCacheKeys.forEach(key => {
      try {
        const cached = localStorage.getItem(key);
        if (cached) {
          const parsedCache = JSON.parse(cached);
          const now = Date.now();
          const isExpired = now > parsedCache.expiry;

          if (isExpired) {
            resolveStats.expired++;
          } else if (now - (parsedCache.expiry - parsedCache.ttl) < 60000) {
            // 1분 이내
            resolveStats.recentlyResolved++;
          }
        }
      } catch (e) {
        // 잘못된 캐시 항목은 무시
      }
    });

    console.log('🔄 Mutable Resolve Debug:', {
      'Total Cached Resolves': resolveStats.totalCached,
      'Recently Resolved (1min)': resolveStats.recentlyResolved,
      'Expired Entries': resolveStats.expired,
      'Cache Hit Potential': `${Math.round(((resolveStats.totalCached - resolveStats.expired) / Math.max(resolveStats.totalCached, 1)) * 100)}%`,
    });

    // 최근 성공한 resolve들 표시
    if (resolveStats.recentlyResolved > 0) {
      console.log(
        `✅ ${resolveStats.recentlyResolved} mutable addresses were successfully resolved recently`
      );
    }
  }
}

// 실시간 mutable resolve 테스트 함수
export async function testMutableResolve(
  mutableAddress: string
): Promise<void> {
  if (
    typeof window !== 'undefined' &&
    window.location.hostname === 'localhost'
  ) {
    console.log(
      `🧪 Testing mutable resolve for: ${mutableAddress.slice(0, 12)}...`
    );

    const startTime = performance.now();
    const resolved = await resolveMutableAddress(mutableAddress);
    const endTime = performance.now();

    if (resolved) {
      console.log(
        `✅ Resolve successful in ${Math.round(endTime - startTime)}ms`
      );
      console.log(
        `   ${mutableAddress.slice(0, 12)}... → ${resolved.slice(0, 12)}...`
      );

      // URL 유효성도 확인
      const testUrl = `https://gateway.irys.xyz/${resolved}`;
      if (
        URLUtils.isValidUrl(
          `https://gateway.irys.xyz/mutable/${mutableAddress}`
        )
      ) {
        console.log(`   Generated URL: ${testUrl}`);
      } else {
        console.warn(`   ⚠️ Generated invalid URL: ${testUrl}`);
      }
    } else {
      console.warn(
        `❌ Resolve failed after ${Math.round(endTime - startTime)}ms`
      );
    }
  }
}

// URL 검증 및 안전 처리 유틸리티
export const URLUtils = {
  // 트랜잭션 ID 유효성 검증
  isValidTransactionId: (txId: string): boolean => {
    if (!txId || typeof txId !== 'string') return false;
    // Solana/Arweave 트랜잭션 ID는 일반적으로 43-44자의 Base58
    return (
      txId.length >= 32 && txId.length <= 50 && /^[a-zA-Z0-9_-]+$/.test(txId)
    );
  },

  // 개선된 프로필 이미지 URL 생성 (일반 트랜잭션 URL 사용)
  createSafeProfileImageUrl: (
    txId: string | undefined,
    resolvedTxId?: string
  ): string | undefined => {
    if (!txId) return undefined;

    if (!URLUtils.isValidTransactionId(txId)) {
      console.warn(`Invalid transaction ID for profile image: ${txId}`);
      return undefined;
    }

    // 일반 트랜잭션 URL 사용 (mutable URL 대신)
    return `https://gateway.irys.xyz/${txId}`;
  },

  // URL 유효성 검증
  isValidUrl: (url: string | undefined): boolean => {
    if (!url) return false;
    try {
      const parsed = new URL(url);
      return (
        parsed.protocol === 'https:' && parsed.hostname === 'gateway.irys.xyz'
      );
    } catch {
      return false;
    }
  },
};

// 로딩 성능 측정을 위한 유틸리티
export const PerformanceUtils = {
  // 함수 실행 시간 측정
  measureTime: async <T>(label: string, fn: () => Promise<T>): Promise<T> => {
    const start = performance.now();
    try {
      const result = await fn();
      const end = performance.now();
      const duration = Math.round(end - start);

      if (
        typeof window !== 'undefined' &&
        window.location.hostname === 'localhost'
      ) {
        console.log(`⏱️ ${label}: ${duration}ms`);
      }

      return result;
    } catch (error) {
      const end = performance.now();
      const duration = Math.round(end - start);

      if (
        typeof window !== 'undefined' &&
        window.location.hostname === 'localhost'
      ) {
        console.log(`❌ ${label}: ${duration}ms (failed)`);
      }

      throw error;
    }
  },

  // 로딩 단계별 성능 로그
  logLoadingStep: (step: string, startTime: number): void => {
    if (
      typeof window !== 'undefined' &&
      window.location.hostname === 'localhost'
    ) {
      const duration = Math.round(performance.now() - startTime);
      console.log(`📊 Loading Step - ${step}: ${duration}ms`);
    }
  },
};

// 개발 환경에서 전역 디버깅 함수 등록 (PerformanceUtils 선언 이후)
if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
  (window as any).debugMutableResolve = {
    checkImages: debugProfileImageUrls,
    checkStatus: debugMutableResolveStatus,
    testResolve: testMutableResolve,
    measureTime: PerformanceUtils.measureTime,
  };

  console.log('🔧 Mutable resolve debug tools available:');
  console.log('  debugMutableResolve.checkImages() - Check all image URLs');
  console.log(
    '  debugMutableResolve.checkStatus() - Check resolve cache status'
  );
  console.log(
    '  debugMutableResolve.testResolve(txId) - Test specific mutable address'
  );
  console.log(
    '  debugMutableResolve.measureTime(label, fn) - Measure function performance'
  );
}
