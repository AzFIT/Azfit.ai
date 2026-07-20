import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"
import { inspectAttr } from 'plugin-inspect-react-code'
import { sentryVitePlugin } from "@sentry/vite-plugin"

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")

  const plugins = [inspectAttr(), react()]

  // Only wire Sentry source-map upload when an auth token is present.
  // The build still works without it; the DSN for runtime error reporting
  // is read at runtime via import.meta.env.VITE_SENTRY_DSN.
  if (env.SENTRY_AUTH_TOKEN) {
    plugins.push(
      sentryVitePlugin({
        org: env.SENTRY_ORG,
        project: env.SENTRY_PROJECT,
        authToken: env.SENTRY_AUTH_TOKEN,
        sourcemaps: {
          assets: "./dist/**",
        },
      })
    )
  }

  return {
    base: './',
    plugins,
    server: {
      port: 3000,
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      // Ensure service worker and manifest are copied to dist
      copyPublicDir: true,
      // Chunk splitting for optimal caching
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router'],
            ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', 'lucide-react', 'framer-motion'],
            charts: ['recharts'],
            supabase: ['@supabase/supabase-js'],
          },
        },
      },
    },
  }
})
