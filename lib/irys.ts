// lib/irys.ts
import { WebUploader } from '@irys/web-upload';
import { WebSolana } from '@irys/web-upload-solana';

// 브랜치 정보를 포함한 인터페이스 정의
export interface RepoBranch {
  name: string;
  transactionId: string;
  mutableAddress: string | null;
  timestamp: number;
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
      console.log("No wallet provided, creating read-only uploader");
      // For read-only operations without wallet
      return await WebUploader(WebSolana);
    }

    if (!wallet.connected) {
      throw new Error("Wallet not connected");
    }

    console.log("Creating Irys uploader with wallet:", wallet.publicKey?.toBase58());
    
    // Use the wallet object directly with withProvider as per documentation
    const irysUploader = await WebUploader(WebSolana).withProvider(wallet);
    
    console.log(`Connected to Irys from ${irysUploader.address}`);
    return irysUploader;
    
  } catch (error) {
    console.error("Error connecting to Irys:", error);
    throw new Error("Error connecting to Irys");
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
      body: JSON.stringify({ query: testQuery })
    });

    const result = await response.json();
    console.log('Irys GraphQL 연결 테스트:', response.ok, result);
    return response.ok && !result.errors;
  } catch (error) {
    console.error('Irys GraphQL 연결 실패:', error);
    return false;
  }
}

// Search repositories by connected wallet address and group by repository and branch (irys-git 방식)
export async function searchRepositories(owner: string): Promise<Repository[]> {
  console.log('🔍 저장소 검색 시작:', owner);
  
  // Test Irys connection first
  const canConnect = await testIrysConnection();
  if (!canConnect) {
    console.warn('⚠️ Irys GraphQL 연결 실패');
  }

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
    variables: { owners: [owner] }
  };

  try {
    console.log(`🔎 ${searchStrategy.name} 시도 중...`);
    
    const response = await fetch(searchStrategy.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: searchStrategy.query,
        variables: searchStrategy.variables
      })
    });

    if (!response.ok) {
      console.warn(`❌ ${searchStrategy.name} HTTP 오류:`, response.statusText);
      return [];
    }

    const result = await response.json();
    
    if (result.errors) {
      console.warn(`❌ ${searchStrategy.name} GraphQL 오류:`, result.errors);
      return [];
    }

    const transactions = result.data?.transactions?.edges || [];
    console.log(`📊 ${searchStrategy.name} 결과:`, transactions.length, '개 트랜잭션');

    if (transactions.length === 0) {
      return [];
    }

    // 저장소별로 그룹핑
    const repositoryMap = new Map<string, Repository>();

    // 브랜치별 최신 트랜잭션 맵 (irys-git 방식과 동일)
    const branchTransactionMap = new Map<string, Map<string, BranchTransactionData>>();

    for (const edge of transactions) {
      const node = edge.node;
      
      // 태그에서 필요한 정보 추출
      const repositoryTag = node.tags?.find((tag: any) => tag.name === 'Repository');
      const branchTag = node.tags?.find((tag: any) => tag.name === 'Branch');
      const timestampTag = node.tags?.find((tag: any) => tag.name === 'Timestamp');
      const mutableTag = node.tags?.find((tag: any) => tag.name === 'Mutable-Address');
      const commitHashTag = node.tags?.find((tag: any) => tag.name === 'Commit-Hash');
      const commitMsgTag = node.tags?.find((tag: any) => tag.name === 'Commit-Message');
      const authorTag = node.tags?.find((tag: any) => tag.name === 'Author');
      
      if (!repositoryTag) {
        console.warn('Repository 태그가 없는 트랜잭션 건너뛰기:', node.id);
        continue;
      }

      const repoName = repositoryTag.value;
      const branchName = branchTag?.value || 'main';
      const timestamp = timestampTag?.value || new Date(node.timestamp * 1000).toISOString();
      const mutableAddress = mutableTag?.value || null;

      // 저장소별 브랜치 맵 초기화
      if (!branchTransactionMap.has(repoName)) {
        branchTransactionMap.set(repoName, new Map<string, BranchTransactionData>());
      }

      const repoBranches = branchTransactionMap.get(repoName)!;
      
      // 브랜치별로 최신 트랜잭션만 유지 (irys-git과 동일한 로직)
      if (!repoBranches.has(branchName) || 
          new Date(timestamp) > new Date(repoBranches.get(branchName)!.timestamp)) {
        repoBranches.set(branchName, {
          name: branchName,
          transactionId: node.id,
          mutableAddress: mutableAddress,
          timestamp: timestamp,
          commitHash: commitHashTag?.value || '',
          commitMessage: commitMsgTag?.value || '',
          author: authorTag?.value || '',
          tags: node.tags || [],
          nodeTimestamp: node.timestamp
        });
      }
    }

    // Repository 객체 생성
    for (const [repoName, branches] of Array.from(branchTransactionMap.entries())) {
      const branchInfos: RepoBranch[] = Array.from(branches.values()).map((branchData: BranchTransactionData) => ({
        name: branchData.name,
        transactionId: branchData.transactionId,
        mutableAddress: branchData.mutableAddress,
        timestamp: branchData.nodeTimestamp, // GraphQL의 timestamp 사용
        commitHash: branchData.commitHash,
        commitMessage: branchData.commitMessage,
        author: branchData.author,
        tags: branchData.tags
      }));

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
        tags: branchInfos[0]?.tags || []
      });
    }

    const repositories = Array.from(repositoryMap.values());

    console.log(`✅ ${repositories.length}개 저장소 발견, 총 ${repositories.reduce((sum, repo) => sum + repo.branches.length, 0)}개 브랜치`);
    
    // 디버깅을 위한 로그
    repositories.forEach(repo => {
      console.log(`📁 저장소: ${repo.name}`);
      repo.branches.forEach(branch => {
        const downloadId = branch.mutableAddress || branch.transactionId;
        console.log(`  🌿 브랜치: ${branch.name} (downloadId: ${downloadId})`);
        if (branch.mutableAddress) {
          console.log(`    📍 Mutable 주소: ${branch.mutableAddress}`);
        }
      });
    });

    return repositories;

  } catch (error) {
    console.error(`❌ ${searchStrategy.name} 오류:`, error);
    return [];
  }
}

