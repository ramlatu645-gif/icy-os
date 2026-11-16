/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { TimeFormatOption } from '../types/launcher';
import { formatClockAndDate, FormattedClockTime } from '../utils/clock';

/**
 * Custom hook that provides the device's real local time and date,
 * updating automatically every second without page reloads.
 */
export function useLiveClock(timeFormat: TimeFormatOption = '12h'): FormattedClockTime {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    // Update immediately on mount or format change
    setNow(new Date());

    const intervalId = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [timeFormat]);

  return formatClockAndDate(now, timeFormat);
}
