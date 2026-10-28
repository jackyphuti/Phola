/** @type {import('next').NextConfig} */
const isStaticExport = process.env.NEXT_OUTPUT_EXPORT === 'true'

const nextConfig = {
  ...(isStaticExport ? { output: 'export' } : {}),
  // Whitelist external dev origin(s) for Hot Module Replacement (HMR)
  // Allow common local development origins used by Android Studio, emulators, and local browsers.
  allowedDevOrigins: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://10.0.2.2:3000'],
  images: {
    unoptimized: true,
  },
  async redirects() {
    return [
      {
        source: '/loadshedding',
        destination: '/safety',
        permanent: false,
      },
    ]
  },
  async headers() {
    if (isStaticExport) {
      return []
    }

    const contentSecurityPolicy = [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "form-action 'self'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://plausible.io https://plausible.site",
      "connect-src 'self' https: wss:",
      "media-src 'self' data: blob:",
      "worker-src 'self' blob:",
    ].join('; ')

    return [
      {
        // 1. Apply Security & Strict No-Cache to all HTML & dynamic pages to ensure updates load immediately
        source: '/((?!_next/static|_next/image).*)',
        headers: [
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'geolocation=(self), microphone=(self), camera=(self)' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
          { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Cache-Control', value: 'no-cache, no-store, max-age=0, must-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
        ],
      },
      {
        // 2. Service Worker must NEVER be cached by the browser or WebView
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, max-age=0, must-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
        ],
      },
    ]
  },
}

export default nextConfig
