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
      console.log(`🕐 ${label}:`, {
        original: timestamp,
        type: typeof timestamp,
        normalized: TimestampUtils.normalize(timestamp),
        date: TimestampUtils.toDate(timestamp).toISOString(),
        formatted: TimestampUtils.format(timestamp),
      });
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

// Search repositories by connected wallet address and group by repository and branch (irys-git 방식)
export async function searchRepositories(
  owner: string,
  currentWallet?: string
): Promise<Repository[]> {
  // Test Irys connection first
  const canConnect = await testIrysConnection();

  const searchStrategy = {
    name: 'irys-git 태그로 검색',
    endpoint: 'https://uploader.irys.xyz/graphql',
    query: `
      query getTagsWithAnd($owners: [String!]!) {
        transactions(
          tags: [{ name: "App-Name", values: ["irys-git"] }, { name: "git-owner", values: $owners }],
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
    variables: { owners: [owner] },
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

    if (transactions.length === 0) {
      return [];
    }

    // 저장소별로 그룹핑
    const repositoryMap = new Map<string, Repository>();

    // 브랜치별 최신 트랜잭션 맵 (irys-git 방식과 동일)
    const branchTransactionMap = new Map<
      string,
      Map<string, BranchTransactionData>
    >();

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

      // 디버깅을 위한 timestamp 정보 출력 (개발 시에만)
      if (process.env.NODE_ENV === 'development') {
        TimestampUtils.debug(rawTimestamp, `${repoName}/${branchName}`);
      }

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
          nodeTimestamp: normalizedTimestamp, // 정규화된 timestamp 저장
        });
      }
    }

    // Repository 객체 생성
    for (const [repoName, branches] of Array.from(
      branchTransactionMap.entries()
    )) {
      const branchInfos: RepoBranch[] = Array.from(branches.values()).map(
        (branchData: BranchTransactionData) => ({
          name: branchData.name,
          transactionId: branchData.transactionId,
          mutableAddress: branchData.mutableAddress,
          timestamp: branchData.nodeTimestamp, // 정규화된 timestamp 사용
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

    // 노출 권한 필터링 - private 저장소는 편집 권한이 있는 사용자만 볼 수 있음
    const filteredRepositories: Repository[] = [];

    for (const repo of repositories) {
      // 현재 지갑이 소유자인 경우 항상 표시
      if (repo.owner === currentWallet) {
        filteredRepositories.push(repo);
        continue;
      }

      try {
        // 저장소 노출 권한 확인
        const visibility = await getRepositoryVisibility(repo.name, repo.owner);

        if (!visibility || visibility.visibility === 'public') {
          // 노출 권한 정보가 없거나 public인 경우 표시
          filteredRepositories.push(repo);
        } else if (visibility.visibility === 'private' && currentWallet) {
          // private인 경우 편집 권한 확인
          const permissions = await getRepositoryPermissions(
            repo.name,
            repo.owner
          );
          if (permissions && permissions.contributors.includes(currentWallet)) {
            filteredRepositories.push(repo);
          }
        }
      } catch (error) {
        // 오류 발생 시 안전하게 public으로 처리
        filteredRepositories.push(repo);
      }
    }

    return filteredRepositories;
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

// Download data from Irys gateway (irys-git 방식: mutable 주소 우선 사용)
export async function downloadData(
  transactionId: string,
  mutableAddress?: string | null,
  forceRefresh?: boolean
): Promise<ArrayBuffer | null> {
  // 캐시 방지를 위한 쿼리 파라미터 추가
  const cacheBypass = forceRefresh ? `?t=${Date.now()}` : '';

  // mutable 주소 우선 시도, 실패 시 기본 트랜잭션 ID로 fallback
  const gateways = [];

  if (mutableAddress) {
    // mutable 주소 우선 시도
    gateways.push(
      `https://gateway.irys.xyz/mutable/${mutableAddress}${cacheBypass}`
    );
    // fallback으로 기본 트랜잭션 ID도 추가
    gateways.push(`https://gateway.irys.xyz/${transactionId}${cacheBypass}`);
  } else {
    // mutable 주소가 없으면 기본 트랜잭션 ID만 사용
    gateways.push(`https://gateway.irys.xyz/${transactionId}${cacheBypass}`);
  }

  for (const gateway of gateways) {
    try {
      const response = await fetch(gateway, {
        // 캐시 방지 헤더 추가
        ...(forceRefresh && {
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache',
            Expires: '0',
          },
        }),
      });

      if (response.ok) {
        return await response.arrayBuffer();
      }
    } catch (error) {
      // 에러가 발생하면 다음 게이트웨이 시도
    }
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
  mutableAddress?: string;
  timestamp: number;
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

  // 프로필 이미지 크기 검증
  validateImageSize: (file: File): Promise<boolean> => {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        resolve(img.width === 400 && img.height === 400);
      };
      img.onerror = () => resolve(false);
      img.src = URL.createObjectURL(file);
    });
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

