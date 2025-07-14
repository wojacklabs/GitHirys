// components/RepoDetail.tsx
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import {
  getTransactionById,
  downloadData,
  searchRepositories,
  Repository,
  RepoBranch,
  TimestampUtils,
  getRepositoryPermissions,
  getProfileByAddress,
  getRepositoryDescription,
  updateRepositoryDescription,
  RepositoryDescription,
  RepositoryPermissions,
  UserProfile,
  Issue,
  IssueComment,
  getRepositoryIssues,
  getIssueComments,
  createIssue,
  updateIssue,
  createIssueComment,
  updateIssueComment,
  updateIssueVisibility,
  updateCommentVisibility,
} from '../lib/irys';
import JSZip from 'jszip';
import PermissionManager from './PermissionManager';
import VisibilityManager from './VisibilityManager';
import RepoShareCard from './RepoShareCard';
import styles from '../styles/RepoDetail.module.css';

interface FileInfo {
  path: string;
  size: number;
  content?: string;
  binaryContent?: Uint8Array; // 바이너리 파일용 데이터
  isDirectory: boolean;
  fileType?:
    | 'image'
    | 'video'
    | 'audio'
    | 'document'
    | 'archive'
    | 'code'
    | 'text'
    | 'binary'; // 파일 유형
  mimeType?: string; // MIME 타입
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
  isLatest?: boolean;
}

// 파일 유형 감지 함수들
const getFileTypeByExtension = (
  filename: string
): { type: FileInfo['fileType']; mimeType: string } => {
  const extension = filename.split('.').pop()?.toLowerCase() || '';

  // 이미지 파일
  const imageExtensions = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    bmp: 'image/bmp',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    ico: 'image/x-icon',
    tiff: 'image/tiff',
    tif: 'image/tiff',
    heic: 'image/heic',
    heif: 'image/heif',
    avif: 'image/avif',
  };

  // 비디오 파일
  const videoExtensions = {
    mp4: 'video/mp4',
    avi: 'video/x-msvideo',
    mov: 'video/quicktime',
    wmv: 'video/x-ms-wmv',
    flv: 'video/x-flv',
    webm: 'video/webm',
    mkv: 'video/x-matroska',
    m4v: 'video/x-m4v',
    '3gp': 'video/3gpp',
    '3g2': 'video/3gpp2',
    ogv: 'video/ogg',
    ts: 'video/mp2t',
    mts: 'video/mp2t',
    m2ts: 'video/mp2t',
  };

  // 오디오 파일
  const audioExtensions = {
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    flac: 'audio/flac',
    aac: 'audio/aac',
    ogg: 'audio/ogg',
    wma: 'audio/x-ms-wma',
    m4a: 'audio/m4a',
    opus: 'audio/opus',
    aiff: 'audio/x-aiff',
    au: 'audio/basic',
    ra: 'audio/x-realaudio',
    mid: 'audio/midi',
    midi: 'audio/midi',
  };

  // 문서 파일
  const documentExtensions = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    odt: 'application/vnd.oasis.opendocument.text',
    ods: 'application/vnd.oasis.opendocument.spreadsheet',
    odp: 'application/vnd.oasis.opendocument.presentation',
    rtf: 'application/rtf',
    epub: 'application/epub+zip',
    mobi: 'application/x-mobipocket-ebook',
    azw: 'application/vnd.amazon.ebook',
    azw3: 'application/vnd.amazon.ebook',
  };

  // 압축 파일
  const archiveExtensions = {
    zip: 'application/zip',
    rar: 'application/vnd.rar',
    '7z': 'application/x-7z-compressed',
    tar: 'application/x-tar',
    gz: 'application/gzip',
    bz2: 'application/x-bzip2',
    xz: 'application/x-xz',
    cab: 'application/vnd.ms-cab-compressed',
    dmg: 'application/x-apple-diskimage',
    iso: 'application/x-iso9660-image',
    deb: 'application/vnd.debian.binary-package',
    rpm: 'application/x-rpm',
    msi: 'application/x-msdownload',
  };

  // 코드 파일
  const codeExtensions = {
    js: 'application/javascript',
    jsx: 'application/javascript',
    ts: 'application/typescript',
    tsx: 'application/typescript',
    html: 'text/html',
    htm: 'text/html',
    css: 'text/css',
    scss: 'text/x-scss',
    sass: 'text/x-sass',
    less: 'text/x-less',
    json: 'application/json',
    xml: 'application/xml',
    yml: 'application/x-yaml',
    yaml: 'application/x-yaml',
    toml: 'application/toml',
    ini: 'text/plain',
    cfg: 'text/plain',
    conf: 'text/plain',
    py: 'text/x-python',
    java: 'text/x-java-source',
    c: 'text/x-c',
    cpp: 'text/x-c++',
    cc: 'text/x-c++',
    cxx: 'text/x-c++',
    h: 'text/x-c',
    hpp: 'text/x-c++',
    cs: 'text/x-csharp',
    php: 'text/x-php',
    rb: 'text/x-ruby',
    go: 'text/x-go',
    rs: 'text/x-rust',
    swift: 'text/x-swift',
    kt: 'text/x-kotlin',
    scala: 'text/x-scala',
    clj: 'text/x-clojure',
    hs: 'text/x-haskell',
    lua: 'text/x-lua',
    r: 'text/x-r',
    sql: 'text/x-sql',
    sh: 'text/x-shellscript',
    bash: 'text/x-shellscript',
    zsh: 'text/x-shellscript',
    fish: 'text/x-shellscript',
    ps1: 'text/x-powershell',
    bat: 'text/x-msdos-batch',
    cmd: 'text/x-msdos-batch',
    vim: 'text/x-vim',
    dockerfile: 'text/x-dockerfile',
    makefile: 'text/x-makefile',
    cmake: 'text/x-cmake',
    gradle: 'text/x-gradle',
    pom: 'application/xml',
    sln: 'text/x-sln',
    csproj: 'application/xml',
    vcxproj: 'application/xml',
    xcodeproj: 'text/x-xcode',
  };

  // 텍스트 파일
  const textExtensions = {
    txt: 'text/plain',
    md: 'text/markdown',
    markdown: 'text/markdown',
    mdown: 'text/markdown',
    mkd: 'text/markdown',
    rst: 'text/x-rst',
    asciidoc: 'text/x-asciidoc',
    adoc: 'text/x-asciidoc',
    tex: 'text/x-tex',
    latex: 'text/x-latex',
    bib: 'text/x-bibtex',
    org: 'text/org',
    wiki: 'text/x-wiki',
    textile: 'text/x-textile',
    csv: 'text/csv',
    tsv: 'text/tab-separated-values',
    log: 'text/plain',
    patch: 'text/x-patch',
    diff: 'text/x-diff',
    gitignore: 'text/plain',
    gitattributes: 'text/plain',
    license: 'text/plain',
    readme: 'text/plain',
    changelog: 'text/plain',
    todo: 'text/plain',
    authors: 'text/plain',
    contributors: 'text/plain',
    copying: 'text/plain',
    install: 'text/plain',
    news: 'text/plain',
    thanks: 'text/plain',
    version: 'text/plain',
  };

  // 코드 파일 확장자를 먼저 확인 (ts, tsx 등의 충돌 방지)
  if (extension in codeExtensions) {
    return {
      type: 'code',
      mimeType: codeExtensions[extension as keyof typeof codeExtensions],
    };
  }
  if (extension in textExtensions) {
    return {
      type: 'text',
      mimeType: textExtensions[extension as keyof typeof textExtensions],
    };
  }
  if (extension in imageExtensions) {
    return {
      type: 'image',
      mimeType: imageExtensions[extension as keyof typeof imageExtensions],
    };
  }
  // ts 확장자의 경우 비디오 파일과 TypeScript 파일을 구분
  if (extension in videoExtensions) {
    // .ts 확장자인 경우 파일명 패턴으로 추가 확인
    if (extension === 'ts') {
      // 비디오 파일로 보이는 패턴이 있는지 확인 (예: *.transport.ts, *.stream.ts)
      const lowerFilename = filename.toLowerCase();
      if (
        lowerFilename.includes('transport') ||
        lowerFilename.includes('stream') ||
        lowerFilename.includes('video') ||
        lowerFilename.includes('broadcast')
      ) {
        return {
          type: 'video',
          mimeType: videoExtensions[extension as keyof typeof videoExtensions],
        };
      }
      // 그 외의 경우 TypeScript 파일로 간주 (이미 위에서 처리됨)
      return {
        type: 'code',
        mimeType: 'application/typescript',
      };
    }
    return {
      type: 'video',
      mimeType: videoExtensions[extension as keyof typeof videoExtensions],
    };
  }
  if (extension in audioExtensions) {
    return {
      type: 'audio',
      mimeType: audioExtensions[extension as keyof typeof audioExtensions],
    };
  }
  if (extension in documentExtensions) {
    return {
      type: 'document',
      mimeType:
        documentExtensions[extension as keyof typeof documentExtensions],
    };
  }
  if (extension in archiveExtensions) {
    return {
      type: 'archive',
      mimeType: archiveExtensions[extension as keyof typeof archiveExtensions],
    };
  }

  return { type: 'binary', mimeType: 'application/octet-stream' };
};

