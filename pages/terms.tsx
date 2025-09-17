import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import styles from '../styles/LegalPage.module.css';

const Terms: NextPage = () => {
  return (
    <>
      <Head>
        <title>이용약관 - GitHirys</title>
        <meta property="og:title" content="이용약관 - GitHirys" />
        <meta property="og:url" content="https://githirys.xyz/terms" />
        <meta
          name="description"
          content="GitHirys 서비스 이용약관입니다. 서비스 이용에 대한 권리와 의무를 설명합니다."
        />
      </Head>

      <div className={styles.container}>
        <h1 className={styles.title}>이용약관</h1>
        <p className={styles.lastUpdated}>최종 수정일: 2025년 9월 17일</p>

        <section className={styles.section}>
          <h2>제1조 (목적)</h2>
          <p>
            이 약관은 GitHirys(이하 "서비스")가 제공하는 분산형 Git 저장소
            호스팅 서비스의 이용과 관련하여 서비스와 이용자의 권리, 의무 및
            책임사항을 규정함을 목적으로 합니다.
          </p>
        </section>

        <section className={styles.section}>
          <h2>제2조 (서비스의 내용)</h2>
          <p>서비스는 다음과 같은 기능을 제공합니다:</p>
          <ul>
            <li>Git 저장소의 분산형 저장 및 호스팅</li>
            <li>Solana 지갑을 통한 사용자 인증</li>
            <li>프로필 및 저장소 관리</li>
            <li>저장소 공유 및 접근 권한 관리</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>제3조 (이용자의 의무)</h2>
          <p>이용자는 다음 행위를 하여서는 안 됩니다:</p>
          <ul>
            <li>타인의 정보를 도용하는 행위</li>
            <li>서비스의 운영을 방해하는 행위</li>
            <li>저작권 등 타인의 권리를 침해하는 콘텐츠 업로드</li>
            <li>불법적이거나 부적절한 콘텐츠 업로드</li>
            <li>악성 코드나 바이러스를 포함한 파일 업로드</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>제4조 (서비스의 특성)</h2>
          <p className={styles.highlight}>
            <strong>중요:</strong> Arweave 블록체인에 업로드된 데이터는
            영구적으로 저장되며, 한 번 업로드된 콘텐츠는 수정이나 삭제가
            불가능합니다. 이용자는 업로드 전 콘텐츠를 신중히 검토해야 합니다.
          </p>
        </section>

        <section className={styles.section}>
          <h2>제5조 (면책조항)</h2>
          <p>서비스는 다음과 같은 경우 책임을 지지 않습니다:</p>
          <ul>
            <li>블록체인 네트워크의 장애로 인한 서비스 중단</li>
            <li>이용자의 부주의로 인한 지갑 키 분실</li>
            <li>이용자가 업로드한 콘텐츠로 인한 문제</li>
            <li>제3자의 불법적인 서비스 이용으로 인한 손해</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>제6조 (지적재산권)</h2>
          <p>
            이용자가 업로드한 콘텐츠의 저작권은 해당 이용자에게 있으며, 서비스는
            서비스 제공을 위한 필요한 범위 내에서만 이를 사용할 수 있습니다.
          </p>
        </section>

        <section className={styles.section}>
          <h2>제7조 (약관의 변경)</h2>
          <p>
            서비스는 필요한 경우 약관을 변경할 수 있으며, 변경된 약관은 서비스
            내 공지를 통해 이용자에게 알립니다.
          </p>
        </section>

        <section className={styles.section}>
          <h2>제8조 (준거법)</h2>
          <p>
            이 약관의 해석 및 서비스 이용에 관한 분쟁은 대한민국 법률에
            따릅니다.
          </p>
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

export default Terms;
