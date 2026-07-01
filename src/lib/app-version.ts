import Constants from 'expo-constants';

type ExtraConfig = {
  appVersion?: string;
};

const extra = Constants.expoConfig?.extra as ExtraConfig | undefined;

export const APP_STORE_VERSION = Constants.expoConfig?.version ?? '1.0.0';
export const APP_VERSION = extra?.appVersion ?? APP_STORE_VERSION;
