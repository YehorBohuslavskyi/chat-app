import { defineConfig } from '#q-app'

export default defineConfig(() => ({
  boot: ['pinia'],
  css: ['app.scss'],
  extras: ['roboto-font', 'material-icons'],
  build: {
    vueRouterMode: 'hash',
    defineEnv: {
      API_BASE_URL: process.env.SIDEBY_API_BASE_URL || '/api/v1',
      WORKSPACE_MODE: process.env.SIDEBY_WORKSPACE_MODE || 'api'
    }
  },
  devServer: {
    open: false,
    proxy: { '/api': { target: 'http://localhost:3333', changeOrigin: true } }
  },
  framework: {
    plugins: ['AppVisibility']
  },
  animations: [],
  ssr: {
    prodPort: 3000,
    middlewares: ['render']
  },
  pwa: {
    workboxMode: 'GenerateSW'
  },
  capacitor: {
    hideSplashscreen: true
  },
  electron: {
    preloadScripts: ['electron-preload'],
    inspectPort: 5858,
    bundler: 'packager',
    builder: {
      appId: 'frontend'
    }
  },
  bex: {
    extraScripts: []
  }
}))
