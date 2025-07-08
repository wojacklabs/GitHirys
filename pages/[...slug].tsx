import type { NextPage } from 'next';
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

const CatchAllPage: NextPage = () => {
  const router = useRouter();

  useEffect(() => {
    const { slug } = router.query;

    if (slug && Array.isArray(slug)) {
      // URL 구조에 따라 적절한 페이지로 리다이렉트
      if (slug.length === 1) {
        // /user -> [user] 페이지로 리다이렉트
        router.replace(`/${slug[0]}`);
      } else if (slug.length === 2) {
        // /user/repo -> [user]/[repo] 페이지로 리다이렉트
        router.replace(`/${slug[0]}/${slug[1]}`);
      } else {
        // 잘못된 URL 구조인 경우 404로 리다이렉트
        router.replace('/404');
      }
    }
  }, [router]);

  return (
    <>
      <Head>
        <title>GitHirys</title>
      </Head>
      <div className="container">
        <p style={{ marginTop: 40 }}>Redirecting...</p>
      </div>
    </>
  );
};

export default CatchAllPage;
