import { Request, Response } from 'express';
import { getAllUsers, getUserCalendar } from '../services/teamsService';

export class TeamsController {
    /**
     * Get authenticated user's calendar events
     */
    public async getCalendarEvents(req: Request, res: Response) {
        try {
            const { userId, startDateTime, endDateTime } = req.query;
            
            if (!userId) {
                return res.status(400).json({
                    success: false,
                    message: 'userId is required'
                });
            }

            const events = await getUserCalendar(
                userId as string
            );

            res.json({
                success: true,
                data: events
            });
        } catch (error: unknown) {
            console.error('Error in getCalendarEvents:', error);
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
            res.status(500).json({
                success: false,
                message: 'Failed to fetch calendar events',
                error: errorMessage
            });
        }

    }
    public async getAllUsers(req: Request, res: Response) {
        try {
            const users = await getAllUsers();
            console.log("Found users:", users.length);
        
            for (const user of users) {
              console.log(`\n📅 Calendar for: ${user.displayName} (${user.userPrincipalName})`);
              try {
                const events = await getUserCalendar(user.id);
                for (const ev of events) {
                  console.log(`- ${ev.subject} (${ev.start.dateTime} → ${ev.end.dateTime})`);
                }
                res.json({
                    success: true,
                    data: events
                });
              } catch (err) {
                console.error(`Error fetching calendar for ${user.userPrincipalName}:`, err);
              }
            }
        } catch (error) {
            console.log("error", error)
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
            res.status(500).json({
                success: false,
                message: 'Failed to fetch calendar events',
                error: errorMessage
            });          
        }
    }
}
export const teamsController = new TeamsController();