import { ComingSoon, Screen, Title } from '@/components/ui';

export default function Progress() {
  return (
    <Screen>
      <Title>Progress</Title>
      <ComingSoon
        phase="Phase 4 · Progress"
        title="Weight, measurements and photos"
        items={['Body weight and measurement trends', 'Progress photos, private unless you share them', 'Strength trends per exercise']}
      />
      <ComingSoon
        phase="Phase 5 · Check-ins"
        title="Weekly check-in"
        items={['Answer your coach’s weekly check-in', 'See their review and feedback', 'Report pain so your coach knows right away']}
      />
    </Screen>
  );
}
