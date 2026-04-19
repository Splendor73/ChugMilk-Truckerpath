export function nowMs() {
  return Date.now();
}

export function minutesToMs(minutes: number) {
  return minutes * 60 * 1000;
}

export function hoursToMinutes(hours: number) {
  return hours * 60;
}

export function isoNow() {
  return new Date().toISOString();
}

export function defaultTimeRange(days = 7) {
  const end = Date.now();
  const start = end - days * 24 * 60 * 60 * 1000;
  return { startTime: start, endTime: end };
}

export function addHours(ms: number, hours: number) {
  return ms + hours * 60 * 60 * 1000;
}
