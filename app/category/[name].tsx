import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { PhraseEntry } from '../../src/data/dictionary';
import { useDictionary } from '../../src/data/useDictionary';
import { CATEGORY_META } from '../../src/ui/categories';
import { theme } from '../../src/ui/theme';

export default function CategoryScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const dict = useDictionary();
  const [phrases, setPhrases] = useState<PhraseEntry[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const meta = CATEGORY_META[name] ?? { label: name, emoji: '\uD83D\uDCD6' };

  useEffect(() => {
    let cancelled = false;
    dict.getPhrasesByCategory(name).then((p) => {
      if (!cancelled) setPhrases(p);
    });
    return () => {
      cancelled = true;
    };
  }, [dict, name]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: `${meta.emoji} ${meta.label}` }} />
      <FlatList
        data={phrases}
        keyExtractor={(p) => String(p.id)}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => setExpanded(expanded === item.id ? null : item.id)}
          >
            <Text style={styles.tl}>{item.tl}</Text>
            <Text style={styles.ceb}>{item.ceb}</Text>
            {expanded === item.id && item.pron && (
              <Text style={styles.pron}>{'\uD83D\uDD09 '}{item.pron}</Text>
            )}
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  card: { backgroundColor: theme.colors.card, borderRadius: 12, padding: 14 },
  tl: { fontSize: 16, fontWeight: '600', color: theme.colors.text },
  ceb: { fontSize: 16, color: theme.colors.accent, marginTop: 4 },
  pron: { fontSize: 14, color: theme.colors.muted, marginTop: 8 },
});
