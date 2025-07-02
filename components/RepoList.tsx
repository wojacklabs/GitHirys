// components/RepoList.tsx
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { searchRepositories, testIrysConnection, Repository, RepoBranch } from '../lib/irys';

export default function RepoList({
  uploader,
  owner,
}: {
  uploader: any; // New Irys uploader type
  owner: string;
}) {
  const router = useRouter();
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const [searchProgress, setSearchProgress] = useState<string>('');
  const [selectedBranches, setSelectedBranches] = useState<{ [repoName: string]: string }>({});

  const addDebugInfo = (message: string) => {
    setDebugInfo(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
    setSearchProgress(message);
  };

  const handleRepoClick = (repo: Repository, branch?: RepoBranch) => {
    const selectedBranch = branch || repo.branches.find(b => b.name === repo.defaultBranch) || repo.branches[0];
    
    // 선택된 저장소와 브랜치 정보를 sessionStorage에 저장
    if (typeof window !== 'undefined') {
      const repoData = {
        name: repo.name,
        cid: selectedBranch.transactionId,
        tags: selectedBranch.tags,
        timestamp: selectedBranch.timestamp,
        owner: repo.owner,
        repository: repo,
        selectedBranch: selectedBranch
      };
      sessionStorage.setItem('selectedRepo', JSON.stringify(repoData));
    }
    router.push(`/${repo.name}`);
  };

  const handleBranchChange = (repoName: string, branchName: string) => {
    setSelectedBranches(prev => ({
      ...prev,
      [repoName]: branchName
    }));
  };

  useEffect(() => {
    const loadRepos = async () => {
      try {
        setLoading(true);
        setError(null);
        setDebugInfo([]);
        
        addDebugInfo(`🔍 지갑 ${owner}로 저장소 검색 시작`);
        
        // Test connection first
        addDebugInfo('🔌 Irys GraphQL 연결 테스트 중...');
        const canConnect = await testIrysConnection();
        addDebugInfo(canConnect ? '✅ Irys 연결 성공' : '⚠️ Irys 연결 실패, 대체 방법 시도');
        
        // Search repositories using enhanced GraphQL API
        addDebugInfo('🔎 저장소별 브랜치 검색 중...');
        const foundRepos = await searchRepositories(owner);
        
        if (foundRepos.length > 0) {
          const totalBranches = foundRepos.reduce((sum, repo) => sum + repo.branches.length, 0);
          addDebugInfo(`✅ ${foundRepos.length}개의 저장소, ${totalBranches}개의 브랜치 발견!`);
          
          // 각 저장소의 기본 브랜치를 선택된 브랜치로 설정
          const initialSelectedBranches: { [repoName: string]: string } = {};
          foundRepos.forEach(repo => {
            initialSelectedBranches[repo.name] = repo.defaultBranch;
          });
          setSelectedBranches(initialSelectedBranches);
          
          // Log details for debugging
          foundRepos.forEach((repo, idx) => {
            addDebugInfo(`📁 저장소 ${idx + 1}: ${repo.name} (${repo.branches.length}개 브랜치)`);
          });
        } else {
          addDebugInfo('❌ 저장소를 찾을 수 없음');
        }
        
        setRepositories(foundRepos);
        
      } catch (error) {
        console.error('저장소 목록 로딩 오류:', error);
        const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
        setError(`저장소 목록을 불러오는데 실패했습니다: ${errorMessage}`);
        addDebugInfo(`❌ 오류 발생: ${errorMessage}`);
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
        <p className="loading">저장소 목록을 불러오는 중...</p>
        {searchProgress && (
          <div style={{ 
            fontSize: '14px', 
            color: '#6b7280', 
            marginTop: '8px',
            padding: '8px',
            backgroundColor: '#f9fafb',
            borderRadius: '4px'
          }}>
            {searchProgress}
          </div>
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div className="error">
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>다시 시도</button>
        
        {debugInfo.length > 0 && (
          <details style={{ marginTop: '16px' }}>
            <summary style={{ cursor: 'pointer', fontWeight: '500' }}>
              디버그 정보 보기
            </summary>
            <div style={{
              marginTop: '8px',
              padding: '12px',
              backgroundColor: '#f8fafc',
              borderRadius: '4px',
              fontSize: '12px',
              fontFamily: 'monospace',
              maxHeight: '200px',
              overflow: 'auto'
            }}>
              {debugInfo.map((info, idx) => (
                <div key={idx} style={{ marginBottom: '4px' }}>
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
        <p>📂 연결된 지갑에서 저장소를 찾을 수 없습니다.</p>
        
        <div style={{ 
          fontSize: '14px', 
          color: '#6b7280', 
          marginTop: '12px',
          padding: '12px',
          backgroundColor: '#f9fafb',
          borderRadius: '6px',
          border: '1px solid #e5e7eb'
        }}>
          <p style={{ margin: '0 0 8px 0', fontWeight: '500' }}>확인해야 할 사항:</p>
          <p style={{ margin: '4px 0' }}>• 지갑 주소: <code style={{ backgroundColor: '#fff', padding: '2px 4px', borderRadius: '2px' }}>{owner}</code></p>
          <p style={{ margin: '4px 0' }}>• 저장소 업로드 시 필수 태그들이 설정되어야 합니다:</p>
          <p style={{ margin: '4px 0 4px 16px' }}>- "App-Name": "irys-git"</p>
          <p style={{ margin: '4px 0 4px 16px' }}>- "git-owner": "{owner}"</p>
          <p style={{ margin: '4px 0 4px 16px' }}>- "Repository": "저장소명"</p>
          <p style={{ margin: '4px 0 4px 16px' }}>- "Branch": "브랜치명"</p>
          <p style={{ margin: '4px 0 4px 16px' }}>- "Mutable-Address": "mutable 주소" (선택사항)</p>
          <p style={{ margin: '4px 0' }}>• 저장소가 다른 네트워크(devnet/mainnet)에 있을 수 있습니다</p>
          <p style={{ margin: '4px 0' }}>• Irys CLI를 사용해서 저장소를 업로드해보세요</p>
        </div>

        {debugInfo.length > 0 && (
          <details style={{ marginTop: '16px' }}>
            <summary style={{ 
              cursor: 'pointer', 
              fontWeight: '500',
              color: '#2563eb'
            }}>
              🔍 검색 과정 상세보기
            </summary>
            <div style={{
              marginTop: '8px',
              padding: '12px',
              backgroundColor: '#f8fafc',
              borderRadius: '4px',
              fontSize: '12px',
              fontFamily: 'monospace',
              maxHeight: '300px',
              overflow: 'auto',
              border: '1px solid #e2e8f0'
            }}>
              {debugInfo.map((info, idx) => (
                <div key={idx} style={{ 
                  marginBottom: '4px',
                  color: info.includes('❌') ? '#dc2626' : 
                        info.includes('✅') ? '#16a34a' : 
                        info.includes('⚠️') ? '#f59e0b' : '#4b5563'
                }}>
                  {info}
                </div>
              ))}
            </div>
          </details>
        )}

        <div style={{
          marginTop: '16px',
          padding: '12px',
          backgroundColor: '#fef3c7',
          border: '1px solid #f59e0b',
          borderRadius: '6px',
          color: '#92400e'
        }}>
          <p style={{ margin: '0 0 8px 0', fontWeight: '500' }}>💡 테스트를 위한 제안:</p>
          <p style={{ margin: '4px 0', fontSize: '13px' }}>개발자 콘솔(F12)을 열어서 검색 과정의 자세한 로그를 확인해보세요.</p>
        </div>
      </div>
    );
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div>
      <h3>내 저장소 ({repositories.length}개)</h3>
      
      {debugInfo.length > 0 && (
        <div style={{
          marginBottom: '16px',
          padding: '8px 12px',
          backgroundColor: '#dcfce7',
          border: '1px solid #16a34a',
          borderRadius: '6px',
          fontSize: '14px',
          color: '#166534'
        }}>
          ✅ 검색 완료! 개발자 콘솔에서 자세한 로그를 확인할 수 있습니다.
        </div>
      )}
      
      <div style={{ 
        display: 'grid', 
        gap: '16px', 
        marginTop: '16px' 
      }}>
        {repositories.map(repo => {
          const selectedBranch = repo.branches.find(b => b.name === selectedBranches[repo.name]) || repo.branches[0];
          
          return (
            <div key={repo.name} style={{
              padding: '20px',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              backgroundColor: '#fafafa'
            }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'flex-start',
                marginBottom: '12px'
              }}>
                <div style={{ flex: 1 }}>
                  <h4 style={{margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px'}}>
                    📁 <button 
                      onClick={() => handleRepoClick(repo, selectedBranch)}
                      style={{
                        background: 'none',
                        border: 'none',
                        textDecoration: 'none',
                        color: '#2563eb',
                        fontWeight: '600',
                        cursor: 'pointer',
                        padding: '0',
                        fontSize: 'inherit'
                      }}
                    >
                      {repo.name}
                    </button>
                    <span style={{ 
                      fontSize: '12px', 
                      color: '#6b7280',
                      backgroundColor: '#f3f4f6',
                      padding: '2px 6px',
                      borderRadius: '4px'
                    }}>
                      {repo.branches.length}개 브랜치
                    </span>
                    {selectedBranch.mutableAddress && (
                      <span style={{ 
                        fontSize: '11px', 
                        color: '#059669',
                        backgroundColor: '#d1fae5',
                        padding: '2px 6px',
                        borderRadius: '4px'
                      }}>
                        📍 Mutable
                      </span>
                    )}
                  </h4>
                  
                  {/* 브랜치 선택 드롭다운 */}
                  <div style={{ marginBottom: '8px' }}>
                    <label style={{ 
                      fontSize: '12px', 
                      color: '#4b5563',
                      marginRight: '8px'
                    }}>
                      브랜치:
                    </label>
                    <select 
                      value={selectedBranches[repo.name] || repo.defaultBranch}
                      onChange={(e) => handleBranchChange(repo.name, e.target.value)}
                      style={{
                        fontSize: '12px',
                        padding: '4px 8px',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        backgroundColor: 'white'
                      }}
                    >
                      {repo.branches.map(branch => (
                        <option key={branch.name} value={branch.name}>
                          🌿 {branch.name} 
                          {branch.name === repo.defaultBranch && ' (기본)'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                    <p style={{ margin: '2px 0' }}>
                      소유자: <span style={{ fontFamily: 'monospace' }}>{repo.owner}</span>
                    </p>
                    <p style={{ margin: '2px 0' }}>
                      선택된 브랜치: <span style={{ fontFamily: 'monospace' }}>{selectedBranch.name}</span>
                    </p>
                    {selectedBranch.commitHash && (
                      <p style={{ margin: '2px 0' }}>
                        커밋: <span style={{ fontFamily: 'monospace' }}>{selectedBranch.commitHash.substring(0, 8)}</span>
                      </p>
                    )}
                    {selectedBranch.commitMessage && (
                      <p style={{ margin: '2px 0' }}>
                        메시지: <span style={{ fontFamily: 'monospace' }}>{selectedBranch.commitMessage.substring(0, 50)}{selectedBranch.commitMessage.length > 50 ? '...' : ''}</span>
                      </p>
                    )}
                    {selectedBranch.author && (
                      <p style={{ margin: '2px 0' }}>
                        작성자: <span style={{ fontFamily: 'monospace' }}>{selectedBranch.author}</span>
                      </p>
                    )}
                    <p style={{ margin: '2px 0' }}>
                      트랜잭션 ID: <span style={{ fontFamily: 'monospace' }}>{selectedBranch.transactionId.substring(0, 12)}...</span>
                    </p>
                    {selectedBranch.mutableAddress && (
                      <p style={{ margin: '2px 0' }}>
                        Mutable 주소: <span style={{ fontFamily: 'monospace' }}>{selectedBranch.mutableAddress.substring(0, 12)}...</span>
                      </p>
                    )}
                  </div>
                </div>
                
                <div style={{
                  textAlign: 'right',
                  fontSize: '12px',
                  color: '#6b7280'
                }}>
                  <div>
                    업데이트: {formatDate(selectedBranch.timestamp)}
                  </div>
                </div>
              </div>
              
              <div style={{
                display: 'flex',
                gap: '8px',
                flexWrap: 'wrap'
              }}>
                <button 
                  onClick={() => handleRepoClick(repo, selectedBranch)}
                  style={{
                    fontSize: '12px',
                    padding: '6px 12px',
                    backgroundColor: '#2563eb',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  저장소 보기
                </button>
                <button 
                  onClick={() => navigator.clipboard.writeText(`igit clone ${repo.name} ${repo.owner}`)}
                  style={{
                    fontSize: '12px',
                    padding: '6px 12px',
                    backgroundColor: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Clone 명령어 복사
                </button>
              </div>
            </div>
          );
        })}
      </div>
      
      {debugInfo.length > 0 && (
        <details style={{ marginTop: '20px' }}>
          <summary style={{ 
            cursor: 'pointer', 
            fontWeight: '500',
            color: '#2563eb',
            fontSize: '14px'
          }}>
            🔍 검색 과정 상세보기
          </summary>
          <div style={{
            marginTop: '8px',
            padding: '12px',
            backgroundColor: '#f8fafc',
            borderRadius: '4px',
            fontSize: '12px',
            fontFamily: 'monospace',
            maxHeight: '300px',
            overflow: 'auto',
            border: '1px solid #e2e8f0'
          }}>
            {debugInfo.map((info, idx) => (
              <div key={idx} style={{ 
                marginBottom: '4px',
                color: info.includes('❌') ? '#dc2626' : 
                      info.includes('✅') ? '#16a34a' : 
                      info.includes('⚠️') ? '#f59e0b' : '#4b5563'
              }}>
                {info}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
