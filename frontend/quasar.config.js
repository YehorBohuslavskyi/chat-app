import { defineConfig } from '#q-app'

export default defineConfig(() => ({
  boot: ['pinia'],
  css: ['app.scss'],
  extras: ['roboto-font', 'material-icons'],
  build: {
    vueRouterMode: 'hash'
  },
  devServer: {
    open: false
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
