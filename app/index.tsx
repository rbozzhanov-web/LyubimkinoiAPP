import { useEffect, useState } from 'react';
import { Appearance, Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MainScreen from '@/src/components/MainScreen';
import { loadSavedTheme, saveTheme, type SavedTheme } from '@/src/storage/lovedModeStorage';

export default function Index() {
  const insets = useSafeAreaInsets();
  const systemTheme: SavedTheme = Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
  const [theme, setTheme] = useState<SavedTheme>(() => loadSavedTheme() ?? systemTheme);

  useEffect(() => {
    Appearance.setColorScheme(theme);
  }, [theme]);

  const toggleTheme = () => {
    const next: SavedTheme = theme === 'dark' ? 'light' : 'dark';
    saveTheme(next);
    setTheme(next);
  };

  return <>
    <MainScreen />
    <Pressable
      onPress={toggleTheme}
      accessibilityRole="button"
      accessibilityLabel={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      style={[styles.themeButton, { top: insets.top + 15 }]}
    >
      <Text style={styles.themeGlyph}>{theme === 'dark' ? '🍑' : '🍒'}</Text>
    </Pressable>
  </>;
}

const styles = StyleSheet.create({
  themeButton: {
    position: 'absolute',
    right: 66,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  themeGlyph: { fontSize: 21 },
});
