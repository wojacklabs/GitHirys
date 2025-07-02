// components/RepoDetail.tsx
import { useEffect, useState } from 'react';
import { getTransactionById, downloadData, searchRepositories, Repository, RepoBranch } from '../lib/irys';
import JSZip from 'jszip';

interface FileInfo {
  path: string;
  size: number;
  content?: string;
  isDirectory: boolean;
}

// 확장된 레포 데이터 인터페이스
interface RepoData {
  name: string;
  cid: string;
  tags?: any[];
  timestamp?: number;
  owner?: string;
  repository?: Repository;
  selectedBranch?: RepoBranch;
}

export default function RepoDetail({ 
  repoName, 
  owner,
  repo 
}: { 
  repoName: string;
  owner?: string;
  repo?: RepoData; // 확장된 repo 데이터
}) {
  const [transaction, setTransaction] = useState<any>(null);
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<FileInfo | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<RepoBranch | null>(null);
  const [repository, setRepository] = useState<Repository | null>(null);

  // 브랜치 변경 핸들러
  const handleBranchChange = async (branchName: string) => {
    if (!repository) return;
    
    const branch = repository.branches.find(b => b.name === branchName);
    if (!branch) return;
    
    setSelectedBranch(branch);
    setFiles([]);
    setSelectedFile(null);
    setFileContent('');
    setCurrentPath('');
    
    // 새로운 브랜치의 데이터를 로드 (irys-git 방식: mutable 주소 우선)
    await loadBranchData(branch.transactionId, branch.mutableAddress);
  };

  // 브랜치 데이터 로드 함수 (irys-git 방식)
  const loadBranchData = async (transactionId: string, mutableAddress?: string | null) => {
    try {
      setLoading(true);
      const downloadId = mutableAddress || transactionId;
      console.log('브랜치 데이터 로딩:', downloadId);
      
      // Get transaction details
      const txDetails = await getTransactionById(transactionId);
      if (!txDetails) {
        throw new Error('브랜치 트랜잭션을 찾을 수 없습니다.');
      }
      
      setTransaction(txDetails);
      
      // Download and extract repository data (irys-git 방식: mutable 주소 우선)
      const data = await downloadData(transactionId, mutableAddress);
      if (!data) {
        throw new Error('브랜치 데이터를 다운로드할 수 없습니다.');
      }
      
            // Try to extract files from multiple formats
      let extractedFiles: FileInfo[] = [];
      let extractionSuccess = false;
      
      // 1. Try TAR format first (most common for irys-git)
      try {
        console.log('tar 형식으로 압축 해제 시도 중...');
        const uint8Array = new Uint8Array(data);
        
        // Simple TAR parser
        let offset = 0;
        while (offset < uint8Array.length) {
          // Check if we've reached the end (empty blocks)
          if (offset + 512 > uint8Array.length) break;
          
          // Read TAR header (512 bytes)
          const header = uint8Array.slice(offset, offset + 512);
          
          // Check if this is an empty block (end of tar)
          if (header.every(byte => byte === 0)) break;
          
          // Extract filename (first 100 bytes, null-terminated)
          let nameEnd = 0;
          for (let i = 0; i < 100; i++) {
            if (header[i] === 0) {
              nameEnd = i;
              break;
            }
          }
          const filename = new TextDecoder().decode(header.slice(0, nameEnd));
          
          // Extract file size (12 bytes starting at offset 124, octal)
          const sizeStr = new TextDecoder().decode(header.slice(124, 124 + 11)).replace(/\0/g, '').trim();
          const fileSize = parseInt(sizeStr, 8) || 0;
          
          // Skip header
          offset += 512;
          
          if (filename && fileSize > 0 && !filename.endsWith('/')) {
            // Read file content
            const fileData = uint8Array.slice(offset, offset + fileSize);
            const content = new TextDecoder().decode(fileData);
            
            extractedFiles.push({
              path: filename,
              size: fileSize,
              content: content,
              isDirectory: false
            });
          }
          
          // Move to next file (round up to 512-byte boundary)
          offset += Math.ceil(fileSize / 512) * 512;
        }
        
        if (extractedFiles.length > 0) {
          extractionSuccess = true;
          console.log(`✅ tar에서 ${extractedFiles.length}개의 파일을 추출했습니다.`);
        }
      } catch (tarError) {
        console.log('tar 추출 실패, 다른 형식 시도:', tarError instanceof Error ? tarError.message : String(tarError));
      }
      
      // 2. Try ZIP format if TAR fails
      if (!extractionSuccess) {
        try {
          console.log('zip 형식으로 압축 해제 시도 중...');
          const zip = new JSZip();
          const zipContent = await zip.loadAsync(data);
          
          for (const [filepath, file] of Object.entries(zipContent.files)) {
            if (!file.dir) {
              const content = await file.async('text');
              extractedFiles.push({
                path: filepath,
                size: content.length,
                content: content,
                isDirectory: false
              });
            }
          }
          
          if (extractedFiles.length > 0) {
            extractionSuccess = true;
            console.log(`✅ zip에서 ${extractedFiles.length}개의 파일을 추출했습니다.`);
          }
        } catch (zipError) {
          console.log('zip 추출 실패, 원본 데이터 표시 시도:', zipError instanceof Error ? zipError.message : String(zipError));
        }
      }
      
      // 3. If both archive formats fail, try to display as single text file
      if (!extractionSuccess) {
        console.warn('⚠️ 모든 압축 해제 실패, 원본 데이터를 텍스트로 표시');
        try {
          const textContent = new TextDecoder().decode(data);
          extractedFiles = [{
            path: 'content.txt',
            size: textContent.length,
            content: textContent,
            isDirectory: false
          }];
          console.log('✅ 원본 데이터를 텍스트로 표시합니다.');
        } catch (decodeError) {
          console.error('텍스트 디코딩도 실패:', decodeError);
          extractedFiles = [{
            path: 'binary-file',
            size: data.byteLength,
            content: '[이진 파일 - 내용을 표시할 수 없음]',
            isDirectory: false
          }];
        }
      }
      
      setFiles(extractedFiles);
      console.log(`📁 총 ${extractedFiles.length}개의 파일을 로드했습니다.`);
      
    } catch (error) {
      console.error('브랜치 데이터 로딩 중 오류:', error);
      setError(error instanceof Error ? error.message : '브랜치 데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadRepoDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log('저장소 상세 정보 로딩:', { repoName, owner, repo });
        
        let transactionId: string;
        let mutableAddress: string | null = null;
        let repositoryInfo: Repository | null = null;
        let currentBranch: RepoBranch | null = null;
        
        // 전달받은 repo 데이터가 있고 repository 정보가 있으면 사용
        if (repo && repo.repository && repo.selectedBranch) {
          console.log('전달받은 repo 데이터 사용:', repo);
          repositoryInfo = repo.repository;
          currentBranch = repo.selectedBranch;
          transactionId = repo.selectedBranch.transactionId;
          mutableAddress = repo.selectedBranch.mutableAddress;
        }
        // 전달받은 repo 데이터가 있지만 repository 정보가 없으면 기존대로 처리
        else if (repo && repo.cid) {
          console.log('전달받은 repo 데이터 사용 (단순):', repo);
          transactionId = repo.cid;
        }
        // 저장소 이름으로 검색
        else if (!repoName.match(/^[a-zA-Z0-9_-]{43}$/)) {
          console.log('저장소 이름으로 검색:', repoName);
          
          if (!owner) {
            throw new Error('연결된 지갑 정보가 없습니다. 지갑을 연결해주세요.');
          }
          
          // Search repositories by owner (connected wallet)
          const repos = await searchRepositories(owner);
          
          if (repos.length === 0) {
            throw new Error(`연결된 지갑 '${owner}'에서 저장소를 찾을 수 없습니다.`);
          }

          // Find repository by name
          const targetRepo = repos.find(repo => repo.name === repoName);
          
          if (!targetRepo) {
            throw new Error(`저장소 '${repoName}'을 찾을 수 없습니다. 사용 가능한 저장소: ${repos.map(r => r.name).join(', ')}`);
          }
          
          repositoryInfo = targetRepo;
          currentBranch = targetRepo.branches.find(b => b.name === targetRepo.defaultBranch) || targetRepo.branches[0];
          transactionId = currentBranch.transactionId;
          mutableAddress = currentBranch.mutableAddress;
          console.log('찾은 저장소:', targetRepo.name, '브랜치:', currentBranch.name);
        }
        // 직접 트랜잭션 ID로 접근
        else {
          transactionId = repoName;
        }
        
        // 저장소와 브랜치 정보 설정
        if (repositoryInfo) {
          setRepository(repositoryInfo);
          setSelectedBranch(currentBranch);
        }
        
        // 브랜치 데이터 로드 (irys-git 방식)
        await loadBranchData(transactionId, mutableAddress);
        
      } catch (error) {
        console.error('저장소 정보 로딩 중 오류:', error);
        setError(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
        setLoading(false);
      }
    };

    if (repoName) {
      loadRepoDetails();
    }
  }, [repoName, owner, repo]);

  const handleFileClick = (item: any) => {
    if (item.isDirectory) {
      setCurrentPath(item.path);
      return;
    }
    
    setSelectedFile(item.originalFile);
    setFileContent(item.originalFile?.content || '');
  };

  const getCurrentFiles = () => {
    const items = new Map<string, any>();
    
    // 현재 경로의 길이 계산 (트레일링 슬래시 포함)
    const basePath = currentPath ? (currentPath.endsWith('/') ? currentPath : currentPath + '/') : '';
    const baseDepth = basePath.split('/').length - (basePath === '' ? 1 : 0);
    
    files.forEach(file => {
      let relativePath = file.path;
      
      // 현재 경로 하위의 파일들만 처리
      if (basePath && !file.path.startsWith(basePath)) {
        return;
      }
      
      // 현재 경로를 제거하여 상대 경로 계산
      if (basePath) {
        relativePath = file.path.substring(basePath.length);
      }
      
      // 빈 경로는 스킵
      if (!relativePath) {
        return;
      }
      
      const pathParts = relativePath.split('/').filter(part => part.length > 0);
      
      if (pathParts.length === 0) {
        return;
      }
      
      // 첫 번째 부분이 현재 레벨에서 보여줄 항목
      const firstPart = pathParts[0];
      const fullPath = basePath + firstPart;
      
      if (pathParts.length === 1) {
        // 현재 레벨의 파일
        items.set(firstPart, {
          name: firstPart,
          path: fullPath,
          isDirectory: false,
          size: file.size,
          originalFile: file
        });
      } else {
        // 현재 레벨의 디렉토리 (하위에 더 많은 파일들이 있음)
        if (!items.has(firstPart)) {
          items.set(firstPart, {
            name: firstPart,
            path: fullPath,
            isDirectory: true,
            size: 0,
            originalFile: null
          });
        }
      }
    });
    
    // 이름순으로 정렬 (디렉토리 우선)
    return Array.from(items.values()).sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
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

  const cloneCmd = repository 
    ? `igit clone ${repository.name} ${repository.owner}`
    : `igit clone ${repoName} ${owner}`;

  if (loading) {
    return (
      <div>
        <h2>{repository?.name || repoName}</h2>
        <p className="loading">저장소 정보를 불러오는 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h2>{repository?.name || repoName}</h2>
        <div className="error">
          <p>❌ {error}</p>
          <p style={{ fontSize: '14px', marginTop: '8px' }}>
            • 저장소 이름이 올바른지 확인해주세요<br/>
            • 저장소가 Irys에 업로드되었는지 확인해주세요<br/>
            • 연결된 지갑에 업로드 권한이 있는지 확인해주세요<br/>
            {owner && <span>• 연결된 지갑: <code>{owner}</code></span>}
          </p>
        </div>
      </div>
    );
  }

  if (!transaction) {
    return (
      <div>
        <h2>{repository?.name || repoName}</h2>
        <p>저장소를 찾을 수 없습니다.</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
          <h2 style={{ margin: 0 }}>📁 {repository?.name || repoName}</h2>
          
          {/* 브랜치 선택 드롭다운 */}
          {repository && repository.branches.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14px', color: '#6b7280' }}>브랜치:</span>
              <select 
                value={selectedBranch?.name || repository.defaultBranch}
                onChange={(e) => handleBranchChange(e.target.value)}
                style={{
                  fontSize: '14px',
                  padding: '6px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  backgroundColor: 'white',
                  cursor: 'pointer'
                }}
              >
                {repository.branches.map(branch => (
                  <option key={branch.name} value={branch.name}>
                    🌿 {branch.name} 
                    {branch.name === repository.defaultBranch && ' (기본)'}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        
        <div style={{ 
          fontSize: '14px', 
          color: '#6b7280',
          marginBottom: '12px'
        }}>
          <p>트랜잭션 ID: <code style={{ fontFamily: 'monospace' }}>{transaction.id}</code></p>
          {selectedBranch?.mutableAddress && (
            <p>Mutable 주소: <code style={{ fontFamily: 'monospace' }}>{selectedBranch.mutableAddress}</code></p>
          )}
          {owner && (
            <p>소유자: <code style={{ fontFamily: 'monospace' }}>{owner}</code></p>
          )}
          {selectedBranch && (
            <p>브랜치: <code style={{ fontFamily: 'monospace' }}>{selectedBranch.name}</code></p>
          )}
          {selectedBranch?.commitHash && (
            <p>커밋: <code style={{ fontFamily: 'monospace' }}>{selectedBranch.commitHash}</code></p>
          )}
          {selectedBranch?.author && (
            <p>작성자: <code style={{ fontFamily: 'monospace' }}>{selectedBranch.author}</code></p>
          )}
          {selectedBranch?.timestamp && (
            <p>업로드 시간: {new Date(selectedBranch.timestamp * 1000).toLocaleString('ko-KR')}</p>
          )}
        </div>
        
        <div style={{ 
          padding: '12px',
          backgroundColor: '#f0f9ff',
          border: '1px solid #0ea5e9',
          borderRadius: '6px',
          marginBottom: '16px'
        }}>
          <p style={{ margin: '0 0 8px 0', fontWeight: '500' }}>Clone 명령어 (모든 브랜치 포함):</p>
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
                onClick={() => {
                  const pathParts = currentPath.split('/').filter(part => part.length > 0);
                  if (pathParts.length <= 1) {
                    setCurrentPath('');
                  } else {
                    setCurrentPath(pathParts.slice(0, -1).join('/'));
                  }
                }}
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
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                현재 경로: {currentPath || '/'}
              </div>
            </div>
          )}
          
          <div>
            {getCurrentFiles().map(item => (
              <div 
                key={item.path}
                onClick={() => handleFileClick(item)}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  borderBottom: '1px solid #f3f4f6',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: selectedFile?.path === item.originalFile?.path ? '#e0f2fe' : 'transparent'
                }}
                onMouseEnter={(e) => {
                  if (selectedFile?.path !== item.originalFile?.path) {
                    e.currentTarget.style.backgroundColor = '#f8fafc';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedFile?.path !== item.originalFile?.path) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <span>{item.isDirectory ? '📁' : getFileIcon(item.originalFile || { path: item.name, size: 0, isDirectory: false })}</span>
                <span style={{ fontSize: '14px' }}>{item.name}</span>
                {!item.isDirectory && (
                  <span style={{ 
                    fontSize: '12px', 
                    color: '#6b7280',
                    marginLeft: 'auto'
                  }}>
                    {item.size}B
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
