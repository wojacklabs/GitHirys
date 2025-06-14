/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  trailingSlash: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Cloudflare Pages 배포 최적화 설정
  images: {
    unoptimized: true,
  },
  // 빌드 캐시 비활성화 및 최적화
  experimental: {
    webpackBuildWorker: false,
    optimizePackageImports: [
      '@solana/wallet-adapter-react',
      '@solana/wallet-adapter-wallets',
      '@irys/web-upload',
    ],
  },
  // 압축 최적화
  compress: true,
  // 성능 최적화
  poweredByHeader: false,
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    config.resolve.fallback = {
      fs: false,
      net: false,
      tls: false,
    };

    // 빌드 캐시 비활성화
    if (!dev) {
      config.cache = false;
    }

    // 번들 크기 최적화
    config.optimization = {
      ...config.optimization,
      splitChunks: {
        chunks: 'all',
        minSize: 20000,
        maxSize: 244000,
        cacheGroups: {
          default: {
            minChunks: 2,
            priority: -20,
            reuseExistingChunk: true,
          },
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            priority: -10,
            chunks: 'all',
            maxSize: 244000,
          },
          // Solana 관련 라이브러리 분리
          solana: {
            test: /[\\/]node_modules[\\/]@solana/,
            name: 'solana',
            priority: 10,
            chunks: 'all',
            maxSize: 244000,
          },
          // Irys 관련 라이브러리 분리
          irys: {
            test: /[\\/]node_modules[\\/]@irys/,
            name: 'irys',
            priority: 10,
            chunks: 'all',
            maxSize: 244000,
          },
          // React 관련 라이브러리 분리
          react: {
            test: /[\\/]node_modules[\\/](react|react-dom)/,
            name: 'react',
            priority: 20,
            chunks: 'all',
            maxSize: 244000,
          },
        },
      },
    };

    // 파일 크기 경고 임계값 조정
    config.performance = {
      ...config.performance,
      maxAssetSize: 250000,
      maxEntrypointSize: 250000,
    };

    return config;
  },
};

module.exports = nextConfig;
