import Constants from 'expo-constants';

export function getAppVersion(): string {
  return Constants.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '?';
}

export function getAppBuildNumber(): string {
  return (
    Constants.nativeBuildVersion ??
    Constants.expoConfig?.ios?.buildNumber ??
    Constants.expoConfig?.android?.versionCode?.toString() ??
    '?'
  );
}

export function getAppVersionLabel(): string {
  return `${getAppVersion()} (${getAppBuildNumber()})`;
}
