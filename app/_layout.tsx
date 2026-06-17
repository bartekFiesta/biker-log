import { useFonts } from 'expo-font';
import { Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { DatabaseProvider } from '@/lib/database-context';
import Colors from '@/constants/Colors';

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
      <ThemeProvider value={darkTheme}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerStyle: { backgroundColor: Colors.dark.card }, headerTintColor: Colors.dark.text }}>
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="ride/[id]" options={{ title: 'Ride details' }} />
        <Stack.Screen name="ride/active" options={{ title: 'Active ride', headerBackVisible: false }} />
        <Stack.Screen name="fuel/add" options={{ title: 'Add refueling', presentation: 'modal' }} />
        <Stack.Screen name="fuel/[id]" options={{ title: 'Edit refueling', presentation: 'modal' }} />
        <Stack.Screen name="service/add" options={{ title: 'Add service', presentation: 'modal' }} />
        <Stack.Screen name="service/[id]" options={{ title: 'Edit service', presentation: 'modal' }} />
        <Stack.Screen name="ride/edit/[id]" options={{ title: 'Edit ride' }} />
        <Stack.Screen name="bikes/index" options={{ title: 'Motorcycles' }} />
      </Stack>
      </ThemeProvider>
    </DatabaseProvider>
  );
}

export { darkTheme };
