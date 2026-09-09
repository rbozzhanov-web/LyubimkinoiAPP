import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  const scheme = useColorScheme();
  // expo-router's Stack renders inside its own NavigationContainer, which paints this theme's
  // colors.background (rgb(242,242,242) by default) on the current screen's container -- an
  // ancestor outside this app's own component tree, and outside anything a per-screen
  // `contentStyle` option can reach (tried; the fill survived it). MainScreen's own
  // SafeAreaView already owns the real background for every mode (the app's palette color
  // normally, transparent so the fixed Special Mode wallpaper in +html.tsx shows through), so
  // this theme only needs to get out of the way.
  const navigationTheme = { ...(scheme === 'dark' ? DarkTheme : DefaultTheme), colors: { ...(scheme === 'dark' ? DarkTheme : DefaultTheme).colors, background: 'transparent' } };

  return (
    <SafeAreaProvider>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <ThemeProvider value={navigationTheme}>
        <Stack screenOptions={{ headerShown: false }} />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
