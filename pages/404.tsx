import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Head from 'next/head';
import styles from '../styles/Custom404.module.css';

export default function Custom404() {
  const router = useRouter();
  const [currentPath, setCurrentPath] = useState('');

  useEffect(() => {
    setCurrentPath(window.location.pathname);
  }, []);

  return (
    <>
      <Head>
        <title>Page not found - GitHirys</title>
      </Head>
      <div className="container">
        <div className={styles.container}>
          <h1 className={styles.errorCode}>404</h1>
          <h2 className={styles.errorTitle}>Page not found</h2>
        </div>
      </div>
    </>
  );
}
