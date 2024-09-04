import { Router } from 'express';
import { createEvent, updateEvent, deleteEvent, getEvents , watchGoogleCalendar,
    handleCalendarWebhook,
    syncOldGoogleCalendarEvents, } from '../controllers/calendarController';

const router = Router();

// Watch for changes in Google Calendar
router.post('/watch', watchGoogleCalendar);

// Handle Google Calendar webhooks
router.post('/webhook', handleCalendarWebhook);

// Trigger sync based on oldSyncBoolean
router.get('/syncOldEvents', async (req, res) => {
  const userId = req.query.userId as string;
  const oldSyncBoolean = req.query.oldSyncBoolean === 'true';

  if (oldSyncBoolean) {
    await syncOldGoogleCalendarEvents(userId);
    res.status(200).send('Old events synced successfully');
  } else {
    res.status(400).send('Sync not triggered as oldSyncBoolean is false');
  }
});
router.post('/post/events', createEvent);// create google event
router.put('/put/events', updateEvent);
router.delete('/del/events', deleteEvent);
router.get('/get/events', getEvents); 

export default router;
