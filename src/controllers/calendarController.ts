import { Request, Response } from 'express';
import { googleCalendarService } from '../services/googleCalendarService';
import readline from "readline";
import { google } from "googleapis";
import { Calendar } from '../models/calendar';

const SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
];
// --- Load client info from environment ---
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN!;
const REDIRECT_URI = process.env.GMAIL_REDIRECT_URI!;



export class CalendarController {

  public async getRefreshToken(req: Request, res: Response) {
    const oAuth2Client = new google.auth.OAuth2(
      CLIENT_ID,
      CLIENT_SECRET,
      REDIRECT_URI
    );

    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: SCOPES,
    });

    console.log("Authorize this app by visiting this url:", authUrl);

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question("Enter the code from that page here: ", async (code) => {
      try {
        const { tokens } = await oAuth2Client.getToken(code);
        console.log("Access Token:", tokens.access_token);
        console.log("Refresh Token:", tokens.refresh_token);
      } catch (err) {
        console.error("Error retrieving access token", err);
      }
      rl.close();
    });
  }


  public async getAllMails(req: Request, res: Response) {
    try {
      // ✅ Initialize OAuth2 client
      const oAuth2Client = new google.auth.OAuth2(
        CLIENT_ID,
        CLIENT_SECRET,
        REDIRECT_URI
      );
      oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
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

      const results: any[] = [];
      const batchSize = 20;
      for (let i = 0; i < messageIds.length; i += batchSize) {
        const batchIds = messageIds.slice(i, i + batchSize);
        const fetchPromises = batchIds.map((id) =>
          gmail.users.messages.get({ userId: "me", id, format: "full" })
        );
        const responses = await Promise.all(fetchPromises);

        for (const msg of responses) {
          if (!msg.data.payload) continue;
          const headers = msg.data.payload.headers || [];

          const subject =
            headers.find((h) => h.name?.toLowerCase() === "subject")?.value || "";
          // Function to recursively find the .ics part
          const findIcsPart = (parts: any[] | undefined): any => {
            if (!parts) return null;
            for (const part of parts) {
              if (part.filename && part.filename.endsWith('.ics')) {
                return part;
              }
              if (part.parts) {
                const found = findIcsPart(part.parts);
                if (found) return found;
              }
            }
            return null;
          };

          const icsPart = findIcsPart(msg.data.payload.parts);
          let startTime = null;
          let endTime = null;

          if (icsPart && icsPart.body && icsPart.body.data) {
            const icsContent = Buffer.from(icsPart.body.data, "base64").toString("utf-8");

            const startMatch = /DTSTART(?:;TZID=[^:]*)?:(\d{8}T\d{6}Z?)/.exec(icsContent);
            const endMatch = /DTEND(?:;TZID=[^:]*)?:(\d{8}T\d{6}Z?)/.exec(icsContent);

            if (startMatch) {
              const dateStr = startMatch[1];
              startTime = new Date(`${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}T${dateStr.substring(9, 11)}:${dateStr.substring(11, 13)}:${dateStr.substring(13, 15)}.000Z`);
            }
            if (endMatch) {
              const dateStr = endMatch[1];
              endTime = new Date(`${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}T${dateStr.substring(9, 11)}:${dateStr.substring(11, 13)}:${dateStr.substring(13, 15)}.000Z`);
            }
          }

          const bodyPart = msg.data.payload.parts?.find(
            (p) => p.mimeType === "text/plain" || p.mimeType === "text/html"
          );

          let body = "";
          if (bodyPart?.body?.data) {
            body = Buffer.from(bodyPart.body.data, "base64").toString("utf-8");
          }

          const meetLinks = [
            ...body.matchAll(/https:\/\/meet\.google\.com\/[a-zA-Z0-9-]+/g),
          ].map((m) => m[0]);
          const zoomLinks = [
            ...body.matchAll(/https:\/\/[a-z0-9.-]*zoom\.us\/[^\s]+/g),
          ].map((m) => m[0]);
          const teamsLinks = [
            ...body.matchAll(/https:\/\/teams\.microsoft\.com\/[^\s]+/g),
          ].map((m) => m[0]);

          results.push({
            id: msg.data.id,
            subject,
            startTime,
            endTime,
            meetLinks,
            zoomLinks,
            teamsLinks,
          });
        }
      }

      console.log("Filtered invites:", results.length);
      return res.json(results);
    } catch (err: any) {
      console.error("Error in getAllMeetingMails:", err);
      return res.status(500).json({
        error: "Failed to fetch calendar invites",
        details: err.message || err,
      });
    }
  }
  
  public async createEvent(req: Request, res: Response) {
    try {
      const authenticatedUser = (req as any).user;

      if (!authenticatedUser || !authenticatedUser.id) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const user = await getUserDetails(authenticatedUser.id);
      
      if (!user) {
        return res.status(401).json({ error: "Failed to retrieve user details" });
      }

      if (!user || !user.google?.googleRefreshToken) {
        return res.status(401).json({ error: "User not authenticated or missing Google refresh token" });
      }

      const { title, start, end, description, location, attendees, timeZone, recurrence } = req.body;

      if (!title || !start || !end) {
        return res.status(400).json({ error: "Missing required fields: title, start, end" });
      }

      const eventInput = {
        title,
        description,
        start,
        end,
        location,
        attendees,
        timeZone,
        recurrence
      };

      const result = await googleCalendarService.createCalendarEvent(user.google?.googleRefreshToken, eventInput);
      console.log("Created event in Google Calendar:", result);
      // Upsert to local database
      const savedEvent = await Calendar.findOneAndUpdate(
        { "google.googleEventId": result.id },
        {
          uid: result.id,
          eventId: result.id,
          google: { googleEventId: result.id },
          title: result.summary,
          summary: result.summary,
          description: result.description,
          start: result.start.dateTime || result.start.date,
          end: result.end.dateTime || result.end.date,
          location: result.location,
          hangoutLink: result.hangoutLink,
          meetingLink: result.hangoutLink,
          attendees: result.attendees ? result.attendees.map((a: any) => a.email) : [],
          organizer: result.organizer ? result.organizer.email : '',
          status: result.status,
          calendarType: 'google',
          isRecurring: !!result.recurrence,
          recurrenceRule: result.recurrence ? result.recurrence[0] : null,
          source: 'api'
        },
        { upsert: true, new: true }
      );
      console.log("Upserted event to local database:", savedEvent);

      return res.status(201).json(result);
    } catch (error: any) {
      console.error("Error creating calendar event FULL OBJECT:", JSON.stringify(error, null, 2));
      if (error.response) {
         console.error("Error Response Data:", JSON.stringify(error.response.data, null, 2));
      }
      return res.status(500).json({
        error: "Failed to create calendar event",
        details: error.response?.data || error.message || error,
      });
    }
  }

  /**
   * Get all saved meetings from the database 
   */
  public async getSavedMeetings(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;

      const query: any = {};

      if (startDate) {
        query.start = { $gte: new Date(startDate as string) };
      }

      if (endDate) {
        query.end = { ...query.end, $lte: new Date(endDate as string) };
      }

      const meetings = await Calendar.find(query)
        .sort({ start: 1 })
        .lean();

      return res.json({
        count: meetings.length,
        meetings
      });
    } catch (error: any) {
      console.error("Error fetching saved meetings:", error);
      res.status(500).json({
        error: "Failed to fetch saved meetings",
        details: error.message,
      });
    }
  }
}



export const calendarController = new CalendarController();
