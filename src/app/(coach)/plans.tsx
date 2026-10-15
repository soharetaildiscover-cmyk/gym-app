import { ComingSoon, Screen, Title } from '@/components/ui';

export default function Plans() {
  return (
    <Screen>
      <Title>Plans</Title>
      <ComingSoon
        phase="Phase 3 · Training"
        title="Program builder"
        items={[
          'Build multi-week programs: days, exercises, sets, reps, load',
          'Save drafts and review changes before they go out',
          'Assign to one or many athletes from a start date',
        ]}
      />
    </Screen>
  );
}
