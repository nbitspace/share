import { Router } from 'express';
import { 
  createEvent, 
  updateEvent, 
  deleteEvent, 
  getEvents, 
  watchGoogleCalendar, 
  handleCalendarWebhook, 
  syncOldGoogleCalendarEvents 
} from '../controllers/calendarController';
const router = Router();
/**
 * @swagger
 * /calendar/events:
 *   get:
 *     summary: Get all events
 *     description: Retrieve a list of events from the Google Calendar.
 *     responses:
 *       200:
 *         description: A list of events
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   summary:
 *                     type: string
 *                   start:
 *                     type: string
 *                   end:
 *                     type: string
 *                   location:
 *                     type: string
 */
router.get('/events', getEvents);


/**
 * @swagger
 * /calendar/events:
 *   post:
 *     summary: Create a new event
 *     description: Create a new event in the Google Calendar
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               summary:
 *                 type: string
 *               start:
 *                 type: string
 *               end:
 *                 type: string
 *               location:
 *                 type: string
 *     responses:
 *       201:
 *         description: Event created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 summary:
 *                   type: string
 */
router.post('/events', createEvent);

/**
 * @swagger
 * /calendar/events:
 *   put:
 *     summary: Update an event
 *     description: Update an existing event in the Google Calendar
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *               summary:
 *                 type: string
 *               start:
 *                 type: string
 *               end:
 *                 type: string
 *               location:
 *                 type: string
 *     responses:
 *       200:
 *         description: Event updated successfully
 */
router.put('/events', updateEvent);

/**
 * @swagger
 * /calendar/events:
 *   delete:
 *     summary: Delete an event
 *     description: Delete an event from the Google Calendar
 *     parameters:
 *       - in: query
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The ID of the event to delete
 *     responses:
 *       200:
 *         description: Event deleted successfully
 */
router.delete('/events', deleteEvent);

/**
 * @swagger
 * /calendar/webhook:
 *   post:
 *     summary: Handle Google Calendar webhook
 *     description: Endpoint to handle webhook events from Google Calendar
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Webhook event processed successfully
 */
router.post('/webhook', handleCalendarWebhook);

/**
 * @swagger
 * /calendar/watch:
 *   get:
 *     summary: Watch Google Calendar for changes
 *     description: Setup a push notification to monitor changes in Google Calendar
 *     responses:
 *       200:
 *         description: Watching for calendar changes successfully
 */
router.get('/watch', watchGoogleCalendar);

/**
 * @swagger
 * /calendar/sync:
 *   get:
 *     summary: Sync old Google Calendar events
 *     description: Synchronize old events from the Google Calendar
 *     responses:
 *       200:
 *         description: Old events synchronized successfully
 */
router.get('/sync', syncOldGoogleCalendarEvents);

export default router;

/*

router.get('/microsoft-sync', syncMicrosoftCalendarEvents);


*/