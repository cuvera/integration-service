import { Router } from 'express';
import { googleCalendarController } from '../controllers/googleCalendarController';

const router = Router();

// Calendar Events Routes
router.get('/events', (req, res) => googleCalendarController.fetchCalendarsForAllUsers(req, res));
router.get('/events/:email', (req, res) => googleCalendarController.getUserCalendarEventsByAdmin(req, res));

// Gmail API Routes
router.get('/emails/all', (req, res) => googleCalendarController.getAllMails(req, res));
router.get('/emails/refresh', (req, res) => googleCalendarController.getRefreshToken(req, res));

// Saved Meetings Routes
router.get('/meetings/saved', (req, res) => googleCalendarController.getSavedMeetings(req, res));

export default router;
