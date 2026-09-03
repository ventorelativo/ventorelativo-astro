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
  /** Stable identity, the article URL. */
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

/** `YYYYMMDD`, in local terms, an all-day event has no timezone. */
function toDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`;
}

/**
 * The day after the last day.
 *
 * Every calendar here takes an *exclusive* end, so a one-day event ends the
 * following morning. Get it wrong and the event shows across two days: the
 * one bug in this file a reader will actually notice.
 */
function endOf(event: CalendarEvent): Date {
  const day = new Date(event.end ?? event.start);
  day.setUTCDate(day.getUTCDate() + 1);
  return day;
}

/** `YYYY-MM-DD`, Outlook's date form. */
function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
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

/**
 * The "add to Google Calendar" link.
 *
 * Google takes a pre-filled event as query parameters, so the button is an
 * anchor and nothing has to run on the page: no widget, no script, no
 * account lookup. The same event, expressed twice: this and the `.ics`.
 *
 * `dates` follows the same rule as `DTEND` above: the end is exclusive, so a
 * one-day event ends the following day or Google shows it across two.
 */
export function googleCalendarUrl(event: CalendarEvent): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${toDate(event.start)}/${toDate(endOf(event))}`,
    details: `${event.description}\n\n${event.url}`,
    location: event.location,
  });

  return `https://calendar.google.com/calendar/render?${params}`;
}

/**
 * The "add to Outlook" link.
 *
 * The consumer (outlook.live.com) endpoint, not the work one: a paragliding
 * club's members are on personal accounts, and a signed-in Microsoft 365 user
 * is redirected to their own tenant anyway. `allday=true` with plain dates,
 * and the same exclusive end as everywhere else here.
 */
export function outlookCalendarUrl(event: CalendarEvent): string {
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    allday: 'true',
    startdt: isoDay(event.start),
    enddt: isoDay(endOf(event)),
    subject: event.title,
    body: `${event.description}\n\n${event.url}`,
    location: event.location,
  });

  return `https://outlook.live.com/calendar/0/deeplink/compose?${params}`;
}

export function toIcs(event: CalendarEvent, now = new Date()): string {
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
      `DTEND;VALUE=DATE:${toDate(endOf(event))}`,
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
