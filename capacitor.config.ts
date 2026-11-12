import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.truckwithease.app',
  appName: 'TRUCKWITHEASE Fleet OS',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: false
  },
  ios: {
    contentInset: 'always',
    preferredContentMode: 'mobile',
    scheme: 'TRUCKWITHEASE'
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#0a0e17'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0a0e17',
      showSpinner: false,
      androidSpinnerStyle: 'large',
      iosSpinnerStyle: 'small',
      splashFullScreen: true,
      splashImmersive: true
    }
  }
};

export default config;
