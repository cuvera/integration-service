import { Router } from 'express';
import { teamsController } from '../controllers/teamsController';

const router = Router();

// Get calendar events for a user
router.get('/calendar-events', teamsController.getCalendarEvents);

// Get all users
router.get('/all-users', teamsController.getAllUsers);

// // Get user's chats
// router.get('/chats/:userId', TeamsController.getChats);

// // Webhook endpoint for Microsoft Graph to send meeting events
// router.post('/webhook/meetings', teamsController.handleMeetingWebhook);

// // Subscribe to meeting events
// router.post('/subscribe/meetings', teamsController.subscribeToMeetings);

export default router;
