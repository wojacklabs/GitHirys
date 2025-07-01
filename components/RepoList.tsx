// components/RepoList.tsx
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { searchRepositories, testIrysConnection } from '../lib/irys';

export interface Repo { 
  name: string; 
  cid: string; 
  size?: number;
  timestamp?: number;
  address?: string;
  tags?: any[];
}

export default function RepoList({
  uploader,
  owner,
}: {
  uploader: any; // New Irys uploader type
  owner: string;
}) {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const [searchProgress, setSearchProgress] = useState<string>('');

  const addDebugInfo = (message: string) => {
    setDebugInfo(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
    setSearchProgress(message);
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
        addDebugInfo('🔎 다중 검색 전략으로 저장소 검색 중...');
        const foundRepos = await searchRepositories(owner);
        
        if (foundRepos.length > 0) {
          addDebugInfo(`✅ ${foundRepos.length}개의 저장소 발견!`);
          
          // Log details for debugging
          foundRepos.forEach((repo, idx) => {
            addDebugInfo(`📁 저장소 ${idx + 1}: ${repo.name} (${repo.cid})`);
          });
        } else {
          addDebugInfo('❌ 저장소를 찾을 수 없음');
        }
        
        setRepos(foundRepos);
        
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

  if (!repos.length) {
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
          <p style={{ margin: '4px 0' }}>• 저장소 업로드 시 "Application" 태그가 "irys-git"으로 설정되어야 합니다</p>
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

  const formatSize = (size: number) => {
    if (size < 1024) return `${size}B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}KB`;
    if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)}MB`;
    return `${(size / (1024 * 1024 * 1024)).toFixed(1)}GB`;
  };

  return (
    <div>
      <h3>내 저장소 ({repos.length}개)</h3>
      
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
        gap: '12px', 
        marginTop: '16px' 
      }}>
        {repos.map(repo => (
          <div key={repo.cid} style={{
            padding: '16px',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            backgroundColor: '#fafafa'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'flex-start',
              marginBottom: '8px'
            }}>
              <div>
                <h4 style={{ margin: '0 0 4px 0' }}>
                  📁 <Link href={`/${repo.name}`} style={{ 
                    textDecoration: 'none', 
                    color: '#2563eb',
                    fontWeight: '600'
                  }}>
                    {repo.name}
                  </Link>
                </h4>
                <p style={{ 
                  margin: '0 0 4px 0', 
                  fontSize: '12px', 
                  color: '#6b7280',
                  fontFamily: 'monospace' 
                }}>
                  CID: {repo.cid}
                </p>
                {repo.address && (
                  <p style={{ 
                    margin: '0', 
                    fontSize: '11px', 
                    color: '#9ca3af',
                    fontFamily: 'monospace' 
                  }}>
                    소유자: {repo.address}
                  </p>
                )}
              </div>
              <div style={{ 
                textAlign: 'right', 
                fontSize: '12px', 
                color: '#6b7280' 
              }}>
                {repo.size && repo.size > 0 && <div>{formatSize(repo.size)}</div>}
                {repo.timestamp && <div>{formatDate(repo.timestamp)}</div>}
              </div>
            </div>
            
            {repo.tags && repo.tags.length > 0 && (
              <div style={{ marginBottom: '8px' }}>
                <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>
                  태그:
                </div>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {repo.tags.slice(0, 3).map((tag, idx) => (
                    <span key={idx} style={{
                      fontSize: '10px',
                      padding: '2px 6px',
                      backgroundColor: '#e0f2fe',
                      color: '#0c4a6e',
                      borderRadius: '4px',
                      fontFamily: 'monospace'
                    }}>
                      {tag.name}: {tag.value}
                    </span>
                  ))}
                  {repo.tags.length > 3 && (
                    <span style={{
                      fontSize: '10px',
                      padding: '2px 6px',
                      backgroundColor: '#f3f4f6',
                      color: '#6b7280',
                      borderRadius: '4px'
                    }}>
                      +{repo.tags.length - 3}개 더
                    </span>
                  )}
                </div>
              </div>
            )}
            
            <div style={{ 
              display: 'flex', 
              gap: '8px', 
              flexWrap: 'wrap' 
            }}>
              <Link href={`/${repo.name}`}>
                <button style={{
                  fontSize: '12px',
                  padding: '4px 8px',
                  backgroundColor: '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}>
                  저장소 보기
                </button>
              </Link>
              <button 
                onClick={() => navigator.clipboard.writeText(`igit clone irys://${repo.name}`)}
                style={{
                  fontSize: '12px',
                  padding: '4px 8px',
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
        ))}
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