// 지갑 주소로 프로필 정보 조회
export async function getProfileByAddress(
  address: string
): Promise<UserProfile | null> {
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

    const profile: UserProfile = {
      nickname,
      twitterHandle,
      accountAddress,
      profileImageUrl: rootTxId
        ? `https://gateway.irys.xyz/mutable/${rootTxId}`
        : undefined,
      rootTxId,
      mutableAddress: rootTxId
        ? `https://gateway.irys.xyz/mutable/${rootTxId}`
        : undefined,
      timestamp: TimestampUtils.normalize(latestTx.timestamp),
    };

    return profile;
  } catch (error) {
    return null;
  }
}

// 닉네임으로 프로필 정보 조회
export async function getProfileByNickname(
  nickname: string
): Promise<UserProfile | null> {
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

    const profile: UserProfile = {
      nickname,
      twitterHandle,
      accountAddress,
      profileImageUrl: rootTxId
        ? `https://gateway.irys.xyz/mutable/${rootTxId}`
        : undefined,
      rootTxId,
      mutableAddress: rootTxId
        ? `https://gateway.irys.xyz/mutable/${rootTxId}`
        : undefined,
      timestamp: TimestampUtils.normalize(latestTx.timestamp),
    };

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

export interface UserSearchResult {
  type: 'nickname' | 'wallet';
  displayName: string;
  walletAddress: string;
  nickname?: string;
  profileImageUrl?: string;
  twitterHandle?: string;
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

// 사용자 검색 (닉네임 또는 지갑 주소)
export async function searchUsers(query: string): Promise<UserSearchResult[]> {
  const results: UserSearchResult[] = [];

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
    // 닉네임으로 검색
    const profile = await getProfileByNickname(query);

    if (profile) {
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

  return results;
}

// 부분 닉네임 검색 (자동완성용)
export async function searchNicknamesPartial(
  partialNickname: string
): Promise<UserSearchResult[]> {
  if (partialNickname.length < 2) {
    return [];
  }

  // GraphQL에서 부분 검색은 지원하지 않으므로,
  // 일반적인 닉네임 패턴들을 시도해볼 수 있지만
  // 현재는 정확한 일치만 지원
  const exactMatch = await getProfileByNickname(partialNickname);

  if (exactMatch) {
    return [
      {
        type: 'nickname',
        displayName: exactMatch.nickname,
        walletAddress: exactMatch.accountAddress,
        nickname: exactMatch.nickname,
        profileImageUrl: exactMatch.profileImageUrl,
        twitterHandle: exactMatch.twitterHandle,
      },
    ];
  }

  return [];
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

  console.log('🔍 전체 태그 디버깅 시작');

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
      console.warn('❌ 태그 디버깅 HTTP 오류:', response.statusText);
      return;
    }

    const result = await response.json();

    if (result.errors) {
      console.warn('❌ 태그 디버깅 GraphQL 오류:', result.errors);
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

    console.log('📊 태그 사용 빈도:');
    Array.from(tagCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .forEach(([tagName, count]) => {
        console.log(`  ${tagName}: ${count}개`);
      });
  } catch (error) {
    console.error('❌ 태그 디버깅 오류:', error);
  }
}

// 사용자 수 통계 가져오기 (개선된 버전)
export async function getUserStats(): Promise<number> {
  // App-Name이 "irys-git-nickname"인 트랜잭션들만 쿼리
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
