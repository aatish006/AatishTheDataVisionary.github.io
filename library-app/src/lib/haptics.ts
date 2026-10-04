// Tiny haptic "tick" for page turns.
//
// • Android (Chrome, Edge, Samsung Internet): the Vibration API, a few ms only.
// • iPhone/iPad: Safari has no Vibration API. Since iOS 18, toggling a native
//   <input type="checkbox" switch> plays the system haptic, so we create one,
//   click its label and remove it. Safari only allows this inside a tap
//   ("click"/"touchend"/"pointerup" handler), so call hapticTick() from there.
// • Requires Settings → Sounds & Haptics → System Haptics to be on.
// If none of this is available, it quietly does nothing.

const isIOS = () =>
  typeof navigator !== 'undefined' &&
  (/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

function iosTick() {
  const label = document.createElement('label');
  label.ariaHidden = 'true';
  label.style.display = 'none';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('switch', '');
  label.appendChild(input);
  document.head.appendChild(label);
  label.click();
  label.remove();
}

export function canHaptic() {
  return (typeof navigator !== 'undefined' && 'vibrate' in navigator) || isIOS();
}

export function hapticTick(strength: 'light' | 'medium' = 'light') {
  try {
    if (isIOS()) {
      iosTick();
      if (strength === 'medium') setTimeout(iosTick, 70);
      return;
    }
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(strength === 'light' ? 8 : 16);
  } catch {
    /* haptics are a nicety; never break reading */
  }
}