// 바이너리 데이터에서 파일 유형 감지
const detectFileTypeFromBinary = (
  uint8Array: Uint8Array
): { type: FileInfo['fileType']; mimeType: string } => {
  // 파일 시그니처 확인
  const signatures = [
    // 이미지 파일
    {
      signature: [0x89, 0x50, 0x4e, 0x47],
      type: 'image' as const,
      mimeType: 'image/png',
    },
    {
      signature: [0xff, 0xd8, 0xff],
      type: 'image' as const,
      mimeType: 'image/jpeg',
    },
    {
      signature: [0x47, 0x49, 0x46, 0x38],
      type: 'image' as const,
      mimeType: 'image/gif',
    },
    { signature: [0x42, 0x4d], type: 'image' as const, mimeType: 'image/bmp' },
    {
      signature: [0x52, 0x49, 0x46, 0x46],
      type: 'image' as const,
      mimeType: 'image/webp',
      offset: 8,
      nextSignature: [0x57, 0x45, 0x42, 0x50],
    },

    // 비디오 파일
    {
      signature: [0x66, 0x74, 0x79, 0x70],
      type: 'video' as const,
      mimeType: 'video/mp4',
      offset: 4,
    },
    {
      signature: [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70],
      type: 'video' as const,
      mimeType: 'video/mp4',
    },
    {
      signature: [0x52, 0x49, 0x46, 0x46],
      type: 'video' as const,
      mimeType: 'video/avi',
      offset: 8,
      nextSignature: [0x41, 0x56, 0x49, 0x20],
    },
    {
      signature: [0x1a, 0x45, 0xdf, 0xa3],
      type: 'video' as const,
      mimeType: 'video/webm',
    },

    // 오디오 파일
    {
      signature: [0x49, 0x44, 0x33],
      type: 'audio' as const,
      mimeType: 'audio/mpeg',
    },
    { signature: [0xff, 0xfb], type: 'audio' as const, mimeType: 'audio/mpeg' },
    {
      signature: [0x52, 0x49, 0x46, 0x46],
      type: 'audio' as const,
      mimeType: 'audio/wav',
      offset: 8,
      nextSignature: [0x57, 0x41, 0x56, 0x45],
    },
    {
      signature: [0x66, 0x4c, 0x61, 0x43],
      type: 'audio' as const,
      mimeType: 'audio/flac',
    },
    {
      signature: [0x4f, 0x67, 0x67, 0x53],
      type: 'audio' as const,
      mimeType: 'audio/ogg',
    },

    // 문서 파일
    {
      signature: [0x25, 0x50, 0x44, 0x46],
      type: 'document' as const,
      mimeType: 'application/pdf',
    },
    {
      signature: [0xd0, 0xcf, 0x11, 0xe0],
      type: 'document' as const,
      mimeType: 'application/msword',
    },
    {
      signature: [0x50, 0x4b, 0x03, 0x04],
      type: 'document' as const,
      mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    },

    // 압축 파일
    {
      signature: [0x50, 0x4b, 0x03, 0x04],
      type: 'archive' as const,
      mimeType: 'application/zip',
    },
    {
      signature: [0x52, 0x61, 0x72, 0x21],
      type: 'archive' as const,
      mimeType: 'application/vnd.rar',
    },
    {
      signature: [0x37, 0x7a, 0xbc, 0xaf],
      type: 'archive' as const,
      mimeType: 'application/x-7z-compressed',
    },
    {
      signature: [0x1f, 0x8b, 0x08],
      type: 'archive' as const,
      mimeType: 'application/gzip',
    },
    {
      signature: [0x42, 0x5a, 0x68],
      type: 'archive' as const,
      mimeType: 'application/x-bzip2',
    },
  ];

  for (const sig of signatures) {
    if (sig.signature.every((byte, index) => uint8Array[index] === byte)) {
      if (sig.nextSignature && sig.offset) {
        const nextSigMatch = sig.nextSignature.every(
          (byte, index) => uint8Array[sig.offset + index] === byte
        );
        if (nextSigMatch) {
          return { type: sig.type, mimeType: sig.mimeType };
        }
      } else {
        return { type: sig.type, mimeType: sig.mimeType };
      }
    }
  }

  return { type: 'binary', mimeType: 'application/octet-stream' };
};

// tar 아카이브에서 제외해야 할 메타데이터 파일들을 필터링하는 함수
const shouldExcludeFile = (filename: string): boolean => {
  // pax_global_header: PAX 전역 헤더 파일
  if (filename === 'pax_global_header') {
    return true;
  }

  // macOS 리소스 포크 파일들 (._로 시작)
  if (filename.startsWith('._')) {
    return true;
  }

  // macOS 디렉토리 메타데이터 파일
  if (filename === '.DS_Store' || filename.endsWith('/.DS_Store')) {
    return true;
  }

  // 기타 숨김 파일들 중 일반적으로 제외되는 것들
  const hiddenFiles = [
    '.git',
    '.gitignore',
    '.svn',
    'Thumbs.db',
    'desktop.ini',
  ];

  const baseName = filename.split('/').pop() || '';
  if (hiddenFiles.includes(baseName)) {
    return true;
  }

  return false;
};

// 레거시 지원을 위한 이미지 파일 확장자 감지 함수
const isImageFile = (filename: string): boolean => {
  const { type } = getFileTypeByExtension(filename);
  return type === 'image';
};

