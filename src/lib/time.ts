import { formatInTimeZone } from "date-fns-tz";

const PACIFIC_TZ = "America/Los_Angeles";

export function isAfterDailyCutoff(date: Date) {
  const pacific = new Date(
    date.toLocaleString("en-US", { timeZone: PACIFIC_TZ })
  );
  const cutoff = new Date(pacific);
  cutoff.setHours(15, 0, 0, 0);
  return pacific.getTime() >= cutoff.getTime();
}

export function formatPacificDate(date: Date) {
  return formatInTimeZone(date, PACIFIC_TZ, "yyyy-MM-dd");
}

