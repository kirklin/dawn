/**
 * Linear interpolation of an hourly series at `at`; null outside the series or next to a missing value,
 * except right on an hour, which needs no neighbour.
 */
export function valueAt(time: readonly number[], values: readonly (number | null)[], at: number): number | null {
  if (time.length === 0 || at < time[0] || at > time[time.length - 1]) {
    return null;
  }
  let low = 0;
  let high = time.length - 1;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (time[middle] <= at) {
      low = middle;
    } else {
      high = middle;
    }
  }
  if (at === time[low]) {
    return values[low];
  }
  if (at === time[high]) {
    return values[high];
  }
  const before = values[low];
  const after = values[high];
  if (before === null || after === null) {
    return null;
  }
  return before + (after - before) * (at - time[low]) / (time[high] - time[low]);
}
