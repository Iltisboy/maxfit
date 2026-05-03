// Persists the active workout in localStorage so it survives app close,
// reload, and navigation away from the Workout screen.
// Cleared on workout completion or explicit discard.

const KEY = 'maxfit-active-workout';
const MAX_AGE_MS = 36 * 60 * 60 * 1000; // 36h — auto-discard older sessions

export function saveActiveWorkout(state) {
  try {
    const payload = { ...state, savedAt: Date.now() };
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch (e) {
    console.error('saveActiveWorkout failed', e);
  }
}

export function loadActiveWorkout() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.savedAt || Date.now() - parsed.savedAt > MAX_AGE_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch (e) {
    return null;
  }
}

export function clearActiveWorkout() {
  try {
    localStorage.removeItem(KEY);
  } catch (e) {}
}

export function hasActiveWorkout() {
  return loadActiveWorkout() !== null;
}
