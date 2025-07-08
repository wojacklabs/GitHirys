import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/router';

interface RouterContextType {
  isRouteReady: boolean;
  currentUser: string | null;
  currentRepo: string | null;
  isValidRoute: boolean;
  setRouteParams: (user: string, repo?: string) => void;
}

const RouterContext = createContext<RouterContextType | undefined>(undefined);

export function RouterProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isRouteReady, setIsRouteReady] = useState(false);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [currentRepo, setCurrentRepo] = useState<string | null>(null);
  const [isValidRoute, setIsValidRoute] = useState(true);

  useEffect(() => {
    // 라우터가 준비되었을 때 실행
    if (router.isReady) {
      const { user, repo } = router.query;

      // URL 파라미터 파싱
      const parsedUser = typeof user === 'string' ? user : null;
      const parsedRepo = typeof repo === 'string' ? repo : null;

      setCurrentUser(parsedUser);
      setCurrentRepo(parsedRepo);
      setIsRouteReady(true);

      // 라우트 유효성 검사
      const isUserRoute = router.pathname === '/[user]';
      const isRepoRoute = router.pathname === '/[user]/[repo]';

      if (isUserRoute && !parsedUser) {
        setIsValidRoute(false);
      } else if (isRepoRoute && (!parsedUser || !parsedRepo)) {
        setIsValidRoute(false);
      } else {
        setIsValidRoute(true);
      }
    }
  }, [router.isReady, router.query, router.pathname]);

  const setRouteParams = (user: string, repo?: string) => {
    setCurrentUser(user);
    setCurrentRepo(repo || null);
    setIsValidRoute(true);
  };

  return (
    <RouterContext.Provider
      value={{
        isRouteReady,
        currentUser,
        currentRepo,
        isValidRoute,
        setRouteParams,
      }}
    >
      {children}
    </RouterContext.Provider>
  );
}

export function useRouterContext() {
  const context = useContext(RouterContext);
  if (context === undefined) {
    // 서버 사이드 렌더링 중에는 기본값을 반환
    return {
      isRouteReady: false,
      currentUser: null,
      currentRepo: null,
      isValidRoute: true,
      setRouteParams: () => {},
    };
  }
  return context;
}
