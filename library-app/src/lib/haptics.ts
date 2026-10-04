// Tiny haptic "tick" for page turns.
//
// • Android (Chrome, Edge, Samsung Internet): the Vibration API, a few ms only.
// • iOS Safari has no Vibration API. Since iOS 17.4 a native <input switch>
//   produces a system haptic when toggled from a user gesture, so we keep a
//   hidden one and toggle it. If neither works, we silently do nothing.

let iosSwitch: HTMLLabelElement | null = null;

const isIOS = () =>
  typeof navigator !== 'undefined' &&
  (/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

function ensureIosSwitch() {
  if (iosSwitch || typeof document === 'undefined') return iosSwitch;
  const label = document.createElement('label');
  label.setAttribute('aria-hidden', 'true');
  label.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('switch', '');
  input.tabIndex = -1;
  label.appendChild(input);
  document.body.appendChild(label);
  iosSwitch = label;
  return label;
}

export function canHaptic() {
  return (typeof navigator !== 'undefined' && 'vibrate' in navigator) || isIOS();
}

export function hapticTick(strength: 'light' | 'medium' = 'light') {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator && !isIOS()) {
      navigator.vibrate(strength === 'light' ? 7 : 14);
      return;
    }
    if (isIOS()) ensureIosSwitch()?.click();
  } catch {
    /* haptics are a nicety; never break reading */
  }
}
