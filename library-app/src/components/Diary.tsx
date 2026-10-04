import { memo } from 'react';

// "A candle for every day you read": the last seven days as little candles,
// lit when you read that day, taller flames for longer evenings.

const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function diaryStats(diary: Record<string, number> = {}) {
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    return { date: d, minutes: diary[key(d)] ?? 0 };
  });
  // Streak: consecutive days with reading, ending today (or yesterday, if tonight hasn't started yet).
  let streak = 0;
  const d = new Date(today);
  if (!(diary[key(d)] >= 1)) d.setDate(d.getDate() - 1);
  while (diary[key(d)] >= 1) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  const week = days.reduce((s, x) => s + x.minutes, 0);
  return { days, streak, today: diary[key(today)] ?? 0, week };
}

const fmt = (m: number) => (m < 60 ? `${Math.round(m)} min` : `${Math.floor(m / 60)} h ${Math.round(m % 60)} min`);

export const DiaryCandles = memo(function DiaryCandles({ diary }: { diary?: Record<string, number> }) {
  const { days, streak, today, week } = diaryStats(diary);
  const line =
    today >= 1
      ? `${fmt(today)} of reading today${streak > 1 ? ` · ${streak} days in a row` : ''}`
      : streak > 1
        ? `${streak} days in a row — light tonight’s candle?`
        : week >= 1
          ? `${fmt(week)} of reading this week`
          : 'A candle lights for every day you read.';
  return (
    <div className="diary" aria-label={`Reading diary: ${line}`}>
      <div className="diary__candles" aria-hidden>
        {days.map(({ date, minutes }, i) => {
          const lit = minutes >= 1;
          const h = lit ? Math.min(1, 0.55 + minutes / 60) : 0;
          return (
            <span key={i} className={`candle${lit ? ' is-lit' : ''}${i === 6 ? ' is-today' : ''}`} title={`${date.toLocaleDateString(undefined, { weekday: 'long' })}: ${lit ? fmt(minutes) : 'no reading'}`}>
              {lit && (
                <span className="candle__flamewrap" style={{ transform: `scale(${h})` }}>
                  <span className="candle__flame" style={{ animationDelay: `${-i * 0.37}s` }} />
                </span>
              )}
              <span className="candle__wax" />
              <span className="candle__day">{date.toLocaleDateString(undefined, { weekday: 'narrow' })}</span>
            </span>
          );
        })}
      </div>
      <span className="diary__line">{line}</span>
    </div>
  );
});
