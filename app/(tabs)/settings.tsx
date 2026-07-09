import { useEffect, useState } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getSettings, saveSettings, type Settings } from '../../src/data/settings';
import { UserRepo } from '../../src/data/userRepo';
import type { Direction } from '../../src/engine/types';
import { DIRECTION_LABELS } from '../../src/ui/labels';
import { theme } from '../../src/ui/theme';

const ARROW = '\u2192';
const CHECK = '\u2713';

export default function SettingsScreen() {
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSettings().then((s) => {
      if (!cancelled) setSettings(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!settings) return null;

  const setDirection = async (d: Direction) => {
    await saveSettings({ defaultDirection: d });
    setSettings({ ...settings, defaultDirection: d });
  };

  const clearHistory = () => {
    Alert.alert('Clear history?', 'This removes all past translations (favorites are kept).', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => (await UserRepo.create()).clearHistory(),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <Text style={styles.title}>Settings</Text>

        <Text style={styles.section}>Default direction</Text>
        {(['tl-ceb', 'ceb-tl'] as const).map((d) => (
          <Pressable key={d} style={styles.row} onPress={() => setDirection(d)}>
            <Text style={styles.rowText}>
              {DIRECTION_LABELS[d].from + ' ' + ARROW + ' ' + DIRECTION_LABELS[d].to}
            </Text>
            <Text style={styles.check}>{settings.defaultDirection === d ? CHECK : ''}</Text>
          </Pressable>
        ))}

        <Text style={styles.section}>Data</Text>
        <Pressable style={styles.row} onPress={clearHistory}>
          <Text style={[styles.rowText, { color: theme.colors.danger }]}>Clear history</Text>
        </Pressable>

        <Text style={styles.section}>About</Text>
        <View style={styles.about}>
          <Text style={styles.aboutText}>
            LeyText Learn translates Tagalog to Bisaya (Cebuano) and back, fully offline. Nothing you
            type ever leaves your phone {'\u2014'} the app makes no network connections at all.
          </Text>
          <Text style={styles.aboutText}>
            Word-by-word results are approximate; exact matches come from a curated phrasebook.
          </Text>
          <Text style={styles.aboutText}>
            Dictionary and phrase data curated for this app by its author. Corrections and
            additions are welcome.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg, padding: 16 },
  title: { fontSize: 28, fontWeight: '700', color: theme.colors.text, marginTop: 8, marginBottom: 8 },
  section: { fontSize: 13, fontWeight: '700', color: theme.colors.muted, textTransform: 'uppercase', marginTop: 20, marginBottom: 8 },
  row: {
    backgroundColor: theme.colors.card, borderRadius: 12, padding: 14, marginBottom: 8,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  rowText: { fontSize: 16, color: theme.colors.text },
  check: { fontSize: 16, color: theme.colors.accent, fontWeight: '700' },
  about: { backgroundColor: theme.colors.card, borderRadius: 12, padding: 14, gap: 8 },
  aboutText: { fontSize: 14, color: theme.colors.text, lineHeight: 20 },
});
