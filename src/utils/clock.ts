/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TimeFormatOption } from '../types/launcher';

export interface FormattedClockTime {
  hoursMinutes: string;
  period?: string; // AM / PM if 12h
  fullTimeText: string;
  dateText: string;
  shortDateText: string;
  isoTimestamp: string;
}

/**
 * Formats a Date instance into live clock and date strings respecting the user's
 * current locale and selected time format (12h or 24h).
 */
export function formatClockAndDate(
  now: Date,
  timeFormat: TimeFormatOption = '12h'
): FormattedClockTime {
  const locale = typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en-US';

  const is12Hour = timeFormat === '12h';

  // Format hours and minutes
  const timeFormatter = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: is12Hour,
  });

  const parts = timeFormatter.formatToParts(now);
  let hourPart = '';
  let minutePart = '';
  let literalPart = ':';
  let dayPeriod = '';

  for (const part of parts) {
    if (part.type === 'hour') hourPart = part.value;
    if (part.type === 'minute') minutePart = part.value;
    if (part.type === 'literal' && part.value.trim() !== '') literalPart = part.value;
    if (part.type === 'dayPeriod') dayPeriod = part.value;
  }

  const hoursMinutes = `${hourPart}${literalPart}${minutePart}`;
  const period = is12Hour ? dayPeriod : undefined;
  const fullTimeText = period ? `${hoursMinutes} ${period}` : hoursMinutes;

  // Full date for Home screen (e.g., "Saturday, October 10, 2026")
  const fullDateFormatter = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  // Compact date for Lock screen (e.g., "Sat, 10 Oct, 2026")
  const shortDateFormatter = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return {
    hoursMinutes,
    period,
    fullTimeText,
    dateText: fullDateFormatter.format(now),
    shortDateText: shortDateFormatter.format(now),
    isoTimestamp: now.toISOString(),
  };
}
