import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import styles from '../styles/Custom404.module.css';

export default function Custom404() {
  const router = useRouter();
  const [currentPath, setCurrentPath] = useState('');

  useEffect(() => {
    setCurrentPath(window.location.pathname);
  }, []);

  return (
    <div className="container">
      <div className={styles.container}>
        <h1 className={styles.errorCode}>404</h1>
        <h2 className={styles.errorTitle}>페이지를 찾을 수 없습니다</h2>
        
        <div className={styles.changeNotice}>
          <h3 className={styles.changeNoticeTitle}>🔄 URL 구조가 변경되었습니다</h3>
          
          {currentPath && (
            <p className={styles.currentPath}>
              요청한 경로: <code className={styles.currentPathCode}>
                {currentPath}
              </code>
            </p>
          )}
          
          <div className={styles.urlStructure}>
            <p className={styles.urlStructureTitle}>새로운 URL 구조:</p>
            <ul className={styles.urlStructureList}>
              <li><code>githirys.xyz/지갑주소</code> - 지갑별 저장소 목록</li>
              <li><code>githirys.xyz/지갑주소/저장소명</code> - 특정 저장소 상세</li>
            </ul>
          </div>
          
          <p className={styles.urlStructureNote}>
            홈페이지에서 지갑을 연결하여 새로운 구조로 접근해보세요.
          </p>
        </div>

        <div className={styles.buttonContainer}>
          <Link 
            href="/"
            className={styles.homeButton}
          >
            🏠 홈으로 가기
          </Link>
          
          <button
            onClick={() => router.back()}
            className={styles.backButton}
          >
            ← 이전 페이지로
          </button>
        </div>

        <div className={styles.helpSection}>
          <h3 className={styles.helpTitle}>도움이 필요하신가요?</h3>
          <ul className={styles.helpList}>
            <li>지갑을 연결하여 자동으로 올바른 URL로 이동하세요</li>
            <li>브라우저 주소창에서 올바른 지갑 주소로 직접 이동하세요</li>
            <li>저장소 목록에서 올바른 링크를 사용하세요</li>
          </ul>
          
          <div className={styles.exampleSection}>
            <strong>예시:</strong> 이전 URL <code className={styles.exampleCode}>/my-repo</code> → 새로운 URL <code className={styles.exampleCode}>/ABC123.../my-repo</code>
          </div>
        </div>
      </div>
    </div>
  );
} 