import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import styles from '../styles/AboutPage.module.css';

const About: NextPage = () => {
  return (
    <>
      <Head>
        <title>GitHirys 소개 - 분산형 Git 저장소 호스팅 서비스</title>
        <meta
          property="og:title"
          content="GitHirys 소개 - 분산형 Git 저장소 호스팅 서비스"
        />
        <meta property="og:url" content="https://githirys.xyz/about" />
        <meta name="twitter:title" content="GitHirys 소개" />
        <meta
          name="description"
          content="GitHirys는 Solana 블록체인과 Arweave를 활용한 분산형 Git 저장소 호스팅 서비스입니다. 코드를 영구적으로 보관하고 공유하세요."
        />
        <meta
          property="og:description"
          content="GitHirys는 Solana 블록체인과 Arweave를 활용한 분산형 Git 저장소 호스팅 서비스입니다. 코드를 영구적으로 보관하고 공유하세요."
        />
      </Head>

      <div className={styles.container}>
        <div className={styles.hero}>
          <h1 className={styles.title}>GitHirys란?</h1>
          <p className={styles.subtitle}>
            분산형 Git 저장소 호스팅의 새로운 패러다임
          </p>
        </div>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>🌟 주요 특징</h2>
          <div className={styles.features}>
            <div className={styles.feature}>
              <h3>🔒 영구 보관</h3>
              <p>Arweave 블록체인에 코드를 영구적으로 저장합니다</p>
            </div>
            <div className={styles.feature}>
              <h3>🌐 탈중앙화</h3>
              <p>중앙 서버 없이 완전히 분산된 저장소 운영</p>
            </div>
            <div className={styles.feature}>
              <h3>💰 경제적</h3>
              <p>한 번의 결제로 영구적인 저장소 호스팅</p>
            </div>
            <div className={styles.feature}>
              <h3>🔐 보안</h3>
              <p>Solana 지갑 기반의 안전한 인증 시스템</p>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>🚀 사용 방법</h2>
          <ol className={styles.steps}>
            <li>
              <strong>지갑 연결:</strong> Phantom 또는 Solflare 지갑을
              연결합니다
            </li>
            <li>
              <strong>프로필 생성:</strong> 닉네임과 프로필 이미지를 설정합니다
            </li>
            <li>
              <strong>저장소 업로드:</strong> Git 저장소를 압축하여 업로드합니다
            </li>
            <li>
              <strong>공유:</strong> 생성된 링크로 저장소를 공유합니다
            </li>
          </ol>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>🔧 기술 스택</h2>
          <div className={styles.techStack}>
            <div className={styles.tech}>
              <h4>Solana</h4>
              <p>사용자 인증 및 권한 관리</p>
            </div>
            <div className={styles.tech}>
              <h4>Arweave</h4>
              <p>영구 데이터 저장소</p>
            </div>
            <div className={styles.tech}>
              <h4>Irys</h4>
              <p>효율적인 데이터 업로드 및 관리</p>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>📌 안전성</h2>
          <div className={styles.safety}>
            <p>
              GitHirys는 오픈소스 프로젝트로, 모든 코드가 공개되어 있습니다.
              사용자의 개인정보나 비밀번호를 수집하지 않으며, 오직 Solana 지갑을
              통한 안전한 인증만을 사용합니다.
            </p>
            <p>
              <strong>주의:</strong> GitHirys는 절대로 사용자의 시드 구문이나
              프라이빗 키를 요구하지 않습니다. 이를 요구하는 사이트는 피싱
              사이트일 가능성이 높으니 주의하세요.
            </p>
          </div>
        </section>

        <div className={styles.cta}>
          <Link href="/">
            <a className={styles.ctaButton}>시작하기</a>
          </Link>
        </div>
      </div>
    </>
  );
};

export default About;
