import createNextIntlPlugin from 'next-intl/plugin'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.githubusercontent.com' },
      { protocol: 'https', hostname: '**.unsplash.com' },
      { protocol: 'https', hostname: 'images.pexels.com' },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  eslint: {
    dirs: ['src'],
  },
  typescript: {
    ignoreBuildErrors: false,
  },
}

// next-intl：src/i18n.ts 为 getRequestConfig 入口（架构 §7.6）
const withNextIntl = createNextIntlPlugin('./src/i18n.ts')

// 仅在需要时开启包体积分析：ANALYZE=true npm run build
let finalConfig = nextConfig
if (process.env.ANALYZE === 'true') {
  // 动态引入，避免影响常规构建
  const analyzerModule = await import('@next/bundle-analyzer').catch(() => null)
  if (analyzerModule?.default) {
    finalConfig = analyzerModule.default({ enabled: true })(nextConfig)
  }
}

export default withNextIntl(finalConfig)
