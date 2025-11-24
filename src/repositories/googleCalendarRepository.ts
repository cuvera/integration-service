import { GoogleCalendar } from "../models/GoogleCalendar";
import { getLocalTime } from "../utils/timeUtils";

export class GoogleCalendarRepository {
    async markMessagesSentByEventIds(eventIds: string[]): Promise<void> {
        await GoogleCalendar.updateMany(
            { eventId: { $in: eventIds } },
            { $set: { isMessageSent: true } }
        );
    }

    async upsertFromParsedInvite(event: any): Promise<void> {
        const existing = await GoogleCalendar.findOne({ uid: event.uid });
        const startTime = event.start ? await getLocalTime(new Date(event.start).toISOString()) : null;
        const endTime = event.end ? await getLocalTime(new Date(event.end).toISOString()) : null;

        if (existing) {
            await GoogleCalendar.updateOne(
                { uid: event.uid },
                {
                    $set: {
                        summary: event.summary,
                        description: event.description,
                        location: event.location,
                        start: startTime,
                        end: endTime,
                        organizer: event.organizer,
                        attendees: event.attendees,
                        isRecurring: event.isRecurring,
                        recurrenceRule: event.recurrenceRule,
                        exceptionDates: event.exceptionDates,
                        hangoutLink: event.hangoutLink,
                        isMessageSent: false,
                        recurringEventId: event.recurringEventId,
                    },
                }
            );
            return;
        }

        await GoogleCalendar.create({
            uid: event.uid,
            eventId: event.eventId,
            summary: event.summary,
            description: event.description,
            location: event.location,
            start: startTime,
            end: endTime,
            organizer: event.organizer,
            attendees: event.attendees,
            status: "scheduled",
            isRecurring: event.isRecurring,
            recurrenceRule: event.recurrenceRule,
            exceptionDates: event.exceptionDates,
            hangoutLink: event.hangoutLink,
            isMessageSent: false,
            recurringEventId: event.recurringEventId,
        });
    }
}

export const googleCalendarRepository = new GoogleCalendarRepository();
