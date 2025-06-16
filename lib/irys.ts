// lib/irys.ts
import { WebUploader } from '@irys/web-upload';
import { WebSolana } from '@irys/web-upload-solana';
import { Connection } from '@solana/web3.js';

// Remove explicit RPC configuration and let Irys handle it internally
// Irys has its own RPC configuration that works in browser environments

// 쿼리 큐 관리를 위한 변수
let isQueryRunning = false;
const queryQueue: (() => Promise<any>)[] = [];

// 업로드 큐 관리를 위한 변수
let isUploadRunning = false;
const uploadQueue: (() => Promise<any>)[] = [];

// 쿼리 실행 함수 - 동시 실행 방지
async function executeQuery<T>(
  queryName: string,
  queryFn: () => Promise<T>
): Promise<T> {
  return new Promise((resolve, reject) => {
    const wrappedQuery = async () => {
      try {
        console.log(`[executeQuery] ${queryName} 쿼리 실행 시작`);
        const result = await queryFn();
        console.log(`[executeQuery] ${queryName} 쿼리 실행 완료`);
        resolve(result);
      } catch (error) {
        console.error(`[executeQuery] ${queryName} 쿼리 실행 오류:`, error);
        reject(error);
      }
    };

    queryQueue.push(wrappedQuery);
    processQueue();
  });
}

// 업로드 실행 함수 - 동시 실행 방지
async function executeUpload<T>(
  uploadName: string,
  uploadFn: () => Promise<T>
): Promise<T> {
  return new Promise((resolve, reject) => {
    const wrappedUpload = async () => {
      try {
        console.log(`[executeUpload] ${uploadName} 업로드 시작`);
        const result = await uploadFn();
        console.log(`[executeUpload] ${uploadName} 업로드 완료`);
        resolve(result);
      } catch (error) {
        console.error(`[executeUpload] ${uploadName} 업로드 오류:`, error);
        reject(error);
      }
    };

    uploadQueue.push(wrappedUpload);
    processUploadQueue();
  });
}

// 큐 처리 함수
async function processQueue() {
  if (isQueryRunning || queryQueue.length === 0) return;

  isQueryRunning = true;
  const query = queryQueue.shift();

  try {
    await query!();
  } catch (error) {
    console.error('Query execution error:', error);
  } finally {
    isQueryRunning = false;
    // 300ms 대기 후 다음 쿼리 실행 (rate limit 방지)
    setTimeout(() => processQueue(), 300);
  }
}

// 업로드 큐 처리 함수
async function processUploadQueue() {
  if (isUploadRunning || uploadQueue.length === 0) return;

  isUploadRunning = true;
  const upload = uploadQueue.shift();

  try {
    await upload!();
  } catch (error) {
    console.error('Upload execution error:', error);
  } finally {
    isUploadRunning = false;
    // 500ms 대기 후 다음 업로드 실행 (업로드는 더 긴 간격 필요)
    setTimeout(() => processUploadQueue(), 500);
  }
}

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
  visibility?: 'public' | 'private';
  permissionTimestamp?: number;
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

    console.log('[createIrysUploader] Creating Irys uploader...');

    // Use withProvider and set RPC URL from environment variable if available
    const irysUploader = process.env.NEXT_PUBLIC_SOLANA_RPC_URL
      ? await WebUploader(WebSolana)
          .withProvider(wallet)
          .withRpc(process.env.NEXT_PUBLIC_SOLANA_RPC_URL)
      : await WebUploader(WebSolana).withProvider(wallet);

    console.log(
      `[createIrysUploader] Connected to Irys from ${irysUploader.address}`
    );
    return irysUploader;
  } catch (error) {
    console.error('Error connecting to Irys:', error);
    throw new Error('Error connecting to Irys');
  }
}

