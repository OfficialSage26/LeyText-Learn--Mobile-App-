import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { theme } from '../../src/ui/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.colors.accent,
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Translate',
          tabBarIcon: ({ color, size }) => <Ionicons name="swap-horizontal" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="phrasebook"
        options={{
          title: 'Phrasebook',
          tabBarIcon: ({ color, size }) => <Ionicons name="book-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: 'Saved',
          tabBarIcon: ({ color, size }) => <Ionicons name="star-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
