// components/RepoDetail.tsx
import { useEffect, useState } from 'react';
import {
  getTransactionById,
  downloadData,
  searchRepositories,
  Repository,
  RepoBranch,
  TimestampUtils,
} from '../lib/irys';
import JSZip from 'jszip';
import PermissionManager from './PermissionManager';
import VisibilityManager from './VisibilityManager';
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

  if (imageExtensions[extension]) {
    return { type: 'image', mimeType: imageExtensions[extension] };
  }
  if (videoExtensions[extension]) {
    return { type: 'video', mimeType: videoExtensions[extension] };
  }
  if (audioExtensions[extension]) {
    return { type: 'audio', mimeType: audioExtensions[extension] };
  }
  if (documentExtensions[extension]) {
    return { type: 'document', mimeType: documentExtensions[extension] };
  }
  if (archiveExtensions[extension]) {
    return { type: 'archive', mimeType: archiveExtensions[extension] };
  }
  if (codeExtensions[extension]) {
    return { type: 'code', mimeType: codeExtensions[extension] };
  }
  if (textExtensions[extension]) {
    return { type: 'text', mimeType: textExtensions[extension] };
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

  // 브랜치 변경 핸들러
  const handleBranchChange = async (branchName: string) => {
    if (!repository) return;

    const branch = repository.branches.find(b => b.name === branchName);
    if (!branch) return;

    console.log('🌿 브랜치 변경:', {
      branchName,
      transactionId: branch.transactionId.substring(0, 12) + '...',
      mutableAddress: branch.mutableAddress
        ? branch.mutableAddress.substring(0, 12) + '...'
        : null,
      useMutable: !!branch.mutableAddress,
    });

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
      console.log('🔄 브랜치 데이터 로딩:', {
        transactionId: transactionId.substring(0, 12) + '...',
        mutableAddress: mutableAddress
          ? mutableAddress.substring(0, 12) + '...'
          : null,
        useMutable: !!mutableAddress,
        forceRefresh,
      });

      // Get transaction details
      const txDetails = await getTransactionById(transactionId);
      if (!txDetails) {
        throw new Error('브랜치 트랜잭션을 찾을 수 없습니다.');
      }

      setTransaction(txDetails);

      // Download and extract repository data (강제 새로고침 옵션 포함)
      const data = await downloadData(
        transactionId,
        mutableAddress,
        forceRefresh
      );
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
          const sizeStr = new TextDecoder()
            .decode(header.slice(124, 124 + 11))
            .replace(/\0/g, '')
            .trim();
          const fileSize = parseInt(sizeStr, 8) || 0;

          // Skip header
          offset += 512;

          if (filename && fileSize > 0 && !filename.endsWith('/')) {
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

          // Move to next file (round up to 512-byte boundary)
          offset += Math.ceil(fileSize / 512) * 512;
        }

        if (extractedFiles.length > 0) {
          extractionSuccess = true;
          console.log(
            `✅ tar에서 ${extractedFiles.length}개의 파일을 추출했습니다.`
          );
        }
      } catch (tarError) {
        console.log(
          'tar 추출 실패, 다른 형식 시도:',
          tarError instanceof Error ? tarError.message : String(tarError)
        );
      }

      // 2. Try ZIP format if TAR fails
      if (!extractionSuccess) {
        try {
          console.log('zip 형식으로 압축 해제 시도 중...');
          const zip = new JSZip();
          const zipContent = await zip.loadAsync(data);

          for (const [filepath, file] of Object.entries(zipContent.files)) {
            if (!file.dir) {
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
            console.log(
              `✅ zip에서 ${extractedFiles.length}개의 파일을 추출했습니다.`
            );
          }
        } catch (zipError) {
          console.log(
            'zip 추출 실패, 원본 데이터 표시 시도:',
            zipError instanceof Error ? zipError.message : String(zipError)
          );
        }
      }

      // 3. If both archive formats fail, try to display as single file
      if (!extractionSuccess) {
        console.warn('⚠️ 모든 압축 해제 실패, 원본 데이터를 단일 파일로 표시');

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
          console.log(
            `✅ 원본 데이터를 ${binaryTypeInfo.type} 파일로 표시합니다.`
          );
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
            console.log('✅ 원본 데이터를 텍스트로 표시합니다.');
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
      console.log(`📁 총 ${extractedFiles.length}개의 파일을 로드했습니다.`);
    } catch (error) {
      console.error('브랜치 데이터 로딩 중 오류:', error);
      setError(
        error instanceof Error
          ? error.message
          : '브랜치 데이터를 불러오는 중 오류가 발생했습니다.'
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
        console.log('저장소 상세 정보 로딩:', { repoName, owner, repo });

        let transactionId: string;
        let mutableAddress: string | null = null;
        let repositoryInfo: Repository | null = null;
        let currentBranch: RepoBranch | null = null;

        // 항상 최신 정보를 가져오기 위해 저장소 검색을 다시 수행
        if (!repoName.match(/^[a-zA-Z0-9_-]{43}$/)) {
          console.log(
            '🔄 저장소 이름으로 최신 정보 검색:',
            repoName,
            repo?.isLatest ? '(최신 데이터 요청됨)' : ''
          );

          if (!owner) {
            throw new Error(
              '연결된 지갑 정보가 없습니다. 지갑을 연결해주세요.'
            );
          }

          // 항상 최신 저장소 정보를 검색
          const repos = await searchRepositories(owner);

          if (repos.length === 0) {
            throw new Error(
              `연결된 지갑 '${owner}'에서 저장소를 찾을 수 없습니다.`
            );
          }

          // Find repository by name
          const targetRepo = repos.find(repo => repo.name === repoName);

          if (!targetRepo) {
            throw new Error(
              `저장소 '${repoName}'을 찾을 수 없습니다. 사용 가능한 저장소: ${repos.map(r => r.name).join(', ')}`
            );
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
            console.log(
              '전달받은 브랜치 정보를 최신 데이터와 매칭:',
              currentBranch?.name
            );
          } else {
            currentBranch =
              targetRepo.branches.find(
                b => b.name === targetRepo.defaultBranch
              ) || targetRepo.branches[0];
            console.log('기본 브랜치 선택:', currentBranch?.name);
          }

          transactionId = currentBranch.transactionId;
          mutableAddress = currentBranch.mutableAddress;
          console.log(
            '최신 저장소 정보 사용:',
            targetRepo.name,
            '브랜치:',
            currentBranch.name,
            'mutable:',
            mutableAddress
          );
        }
        // 직접 트랜잭션 ID로 접근하는 경우
        else {
          transactionId = repoName;
          console.log('직접 트랜잭션 ID 사용:', transactionId);
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
        setError(
          error instanceof Error
            ? error.message
            : '알 수 없는 오류가 발생했습니다.'
        );
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
      console.log(
        `🎯 ${file.fileType} 파일 선택:`,
        file.path,
        `(${file.size} bytes)`
      );
    } else {
      setFileContent(file?.content || '파일 내용을 불러올 수 없습니다.');
      console.log(
        '📄 텍스트 파일 선택:',
        file?.path,
        `(${file?.size || 0} bytes)`
      );
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
            • 저장소 이름이 올바른지 확인해주세요
            <br />
            • 저장소가 Irys에 업로드되었는지 확인해주세요
            <br />
            • 연결된 지갑에 업로드 권한이 있는지 확인해주세요
            <br />
            {owner && (
              <span>
                • 연결된 지갑: <code>{owner}</code>
              </span>
            )}
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
      <div className={styles.repoHeader}>
        <div className={styles.repoTitleRow}>
          <h2 className={styles.repoTitle}>
            📁 {repository?.name || repoName}
          </h2>

          {/* 브랜치 선택 드롭다운 */}
          {repository && repository.branches.length > 1 && (
            <div className={styles.branchSelectorContainer}>
              <span className={styles.branchLabel}>브랜치:</span>
              <select
                value={selectedBranch?.name || repository.defaultBranch}
                onChange={e => handleBranchChange(e.target.value)}
                className={styles.branchSelect}
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

        <div className={styles.repoMeta}>
          <p className={styles.repoMetaRow}>
            트랜잭션 ID:{' '}
            <code className={styles.repoMetaCode}>{transaction.id}</code>
          </p>
          {selectedBranch?.mutableAddress && (
            <p className={styles.repoMetaRow}>
              Mutable 주소:{' '}
              <code className={styles.repoMetaCode}>
                {selectedBranch.mutableAddress}
              </code>
            </p>
          )}
          {owner && (
            <p className={styles.repoMetaRow}>
              소유자: <code className={styles.repoMetaCode}>{owner}</code>
            </p>
          )}
          {selectedBranch && (
            <p className={styles.repoMetaRow}>
              브랜치:{' '}
              <code className={styles.repoMetaCode}>{selectedBranch.name}</code>
            </p>
          )}
          {selectedBranch?.commitHash && (
            <p className={styles.repoMetaRow}>
              커밋:{' '}
              <code className={styles.repoMetaCode}>
                {selectedBranch.commitHash}
              </code>
            </p>
          )}
          {selectedBranch?.author && (
            <p className={styles.repoMetaRow}>
              작성자:{' '}
              <code className={styles.repoMetaCode}>
                {selectedBranch.author}
              </code>
            </p>
          )}
          {selectedBranch?.timestamp && (
            <p className={styles.repoMetaRow}>
              업로드 시간:{' '}
              {TimestampUtils.formatRelative(selectedBranch.timestamp)} (
              {TimestampUtils.format(selectedBranch.timestamp)})
            </p>
          )}
        </div>

        <div className={styles.cloneSection}>
          <p className={styles.cloneTitle}>Clone 명령어 (모든 브랜치 포함):</p>
          <div className={styles.cloneCommandContainer}>
            <code className={styles.cloneCommand}>{cloneCmd}</code>
            <button
              onClick={() => navigator.clipboard.writeText(cloneCmd)}
              className={styles.cloneButton}
            >
              복사
            </button>
          </div>
        </div>
      </div>

      <div className={styles.contentContainer}>
        {/* File Tree */}
        <div className={styles.fileTree}>
          <div className={styles.fileTreeHeader}>파일 트리</div>

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
                ← 상위 폴더로
              </button>
              <div className={styles.breadcrumbPath}>
                현재 경로: {currentPath || '/'}
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
            {selectedFile ? selectedFile.path : '파일을 선택하세요'}
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
                        📐 이미지 크기: {selectedFile.size} bytes
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
                        🎬 비디오 크기: {selectedFile.size} bytes
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
                        🎵 오디오 크기: {selectedFile.size} bytes
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
                          📄 PDF 문서 크기: {selectedFile.size} bytes
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
                          바이너리 파일
                        </div>
                        <div className={styles.binaryDetails}>
                          <p>
                            <strong>파일 유형:</strong> {selectedFile.fileType}
                          </p>
                          <p>
                            <strong>MIME 타입:</strong> {selectedFile.mimeType}
                          </p>
                          <p>
                            <strong>파일 크기:</strong> {selectedFile.size}{' '}
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
                            📥 다운로드
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                // 텍스트 파일 표시
                <div className={styles.textContent}>
                  {fileContent || '파일 내용을 불러올 수 없습니다.'}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 권한 관리 섹션 - 저장소가 있고 소유자가 있을 때만 표시 */}
      {repository && owner && (
        <>
          <PermissionManager
            repositoryName={repository.name}
            owner={owner}
            currentWallet={currentWallet}
            uploader={uploader}
          />

          <VisibilityManager
            repositoryName={repository.name}
            owner={owner}
            currentWallet={currentWallet}
            uploader={uploader}
          />
        </>
      )}
    </div>
  );
}