// Get transaction details by ID with correct Irys syntax
export async function getTransactionById(transactionId: string): Promise<any | null> {
  console.log('🔍 트랜잭션 상세 정보 조회:', transactionId);

  const strategy = {
    name: 'Irys GraphQL',
    endpoint: 'https://uploader.irys.xyz/graphql',
    query:
        `
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
    console.log(`🔍 ${strategy.name} 시도 중...`);
    
    const response = await fetch(strategy.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: strategy.query
      })
    });

    if (!response.ok) {
      console.warn(`❌ ${strategy.name} HTTP 오류:`, response.statusText);
      return null;
    }

    const result = await response.json();
    
    if (result.errors) {
      console.warn(`❌ ${strategy.name} GraphQL 오류:`, result.errors);
      return null;
    }

    const transactions = result.data?.transactions?.edges || [];
    if (transactions.length > 0) {
      console.log(`✅ ${strategy.name}에서 트랜잭션 발견`);
      const tx = transactions[0].node;
      return {
        ...tx,
        owner: { address: tx.address }
      };
    }
  } catch (error) {
    console.error(`❌ ${strategy.name} 오류:`, error);
  }

  console.log('❌ 트랜잭션을 찾을 수 없음');
  return null;
}

// Download data from Irys gateway (irys-git 방식: mutable 주소 우선 사용)
export async function downloadData(transactionId: string, mutableAddress?: string | null): Promise<ArrayBuffer | null> {
  // irys-git과 동일한 방식: mutable 주소가 있으면 우선 사용
  const downloadId = mutableAddress || transactionId;
  console.log('📥 데이터 다운로드 시작:', downloadId);

  const gateways = [
    `https://gateway.irys.xyz/${downloadId}`,
  ];

  for (const gateway of gateways) {
    try {
      console.log('🌐 게이트웨이 시도:', gateway);
      
      const response = await fetch(gateway);
      
      if (response.ok) {
        console.log('✅ 다운로드 성공:', gateway);
        return await response.arrayBuffer();
      } else {
        console.warn('❌ 다운로드 실패:', gateway, response.statusText);
      }
    } catch (error) {
      console.error('❌ 게이트웨이 오류:', gateway, error);
    }
  }

  console.log('❌ 모든 게이트웨이에서 다운로드 실패');
  return null;
}
