import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'


function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

/**
 * Determine if running in GitHub Codespaces
 */
const isCodespaces = (): boolean => {
  return !!(process.env.CODESPACE_NAME);
};

/**
 * Get backend API URL based on environment
 */
const getBackendUrl = (): string => {
  if (isCodespaces()) {
    const codespaceName = process.env.CODESPACE_NAME;
    const apiPort = process.env.VITE_API_PORT || '5000';
    return `https://${codespaceName}-${apiPort}.app.github.dev`;
  }
  
  const apiPort = process.env.VITE_API_PORT || '5000';
  return `http://localhost:${apiPort}`;
};

export default defineConfig({
  plugins: [
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],

  /**
   * Dev server configuration for Codespaces compatibility
   */
  server: {
    // Allow access from GitHub Codespaces proxy
    middlewareMode: false,
    hmr: isCodespaces()
      ? {
          // Use secure connections in Codespaces
          protocol: 'wss',
          host: process.env.CODESPACE_NAME
            ? `${process.env.CODESPACE_NAME}-5173.app.github.dev`
            : undefined,
          port: 443,
        }
      : undefined,
    
    // Proxy API requests to the backend
    proxy: {
      '/api': {
        target: getBackendUrl(),
        changeOrigin: true,
        secure: isCodespaces(), // Use secure in Codespaces
        ws: true,
        logLevel: 'info',
        // Remove /api prefix when forwarding to backend if backend doesn't use it
        // rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },

    // Allow connections from Codespaces proxy
    allowedHosts: isCodespaces()
      ? [`.app.github.dev`]
      : ['localhost', '127.0.0.1'],
  },

  /**
   * Build configuration
   */
  build: {
    outDir: 'dist',
    sourcemap: true,
    // Optimize for production
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
      },
    },
  },

  /**
   * Environment variables configuration
   */
  define: {
    __API_URL__: JSON.stringify(getBackendUrl()),
    __IS_CODESPACES__: JSON.stringify(isCodespaces()),
  },
})
