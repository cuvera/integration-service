import * as ical from "node-ical";
import { IGoogleCalendar } from "../models/GoogleCalendar";


export type CalendarEvent = Partial<Omit<IGoogleCalendar, 'start' | 'end' | 'uid'>> & {
    eventId: string;
    start?: string | null;
    end?: string | null;
    hangoutLink?: string | null;
    attendees?: string[];
    uid: string;
}

export async function parseCalendarInvite(emailContent: string): Promise<CalendarEvent | null> {
    try {
        // Extract VCALENDAR section
        const icalMatch = emailContent.match(/BEGIN:VCALENDAR[\s\S]*?END:VCALENDAR/);
        if (!icalMatch) return null;

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
