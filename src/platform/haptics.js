/* Copyright © 2025 Benjamin Bringgren. All rights reserved.
   Unauthorised copying or distribution is prohibited. */
// LAYER 5 — platform — vibration haptics. No-ops silently on iOS Safari.

function tryVibrate(pattern) {
  try { navigator.vibrate?.(pattern); } catch(e) {}
}

export function tap()     { tryVibrate(10); }
export function commit()  { tryVibrate(15); }
export function success() { tryVibrate([10, 30, 10]); }
