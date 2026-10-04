import { memo } from 'react';
import type { UserId } from '../lib/types';

export type AvatarMood = 'idle' | 'wave' | 'happy' | 'reading';

interface Props {
  user: UserId;
  mood?: AvatarMood;
  size?: number;
  className?: string;
  /** render without the round badge background */
  bare?: boolean;
}

const LOOK: Record<UserId, { bg: string; bg2: string; skin: string; skinShade: string; hair: string; top: string; topShade: string; accent: string }> = {
  aatish: { bg: '#2f4a44', bg2: '#22352f', skin: '#c88c62', skinShade: '#b47a52', hair: '#2a1d17', top: '#c99a4a', topShade: '#b0843a', accent: '#e7c27a' },
  nishi: { bg: '#6a2e3a', bg2: '#4d1f29', skin: '#d39b74', skinShade: '#bd8560', hair: '#22150f', top: '#8c3442', topShade: '#742a37', accent: '#f0c98a' },
};

/**
 * Hand-drawn SVG avatars with gentle life: breathing, blinking, a slight head
 * sway, a wave hello, a happy hop. All motion is CSS and respects reduced-motion.
 */
export const Avatar = memo(function Avatar({ user, mood = 'idle', size = 120, className = '', bare }: Props) {
  const c = LOOK[user];
  const id = `av-${user}`;
  const happy = mood === 'happy';
  const reading = mood === 'reading';
  const eyeY = reading ? 55 : 53;

  const eyes = happy ? (
    <g className="av-eyes" stroke="#2a1d17" strokeWidth={2} fill="none" strokeLinecap="round">
      <path d="M47.5 54 Q51 49.5 54.5 54" />
      <path d="M65.5 54 Q69 49.5 72.5 54" />
    </g>
  ) : (
    <g className="av-eyes">
      <ellipse cx="51" cy={eyeY} rx="2.3" ry="2.6" fill="#2a1d17" />
      <ellipse cx="69" cy={eyeY} rx="2.3" ry="2.6" fill="#2a1d17" />
      <circle cx="51.8" cy={eyeY - 0.9} r="0.75" fill="#fff" />
      <circle cx="69.8" cy={eyeY - 0.9} r="0.75" fill="#fff" />
      {user === 'nishi' && (
        <g stroke="#2a1d17" strokeWidth={1.1} strokeLinecap="round">
          <path d={`M47.6 ${eyeY - 2.2} l-1.6 -1.2`} />
          <path d={`M72.4 ${eyeY - 2.2} l1.6 -1.2`} />
        </g>
      )}
    </g>
  );

  return (
    <svg
      className={`avatar avatar--${user} avatar--${mood} ${className}`}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role="img"
      aria-label={`${user === 'aatish' ? 'Aatish' : 'Nishi'}’s avatar`}
    >
      <defs>
        <radialGradient id={`${id}-bg`} cx="50%" cy="35%" r="70%">
          <stop offset="0%" stopColor={c.bg} />
          <stop offset="100%" stopColor={c.bg2} />
        </radialGradient>
        <clipPath id={`${id}-clip`}>
          <circle cx="60" cy="60" r="58" />
        </clipPath>
      </defs>

      {!bare && <circle cx="60" cy="60" r="58" fill={`url(#${id}-bg)`} />}
      {!bare && <circle cx="60" cy="60" r="57" fill="none" stroke={c.accent} strokeOpacity={0.35} strokeWidth={1} />}

      <g clipPath={bare ? undefined : `url(#${id}-clip)`}>
        <g className="av-body">
          {/* hair behind (Nishi) */}
          {user === 'nishi' && (
            <path className="av-hair-back" d="M35 52C31 28 48 19 61 20c15 0 29 11 25 34l4 40c-8 7-17 4-21-4H51c-4 8-13 11-21 4z" fill={c.hair} />
          )}

          {/* shoulders */}
          <path d="M18 122c2-22 18-36 42-36s40 14 42 36z" fill={c.top} />
          <path d="M18 122c2-22 18-36 42-36-14 4-24 16-26 36z" fill={c.topShade} opacity={0.5} />
          {user === 'aatish' ? (
            <path d="M48 87l12 10 12-10" fill="none" stroke="#efe2c4" strokeWidth={3} strokeLinejoin="round" />
          ) : (
            <>
              <path d="M50 87c3 7 7 10 10 10s7-3 10-10" fill="#efe2c8" />
              <path d="M49 88l-5 34M71 88l5 34" stroke={c.topShade} strokeWidth={2} />
            </>
          )}
          {/* neck */}
          <path d="M53 70h14v14c-3 4-11 4-14 0z" fill={c.skinShade} />

          <g className="av-head">
            {/* ears */}
            <ellipse cx="38.5" cy="55" rx="3.6" ry="5" fill={c.skinShade} />
            <ellipse cx="81.5" cy="55" rx="3.6" ry="5" fill={c.skinShade} />
            {/* face */}
            <ellipse cx="60" cy="52" rx="21.5" ry="23.5" fill={c.skin} />

            {/* hair front */}
            {user === 'aatish' ? (
              <g fill={c.hair}>
                <path d="M37.5 51C35 31 47 24 60 25c15 0 27 8 23 27-2-8-7-13-14-14-6 2-15 0-21 2-5 2-9 6-10.5 11z" />
                <path d="M52 27c4-6 14-7 19-2-6-1-11 1-14 5z" />
              </g>
            ) : (
              <g fill={c.hair}>
                <path d="M38 53c-1-18 10-27 23-27 13 0 23 9 21 27-4-9-11-15-20-17-4 6-13 11-24 17z" />
                <g transform="translate(75 34)">
                  <circle r="3.2" fill={c.accent} />
                  <circle r="1.2" fill="#fff6e0" />
                </g>
              </g>
            )}

            {/* brows */}
            <g stroke={c.hair} strokeWidth={1.8} strokeLinecap="round" fill="none" className="av-brows">
              <path d={happy ? 'M46 45.5q5-3 9 0' : 'M46 46q5-2.4 9 0'} />
              <path d={happy ? 'M65 45.5q5-3 9 0' : 'M65 46q5-2.4 9 0'} />
            </g>

            {eyes}

            {/* glasses (Aatish) */}
            {user === 'aatish' && (
              <g fill="none" stroke={c.accent} strokeWidth={1.4}>
                <circle cx="51" cy="54" r="6.8" />
                <circle cx="69" cy="54" r="6.8" />
                <path d="M57.8 53.5q2.2-1.6 4.4 0M44.2 53l-5-1.5M75.8 53l5-1.5" />
                <path className="av-glint" d="M47 50.5l2.5-2" stroke="#fff" strokeOpacity={0.7} strokeWidth={1.2} strokeLinecap="round" />
              </g>
            )}

            {/* earrings (Nishi) */}
            {user === 'nishi' && (
              <g fill={c.accent}>
                <circle cx="38.5" cy="62" r="1.8" />
                <circle cx="81.5" cy="62" r="1.8" />
              </g>
            )}

            {/* cheeks & mouth */}
            <circle cx="45" cy="62" r="4" fill="#e9837a" opacity={happy ? 0.5 : 0.28} />
            <circle cx="75" cy="62" r="4" fill="#e9837a" opacity={happy ? 0.5 : 0.28} />
            <path d="M58.5 59.5q1.5 1.2 3 0" stroke={c.skinShade} strokeWidth={1.4} fill="none" strokeLinecap="round" />
            {happy ? (
              <path d="M53.5 64.5q6.5 7 13 0z" fill="#7a2e2e" stroke="#7a2e2e" strokeWidth={1} strokeLinejoin="round" />
            ) : (
              <path className="av-mouth" d="M54.5 65q5.5 4.6 11 0" stroke="#7a2e2e" strokeWidth={1.8} fill="none" strokeLinecap="round" />
            )}
          </g>
        </g>

        {/* waving hand */}
        <g className="av-wave">
          <path d="M92 124l6-34" stroke={c.top} strokeWidth={9} strokeLinecap="round" />
          <circle cx="98.5" cy="86" r="6" fill={c.skin} />
          <path d="M96 81.5v-4M99 81v-4.6M102 82v-3.8" stroke={c.skin} strokeWidth={2.6} strokeLinecap="round" />
        </g>
      </g>

      {happy && (
        <g className="av-sparkles" fill={c.accent}>
          <path d="M18 30l1.5 3.5L23 35l-3.5 1.5L18 40l-1.5-3.5L13 35l3.5-1.5z" />
          <path d="M100 24l1 2.4 2.4 1-2.4 1-1 2.4-1-2.4-2.4-1 2.4-1z" />
          <path d="M104 52l.8 1.8 1.8.8-1.8.8-.8 1.8-.8-1.8-1.8-.8 1.8-.8z" />
        </g>
      )}
    </svg>
  );
});
