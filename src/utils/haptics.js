// Haptic feedback utility — uses Vibration API where available
// Silently no-ops on devices without haptics or before first user interaction

const safeVibrate = (pattern) => {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern)
    }
  } catch (e) {
    // Silently fail if blocked by browser intervention (e.g. no user gesture)
  }
}

export const haptic = {
  light:   () => safeVibrate(10),
  medium:  () => safeVibrate(25),
  heavy:   () => safeVibrate(50),
  success: () => safeVibrate([10, 30, 10]),
  error:   () => safeVibrate([50, 30, 50]),
  select:  () => safeVibrate(8),
}