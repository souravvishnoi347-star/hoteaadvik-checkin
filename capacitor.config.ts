import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hotelaadvik.checkin',
  appName: 'Hotel Aadvik',
  webDir: 'public',
  server: {
    url: 'https://checkin.hotelaadvikinn.com/admin',
    cleartext: true
  }
};

export default config;
