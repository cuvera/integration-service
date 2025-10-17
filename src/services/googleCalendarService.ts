import { google } from 'googleapis';
import { JWT, OAuth2Client } from 'google-auth-library';
import { GoogleCalendar } from '../models/GoogleCalendar';
import { generateKafkaMessage, logger } from "@cuvera/commons";
import { topics } from '../config/rabbitmq';
import { 
  sendMessage, 
} from '@cuvera/commons';
interface IMeetingEvent {
  id: string;
  subject: string;
  startTime: Date | null;
  endTime: Date | null;
  meetLinks: string[];
  zoomLinks: string[];
  teamsLinks: string[];
}

interface ICalendarEvent {
  id: string;
  summary: string;
  start: string | null | undefined;
  end: string | null | undefined;
  hangoutLink: string | null | undefined;
  location: string | null | undefined;
  attendees: string[] | undefined;
}

const SERVICE_ACCOUNT_EMAIL = process.env.SERVICE_ACCOUNT_EMAIL || "";
const SERVICE_ACCOUNT_KEY = (process.env.SERVICE_ACCOUNT_KEY || "").replace(/\\n/g, "\n");
const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || "";

const SCOPES = [
  "https://www.googleapis.com/auth/admin.directory.user.readonly",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events.readonly",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events.readonly",
];

class GoogleCalendarService {
  private getOAuth2Client(): OAuth2Client {
    const CLIENT_ID = process.env.GMAIL_CLIENT_ID!;
    const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET!;
    const REDIRECT_URI = process.env.GMAIL_REDIRECT_URI!;
    const REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN!; 
    return new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
  }

  private getAuth(subject: string): JWT {
    return new JWT({
      email: SERVICE_ACCOUNT_EMAIL,
      key: SERVICE_ACCOUNT_KEY,
      scopes: SCOPES,
      subject,
    });
  }

