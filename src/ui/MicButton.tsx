import Ionicons from '@expo/vector-icons/Ionicons';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from './theme';

export function MicButton({ onTranscript, enabled }: { onTranscript: (t: string) => void; enabled: boolean }) {
  const [available, setAvailable] = useState(false);
  const [listening, setListening] = useState(false);

  useEffect(() => {
    setAvailable(ExpoSpeechRecognitionModule.isRecognitionAvailable());
  }, []);

  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results[0]?.transcript;
    if (transcript) onTranscript(transcript);
  });
  useSpeechRecognitionEvent('end', () => setListening(false));
  useSpeechRecognitionEvent('error', (event) => {
    setListening(false);
    if (event.error === 'network') {
      Alert.alert(
        'Offline voice input unavailable',
        'Your phone needs the offline Tagalog language pack. Install it via phone Settings \u2192 Google \u2192 Voice input, or type instead.',
      );
    }
  });

  if (!enabled || !available) return null;

  const toggle = async () => {
    if (listening) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    const perms = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perms.granted) return;
    setListening(true);
    ExpoSpeechRecognitionModule.start({ lang: 'fil-PH', interimResults: true });
  };

  return (
    <View style={styles.wrap}>
      <Pressable accessibilityLabel="Voice input" onPress={toggle} style={[styles.mic, listening && styles.micActive]}>
        <Ionicons name={listening ? 'mic' : 'mic-outline'} size={22} color={listening ? '#fff' : theme.colors.accent} />
      </Pressable>
      {listening && <Text style={styles.hint}>{'Listening\u2026'}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  mic: { backgroundColor: theme.colors.accentSoft, borderRadius: 24, padding: 12 },
  micActive: { backgroundColor: theme.colors.accent },
  hint: { color: theme.colors.muted, fontSize: 14 },
});
