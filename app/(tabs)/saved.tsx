import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import type { SavedEntry } from '../../src/data/userRepo';
import { UserRepo } from '../../src/data/userRepo';
import { DIRECTION_LABELS } from '../../src/ui/labels';
import { theme } from '../../src/ui/theme';

const ARROW = '\u2192';

export default function SavedScreen() {
  const [tab, setTab] = useState<'history' | 'favorites'>('history');
  const [entries, setEntries] = useState<SavedEntry[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      UserRepo.create().then(async (repo) => {
        const data = tab === 'history' ? await repo.getHistory() : await repo.getFavorites();
        if (!cancelled) setEntries(data);
      });
      return () => {
        cancelled = true;
      };
    }, [tab]),
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Saved</Text>
      <View style={styles.tabs}>
        {(['history', 'favorites'] as const).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabActive]}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'history' ? 'History' : 'Favorites'}
            </Text>
          </Pressable>
        ))}
      </View>
      <FlatList
        data={entries}
        keyExtractor={(e) => `${tab}-${e.id}`}
        contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.dir}>
              {DIRECTION_LABELS[item.direction].from + ' ' + ARROW + ' ' + DIRECTION_LABELS[item.direction].to}
            </Text>
            <Text style={styles.input}>{item.input}</Text>
            <Text style={styles.output}>{item.output}</Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {tab === 'history' ? 'No translations yet.' : 'No favorites yet \u2014 tap the star on a translation.'}
          </Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg, padding: 16 },
  title: { fontSize: 28, fontWeight: '700', color: theme.colors.text, marginTop: 8, marginBottom: 12 },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: theme.colors.card },
  tabActive: { backgroundColor: theme.colors.accent },
  tabText: { color: theme.colors.text, fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  card: { backgroundColor: theme.colors.card, borderRadius: 12, padding: 14 },
  dir: { fontSize: 12, color: theme.colors.muted, marginBottom: 4 },
  input: { fontSize: 15, color: theme.colors.text },
  output: { fontSize: 16, color: theme.colors.accent, marginTop: 4, fontWeight: '600' },
  empty: { color: theme.colors.muted, textAlign: 'center', marginTop: 32 },
});
