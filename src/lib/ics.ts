/**
 * iCalendar (`.ics`) generation, by hand.
 *
 * The format is a few lines of text, so a dependency would be more code to
 * audit than to write. What it is fussy about, and what this handles:
 *
 *  - **CRLF line endings.** RFC 5545 says every line ends `\r\n`. Some readers
 *    forgive `\n`; Outlook historically does not.
 *  - **Escaping.** Commas, semicolons and backslashes are structural, so they
 *    have to be escaped inside a value, and newlines become a literal `\n`.
 *  - **Line folding.** Lines over 75 octets must be wrapped with a leading
 *    space on the continuation. A long Italian location would otherwise
 *    produce a file some parsers reject.
 *  - **All-day events are dates, not times.** `DTSTART;VALUE=DATE` with an
 *    exclusive `DTEND`, so a one-day event does not show as two.
 *
 * A stable `UID` matters: re-importing the same event updates it rather than
 * creating a duplicate, so the URL is used as the identity.
 */
export interface CalendarEvent {
  /** Stable identity — the article URL. */
  uid: string;
  title: string;
  description: string;
  /** Where to turn up. */
  location: string;
  start: Date;
  /** Last day of the event, inclusive. Defaults to the start day. */
  end?: Date;
  /** Link back to the announcement. */
  url: string;
}

/** `YYYYMMDD`, in local terms — an all-day event has no timezone. */
function toDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`;
}

function escape(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Folds a line at 75 octets, continuation lines beginning with a space. */
function fold(line: string): string {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;

  const parts: string[] = [];
  let start = 0;
  while (start < bytes.length) {
    // 74 to leave room for the leading space on continuations.
    let end = Math.min(start + (start === 0 ? 75 : 74), bytes.length);
    // Never split a multi-byte character: back off to a boundary.
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
    parts.push(bytes.subarray(start, end).toString('utf8'));
    start = end;
  }
  return parts.join('\r\n ');
}

export function toIcs(event: CalendarEvent, now = new Date()): string {
  // DTEND is exclusive for all-day events: the day after the last day.
  const lastDay = event.end ?? event.start;
  const dayAfter = new Date(lastDay);
  dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);

  const stamp = `${toDate(now)}T${String(now.getUTCHours()).padStart(2, '0')}${String(
    now.getUTCMinutes(),
  ).padStart(2, '0')}00Z`;

  return (
    [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//VentoRelativo//Sito//IT',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${escape(event.uid)}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${toDate(event.start)}`,
      `DTEND;VALUE=DATE:${toDate(dayAfter)}`,
      `SUMMARY:${escape(event.title)}`,
      `DESCRIPTION:${escape(`${event.description}\n\n${event.url}`)}`,
      `LOCATION:${escape(event.location)}`,
      `URL:${escape(event.url)}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ]
      .map(fold)
      .join('\r\n') + '\r\n'
  );
}
