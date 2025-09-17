import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="ko">
      <Head>
        {/* 기본 메타 태그 */}
        <meta charSet="utf-8" />
        <meta name="robots" content="index, follow" />
        <meta name="author" content="GitHirys" />

        {/* 사이트 설명 - 명확하게 사이트의 목적을 설명 */}
        <meta
          name="description"
          content="GitHirys는 분산형 Git 저장소 호스팅 서비스입니다. Solana 블록체인과 Arweave를 활용하여 코드를 영구적으로 보관하고 공유할 수 있습니다."
        />
        <meta
          name="keywords"
          content="GitHirys, 분산형 Git, 블록체인 Git, Solana, Arweave, 코드 저장소, 오픈소스"
        />

        {/* Open Graph 태그 - 소셜 미디어 공유 시 */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="GitHirys" />
        <meta
          property="og:description"
          content="GitHirys는 분산형 Git 저장소 호스팅 서비스입니다. Solana 블록체인과 Arweave를 활용하여 코드를 영구적으로 보관하고 공유할 수 있습니다."
        />
        <meta property="og:image" content="/sprite_favicon.webp" />
        <meta property="og:locale" content="ko_KR" />

        {/* Twitter 카드 */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta
          name="twitter:description"
          content="GitHirys는 분산형 Git 저장소 호스팅 서비스입니다. Solana 블록체인과 Arweave를 활용하여 코드를 영구적으로 보관하고 공유할 수 있습니다."
        />
        <meta name="twitter:image" content="/sprite_favicon.webp" />

        {/* 보안 관련 메타 태그 */}
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="referrer" content="origin-when-cross-origin" />

        {/* 파비콘 */}
        <link rel="icon" href="/sprite_favicon.webp" />
        <link rel="apple-touch-icon" href="/sprite_favicon.webp" />
        <link
          rel="icon"
          type="image/webp"
          sizes="32x32"
          href="/sprite_favicon.webp"
        />
        <link
          rel="icon"
          type="image/webp"
          sizes="16x16"
          href="/sprite_favicon.webp"
        />

        {/* 추가 보안 헤더 */}
        <meta name="theme-color" content="#ffffff" />
        <meta name="msapplication-TileColor" content="#ffffff" />

        {/* 사이트 인증 */}
        {/* 네이버와 구글 인증 코드는 실제 값으로 교체해주세요 */}
        {/* <meta name="naver-site-verification" content="YOUR_NAVER_VERIFICATION_CODE" /> */}
        {/* <meta name="google-site-verification" content="YOUR_GOOGLE_VERIFICATION_CODE" /> */}
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
