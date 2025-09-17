import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import styles from '../styles/LegalPage.module.css';

const Privacy: NextPage = () => {
  return (
    <>
      <Head>
        <title>개인정보 처리방침 - GitHirys</title>
        <meta property="og:title" content="개인정보 처리방침 - GitHirys" />
        <meta property="og:url" content="https://githirys.xyz/privacy" />
        <meta
          name="description"
          content="GitHirys의 개인정보 처리방침입니다. 사용자의 개인정보를 어떻게 수집하고 보호하는지 설명합니다."
        />
      </Head>

      <div className={styles.container}>
        <h1 className={styles.title}>개인정보 처리방침</h1>
        <p className={styles.lastUpdated}>최종 수정일: 2025년 9월 17일</p>

        <section className={styles.section}>
          <h2>1. 개인정보의 수집 및 이용</h2>
          <p>
            GitHirys는 사용자의 개인정보를 다음과 같이 최소한으로 수집하고
            있습니다:
          </p>
          <ul>
            <li>
              <strong>지갑 주소:</strong> Solana 블록체인 지갑 연결 시 공개
              주소만 수집
            </li>
            <li>
              <strong>프로필 정보:</strong> 사용자가 직접 입력한 닉네임 및
              프로필 이미지
            </li>
            <li>
              <strong>저장소 데이터:</strong> 업로드한 Git 저장소의 공개 정보
            </li>
          </ul>
          <p className={styles.highlight}>
            <strong>중요:</strong> GitHirys는 절대로 사용자의 시드 구문,
            프라이빗 키, 비밀번호 등의 민감한 정보를 요구하거나 수집하지
            않습니다.
          </p>
        </section>

        <section className={styles.section}>
          <h2>2. 개인정보의 보관 및 파기</h2>
          <p>
            모든 데이터는 Arweave 블록체인에 영구적으로 저장되며, 블록체인의
            특성상 한 번 저장된 데이터는 수정이나 삭제가 불가능합니다. 따라서
            업로드 전 신중한 검토를 권장합니다.
          </p>
        </section>

        <section className={styles.section}>
          <h2>3. 개인정보의 제3자 제공</h2>
          <p>
            GitHirys는 사용자의 개인정보를 제3자에게 제공하지 않습니다. 모든
            데이터는 분산형 저장소에 공개적으로 저장되며, 블록체인의 투명성
            원칙에 따라 누구나 열람할 수 있습니다.
          </p>
        </section>

        <section className={styles.section}>
          <h2>4. 쿠키 사용</h2>
          <p>GitHirys는 사용자 경험 향상을 위해 최소한의 쿠키를 사용합니다:</p>
          <ul>
            <li>세션 관리를 위한 필수 쿠키</li>
            <li>사용자 설정 저장을 위한 기능성 쿠키</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>5. 보안</h2>
          <p>
            GitHirys는 사용자 정보 보호를 위해 다음과 같은 조치를 취하고
            있습니다:
          </p>
          <ul>
            <li>SSL/TLS 암호화 통신</li>
            <li>지갑 연결을 통한 안전한 인증</li>
            <li>클라이언트 사이드 암호화</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>6. 문의</h2>
          <p>
            개인정보 처리방침에 대한 문의사항이 있으시면 다음 연락처로 문의해
            주세요:
          </p>
          <p>이메일: privacy@githirys.xyz</p>
        </section>

        <div className={styles.footer}>
          <Link href="/" className={styles.backLink}>
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    </>
  );
};

export default Privacy;
