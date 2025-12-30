import * as ical from "node-ical";
import { IGoogleCalendar } from "../models/GoogleCalendar";


export interface CalendarEvent {
    eventId: string;
    uid: string;
    summary?: string;
    description?: string;
    location?: string | null;
    start?: string | null;
    end?: string | null;
    hangoutLink?: string | null;
    attendees?: string[];
    organizer?: string | null;
    status?: string;
    isRecurring?: boolean;
    recurrenceRule?: string | null;
    exceptionDates?: string[] | null;
    recurringEventId?: string | null;
    recurrenceId?: string | null;
    origin?: string;
    previousStart?: Date | null;
    previousEnd?: Date | null;
}

function parseHappeningNow(raw: string): CalendarEvent | null {
    const subjectMatch = raw.match(/^Subject:\s*(.*)$/mi);
    const subject = subjectMatch?.[1] || "";
    if (!/Happening now/i.test(subject)) return null;

    const meetMatch = raw.match(/https:\/\/meet\.google\.com\/[a-zA-Z0-9-]+/);
    // Organizer should be taken from the UID text in subject
    // Example: "Happening now: ashwini@rootent.com is inviting you to a video call-..."
    let organizer: string | null = null;
    const uidSegmentMatch = subject.match(/Happening now:\s*(.+?)\s+is inviting/i);
    if (uidSegmentMatch?.[1]) {
        const segment = uidSegmentMatch[1].trim();
        const emailInSegment = segment.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
        organizer = (emailInSegment ? emailInSegment[0] : segment) || null;
    }

    const now = new Date();
    const end = new Date(now.getTime() + 60 * 60 * 1000);

    const uidBase = `${subject}-${meetMatch?.[0] || ''}-${now.getTime()}`;

    const event: CalendarEvent = {
        uid: uidBase,
        eventId: uidBase,
        summary: subject || 'Happening now meeting',
        start: now.toISOString(),
        end: end.toISOString(),
        hangoutLink: meetMatch?.[0] || null,
        ...(organizer ? { organizer } : {}),
        ...(organizer ? { attendees: [organizer] } : {}),
        origin: "gmeet"
    };

    return event;
}

export async function parseCalendarInvite(emailContent: string): Promise<CalendarEvent | null> {
    try {
        // Extract VCALENDAR section
        const icalMatch = emailContent.match(/BEGIN:VCALENDAR[\s\S]*?END:VCALENDAR/);
        if (!icalMatch) {
            const fallback = parseHappeningNow(emailContent);
            return fallback;
        }

        const icalString = icalMatch[0];

        const events = ical.sync.parseICS(icalString);

        // Get the first VEVENT entry
        const eventData: any = Object.values(events).find(
            (event: any) => event.type === "VEVENT"
        );

        if (!eventData) return null;
        console.log("eventData", eventData);
        console.log("eventData", eventData.start);
        console.log("uid", eventData.uid);
        // ------------------------------
        // Extract base event fields
        // ------------------------------
        const event: CalendarEvent = {
            uid: eventData.uid,
            eventId: `${eventData.uid}_${new Date().getTime()}`,
            ...(eventData.summary && { summary: eventData.summary }),
            ...(eventData.location && { location: eventData.location }),
            ...(eventData.start && { start: eventData.start }),
            ...(eventData.end && { end: eventData.end }),
            ...(eventData.status && { status: eventData.status }),
            ...(eventData['GOOGLE-CONFERENCE'] && { hangoutLink: eventData['GOOGLE-CONFERENCE'] }),
            ...(eventData.attendee && {
                attendees: Array.isArray(eventData.attendee)
                    ? eventData.attendee.map((a: any) =>
                        typeof a === 'string' ? a.replace('mailto:', '') : a.val?.replace('mailto:', '')
                    )
                    : [typeof eventData.attendee === 'string'
                        ? eventData.attendee.replace('mailto:', '')
                        : eventData.attendee?.val?.replace('mailto:', '')].filter(Boolean)
            }),
            ...(eventData.organizer && { organizer: eventData.organizer.val?.replace('mailto:', '') }),

        };

        // ------------------------------
        // Recurring Meeting Support
        // ------------------------------
        if (eventData.rrule) {
            event.isRecurring = true;
            event.recurringEventId = eventData.uid;
            event.recurrenceRule = eventData.rrule.toString();
        }

        if (eventData.exdate) {
            event.exceptionDates = Object.values(eventData.exdate);
        }

        return event;
    } catch (error) {
        console.error("Error parsing calendar invite:", error);
        return null;
    }
}

