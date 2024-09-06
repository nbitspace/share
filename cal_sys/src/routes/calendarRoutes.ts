import { Router } from 'express';
import { createEvent, updateEvent, deleteEvent, getEvents , watchGoogleCalendar,
    handleCalendarWebhook,
    syncOldGoogleCalendarEvents, } from '../controllers/calendarController';

const router = Router();


router.post('/events', createEvent);
router.put('/events', updateEvent);
router.delete('/events', deleteEvent);
router.get('/events', getEvents); 

export default router;
