// pages/_app.tsx
import type { AppProps } from 'next/app';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import '../styles/globals.css';
import Head from 'next/head';

// 클라이언트 사이드 전용 컴포넌트들
const Header = dynamic(() => import('../components/Header'), {
  ssr: false,
  loading: () => <div style={{ height: '60px' }} />,
});

const SolanaProvider = dynamic(() => import('../components/SolanaProvider'), {
  ssr: false,
  loading: () => <div>Loading wallet...</div>,
});

const Footer = dynamic(() => import('../components/Footer'), {
  ssr: false,
});

export default function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  // 클라이언트 사이드에서만 실행
  useEffect(() => {
    setMounted(true);
  }, []);

  // 기본 HTML 구조 (SSR에서 실행됨)
  const baseContent = (
    <>
      <Head>
        <meta
          name="viewport"
          content="width=device-width,initial-scale=1.0,maximum-scale=1.0,minimum-scale=1.0,user-scalable=no"
        />
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
        <meta name="theme-color" content="#ffffff" />
      </Head>
      <Component {...pageProps} />
    </>
  );

  // 서버 사이드에서는 지갑 기능 없이 기본 페이지만 렌더링
  if (!mounted) {
    return baseContent;
  }

  // 클라이언트 사이드에서는 완전한 기능 포함
  return (
    <>
      <Head>
        <meta
          name="viewport"
          content="width=device-width,initial-scale=1.0,maximum-scale=1.0,minimum-scale=1.0,user-scalable=no"
        />
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
        <meta name="theme-color" content="#ffffff" />
      </Head>
      <SolanaProvider>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Header showSearch />
          <main style={{ flex: 1 }}>
            <Component {...pageProps} />
          </main>
          <Footer />
        </div>
      </SolanaProvider>
    </>
  );
}
