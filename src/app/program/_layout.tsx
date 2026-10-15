import { Stack } from 'expo-router';

import { BuilderProvider } from '@/components/builder';
import { colors } from '@/theme';

export default function ProgramBuilderLayout() {
  return (
    <BuilderProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.black } }} />
    </BuilderProvider>
  );
}
