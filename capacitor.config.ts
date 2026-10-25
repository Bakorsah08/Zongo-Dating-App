import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.zongo.dating',
  appName: 'Zongo',
  webDir: 'dist',
  server: {
    // Allow live reload against Vite during native dev (optional).
    androidScheme: 'https',
  },
};

export default config;
