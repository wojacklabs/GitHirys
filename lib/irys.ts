// lib/irys.ts
import { WebUploader } from '@irys/web-upload';
import { WebSolana } from '@irys/web-upload-solana';

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

// Search repositories by connected wallet address using correct Irys syntax
export async function searchRepositories(owner: string): Promise<any[]> {
  console.log('🔍 저장소 검색 시작:', owner);
  
  // Test Irys connection first
  const canConnect = await testIrysConnection();
  if (!canConnect) {
    console.warn('⚠️ Irys GraphQL 연결 실패');
  }

  // Try multiple search strategies with correct Irys syntax
  const searchStrategies = [
    {
      name: 'irys-git 태그로 검색',
      endpoint: 'https://uploader.irys.xyz/graphql',
      query: `
        query getByOwnerAndTags($owners: [String!]!) {
          transactions(
            tags: [
              { name: "Application", values: ["irys-git"] }, { name: "git-owner", values: $owners }
            ]
            limit: 100
          ) {
            edges {
              node {
                id
                address
                token
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
    },
  ];

  for (const strategy of searchStrategies) {
    try {
      console.log(`🔎 ${strategy.name} 시도 중...`);
      
      const response = await fetch(strategy.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: strategy.query,
          variables: strategy.variables
        })
      });

      if (!response.ok) {
        console.warn(`❌ ${strategy.name} HTTP 오류:`, response.statusText);
        continue;
      }

      const result = await response.json();
      
      if (result.errors) {
        console.warn(`❌ ${strategy.name} GraphQL 오류:`, result.errors);
        continue;
      }

      const transactions = result.data?.transactions?.edges || [];
      console.log(`📊 ${strategy.name} 결과:`, transactions.length, '개 트랜잭션');

      if (transactions.length > 0) {
        // Log transaction details for debugging
        transactions.slice(0, 3).forEach((edge: any, idx: number) => {
          const node = edge.node;
          console.log(`📄 트랜잭션 ${idx + 1}:`, {
            id: node.id,
            address: node.address,
            token: node.token,
            tags: node.tags,
            timestamp: node.timestamp
          });
        });

        const repositories = transactions.map((edge: any) => {
          const node = edge.node;
          
          // Try to find repository name from various tag combinations
          const repoNameTag = node.tags?.find((tag: any) => 
            ['Repository-Name', 'Repo-Name', 'Name', 'Title'].includes(tag.name)
          );
          
          const applicationTag = node.tags?.find((tag: any) => 
            tag.name === 'Application'
          );
          
          let repoName = repoNameTag?.value || node.id;
          
          // If it's a git-related application, use a more descriptive name
          if (applicationTag && ['git', 'irys-git'].includes(applicationTag.value)) {
            const nameFromTags = node.tags?.find((tag: any) => 
              ['repository', 'repo'].some(keyword => 
                tag.name.toLowerCase().includes(keyword)
              )
            );
            if (nameFromTags) {
              repoName = nameFromTags.value;
            }
          }
          
          return {
            name: repoName,
            cid: node.id,
            size: 0, // Irys GraphQL doesn't provide size in basic query
            timestamp: node.timestamp,
            address: node.address,
            token: node.token,
            tags: node.tags || []
          };
        });

        console.log(`✅ ${strategy.name}에서 ${repositories.length}개 저장소 발견`);
        return repositories;
      }
    } catch (error) {
      console.error(`❌ ${strategy.name} 오류:`, error);
    }
  }

  console.log('❌ 모든 검색 전략 실패');
  return [];
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

// Download data from Irys gateway
export async function downloadData(transactionId: string): Promise<ArrayBuffer | null> {
  console.log('📥 데이터 다운로드 시작:', transactionId);

  const gateways = [
    `https://gateway.irys.xyz/${transactionId}`,
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
