import Link from 'next/link';
import styles from './Footer.module.css';

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>GitHirys</h3>
            <p className={styles.description}>
              분산형 Git 저장소 호스팅 서비스
            </p>
            <p className={styles.copyright}>
              © 2025 GitHirys. All rights reserved.
            </p>
          </div>

          <div className={styles.section}>
            <h4 className={styles.linkTitle}>서비스</h4>
            <ul className={styles.linkList}>
              <li>
                <Link href="/about" className={styles.link}>
                  서비스 소개
                </Link>
              </li>
              <li>
                <a
                  href="https://github.com/githirys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.link}
                >
                  GitHub
                </a>
              </li>
            </ul>
          </div>

          <div className={styles.section}>
            <h4 className={styles.linkTitle}>법적 고지</h4>
            <ul className={styles.linkList}>
              <li>
                <Link href="/terms" className={styles.link}>
                  이용약관
                </Link>
              </li>
              <li>
                <Link href="/privacy" className={styles.link}>
                  개인정보 처리방침
                </Link>
              </li>
            </ul>
          </div>

          <div className={styles.section}>
            <h4 className={styles.linkTitle}>문의</h4>
            <ul className={styles.linkList}>
              <li>
                <a href="mailto:contact@githirys.xyz" className={styles.link}>
                  이메일: contact@githirys.xyz
                </a>
              </li>
              <li>
                <a href="mailto:security@githirys.xyz" className={styles.link}>
                  보안 문의: security@githirys.xyz
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className={styles.disclaimer}>
          <p>
            <strong>보안 안내:</strong> GitHirys는 절대로 시드 구문이나 프라이빗
            키를 요구하지 않습니다. 이를 요구하는 사이트는 피싱 사이트입니다.
          </p>
        </div>
      </div>
    </footer>
  );
}