export default function RepoDetail({
  repoName,
  owner,
  repo,
  uploader,
  currentWallet,
}: {
  repoName: string;
  owner?: string;
  repo?: RepoData; // 확장된 repo 데이터
  uploader?: any;
  currentWallet?: string;
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
  const [repositoryOwner, setRepositoryOwner] = useState<any>(null);
  const [contributors, setContributors] = useState<any[]>([]);
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
  const [refreshPermissions, setRefreshPermissions] = useState(0);
  const [description, setDescription] = useState<string>('');
  const [editingDescription, setEditingDescription] = useState<string>('');
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [savingDescription, setSavingDescription] = useState(false);
  const [repositoryDescription, setRepositoryDescription] =
    useState<RepositoryDescription | null>(null);
  const [showRepoShareCard, setShowRepoShareCard] = useState(false);

  // Issue-related states
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loadingIssues, setLoadingIssues] = useState(false);
  const [showIssueCreateModal, setShowIssueCreateModal] = useState(false);
  const [showIssueDetailModal, setShowIssueDetailModal] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [issueComments, setIssueComments] = useState<IssueComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newIssueTitle, setNewIssueTitle] = useState('');
  const [newIssueContent, setNewIssueContent] = useState('');
  const [newCommentContent, setNewCommentContent] = useState('');
  const [editingIssue, setEditingIssue] = useState<Issue | null>(null);
  const [editingComment, setEditingComment] = useState<IssueComment | null>(
    null
  );
  const [editingIssueTitle, setEditingIssueTitle] = useState('');
  const [editingIssueContent, setEditingIssueContent] = useState('');
  const [editingCommentContent, setEditingCommentContent] = useState('');
  const [savingIssue, setSavingIssue] = useState(false);
  const [savingComment, setSavingComment] = useState(false);
  const [refreshIssues, setRefreshIssues] = useState(0);

  const router = useRouter();

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

    // 새로운 브랜치의 데이터를 로드 (강제 새로고침으로 최신 데이터 보장)
    await loadBranchData(branch.transactionId, branch.mutableAddress, true);
  };

  // 브랜치 데이터 로드 함수 (irys-git 방식)
  const loadBranchData = async (
    transactionId: string,
    mutableAddress?: string | null,
    forceRefresh?: boolean
  ) => {
    try {
      setLoading(true);
      setError(null);

      // Get transaction details
      const txDetails = await getTransactionById(transactionId);
      if (!txDetails) {
        throw new Error("Can't find branch transaction");
      }

      setTransaction(txDetails);

      // Download and extract repository data (강제 새로고침 옵션 포함)
      const data = await downloadData(
        transactionId,
        mutableAddress,
        forceRefresh
      );
      if (!data) {
        throw new Error("Can't download branch Data");
      }

      // Try to extract files from multiple formats
      let extractedFiles: FileInfo[] = [];
      let extractionSuccess = false;

      // 1. Try TAR format first (most common for irys-git)
      try {
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
          const sizeStr = new TextDecoder()
            .decode(header.slice(124, 124 + 11))
            .replace(/\0/g, '')
            .trim();
          const fileSize = parseInt(sizeStr, 8) || 0;

          // Skip header
          offset += 512;

          if (filename && fileSize > 0 && !filename.endsWith('/')) {
            // 메타데이터 파일들을 제외
            if (shouldExcludeFile(filename)) {
              // 메타데이터 파일 제외 로그 제거
            } else {
              // Read file content
              const fileData = uint8Array.slice(offset, offset + fileSize);

              // 파일 유형 감지
              const fileTypeInfo = getFileTypeByExtension(filename);

              if (
                fileTypeInfo.type === 'image' ||
                fileTypeInfo.type === 'video' ||
                fileTypeInfo.type === 'audio' ||
                fileTypeInfo.type === 'document' ||
                fileTypeInfo.type === 'archive'
              ) {
                // 바이너리 파일은 바이너리 데이터로 저장
                extractedFiles.push({
                  path: filename,
                  size: fileSize,
                  binaryContent: fileData,
                  isDirectory: false,
                  fileType: fileTypeInfo.type,
                  mimeType: fileTypeInfo.mimeType,
                });
              } else {
                // 텍스트 파일은 텍스트로 디코딩 시도
                try {
                  const content = new TextDecoder().decode(fileData);
                  extractedFiles.push({
                    path: filename,
                    size: fileSize,
                    content: content,
                    isDirectory: false,
                    fileType: fileTypeInfo.type,
                    mimeType: fileTypeInfo.mimeType,
                  });
                } catch (decodeError) {
                  // 텍스트 디코딩 실패 시 바이너리로 처리
                  const binaryTypeInfo = detectFileTypeFromBinary(fileData);
                  extractedFiles.push({
                    path: filename,
                    size: fileSize,
                    binaryContent: fileData,
                    isDirectory: false,
                    fileType: binaryTypeInfo.type,
                    mimeType: binaryTypeInfo.mimeType,
                    content: '[바이너리 파일 - 텍스트로 표시할 수 없음]',
                  });
                }
              }
            }
          }

          // Move to next file (round up to 512-byte boundary)
          offset += Math.ceil(fileSize / 512) * 512;
        }

        if (extractedFiles.length > 0) {
          extractionSuccess = true;
        }
      } catch (tarError) {
        // tar 추출 실패, zip 형식 시도
      }

      // 2. Try ZIP format if TAR fails
      if (!extractionSuccess) {
        try {
          const zip = new JSZip();
          const zipContent = await zip.loadAsync(data);

          for (const [filepath, file] of Object.entries(zipContent.files)) {
            if (!file.dir) {
              // 메타데이터 파일들을 제외
              if (shouldExcludeFile(filepath)) {
                // 메타데이터 파일 제외 로그 제거
                continue;
              }

              // 파일 유형 감지
              const fileTypeInfo = getFileTypeByExtension(filepath);

              if (
                fileTypeInfo.type === 'image' ||
                fileTypeInfo.type === 'video' ||
                fileTypeInfo.type === 'audio' ||
                fileTypeInfo.type === 'document' ||
                fileTypeInfo.type === 'archive'
              ) {
                // 바이너리 파일은 바이너리 데이터로 저장
                const binaryData = await file.async('uint8array');
                extractedFiles.push({
                  path: filepath,
                  size: binaryData.length,
                  binaryContent: binaryData,
                  isDirectory: false,
                  fileType: fileTypeInfo.type,
                  mimeType: fileTypeInfo.mimeType,
                });
              } else {
                // 텍스트 파일은 텍스트로 저장
                try {
                  const content = await file.async('text');
                  extractedFiles.push({
                    path: filepath,
                    size: content.length,
                    content: content,
                    isDirectory: false,
                    fileType: fileTypeInfo.type,
                    mimeType: fileTypeInfo.mimeType,
                  });
                } catch (textError) {
                  // 텍스트 변환 실패 시 바이너리로 처리
                  const binaryData = await file.async('uint8array');
                  const binaryTypeInfo = detectFileTypeFromBinary(binaryData);
                  extractedFiles.push({
                    path: filepath,
                    size: binaryData.length,
                    binaryContent: binaryData,
                    isDirectory: false,
                    fileType: binaryTypeInfo.type,
                    mimeType: binaryTypeInfo.mimeType,
                    content: '[바이너리 파일 - 텍스트로 표시할 수 없음]',
                  });
                }
              }
            }
          }

          if (extractedFiles.length > 0) {
            extractionSuccess = true;
          }
        } catch (zipError) {
          // zip 추출 실패, 원본 데이터 표시 시도
        }
      }

      // 3. If both archive formats fail, try to display as single file
      if (!extractionSuccess) {
        // 파일 이름이 있는지 확인 (URL이나 다른 소스에서)
        let filename = 'unknown-file';
        if (selectedBranch?.mutableAddress) {
          filename = `mutable-${selectedBranch.mutableAddress.substring(0, 8)}`;
        } else {
          filename = `content-${transaction.id.substring(0, 8)}`;
        }

        // 파일 유형 감지 (바이너리 시그니처 확인)
        const uint8Array = new Uint8Array(data);
        const binaryTypeInfo = detectFileTypeFromBinary(uint8Array);

        if (
          binaryTypeInfo.type === 'image' ||
          binaryTypeInfo.type === 'video' ||
          binaryTypeInfo.type === 'audio' ||
          binaryTypeInfo.type === 'document' ||
          binaryTypeInfo.type === 'archive'
        ) {
          // 바이너리 파일로 처리
          const extension = binaryTypeInfo.mimeType.split('/')[1] || 'bin';
          filename += `.${extension}`;
          extractedFiles = [
            {
              path: filename,
              size: data.byteLength,
              binaryContent: uint8Array,
              isDirectory: false,
              fileType: binaryTypeInfo.type,
              mimeType: binaryTypeInfo.mimeType,
            },
          ];
        } else {
          // 텍스트로 처리 시도
          try {
            const textContent = new TextDecoder().decode(data);
            filename += '.txt';
            extractedFiles = [
              {
                path: filename,
                size: textContent.length,
                content: textContent,
                isDirectory: false,
                fileType: 'text',
                mimeType: 'text/plain',
              },
            ];
          } catch (decodeError) {
            console.error('텍스트 디코딩도 실패:', decodeError);
            extractedFiles = [
              {
                path: 'binary-file',
                size: data.byteLength,
                binaryContent: uint8Array,
                content: '[바이너리 파일 - 내용을 표시할 수 없음]',
                isDirectory: false,
                fileType: 'binary',
                mimeType: 'application/octet-stream',
              },
            ];
          }
        }
      }

      setFiles(extractedFiles);
    } catch (error) {
      console.error('브랜치 데이터 로딩 중 오류:', error);
      setError(
        error instanceof Error ? error.message : 'Error fetching branch data.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadRepoDetails = async () => {
      try {
        setLoading(true);
        setError(null);

        let transactionId: string;
        let mutableAddress: string | null = null;
        let repositoryInfo: Repository | null = null;
        let currentBranch: RepoBranch | null = null;

        // 항상 최신 정보를 가져오기 위해 저장소 검색을 다시 수행
        if (!repoName.match(/^[a-zA-Z0-9_-]{43}$/)) {
          if (!owner) {
            throw new Error('Wallet not connected.');
          }

          // 항상 최신 저장소 정보를 검색
          const repos = await searchRepositories(owner, currentWallet);

          if (repos.length === 0) {
            throw new Error(`Can't find repo from '${owner}'`);
          }

          // Find repository by name
          const targetRepo = repos.find(repo => repo.name === repoName);

          if (!targetRepo) {
            throw new Error(`Can't find repo called '${repoName}'.`);
          }

          repositoryInfo = targetRepo;

          // 전달받은 repo 데이터에서 선택된 브랜치가 있으면 사용, 없으면 기본 브랜치 사용
          if (repo && repo.selectedBranch) {
            currentBranch =
              targetRepo.branches.find(
                b => b.name === repo.selectedBranch?.name
              ) ||
              targetRepo.branches.find(
                b => b.name === targetRepo.defaultBranch
              ) ||
              targetRepo.branches[0];
          } else {
            currentBranch =
              targetRepo.branches.find(
                b => b.name === targetRepo.defaultBranch
              ) || targetRepo.branches[0];
          }

          transactionId = currentBranch.transactionId;
          mutableAddress = currentBranch.mutableAddress;
        }
        // 직접 트랜잭션 ID로 접근하는 경우
        else {
          transactionId = repoName;
        }

        // 저장소와 브랜치 정보 설정
        if (repositoryInfo) {
          setRepository(repositoryInfo);
          setSelectedBranch(currentBranch);
        }

        // 브랜치 데이터 로드 (강제 새로고침 옵션 포함)
        await loadBranchData(transactionId, mutableAddress, true);
      } catch (error) {
        console.error('저장소 정보 로딩 중 오류:', error);
        setError(error instanceof Error ? error.message : 'Unknown error.');
        setLoading(false);
      }
    };

    if (repoName) {
      loadRepoDetails();
    }
  }, [repoName, owner, repo]);

  // 저장소 관련 정보를 병렬로 로드
  useEffect(() => {
    const loadRepositoryData = async () => {
      if (!repository || !owner) return;

      try {
        // 병렬로 실행할 작업들
        const promises = [
          // 소유자 프로필 로드
          getProfileByAddress(owner),
          // 권한 정보 로드
          getRepositoryPermissions(repository.name, owner),
          // 저장소 설명 로드
          getRepositoryDescription(repository.name, owner),
        ];

        const [ownerProfile, permissions, descriptionData] = (await Promise.all(
          promises
        )) as [
          UserProfile | null,
          RepositoryPermissions | null,
          RepositoryDescription | null,
        ];

        // 소유자 정보 설정
        setRepositoryOwner({
          address: owner,
          profile: ownerProfile,
        });

        // Contributors 프로필 병렬 로드
        if (
          permissions &&
          'contributors' in permissions &&
          permissions.contributors
        ) {
          const contributorAddresses = permissions.contributors.filter(
            address => address !== owner
          );
          const contributorProfiles = await Promise.all(
            contributorAddresses.map(async address => {
              const profile = await getProfileByAddress(address);
              return { address, profile };
            })
          );
          setContributors(contributorProfiles);
        }

        // 저장소 설명 설정
        if (descriptionData) {
          setRepositoryDescription(descriptionData);
          setDescription(descriptionData.description);
        } else {
          setRepositoryDescription(null);
          setDescription('');
        }
      } catch (error) {
        console.error('저장소 데이터 로딩 중 오류:', error);
      }
    };

    loadRepositoryData();
  }, [repository, owner, refreshPermissions]);

  // Load repository issues
  useEffect(() => {
    loadIssues();
  }, [repository, owner, refreshIssues]);

  // Save repository description
  const handleSaveDescription = async () => {
    if (!repository || !owner || !uploader || !currentWallet) return;

    // Only repository owner can edit description
    if (currentWallet !== owner) {
      alert('Only repository owner can edit the description.');
      return;
    }

    try {
      setSavingDescription(true);

      const result = await updateRepositoryDescription(uploader, {
        repository: repository.name,
        owner: owner,
        description: editingDescription,
        existingRootTxId: repositoryDescription?.rootTxId,
      });

      if (result.success) {
        setDescription(editingDescription);
        setIsEditingDescription(false);

        // Update repository description data
        const updatedDescriptionData = await getRepositoryDescription(
          repository.name,
          owner
        );
        if (updatedDescriptionData) {
          setRepositoryDescription(updatedDescriptionData);
        }
      } else {
        alert(`Error saving description: ${result.error}`);
      }
    } catch (error) {
      console.error('Error saving description:', error);
      alert('Error saving description. Please try again.');
    } finally {
      setSavingDescription(false);
    }
  };

  // Cancel editing description
  const handleCancelEditDescription = () => {
    setEditingDescription(description);
    setIsEditingDescription(false);
  };

  // Start editing description
  const handleStartEditDescription = () => {
    setEditingDescription(description);
    setIsEditingDescription(true);
  };

  // 사용자 페이지로 이동하는 핸들러
  const handleUserClick = (user: any) => {
    // 프로필이 있으면 닉네임으로, 없으면 지갑 주소로 이동
    if (user.profile?.nickname) {
      router.push(`/${user.profile.nickname}`);
    } else {
      router.push(`/${user.address}`);
    }
  };

  // 저장소 공유 카드 열기 핸들러
  const handleOpenRepoShareCard = () => {
    setShowRepoShareCard(true);
  };

  // 저장소 공유 카드 닫기 핸들러
  const handleCloseRepoShareCard = () => {
    setShowRepoShareCard(false);
  };

  // Issue-related handlers
  const loadIssues = async () => {
    if (!repository || !owner) return;

    try {
      setLoadingIssues(true);
      const repoIssues = await getRepositoryIssues(repository.name, owner);
      setIssues(repoIssues);
    } catch (error) {
      console.error('Error loading issues:', error);
    } finally {
      setLoadingIssues(false);
    }
  };

  const loadIssueComments = async (issue: Issue) => {
    try {
      setLoadingComments(true);
      const comments = await getIssueComments(
        issue.repository,
        issue.owner,
        issue.issueCount,
        issue.title,
        issue.author
      );
      setIssueComments(comments);
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleCreateIssue = async () => {
    if (!repository || !owner || !uploader || !currentWallet) return;
    if (!newIssueTitle.trim() || !newIssueContent.trim()) return;

    try {
      setSavingIssue(true);
      const result = await createIssue(uploader, {
        repository: repository.name,
        owner: owner,
        title: newIssueTitle.trim(),
        content: newIssueContent.trim(),
        author: currentWallet,
      });

      if (result.success) {
        setNewIssueTitle('');
        setNewIssueContent('');
        setShowIssueCreateModal(false);
        setRefreshIssues(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error creating issue:', error);
    } finally {
      setSavingIssue(false);
    }
  };

  const handleUpdateIssue = async () => {
    if (!editingIssue || !repository || !owner || !uploader || !currentWallet)
      return;
    if (!editingIssueTitle.trim() || !editingIssueContent.trim()) return;

    try {
      setSavingIssue(true);
      const result = await updateIssue(uploader, {
        repository: repository.name,
        owner: owner,
        issueCount: editingIssue.issueCount,
        title: editingIssueTitle.trim(),
        content: editingIssueContent.trim(),
        author: editingIssue.author,
        existingRootTxId: editingIssue.rootTxId,
      });

      if (result.success) {
        setEditingIssue(null);
        setEditingIssueTitle('');
        setEditingIssueContent('');
        setRefreshIssues(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error updating issue:', error);
    } finally {
      setSavingIssue(false);
    }
  };

  const handleCreateComment = async () => {
    if (!selectedIssue || !repository || !owner || !uploader || !currentWallet)
      return;
    if (!newCommentContent.trim()) return;

    try {
      setSavingComment(true);
      const result = await createIssueComment(uploader, {
        repository: repository.name,
        owner: owner,
        issueCount: selectedIssue.issueCount,
        issueTitle: selectedIssue.title,
        issueAuthor: selectedIssue.author,
        content: newCommentContent.trim(),
        author: currentWallet,
      });

      if (result.success) {
        setNewCommentContent('');
        await loadIssueComments(selectedIssue);
      }
    } catch (error) {
      console.error('Error creating comment:', error);
    } finally {
      setSavingComment(false);
    }
  };

  const handleUpdateComment = async () => {
    if (
      !editingComment ||
      !selectedIssue ||
      !repository ||
      !owner ||
      !uploader ||
      !currentWallet
    )
      return;
    if (!editingCommentContent.trim()) return;

    try {
      setSavingComment(true);
      const result = await updateIssueComment(uploader, {
        repository: repository.name,
        owner: owner,
        issueCount: selectedIssue.issueCount,
        issueTitle: selectedIssue.title,
        issueAuthor: selectedIssue.author,
        commentCount: editingComment.commentCount,
        content: editingCommentContent.trim(),
        author: editingComment.author,
        existingRootTxId: editingComment.rootTxId,
      });

      if (result.success) {
        setEditingComment(null);
        setEditingCommentContent('');
        await loadIssueComments(selectedIssue);
      }
    } catch (error) {
      console.error('Error updating comment:', error);
    } finally {
      setSavingComment(false);
    }
  };

  const handleOpenIssueDetail = async (issue: Issue) => {
    setSelectedIssue(issue);
    setShowIssueDetailModal(true);
    await loadIssueComments(issue);
  };

  const handleCloseIssueDetail = () => {
    setShowIssueDetailModal(false);
    setSelectedIssue(null);
    setIssueComments([]);
    setEditingIssue(null);
    setEditingComment(null);
    setEditingIssueTitle('');
    setEditingIssueContent('');
    setEditingCommentContent('');
    setNewCommentContent('');
  };

  const handleStartEditIssue = (issue: Issue) => {
    setEditingIssue(issue);
    setEditingIssueTitle(issue.title);
    setEditingIssueContent(issue.content);
  };

  const handleCancelEditIssue = () => {
    setEditingIssue(null);
    setEditingIssueTitle('');
    setEditingIssueContent('');
  };

  const handleStartEditComment = (comment: IssueComment) => {
    setEditingComment(comment);
    setEditingCommentContent(comment.content);
  };

  const handleCancelEditComment = () => {
    setEditingComment(null);
    setEditingCommentContent('');
  };

  const canEditIssue = (issue: Issue) => {
    return currentWallet === issue.author;
  };

  const canDeleteIssue = (issue: Issue) => {
    return currentWallet === issue.author || currentWallet === owner;
  };

  const canEditComment = (comment: IssueComment) => {
    return currentWallet === comment.author;
  };

  const canDeleteComment = (comment: IssueComment) => {
    return currentWallet === comment.author || currentWallet === owner;
  };

  const truncateText = (text: string, maxLines: number = 3) => {
    const lines = text.split('\n');
    if (lines.length <= maxLines) return text;
    return lines.slice(0, maxLines).join('\n') + '...';
  };

  const handleDeleteIssue = async (issue: Issue) => {
    if (!confirm('Are you sure you want to delete this issue?')) return;
    if (!repository || !owner || !uploader || !currentWallet) return;

    try {
      const result = await updateIssueVisibility(uploader, {
        repository: repository.name,
        owner: owner,
        issueCount: issue.issueCount,
        issueTitle: issue.title,
        issueAuthor: issue.author,
        visibility: false,
        existingRootTxId: issue.rootTxId,
      });

      if (result.success) {
        setRefreshIssues(prev => prev + 1);
        handleCloseIssueDetail();
      }
    } catch (error) {
      console.error('Error deleting issue:', error);
    }
  };

  const handleDeleteComment = async (comment: IssueComment) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;
    if (!repository || !owner || !uploader || !currentWallet) return;

    try {
      const result = await updateCommentVisibility(uploader, {
        repository: repository.name,
        owner: owner,
        issueCount: comment.issueCount,
        issueTitle: comment.issueTitle,
        issueAuthor: comment.issueAuthor,
        commentCount: comment.commentCount,
        commentAuthor: comment.author,
        visibility: false,
        existingRootTxId: comment.rootTxId,
      });

      if (result.success && selectedIssue) {
        await loadIssueComments(selectedIssue);
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  const handleFileClick = (item: any) => {
    if (item.isDirectory) {
      setCurrentPath(item.path);
      return;
    }

    const file = item.originalFile;
    setSelectedFile(file);

    // 바이너리 파일인 경우 내용을 설정하지 않음 (바이너리 데이터로 처리됨)
    if (
      file?.fileType === 'image' ||
      file?.fileType === 'video' ||
      file?.fileType === 'audio' ||
      file?.fileType === 'document' ||
      file?.fileType === 'archive' ||
      file?.fileType === 'binary'
    ) {
      setFileContent('');
    } else {
      setFileContent(file?.content || '파일 내용을 불러올 수 없습니다.');
    }
  };

  const getCurrentFiles = () => {
    const items = new Map<string, any>();

    // 현재 경로의 길이 계산 (트레일링 슬래시 포함)
    const basePath = currentPath
      ? currentPath.endsWith('/')
        ? currentPath
        : currentPath + '/'
      : '';
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
          originalFile: file,
        });
      } else {
        // 현재 레벨의 디렉토리 (하위에 더 많은 파일들이 있음)
        if (!items.has(firstPart)) {
          items.set(firstPart, {
            name: firstPart,
            path: fullPath,
            isDirectory: true,
            size: 0,
            originalFile: null,
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

    // 파일 유형별 아이콘
    if (file.fileType) {
      const extension = getFileExtension(file.path);

      switch (file.fileType) {
        case 'image':
          const imageIconMap: { [key: string]: string } = {
            jpg: '🖼️',
            jpeg: '🖼️',
            png: '🖼️',
            gif: '🎞️',
            bmp: '🖼️',
            webp: '🖼️',
            svg: '🎨',
            ico: '🖼️',
            tiff: '🖼️',
            tif: '🖼️',
            heic: '🖼️',
            heif: '🖼️',
            avif: '🖼️',
          };
          return imageIconMap[extension] || '🖼️';

        case 'video':
          const videoIconMap: { [key: string]: string } = {
            mp4: '🎬',
            avi: '🎬',
            mov: '🎬',
            wmv: '🎬',
            flv: '🎬',
            webm: '🎬',
            mkv: '🎬',
            m4v: '🎬',
            '3gp': '🎬',
            '3g2': '🎬',
            ogv: '🎬',
            ts: '🎬',
            mts: '🎬',
            m2ts: '🎬',
          };
          return videoIconMap[extension] || '🎬';

        case 'audio':
          const audioIconMap: { [key: string]: string } = {
            mp3: '🎵',
            wav: '🎵',
            flac: '🎵',
            aac: '🎵',
            ogg: '🎵',
            wma: '🎵',
            m4a: '🎵',
            opus: '🎵',
            aiff: '🎵',
            au: '🎵',
            ra: '🎵',
            mid: '🎼',
            midi: '🎼',
          };
          return audioIconMap[extension] || '🎵';

        case 'document':
          const documentIconMap: { [key: string]: string } = {
            pdf: '📄',
            doc: '📝',
            docx: '📝',
            xls: '📊',
            xlsx: '📊',
            ppt: '📊',
            pptx: '📊',
            odt: '📝',
            ods: '📊',
            odp: '📊',
            rtf: '📝',
            epub: '📚',
            mobi: '📚',
            azw: '📚',
            azw3: '📚',
          };
          return documentIconMap[extension] || '📄';

        case 'archive':
          const archiveIconMap: { [key: string]: string } = {
            zip: '📦',
            rar: '📦',
            '7z': '📦',
            tar: '📦',
            gz: '📦',
            bz2: '📦',
            xz: '📦',
            cab: '📦',
            dmg: '💽',
            iso: '💽',
            deb: '📦',
            rpm: '📦',
            msi: '📦',
          };
          return archiveIconMap[extension] || '📦';

        case 'code':
          const codeIconMap: { [key: string]: string } = {
            js: '🟨',
            jsx: '⚛️',
            ts: '🔷',
            tsx: '⚛️',
            html: '🌐',
            htm: '🌐',
            css: '🎨',
            scss: '🎨',
            sass: '🎨',
            less: '🎨',
            json: '📋',
            xml: '📋',
            yml: '⚙️',
            yaml: '⚙️',
            toml: '⚙️',
            ini: '⚙️',
            cfg: '⚙️',
            conf: '⚙️',
            py: '🐍',
            java: '☕',
            c: '🇨',
            cpp: '🇨',
            cc: '🇨',
            cxx: '🇨',
            h: '🇨',
            hpp: '🇨',
            cs: '🇨',
            php: '🐘',
            rb: '💎',
            go: '🐹',
            rs: '🦀',
            swift: '🦉',
            kt: '🇰',
            scala: '🇸',
            clj: '🇨',
            hs: '🇭',
            lua: '🌙',
            r: '📊',
            sql: '🗃️',
            sh: '🐚',
            bash: '🐚',
            zsh: '🐚',
            fish: '🐚',
            ps1: '💻',
            bat: '💻',
            cmd: '💻',
            vim: '📝',
            dockerfile: '🐳',
            makefile: '🔧',
            cmake: '🔧',
            gradle: '🔧',
            pom: '📋',
            sln: '💻',
            csproj: '💻',
            vcxproj: '💻',
            xcodeproj: '💻',
          };
          return codeIconMap[extension] || '💻';

        case 'text':
          const textIconMap: { [key: string]: string } = {
            txt: '📄',
            md: '📝',
            markdown: '📝',
            mdown: '📝',
            mkd: '📝',
            rst: '📝',
            asciidoc: '📝',
            adoc: '📝',
            tex: '📝',
            latex: '📝',
            bib: '📚',
            org: '📝',
            wiki: '📝',
            textile: '📝',
            csv: '📊',
            tsv: '📊',
            log: '📃',
            patch: '🔧',
            diff: '🔧',
            gitignore: '🔧',
            gitattributes: '🔧',
            license: '📜',
            readme: '📖',
            changelog: '📜',
            todo: '📝',
            authors: '👥',
            contributors: '👥',
            copying: '📜',
            install: '📋',
            news: '📰',
            thanks: '🙏',
            version: '🔢',
          };
          return textIconMap[extension] || '📄';

        case 'binary':
          return '📦';

        default:
          return '📄';
      }
    }

    // 파일 유형이 없는 경우 확장자로 판단 (하위 호환성)
    const extension = getFileExtension(file.path);
    const { type } = getFileTypeByExtension(file.path);

    if (type === 'image') return '🖼️';
    if (type === 'video') return '🎬';
    if (type === 'audio') return '🎵';
    if (type === 'document') return '📄';
    if (type === 'archive') return '📦';
    if (type === 'code') return '💻';
    if (type === 'text') return '📄';

    return '📄';
  };

  // 현재 URL에서 사용자 식별자 추출 (닉네임 또는 지갑 주소)
  const getUserIdentifier = () => {
    if (typeof window !== 'undefined') {
      const currentPath = window.location.pathname;
      return currentPath.split('/')[1] || owner || repoName;
    }
    return owner || repoName;
  };

  const cloneCmd = repository
    ? `igit clone githirys.xyz/${getUserIdentifier()}/${repository.name}`
    : `igit clone githirys.xyz/${getUserIdentifier()}/${repoName}`;

  if (loading) {
    return (
      <div className={styles.repoHeader}>
        <h2>{repository?.name || repoName}</h2>
        <p className={styles.repoLoading}>Fetching Repo Data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.repoHeader}>
        <h2>{repository?.name || repoName}</h2>
        <div className="error">
          <p>❌ {error}</p>
          <p style={{ fontSize: '14px', marginTop: '8px' }}>
            • Check if the repository name is correct
          </p>
          <p style={{ fontSize: '14px', marginTop: '8px' }}>
            • Check if the repository is done "igit push"
          </p>
          <p style={{ fontSize: '14px', marginTop: '8px' }}>
            • Check if URL is correct
          </p>
        </div>
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className={styles.repoHeader}>
        <h2>{repository?.name || repoName}</h2>
        <p>Can't find such repository</p>
      </div>
    );
  }

  return (
    <div>
      <div className={styles.repoHeader}>
        <div className={styles.repoTitleRow}>
          <h2 className={styles.repoTitle}>{repository?.name || repoName}</h2>
          <button
            className={styles.shareButton}
            onClick={handleOpenRepoShareCard}
            title="Share Repository"
          >
            Share
          </button>
        </div>
        <div className={styles.repoSubRow}>
          {/* 브랜치 선택 드롭다운 */}
          {repository && repository.branches.length > 1 && (
            <div className={styles.branchSelectorContainer}>
              <select
                value={selectedBranch?.name || repository.defaultBranch}
                onChange={e => handleBranchChange(e.target.value)}
                className={styles.branchSelect}
              >
                {repository.branches.map(branch => (
                  <option key={branch.name} value={branch.name}>
                    {branch.name}
                    {branch.name === repository.defaultBranch && ' (Default)'}
                  </option>
                ))}
              </select>
            </div>
          )}
          {/* 저장소 노출 권한 토글 */}
          {repository && owner && (
            <div className={styles.visibilityToggleContainer}>
              <VisibilityManager
                repositoryName={repository.name}
                owner={owner}
                currentWallet={currentWallet}
                uploader={uploader}
              />
            </div>
          )}
        </div>

        {/* Repository Description Section - Description visible to all, editing only for owner */}
        {repository && owner && description && (
          <div className={styles.descriptionSection}>
            <h3 className={styles.descriptionTitle}>Project Description</h3>
            <div className={styles.descriptionText}>{description}</div>
            {/* Edit button only visible to repository owner */}
            {currentWallet === owner && (
              <div className={styles.areaeditDescriptionButton}>
                <button
                  onClick={handleStartEditDescription}
                  className={styles.editDescriptionButton}
                >
                  Edit Description
                </button>
              </div>
            )}
          </div>
        )}

        {/* Repository Description Editor - Only visible to repository owner when editing */}
        {repository &&
          owner &&
          currentWallet === owner &&
          isEditingDescription && (
            <div className={styles.descriptionSection}>
              <h3 className={styles.descriptionTitle}>Project Description</h3>
              <div className={styles.descriptionEditor}>
                <textarea
                  value={editingDescription}
                  onChange={e => setEditingDescription(e.target.value)}
                  placeholder="Describe your project..."
                  className={styles.descriptionTextarea}
                  rows={4}
                />
                <div className={styles.descriptionActions}>
                  <button
                    onClick={handleSaveDescription}
                    disabled={savingDescription}
                    className={styles.saveDescriptionButton}
                  >
                    {savingDescription ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={handleCancelEditDescription}
                    disabled={savingDescription}
                    className={styles.cancelDescriptionButton}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

        {/* Add Description Section - Only visible to repository owner when no description exists */}
        {repository &&
          owner &&
          currentWallet === owner &&
          !description &&
          !isEditingDescription && (
            <div className={styles.descriptionSection}>
              <h3 className={styles.descriptionTitle}>Project Description</h3>
              <div className={styles.descriptionPlaceholder}>
                Add a description to help others understand your project
              </div>
              <div className={styles.areaeditDescriptionButton}>
                <button
                  onClick={handleStartEditDescription}
                  className={styles.editDescriptionButton}
                >
                  Add Description
                </button>
              </div>
            </div>
          )}

        {/* Issues Section */}
        {repository && owner && (
          <div className={styles.issuesSection}>
            <div className={styles.issuesHeader}>
              <h3 className={styles.issuesTitle}>Issues ({issues.length})</h3>
              {currentWallet && (
                <button
                  onClick={() => setShowIssueCreateModal(true)}
                  className={styles.createIssueButton}
                >
                  Create Issue
                </button>
              )}
            </div>

            {loadingIssues ? (
              <div className={styles.issuesLoading}>Loading issues...</div>
            ) : issues.length === 0 ? (
              <div className={styles.noIssues}>
                No issues yet. Create the first one!
              </div>
            ) : (
              <div className={styles.issuesContainer}>
                {issues.map(issue => (
                  <div key={issue.id} className={styles.issueCard}>
                    <div className={styles.issueHeader}>
                      <h4 className={styles.issueTitle}>{issue.title}</h4>
                      <span className={styles.issueAuthor}>
                        by {issue.author.substring(0, 8)}...
                      </span>
                    </div>
                    <div className={styles.issueContent}>
                      {truncateText(issue.content, 3)}
                    </div>
                    <div className={styles.issueFooter}>
                      <span className={styles.issueDate}>
                        {TimestampUtils.formatRelative(issue.createdAt)}
                      </span>
                      <button
                        onClick={() => handleOpenIssueDetail(issue)}
                        className={styles.viewMoreButton}
                      >
                        View More
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 저장소 소유자와 contributor 정보 */}
        {repositoryOwner && (
          <div className={styles.membersSection}>
            <h3 className={styles.membersTitle}>Repo Member</h3>

            <div className={styles.membersContainer}>
              {/* 소유자 */}
              <div className={styles.authorGroup}>
                <h4 className={styles.memberGroupTitle}>Owner</h4>
                <div
                  className={styles.authorItem}
                  onClick={() => handleUserClick(repositoryOwner)}
                >
                  {repositoryOwner.profile?.profileImageUrl ? (
                    <img
                      src={repositoryOwner.profile.profileImageUrl}
                      alt="프로필"
                      className={styles.memberAvatar}
                    />
                  ) : (
                    <div className={styles.memberAvatarPlaceholder}>
                      {repositoryOwner.profile?.nickname
                        ?.charAt(0)
                        .toUpperCase() || '👤'}
                    </div>
                  )}
                  <div className={styles.memberName}>
                    {repositoryOwner.profile?.nickname ||
                      `${repositoryOwner.address.substring(0, 8)}...${repositoryOwner.address.slice(-4)}`}
                  </div>
                  <div className={styles.memberAddress}>
                    {repositoryOwner.address}
                  </div>
                  {repositoryOwner.profile?.twitterHandle && (
                    <div className={styles.memberTwitter}>
                      @{repositoryOwner.profile.twitterHandle}
                    </div>
                  )}
                </div>
              </div>

              {/* Contributor들 */}
              <div className={styles.memberGroup}>
                <div className={styles.memberGroupHeader}>
                  <h4 className={styles.memberGroupTitle}>
                    Contributor ({contributors.length})
                  </h4>
                  {/* 편집 권한 관리 버튼 - 소유자에게만 표시 */}
                </div>
                {contributors.length > 0 ? (
                  <div className={styles.contributorsList}>
                    {contributors.map((contributor, index) => (
                      <div
                        key={contributor.address}
                        className={styles.memberItem}
                        onClick={() => handleUserClick(contributor)}
                      >
                        {contributor.profile?.profileImageUrl ? (
                          <img
                            src={contributor.profile.profileImageUrl}
                            alt="프로필"
                            className={styles.memberAvatar}
                          />
                        ) : (
                          <div className={styles.memberAvatarPlaceholder}>
                            {contributor.profile?.nickname
                              ?.charAt(0)
                              .toUpperCase() || '👤'}
                          </div>
                        )}
                        <div className={styles.memberName}>
                          {contributor.profile?.nickname ||
                            `${contributor.address.substring(0, 8)}...${contributor.address.slice(-4)}`}
                        </div>
                        <div className={styles.memberAddress}>
                          {contributor.address}
                        </div>
                        {contributor.profile?.twitterHandle && (
                          <div className={styles.memberTwitter}>
                            @{contributor.profile.twitterHandle}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={styles.noContributorsMessage}>No one</div>
                )}
                {currentWallet === owner && (
                  <button
                    className={styles.managePermissionButton}
                    onClick={() => setIsPermissionModalOpen(true)}
                  >
                    Edit
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <div className={styles.repoMeta}>
          <div className={styles.repoMetaRow}>
            <span className={styles.repoMetaTitle}>Transaction Id :</span>
            <code className={styles.repoMetaCode}>{transaction.id}</code>
          </div>
          {selectedBranch?.mutableAddress && (
            <div className={styles.repoMetaRow}>
              <span className={styles.repoMetaTitle}>Mutable Address :</span>
              <code className={styles.repoMetaCode}>
                {selectedBranch.mutableAddress}
              </code>
            </div>
          )}
          {owner && (
            <div className={styles.repoMetaRow}>
              <span className={styles.repoMetaTitle}>Owner :</span>
              <code className={styles.repoMetaCode}>{owner}</code>
            </div>
          )}
          {selectedBranch?.commitHash && (
            <div className={styles.repoMetaRow}>
              <span className={styles.repoMetaTitle}>Commit :</span>
              <code className={styles.repoMetaCode}>
                {selectedBranch.commitHash}
              </code>
            </div>
          )}
          {selectedBranch?.author && (
            <div className={styles.repoMetaRow}>
              <span className={styles.repoMetaTitle}>Commiter :</span>
              <code className={styles.repoMetaCode}>
                {selectedBranch.author}
              </code>
            </div>
          )}
          {selectedBranch?.timestamp && (
            <div className={styles.repoMetaRow}>
              <span className={styles.repoMetaTitle}>Last Updated :</span>
              {TimestampUtils.formatRelative(selectedBranch.timestamp)} (
              {TimestampUtils.format(selectedBranch.timestamp)})
            </div>
          )}
        </div>

        <div className={styles.cloneSection}>
          <p className={styles.cloneTitle}>Clone Command:</p>
          <div className={styles.cloneCommandContainer}>
            <code className={styles.cloneCommand}>{cloneCmd}</code>
            <button
              onClick={() => navigator.clipboard.writeText(cloneCmd)}
              className={styles.cloneButton}
            >
              Copy
            </button>
          </div>
        </div>
      </div>
      <div className={styles.contentContainer}>
        {/* File Tree */}
        <div className={styles.fileTree}>
          <div className={styles.fileTreeHeader}>Files</div>

          {currentPath && (
            <div className={styles.breadcrumbContainer}>
              <button
                onClick={() => {
                  const pathParts = currentPath
                    .split('/')
                    .filter(part => part.length > 0);
                  if (pathParts.length <= 1) {
                    setCurrentPath('');
                  } else {
                    setCurrentPath(pathParts.slice(0, -1).join('/'));
                  }
                }}
                className={styles.breadcrumbButton}
              >
                ← Parent path
              </button>
              <div className={styles.breadcrumbPath}>
                Current path : {currentPath || '/'}
              </div>
            </div>
          )}

          <div>
            {getCurrentFiles().map(item => (
              <div
                key={item.path}
                onClick={() => handleFileClick(item)}
                className={`${styles.fileItem} ${selectedFile?.path === item.originalFile?.path ? styles.fileItemSelected : styles.fileItemHover}`}
              >
                <span className={styles.fileItemIcon}>
                  {item.isDirectory
                    ? '📁'
                    : getFileIcon(
                        item.originalFile || {
                          path: item.name,
                          size: 0,
                          isDirectory: false,
                        }
                      )}
                </span>
                <span className={styles.fileItemName}>{item.name}</span>
                {!item.isDirectory && (
                  <span className={styles.fileItemSize}>{item.size}B</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* File Content */}
        <div className={styles.fileContent}>
          <div className={styles.fileContentHeader}>
            {selectedFile ? selectedFile.path : 'Choose File'}
          </div>

          {selectedFile && (
            <div className={styles.fileContentBody}>
              {selectedFile.binaryContent ? (
                // 바이너리 파일 표시
                <div className={styles.mediaContainer}>
                  {selectedFile.fileType === 'image' && (
                    <div className={styles.imageContainer}>
                      <img
                        src={URL.createObjectURL(
                          new Blob([selectedFile.binaryContent], {
                            type: selectedFile.mimeType,
                          })
                        )}
                        alt={selectedFile.path}
                        className={styles.imagePreview}
                        onLoad={e => {
                          // 이미지 로드 후 URL 정리 (메모리 누수 방지)
                          const img = e.target as HTMLImageElement;
                          setTimeout(() => URL.revokeObjectURL(img.src), 1000);
                        }}
                      />
                      <div className={styles.mediaInfo}>
                        📐 Image Size : {selectedFile.size} bytes
                      </div>
                    </div>
                  )}

                  {selectedFile.fileType === 'video' && (
                    <div className={styles.videoContainer}>
                      <video
                        src={URL.createObjectURL(
                          new Blob([selectedFile.binaryContent], {
                            type: selectedFile.mimeType,
                          })
                        )}
                        className={styles.videoPreview}
                        controls
                        onLoadedMetadata={e => {
                          // 비디오 로드 후 URL 정리 (메모리 누수 방지)
                          const video = e.target as HTMLVideoElement;
                          setTimeout(
                            () => URL.revokeObjectURL(video.src),
                            1000
                          );
                        }}
                      />
                      <div className={styles.mediaInfo}>
                        🎬 Video Size: {selectedFile.size} bytes
                      </div>
                    </div>
                  )}

                  {selectedFile.fileType === 'audio' && (
                    <div className={styles.audioContainer}>
                      <audio
                        src={URL.createObjectURL(
                          new Blob([selectedFile.binaryContent], {
                            type: selectedFile.mimeType,
                          })
                        )}
                        className={styles.audioPreview}
                        controls
                        onLoadedMetadata={e => {
                          // 오디오 로드 후 URL 정리 (메모리 누수 방지)
                          const audio = e.target as HTMLAudioElement;
                          setTimeout(
                            () => URL.revokeObjectURL(audio.src),
                            1000
                          );
                        }}
                      />
                      <div className={styles.mediaInfo}>
                        🎵 Audio Size: {selectedFile.size} bytes
                      </div>
                    </div>
                  )}

                  {selectedFile.fileType === 'document' &&
                    selectedFile.mimeType === 'application/pdf' && (
                      <div className={styles.documentContainer}>
                        <iframe
                          src={URL.createObjectURL(
                            new Blob([selectedFile.binaryContent], {
                              type: selectedFile.mimeType,
                            })
                          )}
                          className={styles.documentPreview}
                          title={selectedFile.path}
                        />
                        <div className={styles.mediaInfo}>
                          📄 PDF Document Size: {selectedFile.size} bytes
                        </div>
                      </div>
                    )}

                  {(selectedFile.fileType === 'archive' ||
                    selectedFile.fileType === 'binary' ||
                    (selectedFile.fileType === 'document' &&
                      selectedFile.mimeType !== 'application/pdf')) && (
                    <div className={styles.binaryContainer}>
                      <div className={styles.binaryInfo}>
                        <div className={styles.binaryHeader}>
                          {selectedFile.fileType === 'archive'
                            ? '📦'
                            : selectedFile.fileType === 'document'
                              ? '📄'
                              : '⚙️'}{' '}
                          Binary File
                        </div>
                        <div className={styles.binaryDetails}>
                          <p>
                            <strong>File Type:</strong> {selectedFile.fileType}
                          </p>
                          <p>
                            <strong>MIME Type:</strong> {selectedFile.mimeType}
                          </p>
                          <p>
                            <strong>File Size:</strong> {selectedFile.size}{' '}
                            bytes
                          </p>
                        </div>
                        <div className={styles.downloadSection}>
                          <button
                            className={styles.downloadButton}
                            onClick={() => {
                              const blob = new Blob(
                                [selectedFile.binaryContent!],
                                { type: selectedFile.mimeType }
                              );
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download =
                                selectedFile.path.split('/').pop() ||
                                'download';
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                              URL.revokeObjectURL(url);
                            }}
                          >
                            📥 Download
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                // 텍스트 파일 표시
                <div className={styles.textContent}>
                  {fileContent || `Not supported file type.`}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 편집 권한 관리 팝업 모달 */}
      {isPermissionModalOpen && repository && owner && (
        <div
          className={styles.modalOverlay}
          onClick={e => {
            if (e.target === e.currentTarget) {
              setIsPermissionModalOpen(false);
              setRefreshPermissions(prev => prev + 1);
            }
          }}
        >
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Edit Permission</h3>
              <button
                className={styles.modalCloseButton}
                onClick={() => {
                  setIsPermissionModalOpen(false);
                  setRefreshPermissions(prev => prev + 1);
                }}
              >
                ✕
              </button>
            </div>
            <div className={styles.modalBody}>
              <PermissionManager
                repositoryName={repository.name}
                owner={owner}
                currentWallet={currentWallet}
                uploader={uploader}
              />
            </div>
          </div>
        </div>
      )}

      {/* 저장소 공유 카드 팝업 */}
      {showRepoShareCard && repository && (
        <RepoShareCard
          repositoryName={repository.name}
          description={description || 'No description available'}
          owner={repositoryOwner || { address: owner || 'Unknown' }}
          contributors={contributors || []}
          lastUpdated={
            selectedBranch?.timestamp
              ? TimestampUtils.formatRelative(selectedBranch.timestamp)
              : 'Unknown'
          }
          onClose={handleCloseRepoShareCard}
        />
      )}

      {/* Issue Create Modal */}
      {showIssueCreateModal && (
        <div
          className={styles.modalOverlay}
          onClick={e => {
            if (e.target === e.currentTarget) {
              setShowIssueCreateModal(false);
              setNewIssueTitle('');
              setNewIssueContent('');
            }
          }}
        >
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Create New Issue</h3>
              <button
                className={styles.modalCloseButton}
                onClick={() => {
                  setShowIssueCreateModal(false);
                  setNewIssueTitle('');
                  setNewIssueContent('');
                }}
              >
                ✕
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label htmlFor="issueTitle" className={styles.formLabel}>
                  Issue Title
                </label>
                <input
                  id="issueTitle"
                  type="text"
                  value={newIssueTitle}
                  onChange={e => setNewIssueTitle(e.target.value)}
                  placeholder="Enter issue title..."
                  className={styles.formInput}
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="issueContent" className={styles.formLabel}>
                  Issue Content
                </label>
                <textarea
                  id="issueContent"
                  value={newIssueContent}
                  onChange={e => setNewIssueContent(e.target.value)}
                  placeholder="Describe the issue in detail..."
                  className={styles.formTextarea}
                  rows={8}
                />
              </div>
              <div className={styles.formActions}>
                <button
                  onClick={handleCreateIssue}
                  disabled={
                    savingIssue ||
                    !newIssueTitle.trim() ||
                    !newIssueContent.trim()
                  }
                  className={styles.primaryButton}
                >
                  {savingIssue ? 'Creating...' : 'Create Issue'}
                </button>
                <button
                  onClick={() => {
                    setShowIssueCreateModal(false);
                    setNewIssueTitle('');
                    setNewIssueContent('');
                  }}
                  disabled={savingIssue}
                  className={styles.secondaryButton}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Issue Detail Modal */}
      {showIssueDetailModal && selectedIssue && (
        <div
          className={styles.modalOverlay}
          onClick={e => {
            if (e.target === e.currentTarget) {
              handleCloseIssueDetail();
            }
          }}
        >
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>{selectedIssue.title}</h3>
              <button
                className={styles.modalCloseButton}
                onClick={handleCloseIssueDetail}
              >
                ✕
              </button>
            </div>
            <div className={styles.modalBody}>
              {/* Issue Content */}
              <div className={styles.issueDetail}>
                <div className={styles.issueDetailHeader}>
                  <span className={styles.issueAuthor}>
                    by {selectedIssue.author.substring(0, 8)}...
                  </span>
                  {(canEditIssue(selectedIssue) ||
                    canDeleteIssue(selectedIssue)) && (
                    <div className={styles.issueActions}>
                      {canEditIssue(selectedIssue) && (
                        <button
                          onClick={() => handleStartEditIssue(selectedIssue)}
                          className={styles.actionButton}
                        >
                          Edit
                        </button>
                      )}
                      {canDeleteIssue(selectedIssue) && (
                        <button
                          onClick={() => handleDeleteIssue(selectedIssue)}
                          className={styles.deleteButton}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {editingIssue && editingIssue.id === selectedIssue.id ? (
                  <div className={styles.editForm}>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Issue Title</label>
                      <input
                        type="text"
                        value={editingIssueTitle}
                        onChange={e => setEditingIssueTitle(e.target.value)}
                        className={styles.formInput}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Issue Content</label>
                      <textarea
                        value={editingIssueContent}
                        onChange={e => setEditingIssueContent(e.target.value)}
                        className={styles.formTextarea}
                        rows={6}
                      />
                    </div>
                    <div className={styles.formActions}>
                      <button
                        onClick={handleUpdateIssue}
                        disabled={savingIssue}
                        className={styles.primaryButton}
                      >
                        {savingIssue ? 'Saving...' : 'Save Changes'}
                      </button>
                      <button
                        onClick={handleCancelEditIssue}
                        disabled={savingIssue}
                        className={styles.secondaryButton}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className={styles.issueDetailContent}>
                      {selectedIssue.content}
                    </div>
                    <div className={styles.issueDetailDate}>
                      {TimestampUtils.formatRelative(selectedIssue.createdAt)}
                    </div>
                  </>
                )}
              </div>

              {/* Comments Section */}
              <div className={styles.commentsSection}>
                <h4 className={styles.commentsTitle}>
                  Comments ({issueComments.length})
                </h4>

                {loadingComments ? (
                  <div className={styles.commentsLoading}>
                    Loading comments...
                  </div>
                ) : (
                  <>
                    {issueComments.map(comment => (
                      <div key={comment.id} className={styles.commentCard}>
                        <div className={styles.commentHeader}>
                          <span className={styles.commentAuthor}>
                            {comment.author.substring(0, 8)}...
                          </span>
                          {(canEditComment(comment) ||
                            canDeleteComment(comment)) && (
                            <div className={styles.commentActions}>
                              {canEditComment(comment) && (
                                <button
                                  onClick={() =>
                                    handleStartEditComment(comment)
                                  }
                                  className={styles.actionButton}
                                >
                                  Edit
                                </button>
                              )}
                              {canDeleteComment(comment) && (
                                <button
                                  onClick={() => handleDeleteComment(comment)}
                                  className={styles.deleteButton}
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {editingComment && editingComment.id === comment.id ? (
                          <div className={styles.editForm}>
                            <textarea
                              value={editingCommentContent}
                              onChange={e =>
                                setEditingCommentContent(e.target.value)
                              }
                              className={styles.formTextarea}
                              rows={3}
                            />
                            <div className={styles.formActions}>
                              <button
                                onClick={handleUpdateComment}
                                disabled={savingComment}
                                className={styles.primaryButton}
                              >
                                {savingComment ? 'Saving...' : 'Save'}
                              </button>
                              <button
                                onClick={handleCancelEditComment}
                                disabled={savingComment}
                                className={styles.secondaryButton}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className={styles.commentContent}>
                              {comment.content}
                            </div>
                            <div className={styles.issueDetailDate}>
                              {TimestampUtils.formatRelative(comment.createdAt)}
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </>
                )}

                {/* Add Comment Form */}
                {currentWallet && (
                  <div className={styles.addCommentForm}>
                    <textarea
                      value={newCommentContent}
                      onChange={e => setNewCommentContent(e.target.value)}
                      placeholder="Add a comment..."
                      className={styles.formTextarea}
                      rows={3}
                    />
                    <div className={styles.formActions}>
                      <button
                        onClick={handleCreateComment}
                        disabled={savingComment || !newCommentContent.trim()}
                        className={styles.primaryButton}
                      >
                        {savingComment ? 'Adding...' : 'Add Comment'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
