import { CapacitorConfig } from '@capacitor/cli';

const useDevServer = process.env.CAPACITOR_DEV_SERVER === '1';
const prodServerUrl = process.env.CAPACITOR_SERVER_URL || process.env.PROD_SERVER_URL;

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
        // Enable by setting `CAPACITOR_DEV_SERVER=1` in the environment used for the native build.
        url: 'http://172.16.4.151:3000',
        androidScheme: 'http',
      }
    : undefined,
};

export default config;
