import { CapacitorConfig } from '@capacitor/cli';

const prodServerUrl = process.env.CAPACITOR_SERVER_URL || process.env.PROD_SERVER_URL;
const devServerUrl = process.env.CAPACITOR_DEV_SERVER_URL || 'http://10.0.2.2:3000';
const useDevServer = !prodServerUrl || process.env.CAPACITOR_DEV_SERVER === '1';

const config: CapacitorConfig = {
  appId: 'com.phola.phola',
  appName: 'Phola',
  webDir: 'public',
  server: prodServerUrl
    ? {
        // When building a native APK that should load a deployed site,
        // set `CAPACITOR_SERVER_URL` (or `PROD_SERVER_URL`) to the deployed origin.
        url: prodServerUrl,
        androidScheme: prodServerUrl.startsWith('https') ? 'https' : 'http',
      }
    : useDevServer
    ? {
        // For development: load the running dev server on your machine.
      // This is the default native mode until CAPACITOR_SERVER_URL is set.
      // Override CAPACITOR_DEV_SERVER_URL if you need a physical-device IP instead of the emulator default.
        url: devServerUrl,
        androidScheme: 'http',
      }
    : undefined,
};

export default config;
