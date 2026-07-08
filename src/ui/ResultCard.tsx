import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { TranslationResult } from '../engine/types';
import { METHOD_LABELS } from './labels';
import { theme } from './theme';

export function ResultCard({
  result,
  suggestions,
  isFavorite,
  onToggleFavorite,
}: {
  result: TranslationResult;
  suggestions: string[];
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}) {
  if (result.output === '') return null;
  return (
    <View style={styles.card}>
      <View style={styles.badgeRow}>
        <Text style={[styles.badge, result.method === 'phrase' ? styles.badgeExact : styles.badgeApprox]}>
          {METHOD_LABELS[result.method]}
        </Text>
      </View>
      {result.method === 'phrase' ? (
        <Text style={styles.output}>{result.output}</Text>
      ) : (
        <Text style={styles.output}>
          {result.tokens.map((t, i) => (
            <Text key={i} style={t.target === null ? styles.miss : undefined}>
              {(i > 0 ? ' ' : '') + (t.target ?? t.source)}
            </Text>
          ))}
        </Text>
      )}
      {result.hasMisses && (
        <Text style={styles.note}>Gray words were not found in the dictionary.</Text>
      )}
      {suggestions.length > 0 && (
        <Text style={styles.note}>Did you mean: {suggestions.join(', ')}?</Text>
      )}
      <View style={styles.actions}>
        <Pressable
          accessibilityLabel="Copy translation"
          onPress={() => Clipboard.setStringAsync(result.output)}
          style={styles.action}
        >
          <Ionicons name="copy-outline" size={20} color={theme.colors.accent} />
        </Pressable>
        {onToggleFavorite && (
          <Pressable accessibilityLabel="Favorite" onPress={onToggleFavorite} style={styles.action}>
            <Ionicons
              name={isFavorite ? 'star' : 'star-outline'}
              size={20}
              color={theme.colors.accent}
            />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: theme.colors.card, borderRadius: 16, padding: 16, marginTop: 16 },
  badgeRow: { flexDirection: 'row', marginBottom: 8 },
  badge: { fontSize: 12, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: 'hidden' },
  badgeExact: { backgroundColor: theme.colors.accentSoft, color: theme.colors.accent },
  badgeApprox: { backgroundColor: '#FFF3E0', color: '#B26A00' },
  output: { fontSize: 22, color: theme.colors.text, lineHeight: 30 },
  miss: { color: theme.colors.muted, fontStyle: 'italic' },
  note: { fontSize: 13, color: theme.colors.muted, marginTop: 8 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  action: { backgroundColor: theme.colors.accentSoft, borderRadius: 20, padding: 10 },
});
