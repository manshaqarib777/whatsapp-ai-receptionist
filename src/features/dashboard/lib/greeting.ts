/**
 * Time-of-day greeting for the dashboard header.
 *
 * Pure and testable; the hour is the server's local hour when the page renders.
 * COMPONENT_DESIGN.md §7 shows "Good morning, Alex" in the header, and a greeting
 * that never changes reads as stale rather than personal.
 */

export function greetingForHour(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
