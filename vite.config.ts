import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs';

function parseSimpleEnvFile(filePath: string) {
  if (!existsSync(filePath)) return {} as Record<string, string>;

  return readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .reduce((acc, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return acc;

      const separatorIndex = trimmed.indexOf('=');
      if (separatorIndex === -1) return acc;

      const key = trimmed.slice(0, separatorIndex).trim();
      const rawValue = trimmed.slice(separatorIndex + 1).trim();
      const value = rawValue.replace(/^['"]|['"]$/g, '');

      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const localDevelopmentEnv = parseSimpleEnvFile('.env.development');

  // Generate build timestamp for versioning (using LOCAL time, not UTC)
  const now = new Date();
  // Forzar zona horaria Mexico (UTC-6)
  const mexicoTime = new Date(now.getTime() - 6 * 60 * 60 * 1000);
  const year = String(mexicoTime.getUTCFullYear()).slice(2); // YY
  const month = String(mexicoTime.getUTCMonth() + 1).padStart(2, '0'); // MM
  const day = String(mexicoTime.getUTCDate()).padStart(2, '0'); // DD
  const hours = String(mexicoTime.getUTCHours()).padStart(2, '0'); // HH
  const minutes = String(mexicoTime.getUTCMinutes()).padStart(2, '0'); // MM
  const buildDate = `${year}${month}${day}`; // YYMMDD in local time
  const buildTime = `${hours}${minutes}`; // HHMM in local time
  
  return {
  define: {
    __APP_VERSION__: JSON.stringify('2.4.0'),
    __BUILD_TIMESTAMP__: JSON.stringify(`${buildDate}.${buildTime}`),
    __LOCAL_DEVELOPMENT_ENV__: JSON.stringify(localDevelopmentEnv),
  },
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(), 
    mode === "development" && componentTagger(),
    // Generate version.json on build
    {
      name: 'version-generator',
      closeBundle() {
        const versionString = `v2.4.0-${buildDate}.${buildTime}`;
        const versionData = {
          version: versionString,
          buildTime: Date.now()
        };
        try {
          mkdirSync('dist', { recursive: true });
          writeFileSync('dist/version.json', JSON.stringify(versionData));
          console.log(`Generated version.json with version: ${versionString}`);
        } catch (e) {
          console.log('Could not write version.json:', e);
        }
      }
    },
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    sourcemap: true,
    cssCodeSplit: true,
    cssMinify: true,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        passes: 2,
      },
    },
    assetsInlineLimit: 4096,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select'],
          'form-vendor': ['react-hook-form', '@hookform/resolvers', 'zod'],
          'supabase': ['@supabase/supabase-js'],
          'query': ['@tanstack/react-query'],
        },
      },
    },
  },
};
});
