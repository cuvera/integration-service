import { GoogleCalendar, IGoogleCalendar } from "../models/GoogleCalendar";
import { toUTC } from "../utils/timeUtils";

export class GoogleCalendarRepository {
    async markMessagesSentByEventIds(eventIds: string[]): Promise<void> {
        await GoogleCalendar.updateMany(
            { eventId: { $in: eventIds } },
            { $set: { isMessageSent: true } }
        );
    }

    async upsertFromParsedInvite(event: any): Promise<IGoogleCalendar> {
        const existing: any = await GoogleCalendar.findOne({ uid: event.uid });
        const startTime = event.start ? toUTC(event.start) : null;
        const endTime = event.end ? toUTC(event.end) : null;

        if (existing) {
            const updatedEvent: any = await GoogleCalendar.findOneAndUpdate(
                { uid: event.uid },
                {
                    $set: {
                        summary: event.summary,
                        description: event.description,
                        location: event.location,
                        start: startTime,
                        end: endTime,
                        previousStart: existing.start,
                        previousEnd: existing.end,
                        organizer: event.organizer,
                        attendees: event.attendees,
                        isRecurring: event.isRecurring,
                        recurrenceRule: event.recurrenceRule,
                        exceptionDates: event.exceptionDates,
                        hangoutLink: event.hangoutLink,
                        isMessageSent: false,
                        recurringEventId: event.recurringEventId,
                        status: event.status,
                    },
                },
                { new: true, returnDocument: 'after' }
            );
            return updatedEvent;
        }

        const newEvent = await GoogleCalendar.create({
            uid: event.uid,
            eventId: event.eventId,
            summary: event.summary,
            description: event.description,
            location: event.location,
            start: startTime,
            end: endTime,
            organizer: event.organizer,
            attendees: event.attendees,
            status: event.status,
            isRecurring: event.isRecurring,
            recurrenceRule: event.recurrenceRule,
            exceptionDates: event.exceptionDates,
            hangoutLink: event.hangoutLink,
            isMessageSent: false,
            recurringEventId: event.recurringEventId,
            previousStart: startTime,
            previousEnd: endTime,
        });
        return newEvent;
    }
}

export const googleCalendarRepository = new GoogleCalendarRepository();
