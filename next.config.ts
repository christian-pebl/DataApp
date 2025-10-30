import type {NextConfig} from 'next';
import withPWAInit from '@ducanh2912/next-pwa';
import { withSentryConfig } from '@sentry/nextjs';

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/fonts\.(?:gstatic)\.com\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'google-fonts-webfonts',
        expiration: {
          maxEntries: 4,
          maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
        },
      },
    },
    {
      urlPattern: /^https:\/\/fonts\.(?:googleapis)\.com\/.*/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'google-fonts-stylesheets',
        expiration: {
          maxEntries: 4,
          maxAgeSeconds: 7 * 24 * 60 * 60, // 1 week
        },
      },
    },
    {
      urlPattern: /\.(?:eot|otf|ttc|ttf|woff|woff2|font.css)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-font-assets',
        expiration: {
          maxEntries: 4,
          maxAgeSeconds: 7 * 24 * 60 * 60, // 1 week
        },
      },
    },
    {
      urlPattern: /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-image-assets',
        expiration: {
          maxEntries: 64,
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        },
      },
    },
    {
      urlPattern: /\/_next\/image\?url=.+$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'next-image',
        expiration: {
          maxEntries: 64,
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        },
      },
    },
    {
      urlPattern: /\.(?:mp3|wav|ogg)$/i,
      handler: 'CacheFirst',
      options: {
        rangeRequests: true,
        cacheName: 'static-audio-assets',
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        },
      },
    },
    {
      urlPattern: /\.(?:mp4)$/i,
      handler: 'CacheFirst',
      options: {
        rangeRequests: true,
        cacheName: 'static-video-assets',
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        },
      },
    },
    {
      urlPattern: /\.(?:js)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-js-assets',
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        },
      },
    },
    {
      urlPattern: /\.(?:css|less)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-style-assets',
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        },
      },
    },
    {
      urlPattern: /\/_next\/data\/.+\/.+\.json$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'next-data',
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        },
      },
    },
    {
      urlPattern: /\.(?:json|xml|csv)$/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'static-data-assets',
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        },
      },
    },
    {
      urlPattern: ({ url }) => {
        const isSameOrigin = self.origin === url.origin;
        if (!isSameOrigin) return false;
        const pathname = url.pathname;
        // Exclude API routes from caching
        if (pathname.startsWith('/api/')) return false;
        return true;
      },
      handler: 'NetworkFirst',
      options: {
        cacheName: 'pages',
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        },
      },
    },
  ],
});

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true, // TODO: Fix type errors and set to false
  },
  eslint: {
    ignoreDuringBuilds: true, // TODO: Fix linting errors and set to false
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self)',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // Next.js requires unsafe-eval and unsafe-inline
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: https: blob:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.mapbox.com https://a.tile.openstreetmap.org https://b.tile.openstreetmap.org https://c.tile.openstreetmap.org https://*.basemaps.cartocdn.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },

  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
    formats: ['image/avif', 'image/webp'], // Modern image formats
    minimumCacheTTL: 60, // Cache images for 60 seconds
  },

  // Production optimizations (swcMinify is enabled by default in Next.js 15)
  compiler: {
    // Remove console.log in production
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'], // Keep error and warn logs
    } : false,
  },

  // Experimental features
  experimental: {
    allowedDevOrigins: [
      '6000-firebase-studio-1747684233819.cluster-3gc7bglotjgwuxlqpiut7yyqt4.cloudworkstations.dev',
    ],
    // Optimize package imports for better tree-shaking
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-icons',
      'recharts',
      'date-fns',
    ],
  },

  // Webpack optimizations
  webpack: (config, { isServer, dev }) => {
    // Only apply optimizations in production builds
    if (!dev && !isServer) {
      // Optimize chunk splitting for better caching
      config.optimization = {
        ...config.optimization,
        moduleIds: 'deterministic',
        runtimeChunk: 'single',
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            // Default chunks
            default: false,
            vendors: false,

            // Framework chunk (React, Next.js)
            framework: {
              name: 'framework',
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler|next)[\\/]/,
              priority: 40,
              enforce: true,
            },

            // Supabase chunk
            supabase: {
              name: 'supabase',
              test: /[\\/]node_modules[\\/](@supabase)[\\/]/,
              priority: 35,
              enforce: true,
            },

            // Recharts and D3 (heavy charting library)
            charts: {
              name: 'charts',
              test: /[\\/]node_modules[\\/](recharts|d3-.*)[\\/]/,
              priority: 30,
              enforce: true,
            },

            // Radix UI components
            radix: {
              name: 'radix',
              test: /[\\/]node_modules[\\/]@radix-ui[\\/]/,
              priority: 30,
              enforce: true,
            },

            // Leaflet (map library)
            leaflet: {
              name: 'leaflet',
              test: /[\\/]node_modules[\\/](leaflet)[\\/]/,
              priority: 30,
              enforce: true,
            },

            // Common vendor chunk for other dependencies
            vendor: {
              name: 'vendor',
              test: /[\\/]node_modules[\\/]/,
              priority: 20,
              minChunks: 1,
            },

            // Common chunks used across pages
            common: {
              name: 'common',
              minChunks: 2,
              priority: 10,
              reuseExistingChunk: true,
              enforce: true,
            },
          },
        },
      };
    }

    return config;
  },

  // Production source maps (needed for Sentry error tracking)
  productionBrowserSourceMaps: true, // Enable for Sentry source map support
};

// Wrap config with PWA and Sentry
export default withSentryConfig(
  withPWA(nextConfig),
  {
    // For all available options, see:
    // https://github.com/getsentry/sentry-webpack-plugin#options

    // Suppresses source map uploading logs during build
    silent: true,

    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
  },
  {
    // For all available options, see:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

    // Upload a larger set of source maps for prettier stack traces (increases build time)
    widenClientFileUpload: true,

    // Transpiles SDK to be compatible with IE11 (increases bundle size)
    transpileClientSDK: false,

    // Routes browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers (increases server load)
    tunnelRoute: "/monitoring",

    // Hides source maps from generated client bundles
    hideSourceMaps: true,

    // Automatically tree-shake Sentry logger statements to reduce bundle size
    disableLogger: true,
  }
);