// Test function to check if we can connect to Irys GraphQL
export async function testIrysConnection(): Promise<boolean> {
  // 연결 상태를 5분간 캐시
  const cacheKey = getCacheKey('irys-connection', {});
  const cached = getFromCache<boolean>(cacheKey);

  if (cached !== null && cached !== undefined) {
    console.log('[testIrysConnection] 캐시된 연결 상태 사용:', cached);
    return cached;
  }

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
    const result = await executeQuery('testIrysConnection', async () => {
      const response = await fetch('https://uploader.irys.xyz/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: testQuery }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    });

    const isConnected = !result.errors;

    // 연결 상태를 5분간 캐시에 저장
    setCache(cacheKey, isConnected, 5 * 60 * 1000); // 5분
    console.log('[testIrysConnection] 연결 상태 캐시에 저장:', isConnected);

    return isConnected;
  } catch (error) {
    // 오류 발생 시에도 false로 캐시 (단, 더 짧은 시간)
    setCache(cacheKey, false, 60 * 1000); // 1분
    console.log('[testIrysConnection] 연결 실패, 1분간 캐시에 저장');
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

  const endpoint = 'https://uploader.irys.xyz/graphql';

  try {
    // 닉네임 데이터 먼저 로드 (순차적으로 변경)
    const nicknameResult = await executeQuery(
      'searchAllRepositories-nicknames',
      async () => {
        const nicknameResponse = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: `
              query getAllNicknames {
                transactions(
                  tags: [{ name: "App-Name", values: ["irys-git-nickname"] }],
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
          }),
        });

        if (!nicknameResponse.ok) {
          throw new Error(`HTTP error! status: ${nicknameResponse.status}`);
        }

        return await nicknameResponse.json();
      }
    );
    if (nicknameResult.errors) {
      return [];
    }

    // 저장소 데이터 로드
    const repositoryResult = await executeQuery(
      'searchAllRepositories-repos',
      async () => {
        const repositoryResponse = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: `
              query getAllRepositories {
                transactions(
                  tags: [{ name: "App-Name", values: ["irys-git"] }],
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
          }),
        });

        if (!repositoryResponse.ok) {
          throw new Error(`HTTP error! status: ${repositoryResponse.status}`);
        }

        return await repositoryResponse.json();
      }
    );
    if (repositoryResult.errors) {
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
      // 권한 기반 필터링 (프로필과 동일한 방식)
      for (const repo of otherRepos) {
        // 가시성 확인
        const visibility = await getRepositoryVisibility(repo.name, repo.owner);

        if (!visibility || visibility.visibility === 'public') {
          visibleRepositories.push(repo);
        } else if (visibility.visibility === 'private' && currentWallet) {
          // private인 경우 권한 확인
          const permissions = await getRepositoryPermissions(
            repo.name,
            repo.owner
          );
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

  // 프로필 쿼리와 동일한 방식으로 단순화
  const query = `
    query getRepositories($owner: String!) {
      transactions(
        tags: [
          { name: "App-Name", values: ["irys-git"] },
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
    // 단일 요청으로 단순화 (프로필 조회와 동일한 패턴)
    const result = await executeQuery('searchRepositories', async () => {
      const response = await fetch('https://uploader.irys.xyz/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          variables: { owner },
        }),
      });

      if (!response.ok) {
        throw new Error('Response not ok');
      }

      return await response.json();
    });

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

    // 비소유자인 경우 권한 기반 필터링 (프로필과 동일한 방식)
    const filteredRepositories: Repository[] = [];

    for (const repo of repositories) {
      // 가시성 확인
      const visibility = await getRepositoryVisibility(repo.name, repo.owner);

      if (!visibility || visibility.visibility === 'public') {
        filteredRepositories.push(repo);
      } else if (visibility.visibility === 'private' && currentWallet) {
        // private인 경우 권한 확인
        const permissions = await getRepositoryPermissions(
          repo.name,
          repo.owner
        );
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

// 저장소를 점진적으로 로드하는 함수 (캐싱 포함)
export async function* searchRepositoriesProgressive(
  owner: string,
  currentWallet?: string
): AsyncGenerator<Repository, void, unknown> {
  // Test Irys connection first
  const canConnect = await testIrysConnection();

  // 프로필 쿼리와 동일한 방식으로 단순화
  const query = `
    query getRepositories($owner: String!) {
      transactions(
        tags: [
          { name: "App-Name", values: ["irys-git"] },
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
    // 단일 요청으로 단순화 (프로필 조회와 동일한 패턴)
    const result = await executeQuery(
      'searchRepositoriesProgressive',
      async () => {
        const response = await fetch('https://uploader.irys.xyz/graphql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query,
            variables: { owner },
          }),
        });

        if (!response.ok) {
          throw new Error('Response not ok');
        }

        return await response.json();
      }
    );

    if (result.errors) {
      return;
    }

    const transactions = result.data?.transactions?.edges || [];

    if (transactions.length === 0) {
      return;
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

    // 두 번째 패스: Repository 객체 생성 및 점진적 반환
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

      const repository: Repository = {
        name: repoName,
        owner: owner,
        branches: branchInfos,
        defaultBranch: defaultBranch,
        tags: branchInfos[0]?.tags || [],
      };

      // 권한 필터링 최적화 - 소유자인 경우 권한 체크 스킵
      if (owner === currentWallet) {
        // 소유자는 모든 저장소에 접근 가능하므로 바로 반환
        yield repository;
      } else {
        // 비소유자인 경우 권한 기반 필터링

        // 먼저 캐시된 권한 정보 확인
        const visibilityCacheKey = getCacheKey('repo-visibility', {
          repo: repoName,
          owner,
        });
        const permissionsCacheKey = getCacheKey('repo-permissions', {
          repo: repoName,
          owner,
        });

        let visibility = getFromCache<RepositoryVisibility>(visibilityCacheKey);
        let permissions =
          getFromCache<RepositoryPermissions>(permissionsCacheKey);

        // 캐시가 없으면 가져오기
        if (!visibility) {
          visibility = await getRepositoryVisibility(repoName, owner);
          if (visibility) {
            setCache(visibilityCacheKey, visibility, 30 * 60 * 1000); // 30분 캐싱
          }
        }

        if (!visibility || visibility.visibility === 'public') {
          yield repository;
        } else if (visibility.visibility === 'private' && currentWallet) {
          // private인 경우 권한 확인
          if (!permissions) {
            permissions = await getRepositoryPermissions(repoName, owner);
            if (permissions) {
              setCache(permissionsCacheKey, permissions, 30 * 60 * 1000); // 30분 캐싱
            }
          }

          if (permissions && permissions.contributors.includes(currentWallet)) {
            yield repository;
          }
        }
      }
    }
  } catch (error) {
    console.error('저장소 검색 오류:', error);
  }
}

// 점진적 로딩을 배열로 변환하는 헬퍼 함수
export async function searchRepositoriesAsArray(
  owner: string,
  currentWallet?: string
): Promise<Repository[]> {
  const repositories: Repository[] = [];

  try {
    for await (const repo of searchRepositoriesProgressive(
      owner,
      currentWallet
    )) {
      repositories.push(repo);
    }
  } catch (error) {
    console.error('저장소 검색 오류:', error);
  }

  return repositories;
}

// 백그라운드에서 권한 정보를 미리 로드하는 함수
export async function preloadRepositoryPermissions(
  repositories: Repository[],
  currentWallet?: string
): Promise<void> {
  if (!currentWallet) return;

  // 권한 체크가 필요한 저장소만 필터링 (소유자가 아닌 경우)
  const reposToCheck = repositories.filter(
    repo => repo.owner !== currentWallet
  );

  // 순차적으로 권한 정보 로드 (CORS 에러 방지)
  for (const repo of reposToCheck) {
    try {
      // 캐시 키 확인
      const visibilityCacheKey = getCacheKey('repo-visibility', {
        repo: repo.name,
        owner: repo.owner,
      });
      const permissionsCacheKey = getCacheKey('repo-permissions', {
        repo: repo.name,
        owner: repo.owner,
      });

      // 캐시가 없는 경우에만 로드
      if (!getFromCache(visibilityCacheKey)) {
        await getRepositoryVisibility(repo.name, repo.owner);
      }

      // private 저장소인 경우에만 권한 체크
      const visibility = getFromCache<RepositoryVisibility>(visibilityCacheKey);
      if (
        visibility?.visibility === 'private' &&
        !getFromCache(permissionsCacheKey)
      ) {
        await getRepositoryPermissions(repo.name, repo.owner);
      }
    } catch (error) {
      console.error(`권한 미리 로드 실패 ${repo.owner}/${repo.name}:`, error);
    }
  }
}

// Get transaction details by ID with correct Irys syntax
export async function getTransactionById(
  transactionId: string
): Promise<any | null> {
  console.log('[getTransactionById] 쿼리 시작:', transactionId);
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
    const result = await executeQuery('getTransactionById', async () => {
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
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    });

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
    if (cached) {
      console.log('[downloadData] 캐시에서 반환:', transactionId);
      return cached;
    }
  }

  console.log('[downloadData] 다운로드 시작:', transactionId);

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
  // 권한 관리 필드 추가
  privateRepos?: string[]; // private 저장소 목록 ["repo1", "repo2"]
  repoPermissions?: { [key: string]: string[] }; // 저장소별 권한 {"owner/repo": ["user1", "user2"]}
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
    const result = await executeQuery('getProfileImageUrl', async () => {
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

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    });
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

// Irys wallet 관련 함수들
export async function getIrysBalance(
  uploader: any
): Promise<{ balance: string; formatted: string }> {
  try {
    const balance = await uploader.getLoadedBalance();
    // atomic units to SOL conversion (1 SOL = 10^9 lamports)
    const balanceInSol = balance.dividedBy(1e9);
    return {
      balance: balance.toString(),
      formatted: `${balanceInSol.toFixed(9)} SOL`,
    };
  } catch (error) {
    console.error('Error getting Irys balance:', error);
    return {
      balance: '0',
      formatted: '0 SOL',
    };
  }
}

// Server-side upload proxy option for production environments
export async function uploadViaServerProxy(
  data: Buffer | string,
  tags: any[],
  userAddress: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    console.log(
      `[uploadViaServerProxy] Uploading via server for ${userAddress}`
    );

    // Convert data to base64 if it's a Buffer
    const base64Data = Buffer.isBuffer(data)
      ? data.toString('base64')
      : Buffer.from(data).toString('base64');

    const response = await fetch('/api/irys-upload-proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: base64Data,
        tags,
        userAddress,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.details || error.error || 'Upload request failed');
    }

    const result = await response.json();
    console.log(`[uploadViaServerProxy] Upload successful:`, result.id);

    return {
      success: true,
      id: result.id,
    };
  } catch (error) {
    console.error('[uploadViaServerProxy] Upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

// Original client-side funding (may face RPC issues)
export async function fundIrysWallet(
  uploader: any,
  amountInSol: number
): Promise<{ success: boolean; txId?: string; error?: string }> {
  try {
    // Try server-side funding first (if configured)
    if (process.env.NEXT_PUBLIC_USE_SERVER_FUND === 'true') {
      // For server-side funding, we would use the uploadViaServerProxy instead
      // This requires a different approach - not direct funding
      console.log(
        '[fundIrysWallet] Server-side funding is enabled but requires upload proxy approach'
      );
    }

    // Fall back to client-side funding
    const amountInLamports = Math.floor(amountInSol * 1e9);
    console.log(
      `[fundIrysWallet] Funding with ${amountInSol} SOL (${amountInLamports} lamports)`
    );

    const fundResult = await uploader.fund(amountInLamports);
    console.log(`[fundIrysWallet] Fund transaction ID: ${fundResult.id}`);

    return {
      success: true,
      txId: fundResult.id,
    };
  } catch (error) {
    console.error('[fundIrysWallet] Funding error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

export async function getIrysUploadPrice(
  uploader: any,
  sizeInBytes: number
): Promise<{ price: string; formatted: string }> {
  try {
    const price = await uploader.getPrice(sizeInBytes);
    // atomic units to SOL conversion
    const priceInSol = price.dividedBy(1e9);
    return {
      price: price.toString(),
      formatted: `${priceInSol.toFixed(9)} SOL`,
    };
  } catch (error) {
    console.error('Error getting upload price:', error);
    return {
      price: '0',
      formatted: '0 SOL',
    };
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
        first: 10
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
  if (cached) {
    console.log('[getProfileByAddress] 캐시에서 반환:', address);
    return cached;
  }

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
    const result = await executeQuery('getProfileByAddress', async () => {
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

      return await response.json();
    });
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

    // 권한 관리 태그 파싱
    const privateReposTag = tags.find(
      (tag: any) => tag.name === 'githirys_private_repos'
    )?.value;
    const repoPermissionsTag = tags.find(
      (tag: any) => tag.name === 'githirys_repo_permissions'
    )?.value;

    let privateRepos: string[] | undefined;
    let repoPermissions: { [key: string]: string[] } | undefined;

    try {
      if (privateReposTag) {
        privateRepos = JSON.parse(privateReposTag);
      }
      if (repoPermissionsTag) {
        repoPermissions = JSON.parse(repoPermissionsTag);
      }
    } catch (e) {
      console.error('권한 태그 파싱 오류:', e);
    }

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
      privateRepos,
      repoPermissions,
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
    const result = await executeQuery('getProfileByNickname', async () => {
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

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    });
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

    // 권한 관리 태그 파싱
    const privateReposTag = tags.find(
      (tag: any) => tag.name === 'githirys_private_repos'
    )?.value;
    const repoPermissionsTag = tags.find(
      (tag: any) => tag.name === 'githirys_repo_permissions'
    )?.value;

    let privateRepos: string[] | undefined;
    let repoPermissions: { [key: string]: string[] } | undefined;

    try {
      if (privateReposTag) {
        privateRepos = JSON.parse(privateReposTag);
      }
      if (repoPermissionsTag) {
        repoPermissions = JSON.parse(repoPermissionsTag);
      }
    } catch (e) {
      console.error('권한 태그 파싱 오류:', e);
    }

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
      privateRepos,
      repoPermissions,
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
    privateRepos?: string[];
    repoPermissions?: { [key: string]: string[] };
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

    // 권한 관리 태그 추가
    if (profileData.privateRepos && profileData.privateRepos.length > 0) {
      tags.push({
        name: 'githirys_private_repos',
        value: JSON.stringify(profileData.privateRepos),
      });
    }

    if (
      profileData.repoPermissions &&
      Object.keys(profileData.repoPermissions).length > 0
    ) {
      tags.push({
        name: 'githirys_repo_permissions',
        value: JSON.stringify(profileData.repoPermissions),
      });
    }

    // 기존 프로필이 있는 경우 Root-TX 태그 추가
    if (profileData.existingRootTxId) {
      tags.push({ name: 'Root-TX', value: profileData.existingRootTxId });
    }

    // 100KB 이상의 파일인 경우 잔액 확인 및 충전
    const uploadSize = uploadData.size || (uploadData as Blob).size;
    if (uploadSize > 100 * 1024) {
      console.log(
        `[uploadProfile] File size ${uploadSize} bytes exceeds 100KB, checking balance...`
      );

      try {
        // 업로드 비용 계산
        const uploadPrice = await uploader.getPrice(uploadSize);
        console.log(
          `[uploadProfile] Upload price: ${uploadPrice.toString()} atomic units`
        );

        // 현재 잔액 확인
        const balance = await uploader.getLoadedBalance();
        console.log(
          `[uploadProfile] Current balance: ${balance.toString()} atomic units`
        );

        // 잔액이 부족한 경우 충전
        if (balance.isLessThan(uploadPrice)) {
          const requiredAmount = uploadPrice.minus(balance);
          console.log(
            `[uploadProfile] Insufficient balance. Need to fund: ${requiredAmount.toString()} atomic units`
          );

          // 충전 금액은 필요한 금액의 1.1배로 설정 (여유분 포함)
          const fundAmount = requiredAmount.multipliedBy(1.1).integerValue();
          console.log(
            `[uploadProfile] Funding with: ${fundAmount.toString()} atomic units`
          );

          const fundResult = await uploader.fund(fundAmount);
          console.log(`[uploadProfile] Fund transaction ID: ${fundResult.id}`);

          // 충전 후 잔액 재확인
          const newBalance = await uploader.getLoadedBalance();
          console.log(
            `[uploadProfile] New balance after funding: ${newBalance.toString()} atomic units`
          );
        }
      } catch (fundError) {
        console.error('[uploadProfile] Funding error:', fundError);
        return {
          success: false,
          error: `Failed to fund wallet: ${fundError instanceof Error ? fundError.message : 'Unknown error'}`,
        };
      }
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

// 저장소 권한 정보 조회 (프로필 기반)
export async function getRepositoryPermissions(
  repository: string,
  owner: string
): Promise<RepositoryPermissions | null> {
  // 캐시 확인
  const cacheKey = getCacheKey('repo-permissions', { repo: repository, owner });
  const cached = getFromCache<RepositoryPermissions>(cacheKey);
  if (cached) {
    console.log('[getRepositoryPermissions] 캐시에서 반환:', repository, owner);
    return cached;
  }

  try {
    console.log('[getRepositoryPermissions] 쿼리 시작:', repository, owner);
    // 소유자의 프로필을 조회하여 권한 정보 확인
    const ownerProfile = await getProfileByAddress(owner);

    if (!ownerProfile) {
      // 프로필이 없으면 기본값 반환 (소유자만 포함)
      const defaultPermissions: RepositoryPermissions = {
        repository,
        owner,
        contributors: [owner],
        timestamp: TimestampUtils.normalize(Date.now()),
      };
      setCache(cacheKey, defaultPermissions, 10 * 60 * 1000);
      return defaultPermissions;
    }

    // 저장소별 권한 정보 확인
    const repoKey = `${owner}/${repository}`;
    const contributors = ownerProfile.repoPermissions?.[repoKey] || [owner];

    // 소유자가 contributors에 없으면 추가
    if (!contributors.includes(owner)) {
      contributors.unshift(owner);
    }

    const permissions: RepositoryPermissions = {
      repository,
      owner,
      contributors,
      timestamp: ownerProfile.timestamp,
    };

    // 결과 캐싱 (프로필과 동일한 시간)
    setCache(cacheKey, permissions, 10 * 60 * 1000);
    return permissions;
  } catch (error) {
    return null;
  }
}

// 저장소 권한 업데이트 (프로필 기반)
export async function updateRepositoryPermissions(
  uploader: any,
  permissionsData: {
    repository: string;
    owner: string;
    contributors: string[];
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

    // 현재 프로필 정보 가져오기
    const currentProfile = await getProfileByAddress(permissionsData.owner);
    if (!currentProfile) {
      return {
        success: false,
        error: '프로필을 찾을 수 없습니다.',
      };
    }

    // 저장소별 권한 정보 업데이트
    const updatedRepoPermissions = {
      ...(currentProfile.repoPermissions || {}),
    };

    const repoKey = `${permissionsData.owner}/${permissionsData.repository}`;

    // contributors가 비어있거나 소유자만 있으면 삭제
    if (
      permissionsData.contributors.length <= 1 &&
      permissionsData.contributors[0] === permissionsData.owner
    ) {
      delete updatedRepoPermissions[repoKey];
    } else {
      updatedRepoPermissions[repoKey] = permissionsData.contributors;
    }

    // 프로필 업데이트
    const result = await uploadProfile(uploader, {
      nickname: currentProfile.nickname,
      twitterHandle: currentProfile.twitterHandle,
      accountAddress: currentProfile.accountAddress,
      existingRootTxId: currentProfile.rootTxId,
      existingProfileImageUrl: currentProfile.profileImageUrl,
      privateRepos: currentProfile.privateRepos,
      repoPermissions: updatedRepoPermissions,
    });

    // 캐시 무효화
    if (result.success) {
      const cacheKey = getCacheKey('profile-address', {
        address: permissionsData.owner,
      });
      removeFromCache(cacheKey);

      const permissionsCacheKey = getCacheKey('repo-permissions', {
        repo: permissionsData.repository,
        owner: permissionsData.owner,
      });
      removeFromCache(permissionsCacheKey);
    }

    return result;
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
    return results;
  } else {
    // 닉네임으로 부분검색 지원
    try {
      const endpoint = 'https://uploader.irys.xyz/graphql';
      const result = await executeQuery('searchUsers', async () => {
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
        });

        // response.ok 체크 제거 (프로필처럼)
        return await response.json();
      });

      if (result.errors) {
        return results;
      }

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

        if (nicknameTag && accountTag) {
          const profileImageUrl = URLUtils.createIrysUrl(node.id);
          const rootTxId = node.id;

          const profile: UserProfile = {
            nickname: nicknameTag.value,
            twitterHandle: twitterTag?.value || '',
            accountAddress: accountTag.value,
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
    } catch (error) {
      console.error('Search error:', error);
      return results;
    }
  }

  return results;
}

// 저장소 노출 권한 정보 조회 (프로필 기반)
export async function getRepositoryVisibility(
  repository: string,
  owner: string
): Promise<RepositoryVisibility | null> {
  // 캐시 확인
  const cacheKey = getCacheKey('repo-visibility', { repo: repository, owner });
  const cached = getFromCache<RepositoryVisibility>(cacheKey);
  if (cached) {
    console.log('[getRepositoryVisibility] 캐시에서 반환:', repository, owner);
    return cached;
  }

  try {
    console.log('[getRepositoryVisibility] 쿼리 시작:', repository, owner);
    // 소유자의 프로필을 조회하여 private 저장소 목록 확인
    const ownerProfile = await getProfileByAddress(owner);

    if (!ownerProfile) {
      // 프로필이 없으면 기본값 반환 (public)
      const defaultVisibility: RepositoryVisibility = {
        repository,
        owner,
        visibility: 'public',
        timestamp: TimestampUtils.normalize(Date.now()),
      };
      setCache(cacheKey, defaultVisibility, 10 * 60 * 1000);
      return defaultVisibility;
    }

    // private 저장소 목록에 포함되어 있는지 확인
    const isPrivate = ownerProfile.privateRepos?.includes(repository) || false;

    const visibility: RepositoryVisibility = {
      repository,
      owner,
      visibility: isPrivate ? 'private' : 'public',
      timestamp: ownerProfile.timestamp,
    };

    // 결과 캐싱 (프로필과 동일한 시간)
    setCache(cacheKey, visibility, 10 * 60 * 1000);
    return visibility;
  } catch (error) {
    return null;
  }
}

// 저장소 노출 권한 업데이트 (프로필 기반)
export async function updateRepositoryVisibility(
  uploader: any,
  visibilityData: {
    repository: string;
    owner: string;
    visibility: 'public' | 'private';
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

    // 현재 프로필 정보 가져오기
    const currentProfile = await getProfileByAddress(visibilityData.owner);
    if (!currentProfile) {
      return {
        success: false,
        error: '프로필을 찾을 수 없습니다.',
      };
    }

    // private 저장소 목록 업데이트
    let updatedPrivateRepos = currentProfile.privateRepos || [];

    if (visibilityData.visibility === 'private') {
      // private으로 변경 - 목록에 추가
      if (!updatedPrivateRepos.includes(visibilityData.repository)) {
        updatedPrivateRepos.push(visibilityData.repository);
      }
    } else {
      // public으로 변경 - 목록에서 제거
      updatedPrivateRepos = updatedPrivateRepos.filter(
        repo => repo !== visibilityData.repository
      );
    }

    // 프로필 업데이트
    const result = await uploadProfile(uploader, {
      nickname: currentProfile.nickname,
      twitterHandle: currentProfile.twitterHandle,
      accountAddress: currentProfile.accountAddress,
      existingRootTxId: currentProfile.rootTxId,
      existingProfileImageUrl: currentProfile.profileImageUrl,
      privateRepos: updatedPrivateRepos,
      repoPermissions: currentProfile.repoPermissions,
    });

    // 캐시 무효화
    if (result.success) {
      const cacheKey = getCacheKey('profile-address', {
        address: visibilityData.owner,
      });
      removeFromCache(cacheKey);

      const visibilityCacheKey = getCacheKey('repo-visibility', {
        repo: visibilityData.repository,
        owner: visibilityData.owner,
      });
      removeFromCache(visibilityCacheKey);
    }

    return result;
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
  console.log('[getRepositoryDescription] 쿼리 시작:', repository, owner);
  const query = `
    query getRepositoryDescription($repository: String!, $owner: String!) {
      transactions(
        tags: [
          { name: "App-Name", values: ["irys-git-repo-description"] },
          { name: "Repository", values: [$repository] },
          { name: "git-owner", values: [$owner] }
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
    const result = await executeQuery('getRepositoryDescription', async () => {
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

      // response.ok 체크 제거 (getRepositoryBranches처럼)
      return await response.json();
    });

    console.log('[getRepositoryDescription] 쿼리 결과:', {
      hasData: !!result.data,
      hasErrors: !!result.errors,
      transactionCount: result.data?.transactions?.edges?.length || 0,
    });

    if (result.errors) {
      console.error('[getRepositoryDescription] GraphQL 에러:', result.errors);
    }

    const transactions = result.data?.transactions?.edges || [];

    if (transactions.length === 0) {
      console.log('[getRepositoryDescription] 설명 데이터가 없습니다');
      return null;
    }

    // Get the latest description data
    const latestTx = transactions[0].node;
    const tags = latestTx.tags || [];

    console.log(
      '[getRepositoryDescription] 트랜잭션 태그:',
      tags.map((t: any) => ({ name: t.name, value: t.value }))
    );

    const rootTxIdTag = tags.find((tag: any) => tag.name === 'Root-TX')?.value;
    const descriptionTag = tags.find(
      (tag: any) => tag.name === 'git-repo-description'
    )?.value;

    // getRepositoryBranches처럼 태그에서 직접 데이터 추출
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

    console.log('[getRepositoryDescription] 설명 데이터 반환:', description);

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
    console.log('[updateRepositoryDescription] 시작:', descriptionData);

    // Verify owner wallet address
    if (!uploader?.address || uploader.address !== descriptionData.owner) {
      console.log('[updateRepositoryDescription] 소유자 확인 실패:', {
        uploaderAddress: uploader?.address,
        expectedOwner: descriptionData.owner,
      });
      return {
        success: false,
        error: 'Wallet address is not the repository owner.',
      };
    }

    // 간단한 텍스트 데이터로 업로드 (getRepositoryBranches 방식처럼)
    const uploadData = descriptionData.description;

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
    console.log('[updateRepositoryDescription] uploadData:', uploadData);
    console.log('[updateRepositoryDescription] tags:', tags);

    // 업로드 큐를 통해 실행
    const result = await executeUpload(
      'updateRepositoryDescription',
      async () => {
        return await uploader.upload(uploadData, { tags });
      }
    );

    console.log('[updateRepositoryDescription] 업로드 완료:', result.id);

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
    const result = await executeQuery('getRepositoryStats', async () => {
      const response = await fetch('https://uploader.irys.xyz/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    });

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
    const result = await executeQuery('debugAllTags', async () => {
      const response = await fetch('https://uploader.irys.xyz/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    });

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
    const result = await executeQuery('getUserStats', async () => {
      const response = await fetch('https://uploader.irys.xyz/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    });

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
    const result = await executeQuery('getCommitStats', async () => {
      const response = await fetch('https://uploader.irys.xyz/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    });

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
    const result = await executeQuery('getRecentUsers', async () => {
      const response = await fetch('https://uploader.irys.xyz/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    });

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
    const result = await executeQuery('getRecentRepositories', async () => {
      const response = await fetch('https://uploader.irys.xyz/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    });

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
    const result = await executeQuery('getRepositoryIssues', async () => {
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

      // response.ok 체크 제거 (프로필처럼)
      return await response.json();
    });

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
        // getRepositoryBranches처럼 태그에서 직접 데이터 추출
        const issueContentTag = node.tags?.find(
          (tag: any) => tag.name === 'issue-content'
        );
        const content = issueContentTag?.value || '';

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
    const result = await executeQuery('getIssueComments', async () => {
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

      // response.ok 체크 제거 (프로필처럼)
      return await response.json();
    });

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
        // getRepositoryBranches처럼 태그에서 직접 데이터 추출
        const commentContentTag = node.tags?.find(
          (tag: any) => tag.name === 'issue-comment-content'
        );
        const content = commentContentTag?.value || '';

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
    console.log('[createIssue] 시작:', issueData);

    // Get next issue count
    console.log('[createIssue] 기존 이슈 조회 중...');
    const existingIssues = await getRepositoryIssues(
      issueData.repository,
      issueData.owner
    );
    console.log('[createIssue] 기존 이슈 수:', existingIssues.length);
    const nextIssueCount = existingIssues.length + 1;

    // 간단한 텍스트 데이터로 업로드 (getRepositoryBranches 방식처럼)
    const uploadData = issueData.content;

    // Create tags
    const tags = [
      { name: 'App-Name', value: 'irys-git-issues' },
      { name: 'Repository', value: issueData.repository },
      { name: 'git-owner', value: issueData.owner },
      { name: 'issue-count', value: nextIssueCount.toString() },
      { name: 'issue-name', value: issueData.title },
      { name: 'issue-content', value: issueData.content },
      { name: 'issue-owner', value: issueData.author },
      { name: 'issue-visibility', value: 'true' },
      { name: 'Content-Type', value: 'application/json' },
      { name: 'Timestamp', value: new Date().toISOString() },
    ];

    // Upload issue
    console.log('[createIssue] uploadData:', uploadData);
    console.log('[createIssue] tags:', tags);

    // 업로드 큐를 통해 실행
    const receipt = await executeUpload('createIssue', async () => {
      return await uploader.upload(uploadData, { tags });
    });

    console.log('[createIssue] 업로드 완료:', receipt.id);

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
    // 간단한 텍스트 데이터로 업로드 (getRepositoryBranches 방식처럼)
    const uploadData = issueData.content;

    // Create tags
    const tags = [
      { name: 'App-Name', value: 'irys-git-issues' },
      { name: 'Repository', value: issueData.repository },
      { name: 'git-owner', value: issueData.owner },
      { name: 'issue-count', value: issueData.issueCount.toString() },
      { name: 'issue-name', value: issueData.title },
      { name: 'issue-content', value: issueData.content },
      { name: 'issue-owner', value: issueData.author },
      { name: 'issue-visibility', value: 'true' },
      { name: 'Content-Type', value: 'application/json' },
      { name: 'Timestamp', value: new Date().toISOString() },
    ];

    // Add Root-TX tag if updating existing issue
    if (issueData.existingRootTxId) {
      tags.push({ name: 'Root-TX', value: issueData.existingRootTxId });
    }

    // Upload updated issue
    const receipt = await executeUpload('updateIssue', async () => {
      return await uploader.upload(uploadData, { tags });
    });

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

    // 간단한 텍스트 데이터로 업로드 (getRepositoryBranches 방식처럼)
    const uploadData = commentData.content;

    // Create tags
    const tags = [
      { name: 'App-Name', value: 'irys-git-issue-comments' },
      { name: 'Repository', value: commentData.repository },
      { name: 'git-owner', value: commentData.owner },
      { name: 'issue-count', value: commentData.issueCount.toString() },
      { name: 'issue-name', value: commentData.issueTitle },
      { name: 'issue-owner', value: commentData.issueAuthor },
      { name: 'issue-comment-count', value: nextCommentCount.toString() },
      { name: 'issue-comment-content', value: commentData.content },
      { name: 'issue-comment-owner', value: commentData.author },
      { name: 'issue-comment-visibility', value: 'true' },
      { name: 'Content-Type', value: 'application/json' },
      { name: 'Timestamp', value: new Date().toISOString() },
    ];

    // Upload comment
    const receipt = await executeUpload('createIssueComment', async () => {
      return await uploader.upload(uploadData, { tags });
    });

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
    // 간단한 텍스트 데이터로 업로드 (getRepositoryBranches 방식처럼)
    const uploadData = commentData.content;

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
      { name: 'issue-comment-content', value: commentData.content },
      { name: 'issue-comment-owner', value: commentData.author },
      { name: 'issue-comment-visibility', value: 'true' },
      { name: 'Content-Type', value: 'application/json' },
      { name: 'Timestamp', value: new Date().toISOString() },
    ];

    // Add Root-TX tag if updating existing comment
    if (commentData.existingRootTxId) {
      tags.push({ name: 'Root-TX', value: commentData.existingRootTxId });
    }

    // Upload updated comment
    const receipt = await executeUpload('updateIssueComment', async () => {
      return await uploader.upload(uploadData, { tags });
    });

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
    const result = await executeQuery('getIssueVisibility', async () => {
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
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    });

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
    const result = await executeQuery('getCommentVisibility', async () => {
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
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    });

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

function removeFromCache(key: string): void {
  cache.delete(key);
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

  // Create Irys URL
  createIrysUrl: (txId: string): string => {
    return `https://gateway.irys.xyz/${txId}`;
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

// 저장소의 최신 트랜잭션 가져오기
export async function getLatestRepositoryTransaction(
  repository: string,
  owner: string
): Promise<{ id: string; timestamp: number } | null> {
  const query = `
    query getLatestRepoTransaction($repository: String!, $owner: String!) {
      transactions(
        tags: [
          { name: "App-Name", values: ["irys-git"] },
          { name: "Repository", values: [$repository] },
          { name: "git-owner", values: [$owner] }
        ],
        first: 10,
        order: DESC
      ) {
        edges {
          node {
            id
            timestamp
          }
        }
      }
    }
  `;

  try {
    console.log(
      '[getLatestRepositoryTransaction] 쿼리 시작:',
      repository,
      owner
    );
    const result = await executeQuery(
      'getLatestRepositoryTransaction',
      async () => {
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

        // response.ok 체크를 일시적으로 제거 (getProfileByAddress처럼)
        return await response.json();
      }
    );
    console.log('[getLatestRepositoryTransaction] 쿼리 완료');

    // 쿼리 결과 로깅
    console.log('[getLatestRepositoryTransaction] 쿼리 결과:', {
      hasData: !!result.data,
      hasErrors: !!result.errors,
      transactionCount: result.data?.transactions?.edges?.length || 0,
    });

    if (result.errors) {
      console.error(
        '[getLatestRepositoryTransaction] GraphQL 에러:',
        result.errors
      );
    }

    const transactions = result.data?.transactions?.edges || [];

    if (transactions.length === 0) {
      console.log('[getLatestRepositoryTransaction] 트랜잭션이 없습니다');
      return null;
    }

    const latestTx = transactions[0].node;
    console.log('[getLatestRepositoryTransaction] 최신 트랜잭션:', {
      id: latestTx.id,
      timestamp: latestTx.timestamp,
    });

    return {
      id: latestTx.id,
      timestamp: TimestampUtils.normalize(latestTx.timestamp),
    };
  } catch (error) {
    console.error('[getLatestRepositoryTransaction] 오류:', error);
    return null;
  }
}

// 저장소 브랜치 정보만 조회 (최적화 버전)
export async function getRepositoryBranches(
  repository: string,
  owner: string
): Promise<RepoBranch[]> {
  // 캐시 확인
  const cacheKey = getCacheKey('repo-branches', { repository, owner });
  const cached = getFromCache<RepoBranch[]>(cacheKey);
  if (cached) {
    console.log('[getRepositoryBranches] 캐시에서 반환:', repository);
    return cached;
  }

  console.log('[getRepositoryBranches] 쿼리 시작:', repository, owner);

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
    const result = await executeQuery('getRepositoryBranches', async () => {
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

      return await response.json();
    });

    console.log('[getRepositoryBranches] 쿼리 완료');
    console.log('[getRepositoryBranches] 쿼리 결과:', {
      hasData: !!result.data,
      hasErrors: !!result.errors,
      transactionCount: result.data?.transactions?.edges?.length || 0,
    });

    if (result.errors) {
      console.error('[getRepositoryBranches] GraphQL 에러:', result.errors);
      return [];
    }

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

      // 가장 최신 트랜잭션만 유지
      const existingBranch = branchMap.get(branchName);
      const nodeTimestamp = TimestampUtils.normalize(node.timestamp);

      if (!existingBranch || nodeTimestamp > existingBranch.nodeTimestamp) {
        branchMap.set(branchName, {
          name: branchName,
          transactionId: node.id,
          mutableAddress: null,
          timestamp: timestampTag?.value || node.timestamp,
          commitHash: commitHashTag?.value || '',
          commitMessage: commitMsgTag?.value || '',
          author: authorTag?.value || '',
          tags: tags,
          nodeTimestamp: nodeTimestamp,
        });
      }
    }

    const branches: RepoBranch[] = Array.from(branchMap.values()).map(
      branch => ({
        name: branch.name,
        transactionId: branch.transactionId,
        mutableAddress: branch.mutableAddress,
        commitMessage: branch.commitMessage,
        timestamp: TimestampUtils.normalize(branch.timestamp),
        tags: branch.tags,
      })
    );

    // 캐시에 저장 (5분)
    setCache(cacheKey, branches, 5 * 60 * 1000);
    console.log('[getRepositoryBranches] 브랜치 수:', branches.length);

    return branches;
  } catch (error) {
    console.error('[getRepositoryBranches] 오류:', error);
    return [];
  }
}
