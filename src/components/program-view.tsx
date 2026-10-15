import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Body, Card, Eyebrow } from '@/components/ui';
import { WEEKDAYS_LONG, WEEK_ORDER, describeTarget, prettyDate, programWeek, sessionOn, type Assignment } from '@/lib/programs';
import { colors, fonts, radius, space } from '@/theme';

/** Program header: name, week x of y, and an upcoming program if one is scheduled. */
export function ProgramHeader({ active, scheduled, coachName }: { active: Assignment | null; scheduled: Assignment | null; coachName?: string }) {
  if (!active && !scheduled) return null;
  const main = active ?? scheduled!;
  const week = active ? programWeek(active) : null;
  return (
    <Card style={{ gap: space.xs }}>
      <Eyebrow tone={coachName ? 'gold' : 'acid'}>
        {active ? `Week ${week} of ${active.weeks}` : `Starts ${prettyDate(main.start_date)}`}
        {coachName ? ` · from ${coachName}` : ''}
      </Eyebrow>
      <Text style={{ fontFamily: fonts.display, fontSize: 22, color: colors.bone }}>{main.name}</Text>
      <Body tone="steel">
        {main.snapshot.days.length} sessions · {main.weeks} weeks
      </Body>
      {active && scheduled ? (
        <Body tone="gold" style={{ marginTop: space.sm, fontSize: 13 }}>
          Next: {scheduled.name} from {prettyDate(scheduled.start_date)}
        </Body>
      ) : null}
    </Card>
  );
}

/** Saturday-to-Friday schedule; tap a training day to see its exercises and targets. */
export function WeekSchedule({ assignment }: { assignment: Assignment }) {
  const today = new Date().getDay();
  const [open, setOpen] = useState<number | null>(sessionOn(assignment.snapshot.days, today) ? today : null);
  return (
    <View style={{ gap: space.sm }}>
      {WEEK_ORDER.map((d) => {
        const s = sessionOn(assignment.snapshot.days, d);
        const isToday = d === today;
        const expanded = open === d && !!s;
        return (
          <View
            key={d}
            style={{
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: isToday ? colors.acid : colors.line,
              backgroundColor: colors.carbon,
              overflow: 'hidden',
            }}>
            <Pressable
              accessibilityRole={s ? 'button' : undefined}
              accessibilityState={{ expanded }}
              disabled={!s}
              onPress={() => setOpen(expanded ? null : d)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg }}>
              <View style={{ width: 92 }}>
                <Text style={{ fontFamily: fonts.bodyHeavy, fontSize: 11, letterSpacing: 1, color: isToday ? colors.acid : colors.steel }}>
                  {isToday ? 'TODAY' : WEEKDAYS_LONG[d].toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: s ? fonts.bodyBold : fonts.body, fontSize: 15, color: s ? colors.bone : colors.steel }}>
                  {s ? s.name : 'Rest'}
                </Text>
                {s ? (
                  <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.steel }}>
                    {[s.focus, `${s.exercises.length} exercises`, s.est_minutes ? `${s.est_minutes} min` : null].filter(Boolean).join(' · ')}
                  </Text>
                ) : null}
              </View>
              {s ? <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.steel} /> : null}
            </Pressable>
            {expanded && s ? (
              <View style={{ borderTopWidth: 1, borderTopColor: colors.line }}>
                {s.exercises.map((e, i) => (
                  <View key={`${e.exercise_id}-${i}`} style={{ flexDirection: 'row', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: colors.line }}>
                    <Text style={{ fontFamily: fonts.display, fontSize: 14, color: colors.acid, width: 18 }}>{i + 1}</Text>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: colors.bone }}>{e.name}</Text>
                      <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.bone2 }}>
                        {describeTarget(e)}
                        {e.rest_seconds ? ` · rest ${e.rest_seconds}s` : ''}
                      </Text>
                      {e.notes ? <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.gold }}>{e.notes}</Text> : null}
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
