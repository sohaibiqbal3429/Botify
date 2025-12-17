import 'dotenv/config';
import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: '5gBotify',
  slug: 'fivegbotify',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'fivegbotify',
  userInterfaceStyle: 'light',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#0f172a'
  },
  extra: {
    eas: {
      projectId: 'replace-with-eas-project-id'
    },
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || process.env.API_BASE_URL,
    environment: process.env.APP_ENV || 'development'
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.fivegbotify.app'
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0f172a'
    },
    package: 'com.fivegbotify.app'
  },
  plugins: [
    [
      'expo-secure-store',
      {
        faceIDPermission: 'Allow 5gBotify to use Face ID for secure login.'
      }
    ]
  ]
});
