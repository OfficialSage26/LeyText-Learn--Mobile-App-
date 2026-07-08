import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { PhraseEntry } from '../../src/data/dictionary';
import { useDictionary } from '../../src/data/useDictionary';
import { CATEGORY_META } from '../../src/ui/categories';
import { theme } from '../../src/ui/theme';

export default function PhrasebookScreen() {
  const dict = useDictionary();
  const [counts, setCounts] = useState<{ category: string; count: number }[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PhraseEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    dict.getCategoryCounts().then((c) => {
      if (!cancelled) setCounts(c);
    });
    return () => {
      cancelled = true;
    };
  }, [dict]);

  useEffect(() => {
    let cancelled = false;
    const handle = setTimeout(async () => {
      const r = query.trim() === '' ? [] : await dict.searchPhrases(query.trim());
      if (!cancelled) setResults(r);
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query, dict]);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Phrasebook</Text>
      <TextInput
        style={styles.search}
        placeholder={'Search phrases\u2026'}
        placeholderTextColor={theme.colors.muted}
        value={query}
        onChangeText={setQuery}
      />
      {query.trim() !== '' ? (
        <FlatList
          data={results}
          keyExtractor={(p) => String(p.id)}
          renderItem={({ item }) => (
            <View style={styles.phraseCard}>
              <Text style={styles.tl}>{item.tl}</Text>
              <Text style={styles.ceb}>{item.ceb}</Text>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No phrases found.</Text>}
        />
      ) : (
        <FlatList
          data={counts}
          numColumns={2}
          columnWrapperStyle={{ gap: 12 }}
          contentContainerStyle={{ gap: 12 }}
          keyExtractor={(c) => c.category}
          renderItem={({ item }) => {
            const meta = CATEGORY_META[item.category] ?? { label: item.category, emoji: '\uD83D\uDCD6' };
            return (
              <Link href={{ pathname: '/category/[name]', params: { name: item.category } }} asChild>
                <Pressable style={styles.catCard}>
                  <Text style={styles.catEmoji}>{meta.emoji}</Text>
                  <Text style={styles.catLabel}>{meta.label}</Text>
                  <Text style={styles.catCount}>{item.count} phrases</Text>
                </Pressable>
              </Link>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg, padding: 16 },
  title: { fontSize: 28, fontWeight: '700', color: theme.colors.text, marginTop: 8, marginBottom: 12 },
  search: { backgroundColor: theme.colors.card, borderRadius: 12, padding: 12, fontSize: 16, marginBottom: 16, color: theme.colors.text },
  catCard: { flex: 1, backgroundColor: theme.colors.card, borderRadius: 16, padding: 16 },
  catEmoji: { fontSize: 28 },
  catLabel: { fontSize: 16, fontWeight: '600', color: theme.colors.text, marginTop: 8 },
  catCount: { fontSize: 13, color: theme.colors.muted, marginTop: 2 },
  phraseCard: { backgroundColor: theme.colors.card, borderRadius: 12, padding: 14, marginBottom: 10 },
  tl: { fontSize: 16, color: theme.colors.text, fontWeight: '600' },
  ceb: { fontSize: 16, color: theme.colors.accent, marginTop: 4 },
  empty: { color: theme.colors.muted, textAlign: 'center', marginTop: 24 },
});
