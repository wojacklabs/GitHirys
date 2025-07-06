// pages/_app.tsx
import type { AppProps } from 'next/app';
import { useMemo } from 'react';
import { useRouter } from 'next/router';
import {
  ConnectionProvider,
  WalletProvider,
} from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  // Add other wallet adapters if needed
} from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';
import '@solana/wallet-adapter-react-ui/styles.css';
import '../styles/globals.css';
import Head from 'next/head';
import Header from '../components/Header';
import CustomCursor from '../components/CustomCursor';

export default function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();

  // Choose mainnet or devnet
  const network = 'mainnet-beta';
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);

  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    [network]
  );

  // 홈 화면에서는 검색 UI를 숨김
  const showSearch = router.pathname !== '/';

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
      <ConnectionProvider endpoint={endpoint}>
        <WalletProvider wallets={wallets} autoConnect>
          <WalletModalProvider>
            <Header showSearch={showSearch} />
            <Component {...pageProps} />
            <CustomCursor />
          </WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </>
  );
}
