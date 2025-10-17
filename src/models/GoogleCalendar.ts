import mongoose, { Document, Schema } from 'mongoose';

export interface IGoogleCalendar extends Document {
  eventId: string;
  summary: string;
  start: string | null | undefined;
  end: string | null | undefined;
  hangoutLink: string | null | undefined;
  location: string | null | undefined;
  attendees: string[] | undefined;
  createdAt: Date;
  updatedAt: Date;
}

const GoogleCalendarSchema = new Schema<IGoogleCalendar>(
  {
    eventId: { 
      type: String, 
      required: true, 
      unique: true,
      index: true
    },
    summary: { type: String, required: true },
    start: { type: String },
    end: { type: String },
    hangoutLink: { type: String },
    location: { type: String },
    attendees: [{ type: String }],
  },
  {
    timestamps: true,
  }
);

GoogleCalendarSchema.index({ start: 1 });

export const GoogleCalendar = mongoose.model<IGoogleCalendar>('google_calendar', GoogleCalendarSchema);