import { useFonts } from 'expo-font';
import { Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import '@/lib/ride-tracker';
import { DatabaseProvider } from '@/lib/database-context';
import Colors from '@/constants/Colors';
import { I18nProvider, useI18n } from '@/lib/i18n/context';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

const darkTheme = {
  dark: true,
  colors: {
    primary: Colors.dark.tint,
    background: Colors.dark.background,
    card: Colors.dark.card,
    text: Colors.dark.text,
    border: Colors.dark.border,
    notification: Colors.dark.tint,
  },
  fonts: {
    regular: { fontFamily: 'System', fontWeight: '400' as const },
    medium: { fontFamily: 'System', fontWeight: '500' as const },
    bold: { fontFamily: 'System', fontWeight: '700' as const },
    heavy: { fontFamily: 'System', fontWeight: '800' as const },
  },
};

function RootNavigation() {
  const { t } = useI18n();

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Colors.dark.card },
          headerTintColor: Colors.dark.text,
        }}>
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="ride/[id]" options={{ title: t('screens.rideDetails') }} />
        <Stack.Screen
          name="ride/active"
          options={{ title: t('screens.activeRide'), headerBackVisible: false }}
        />
        <Stack.Screen
          name="fuel/add"
          options={{ title: t('screens.addRefueling'), presentation: 'modal' }}
        />
        <Stack.Screen
          name="fuel/[id]"
          options={{ title: t('screens.editRefueling'), presentation: 'modal' }}
        />
        <Stack.Screen
          name="service/add"
          options={{ title: t('screens.addService'), presentation: 'modal' }}
        />
        <Stack.Screen
          name="service/[id]"
          options={{ title: t('screens.editService'), presentation: 'modal' }}
        />
        <Stack.Screen name="ride/edit/[id]" options={{ title: t('screens.editRide') }} />
        <Stack.Screen name="bikes/index" options={{ title: t('screens.motorcycles') }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <DatabaseProvider>
      <I18nProvider>
        <ThemeProvider value={darkTheme}>
          <RootNavigation />
        </ThemeProvider>
      </I18nProvider>
    </DatabaseProvider>
  );
}

export { darkTheme };
