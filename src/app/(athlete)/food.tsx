import { ComingSoon, Screen, Title } from '@/components/ui';

export default function Food() {
  return (
    <Screen>
      <Title>Food</Title>
      <ComingSoon
        phase="Phase 4 · Nutrition"
        title="Meals against your targets"
        items={[
          'Search foods, reuse saved meals, or quick-add macros',
          'Calories, protein, carbs and fat against your target',
          'Water tracking',
        ]}
      />
    </Screen>
  );
}
