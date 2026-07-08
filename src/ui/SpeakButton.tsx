import Ionicons from '@expo/vector-icons/Ionicons';
import * as Speech from 'expo-speech';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet } from 'react-native';
import { getSettings, saveSettings } from '../data/settings';
import { theme } from './theme';

let filVoiceAvailable: boolean | null = null;

export function SpeakButton({ text }: { text: string }) {
  const [available, setAvailable] = useState<boolean>(filVoiceAvailable ?? false);

  useEffect(() => {
    if (filVoiceAvailable !== null) return;
    let cancelled = false;
    Speech.getAvailableVoicesAsync().then((voices) => {
      filVoiceAvailable = voices.some((v) => v.language.toLowerCase().startsWith('fil'));
      if (!cancelled) setAvailable(filVoiceAvailable);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!available) return null;

  const speak = async () => {
    const settings = await getSettings();
    if (!settings.bisayaVoiceNoticeShown) {
      Alert.alert(
        'About audio',
        'Audio uses the Filipino (Tagalog) voice for both languages, so Bisaya pronunciation is approximate.',
      );
      await saveSettings({ bisayaVoiceNoticeShown: true });
    }
    Speech.stop();
    Speech.speak(text, { language: 'fil-PH', rate: settings.ttsRate });
  };

  return (
    <Pressable accessibilityLabel="Speak translation" onPress={speak} style={styles.action}>
      <Ionicons name="volume-high-outline" size={20} color={theme.colors.accent} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  action: { backgroundColor: theme.colors.accentSoft, borderRadius: 20, padding: 10 },
});