  public async getRefreshToken(): Promise<string> {
    const oAuth2Client = this.getOAuth2Client();
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: [
        "https://www.googleapis.com/auth/calendar.readonly",
        "https://www.googleapis.com/auth/calendar.events.readonly"
      ],
    });
    return authUrl;
  }

  public async exchangeCodeForToken(code: string): Promise<{access_token: string, refresh_token: string}> {
    const oAuth2Client = this.getOAuth2Client();
    const { tokens } = await oAuth2Client.getToken(code);
    return {
      access_token: tokens.access_token!,
      refresh_token: tokens.refresh_token!
    };
  }

  private findIcsPart(parts: any[] | undefined): any {
    if (!parts) return null;
    for (const part of parts) {
      if (part.filename && part.filename.endsWith('.ics')) {
        return part;
      }
      if (part.parts) {
        const found = this.findIcsPart(part.parts);
        if (found) return found;
      }
    }
    return null;
  }

  public async getMeetingInvites(refreshToken: string): Promise<IMeetingEvent[]> {
    const oAuth2Client = this.getOAuth2Client();
    oAuth2Client.setCredentials({ refresh_token: refreshToken });
    const gmail = google.gmail({ version: "v1", auth: oAuth2Client });
    
    let messageIds: string[] = [];
    let pageToken: string | undefined = undefined;

    do {
      const resp: any = await gmail.users.messages.list({
        userId: "me",
        maxResults: 100,
        pageToken,
        q: "has:attachment filename:ics",
      });
      
      const messages = resp.data.messages || [];
      messageIds.push(...messages.map((m: any) => m.id!));
      pageToken = resp.data.nextPageToken || undefined;
    } while (pageToken);

    console.log("Total meeting messages found:", messageIds.length);
    const results: IMeetingEvent[] = [];
    const batchSize = 20;
    
    for (let i = 0; i < messageIds.length; i += batchSize) {
      const batchIds = messageIds.slice(i, i + batchSize);
      const fetchPromises = batchIds.map(id => 
        gmail.users.messages.get({ userId: "me", id, format: "full" })
      );
      const responses = await Promise.all(fetchPromises);

      for (const msg of responses) {
        if (!msg.data.payload) continue;
        const headers = msg.data.payload.headers || [];
        const subject = headers.find((h: any) => h.name?.toLowerCase() === "subject")?.value || "";
        
        const icsPart = this.findIcsPart(msg.data.payload.parts);
        let startTime = null;
        let endTime = null;

        if (icsPart?.body?.data) {
          const icsContent = Buffer.from(icsPart.body.data, "base64").toString("utf-8");
          const startMatch = /DTSTART(?:;TZID=[^:]*)?:(\d{8}T\d{6}Z?)/.exec(icsContent);
          const endMatch = /DTEND(?:;TZID=[^:]*)?:(\d{8}T\d{6}Z?)/.exec(icsContent);

          if (startMatch?.[1]) {
            const dateStr = startMatch[1];
            startTime = new Date(`${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}T${dateStr.substring(9, 11)}:${dateStr.substring(11, 13)}:${dateStr.substring(13, 15)}.000Z`);
          }
          if (endMatch?.[1]) {
            const dateStr = endMatch[1];
            endTime = new Date(`${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}T${dateStr.substring(9, 11)}:${dateStr.substring(11, 13)}:${dateStr.substring(13, 15)}.000Z`);
          }
        }

        const bodyPart = msg.data.payload.parts?.find(
          (p: any) => p.mimeType === "text/plain" || p.mimeType === "text/html"
        );
        
        let body = "";
        if (bodyPart?.body?.data) {
          body = Buffer.from(bodyPart.body.data, "base64").toString("utf-8");
        }

        const meetLinks = [...body.matchAll(/https:\/\/meet\.google\.com\/[a-zA-Z0-9-]+/g)].map(m => m[0]);
        const zoomLinks = [...body.matchAll(/https:\/\/[a-z0-9.-]*zoom\.us\/[^\s]+/g)].map(m => m[0]);
        const teamsLinks = [...body.matchAll(/https:\/\/teams\.microsoft\.com\/[^\s]+/g)].map(m => m[0]);

        results.push({
          id: msg.data.id!,
          subject,
          startTime,
          endTime,
          meetLinks,
          zoomLinks,
          teamsLinks,
        });
      }
    }

    return results;
  }

  public async getUserCalendarEvents(refreshToken: string, timeMin?: string, timeMax?: string): Promise<ICalendarEvent[]> {
    const oAuth2Client = this.getOAuth2Client();
    oAuth2Client.setCredentials({ refresh_token: refreshToken });
    const calendar = google.calendar({ version: "v3", auth: oAuth2Client });

    const now = timeMin ? new Date(timeMin) : new Date();
    const later = timeMax ? new Date(timeMax) : new Date();
    if (!timeMax) {
      later.setDate(now.getDate() + 10); // Default to 10 days if no max time provided
    }

    const response = await calendar.events.list({
      calendarId: "primary",
      timeMin: now.toISOString(),
      timeMax: later.toISOString(),
      maxResults: 50,
      singleEvents: true,
      orderBy: "startTime",
    });

    const events = response.data.items || [];
    return events.map(event => ({
      id: event.id!,
      summary: event.summary || 'No title',
      start: event.start?.dateTime || event.start?.date,
      end: event.end?.dateTime || event.end?.date,
      hangoutLink: event.hangoutLink,
      location: event.location,
      attendees: event.attendees?.map(a => a.email!)
    }));
  }

  public async getUsers(): Promise<string[]> {
    const auth = this.getAuth(SUPER_ADMIN_EMAIL);
    const admin = google.admin({ version: "directory_v1", auth });
    const users: string[] = [];
    let pageToken: string | undefined = undefined;

    do {
      const res: any = await admin.users.list({
        customer: "my_customer",
        maxResults: 500,
        pageToken,
      });

      if (res.data.users) {
        users.push(...res.data.users.map((u: any) => u.primaryEmail!));
      }
      pageToken = res.data.nextPageToken || undefined;
    } while (pageToken);

    return users;
  }

  public async fetchCalendarsForAllUsers(batchSize = 50): Promise<Record<string, ICalendarEvent[]>> {
    const users = await this.getUsers();
    console.log(`✅ Found ${users.length} users in domain.`);
    const results: Record<string, ICalendarEvent[]> = {};
    
    // Process users in batches to avoid rate limiting
    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);
      console.log(`🚀 Processing batch ${Math.floor(i / batchSize) + 1}: ${batch.length} users`);

      const batchPromises = batch.map(user => 
        this.fetchWithRetry(user)
          .then(events => ({ user, events }))
          .catch(err => {
            console.error(`Error fetching calendar for user ${user}:`, err);
            return { user, events: [] as ICalendarEvent[] };
          })
      );
      
      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(({ user, events }) => {
        results[user] = events;
      });
      
      // Add delay between batches to avoid rate limiting
      if (i + batchSize < users.length) {
        await this.sleep(1000);
      }
    }
    
    return results;
  }

  public async fetchAllEventsForUser(email: string): Promise<ICalendarEvent[]> {
    try {
      const auth = this.getAuth(email);
      const calendar = google.calendar({ version: "v3", auth });
      
      const now = new Date();
      const later = new Date();
      later.setFullYear(now.getFullYear() + 1); // Fetch next year's events
      
      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: now.toISOString(),
        timeMax: later.toISOString(),
        maxResults: 250, // Maximum allowed by the API
        singleEvents: true,
        orderBy: 'startTime',
      });

      const events = response.data.items || [];
      return events.map(event => ({
        id: event.id!,
        summary: event.summary || 'No title',
        start: event.start?.dateTime || event.start?.date,
        end: event.end?.dateTime || event.end?.date,
        hangoutLink: event.hangoutLink,
        location: event.location,
        attendees: event.attendees?.map(a => a.email!)
      }));
    } catch (error) {
      console.error(`Error fetching events for user ${email}:`, error);
      throw error;
    }
  }

  public async fetchWithRetry(userEmail: string, retries = 5): Promise<ICalendarEvent[]> {
    let attempt = 0;
    while (true) {
      try {
        return await this.fetchAllEventsForUser(userEmail);
      } catch (err: any) {
        if (attempt < retries && (err.code === 429 || err.code === 403 || err.code === 500)) {
          const delay = Math.pow(2, attempt) * 1000;
          console.warn(`⚠️ Rate limit/Server error for ${userEmail}. Retrying in ${delay}ms...`);
          await this.sleep(delay);
          attempt++;
        } else {
          throw err;
        }
      }
    }
  }

  async sendCalendarEventsMessage(payload: any): Promise<boolean> {
    try {
      const topic = {
        eventType: topics.googleCalendar,
      };
      const message = generateKafkaMessage(payload, {
          tenantId: payload?.tenantId || '689ddc0411e4209395942bee',
          eventType: topic.eventType,
      });
      console.log('Sending message to Kafka:', message);
      await sendMessage(topics.googleCalendar, message);
      return true;
      } catch (error) {
        console.error(`Error sending message to RabbitMQ: ${error}`);
      logger.error(`Warning: Failed to send message to RabbitMQ: ${error}`);
      return false;
    }
}


  public async getCuveraCalendarEvents(){
    console.log("getCuveraCalendarEvents");
    try {
      const oAuth2Client = new google.auth.OAuth2(
        process.env.GMAIL_CLIENT_ID!,
        process.env.GMAIL_CLIENT_SECRET!,
        process.env.GMAIL_REDIRECT_URI!
      );
      oAuth2Client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN! });

      const calendar = google.calendar({ version: "v3", auth: oAuth2Client });
      // Fetch events (for next 10 days in this example)
      const now = new Date();
      const tenDaysLater = new Date();
      tenDaysLater.setDate(now.getDate() + 10);

      const response = await calendar.events.list({
        calendarId: "primary", 
        // timeMin: now.toISOString(),
        //timeMax: tenDaysLater.toISOString(),
        maxResults: 50,
        singleEvents: true,
        orderBy: "startTime",
      });

      const events = response.data.items || [];

      const meetings = events.map((event) => ({
        eventId: event.id!,
        summary: event.summary || 'No title',
        start: event.start?.dateTime || event.start?.date,
        end: event.end?.dateTime || event.end?.date,
        hangoutLink: event.hangoutLink, 
        location: event.location,
        attendees: event.attendees?.map((a) => a.email!),
      }));
      console.log("meetings", meetings);  
      // Save to database
    let newMeetings: any[] = [];
    const bulkOps = meetings.map(meeting => ({
      updateOne: {
        filter: { eventId: meeting.eventId },
        update: { $set: meeting },
        upsert: true
      }
    }));

    if (bulkOps.length > 0) {
      const existingEvents = await GoogleCalendar.find({
        eventId: { $in: meetings.map(m => m.eventId) }
      }).select('eventId -_id').lean();
      
      const existingEventIds = new Set(existingEvents.map((e: any) => e.eventId));
      
      newMeetings = meetings.filter(meeting => !existingEventIds.has(meeting.eventId));
      
      await GoogleCalendar.bulkWrite(bulkOps);      
      if (newMeetings.length > 0) {
        await this.sendCalendarEventsMessage(newMeetings);
        // console.log("sending last event", meetings[meetings.length - 1]);
        //const lastRecord = meetings[meetings.length - 1]
        //await this.sendCalendarEventsMessage([lastRecord]);
      }
    }

    return {
      meetings
    };
  } catch (error) {
      console.error(`Error fetching events`, error);
      throw error;
    }
}

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const googleCalendarService = new GoogleCalendarService();
