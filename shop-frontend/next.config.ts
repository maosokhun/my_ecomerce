import type { NextConfig } from 'next';

/** Origin for rewrites (/api, /uploads). Prefer BACKEND_PROXY_TARGET; else derive from NEXT_PUBLIC_API_URL (Vercel). */
function resolveBackendOrigin(): string {
  const explicit = process.env.BACKEND_PROXY_TARGET?.trim();
  if (explicit) return explicit.replace(/\/$/, '');
  const pub = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (pub) {
    const withoutApi = pub.replace(/\/api\/?$/i, '').replace(/\/$/, '');
    if (withoutApi) return withoutApi;
  }
  return 'http://127.0.0.1:5000';
}

const backendProxyTarget = resolveBackendOrigin();

/** Allow next/image for product URLs hosted on the same API host (e.g. Render). */
function apiUrlRemotePattern(): { protocol: 'https' | 'http'; hostname: string } | null {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (!u.hostname) return null;
    return { protocol: u.protocol === 'http:' ? 'http' : 'https', hostname: u.hostname };
  } catch {
    return null;
  }
}

const apiImageHost = apiUrlRemotePattern();

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${backendProxyTarget}/api/:path*` },
      /** Same-origin image URLs when DB stores path-only or for Next/Image via localhost:3000 */
      { source: '/uploads/:path*', destination: `${backendProxyTarget}/uploads/:path*` },
    ];
  },
  /** Reduces stale chunk 404 / ChunkLoadError after HMR on Windows (pairs with NEXT_DISABLE_WEBPACK_CACHE). */
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = false;
    }
    return config;
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'images.pexels.com' },
      { protocol: 'https', hostname: 'i.pinimg.com' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'via.placeholder.com' },
      { protocol: 'https', hostname: 'example.com' },
      { protocol: 'https', hostname: 'shop.switch.com.my' },
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'http', hostname: '127.0.0.1' },
      ...(apiImageHost ? [apiImageHost] : []),
    ],
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
};

export default nextConfig;
