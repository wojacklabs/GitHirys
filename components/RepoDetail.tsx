// components/RepoDetail.tsx
import { useEffect, useState } from 'react';
import { getTransactionById, downloadData, searchRepositoriesByName } from '../lib/irys';
import JSZip from 'jszip';

interface FileInfo {
  path: string;
  size: number;
  content?: string;
  isDirectory: boolean;
}

export default function RepoDetail({ repoName }: { repoName: string }) {
  const [transaction, setTransaction] = useState<any>(null);
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<FileInfo | null>(null);
  const [fileContent, setFileContent] = useState<string>('');

  useEffect(() => {
    const loadRepoDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log('저장소 상세 정보 로딩:', { repoName });
        
        let transactionId = repoName;
        
        // If it's not a direct transaction ID, search for it
        if (!repoName.match(/^[a-zA-Z0-9_-]{43}$/)) {
          console.log('저장소 이름으로 검색:', repoName);
          const repos = await searchRepositoriesByName(repoName);
          
          if (repos.length === 0) {
            throw new Error(`저장소 '${repoName}'을 찾을 수 없습니다.`);
          }
          
          transactionId = repos[0].cid;
          console.log('찾은 트랜잭션 ID:', transactionId);
        }
        
        // Get transaction details
        const txDetails = await getTransactionById(transactionId);
        if (!txDetails) {
          throw new Error('저장소 트랜잭션을 찾을 수 없습니다.');
        }
        
        setTransaction(txDetails);
        
        // Download and extract repository data
        const data = await downloadData(transactionId);
        if (!data) {
          throw new Error('저장소 데이터를 다운로드할 수 없습니다.');
        }
        
        // Try to extract files from ZIP
        try {
          const zip = new JSZip();
          const zipContent = await zip.loadAsync(data);
          const extractedFiles: FileInfo[] = [];
          
          for (const [filepath, file] of Object.entries(zipContent.files)) {
            if (!file.dir) {
              const content = await file.async('text');
              extractedFiles.push({
                path: filepath,
                size: content.length,
                content: content,
                isDirectory: false
              });
            } else {
              extractedFiles.push({
                path: filepath,
                size: 0,
                isDirectory: true
              });
            }
          }
          
          setFiles(extractedFiles);
          console.log(`${extractedFiles.length}개의 파일을 추출했습니다.`);
          
        } catch (zipError) {
          console.warn('ZIP 추출 실패, 원본 데이터 표시:', zipError);
          // If not a ZIP, try to display as text
          const textContent = new TextDecoder().decode(data);
          setFiles([{
            path: 'README.md',
            size: textContent.length,
            content: textContent,
            isDirectory: false
          }]);
        }
        
      } catch (error) {
        console.error('저장소 정보 로딩 중 오류:', error);
        setError(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    if (repoName) {
      loadRepoDetails();
    }
  }, [repoName]);

  const handleFileClick = (file: FileInfo) => {
    if (file.isDirectory) {
      setCurrentPath(file.path);
      return;
    }
    
    setSelectedFile(file);
    setFileContent(file.content || '');
  };

  const getCurrentFiles = () => {
    if (!currentPath) {
      return files.filter(f => !f.path.includes('/') || f.path.endsWith('/'));
    }
    
    return files.filter(f => 
      f.path.startsWith(currentPath) && 
      f.path !== currentPath &&
      !f.path.substring(currentPath.length).includes('/')
    );
  };

  const getFileExtension = (filename: string) => {
    return filename.split('.').pop()?.toLowerCase() || '';
  };

  const getFileIcon = (file: FileInfo) => {
    if (file.isDirectory) return '📁';
    
    const extension = getFileExtension(file.path);
    const iconMap: { [key: string]: string } = {
      'js': '📄',
      'ts': '📄',
      'jsx': '⚛️',
      'tsx': '⚛️',
      'json': '📋',
      'md': '📝',
      'txt': '📄',
      'py': '🐍',
      'html': '🌐',
      'css': '🎨',
      'scss': '🎨',
      'git': '🔧',
      'yml': '⚙️',
      'yaml': '⚙️'
    };
    
    return iconMap[extension] || '📄';
  };

  const cloneCmd = `igit clone irys://${repoName}`;

  if (loading) {
    return (
      <div>
        <h2>{repoName}</h2>
        <p className="loading">저장소 정보를 불러오는 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h2>{repoName}</h2>
        <div className="error">
          <p>❌ {error}</p>
          <p style={{ fontSize: '14px', marginTop: '8px' }}>
            • 저장소 이름이 올바른지 확인해주세요<br/>
            • 저장소가 Irys에 업로드되었는지 확인해주세요<br/>
            • 연결된 지갑에 업로드 권한이 있는지 확인해주세요
          </p>
        </div>
      </div>
    );
  }

  if (!transaction) {
    return (
      <div>
        <h2>{repoName}</h2>
        <p>저장소를 찾을 수 없습니다.</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h2>{repoName}</h2>
        <div style={{ 
          fontSize: '14px', 
          color: '#6b7280',
          marginBottom: '12px'
        }}>
          <p>트랜잭션 ID: <code style={{ fontFamily: 'monospace' }}>{transaction.id}</code></p>
          <p>소유자: <code style={{ fontFamily: 'monospace' }}>{transaction.owner.address}</code></p>
          {transaction.timestamp && (
            <p>업로드 시간: {new Date(transaction.timestamp * 1000).toLocaleString('ko-KR')}</p>
          )}
        </div>
        
        <div style={{ 
          padding: '12px',
          backgroundColor: '#f0f9ff',
          border: '1px solid #0ea5e9',
          borderRadius: '6px',
          marginBottom: '16px'
        }}>
          <p style={{ margin: '0 0 8px 0', fontWeight: '500' }}>Clone 명령어:</p>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            fontFamily: 'monospace',
            fontSize: '14px'
          }}>
            <code style={{ 
              padding: '4px 8px',
              backgroundColor: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '4px',
              flex: 1
            }}>
              {cloneCmd}
            </code>
            <button 
              onClick={() => navigator.clipboard.writeText(cloneCmd)}
              style={{
                padding: '4px 8px',
                backgroundColor: '#0ea5e9',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              복사
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '20px', height: '600px' }}>
        {/* File Tree */}
        <div style={{ 
          width: '300px',
          border: '1px solid #e5e7eb',
          borderRadius: '6px',
          overflow: 'auto'
        }}>
          <div style={{ 
            padding: '12px',
            backgroundColor: '#f9fafb',
            borderBottom: '1px solid #e5e7eb',
            fontWeight: '600'
          }}>
            파일 트리
          </div>
          
          {currentPath && (
            <div style={{ padding: '8px 12px', borderBottom: '1px solid #f3f4f6' }}>
              <button 
                onClick={() => setCurrentPath('')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#2563eb',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                ← 상위 폴더로
              </button>
            </div>
          )}
          
          <div>
            {getCurrentFiles().map(file => (
              <div 
                key={file.path}
                onClick={() => handleFileClick(file)}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  borderBottom: '1px solid #f3f4f6',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: selectedFile?.path === file.path ? '#e0f2fe' : 'transparent'
                }}
                onMouseEnter={(e) => {
                  if (selectedFile?.path !== file.path) {
                    e.currentTarget.style.backgroundColor = '#f8fafc';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedFile?.path !== file.path) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <span>{getFileIcon(file)}</span>
                <span style={{ fontSize: '14px' }}>{file.path.split('/').pop()}</span>
                {!file.isDirectory && (
                  <span style={{ 
                    fontSize: '12px', 
                    color: '#6b7280',
                    marginLeft: 'auto'
                  }}>
                    {file.size}B
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* File Content */}
        <div style={{ 
          flex: 1,
          border: '1px solid #e5e7eb',
          borderRadius: '6px',
          overflow: 'auto'
        }}>
          <div style={{ 
            padding: '12px',
            backgroundColor: '#f9fafb',
            borderBottom: '1px solid #e5e7eb',
            fontWeight: '600'
          }}>
            {selectedFile ? selectedFile.path : '파일을 선택하세요'}
          </div>
          
          {selectedFile && (
            <div style={{ 
              padding: '16px',
              fontSize: '14px',
              lineHeight: '1.5',
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
              backgroundColor: '#fafafa'
            }}>
              {fileContent || '파일 내용을 불러올 수 없습니다.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
