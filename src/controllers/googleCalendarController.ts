import { Request, Response } from 'express';
import { googleCalendarService } from '../services/googleCalendarService';
import readline from "readline";
import { google } from "googleapis";
import { GoogleCalendar } from '../models/GoogleCalendar';

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events.readonly",
];
// --- Load client info from environment ---
const CLIENT_ID = process.env.GMAIL_CLIENT_ID!;
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET!;
const REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN!; 
const REDIRECT_URI = process.env.GMAIL_REDIRECT_URI!;



export class GoogleCalendarController {

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


  public async fetchCalendarsForAllUsers(req: Request, res: Response) {
    try {
      const events = await googleCalendarService.fetchCalendarsForAllUsers();
      res.json(events);
    } catch (error: any) {
      console.error('Error in fetchCalendarsForAllUsers:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      res.status(500).json({ 
        error: 'Failed to fetch calendar events',
        details: errorMessage
      });
    }
  }


  public async getUserCalendarEventsByAdmin(req: Request, res: Response) {
    try {
      const { email } = req.params;
      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }
      
      const events = await googleCalendarService.fetchAllEventsForUser(email);
      res.json(events);
    } catch (error: any) {
      console.error(`Error fetching events for user ${req.params.email}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      res.status(500).json({ 
        error: 'Failed to fetch user calendar events',
        details: errorMessage
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
      
      const meetings = await GoogleCalendar.find(query)
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

export const googleCalendarController = new GoogleCalendarController();
