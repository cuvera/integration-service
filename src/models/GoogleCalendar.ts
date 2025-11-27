import mongoose, { Document, Schema } from 'mongoose';

export interface IGoogleCalendar extends Document {
  uid: string;
  eventId: string;
  summary: string;
  start: Date | null | undefined;
  end: Date | null | undefined;
  hangoutLink: string | null | undefined;
  location: string | null | undefined;
  attendees: string[] | undefined;
  createdAt: Date;
  updatedAt: Date;
  organizer: { type: String },
  recurringEventId: string | null | undefined,
  isMessageSent: boolean,
  isRecurring: boolean,
  recurrenceRule: string | null | undefined,
  exceptionDates: string[] | null | undefined,
  recurrenceId: string | null | undefined,

}

const GoogleCalendarSchema = new Schema<IGoogleCalendar>(
  {
    uid: {
      type: String,
      required: true,
    },
    eventId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    summary: { type: String, required: true },
    start: { type: Date },
    end: { type: Date },
    hangoutLink: { type: String },
    location: { type: String },
    attendees: [{ type: String }],
    organizer: { type: String },
    recurringEventId: { type: String },
    isMessageSent: { type: Boolean, default: false },
    isRecurring: { type: Boolean, default: false },
    recurrenceRule: { type: String },
    exceptionDates: { type: [String] },
    recurrenceId: { type: String },
  },
  {
    timestamps: true,
  }
);

GoogleCalendarSchema.index({ start: 1 });

export const GoogleCalendar = mongoose.model<IGoogleCalendar>('google_calendar', GoogleCalendarSchema);