import { formatISO, subDays } from 'date-fns';
import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { google, calendar_v3 } from 'googleapis';
import dotenv from 'dotenv';
import { calculateDuration, calculateDurations } from '../utils/utils'; // Correct relative path

let isSyncBoolean: boolean = false;
let oldSyncBoolean: boolean = false;
// Load OAuth 2.0 credentials
const credentialsPath = path.join(__dirname, '../../credentials.json');
const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));
const baseURL = 'https://qa-events.amurahealth.com:3000';
// Utility function to map custom time zones to IANA time zones
function mapTimeZone(timeZone: string): string {
  const timeZoneMapping: Record<string, string> = {
    'indianStandardTime': 'Asia/Kolkata', // Example: Mapping custom time zone to IANA time zone
    // Add other mappings if needed
  };


  return timeZoneMapping[timeZone] || timeZone;
}
dotenv.config();
// Set up OAuth 2.0 client
const customApiToken = process.env.CUSTOM_API_TOKEN;
const redirectUri = credentials.web.redirect_uris[0];
const oAuth2Client = new google.auth.OAuth2(
  credentials.web.client_id,
  credentials.web.client_secret,
  redirectUri
);

const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
const tokenPath = path.join(__dirname, '..', 'token.json');

// Utility function to set OAuth 2.0 credentials
async function authenticate() {
  if (fs.existsSync(tokenPath)) {
    const token = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
    oAuth2Client.setCredentials(token);
  } else {
    throw new Error('Token not found. Please authenticate via /auth');
  }
}

// Watch for changes in Google Calendar
export const watchGoogleCalendar = async (req: Request, res: Response) => {
  try {
    await authenticate();

    const uniqueChannelId = uuidv4(); // Generate a unique ID


    const response = await calendar.events.watch({
      calendarId: 'primary',
      requestBody: {
        id: uniqueChannelId,
        type: 'web_hook',
        address: 'https://eoi7erk35cc5yfe.m.pipedream.net/',
      },
    });

    console.log('Watch response:', response.data);
    res.status(200).json(response.data);
  } catch (error) {
    console.error('Error setting up calendar watch:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'An unknown error occurred' });
  }
};



async function getEventDetails(eventId: string): Promise<calendar_v3.Schema$Event> {
  try {
    const response = await calendar.events.get({
      calendarId: 'primary',
      eventId: eventId,
    });

    return response.data;
  } catch (error) {
    console.error('Error fetching event details:', error);
    throw new Error('Failed to fetch event details');
  }
}

// Function to get authenticated user's email
async function getAuthenticatedUserEmail(): Promise<string> {
  const oauth2 = google.oauth2({ version: 'v2', auth: oAuth2Client });

  try {
    const response = await oauth2.userinfo.get();
    return response.data.email || '';
  } catch (error) {
    console.error('Error fetching user email:', error);
    throw new Error('Failed to fetch user email');
  }
}
// Process webhook event
export const processWebhookEvent = async (req: Request, res: Response) => {
  try {
    // Extract relevant headers and body
    //const { id, resourceId, resourceUri } = req.headers;
    const { event_id } = req.body; // Extract event ID from the webhook payload

    console.log('Webhook headers:', req.headers);
    console.log('Webhook body:', req.body);

    // Fetch the authenticated user's email
    const userEmail ='nbitspace01@gmail.com'// await getAuthenticatedUserEmail();

    // Fetch the full event details from Google Calendar using the event ID
    const eventDetails = await getEventDetails(event_id);
     // Extract event details
     const {
      summary,
      start,
      end,
      attendees,
      description,
      status,
      visibility,
      
    } = eventDetails;
    const timeZone = eventDetails.start?.timeZone || 'UTC';

    // Prepare the event data for Amura
    const eventData = {
      userId: userEmail, // Use the dynamically fetched email
      organizer: 'Google Calendar', // Replace with the actual organizer if available
      title: summary || 'No Title',
      eventType: 'events',
      // Use the mapped time zone
      tenantName: 'amura',
      eventDate: start?.dateTime || start?.date || '',
      fromTime: start?.dateTime || start?.date || '',
      toDate: end?.dateTime || end?.date || '',
      toTime: end?.dateTime || end?.date || '',
      duration: calculateDurations(start?.dateTime || start?.date || '', end?.dateTime || end?.date || ''),
      repeatType: 'doesntRepeat',
      reccurance: {}, // Add recurrence details if available
      tenantId: 'amura',
      notify: [],
      tenantParticipants: [],
      // externalParticipants: attendees?.map(attendee => attendee.email) || [],
      isExcludeMeFromEvent: false,
      visibility: visibility || 'private',
      status: status || 'confirmed',
      callType: 'video',
      others: '',
      description: description || '',
      permissons: [],
      organizerRoleId: '', // Define this if necessary
      notifyTimeInMinutes: [10], // Customize this as needed
    };

    // Send the event data to the Amura API
    const customApiResponse = await axios.post(`${baseURL}/scheduler/event/createEvent`, eventData, {
      headers: {
        'Authorization': `Bearer ${customApiToken}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('Event created successfully in Amura:', customApiResponse.data);
    res.status(200).send('Event processed successfully');
  } catch (error) {
    console.error('Error processing event:', error);
    res.status(500).send('Internal Server Error');
  }
};
// Existing webhook handler
export const handleCalendarWebhook = async (req: Request, res: Response) => {
  try {
    const channelId = req.headers['x-goog-channel-id'];
    const resourceId = req.headers['x-goog-resource-id'];

    // Assuming you have some way of associating channelId/resourceId with a user
    const userId = 'nbitspace01@gmail.com'; // Replace with actual user ID lookup

    if (channelId === 'unique-channel-id' && isSyncBoolean) {
      const eventId = req.body.id;
      const eventResponse = await calendar.events.get({
        calendarId: 'primary',
        eventId,
      });

      const event = eventResponse.data;
      const startDateTime = event.start?.dateTime || event.start?.date || new Date().toISOString();
      const endDateTime = event.end?.dateTime || event.end?.date || new Date().toISOString();

      const amuraEvent = {
        userId: userId,
        title: event.summary || 'Now Title',
        eventType: 'events',
        tenantName: 'amura',
        eventDate: startDateTime,
        fromTime: startDateTime,
        toDate: endDateTime,
        toTime: endDateTime,
        duration: calculateDuration(startDateTime, endDateTime),
        timeZone: event.start?.timeZone || 'Asia/Kolkata',
        repeatType: 'doesntRepeat',
        tenantId: 'amura',
        notify: [],
        tenantParticipants: [],
        externalParticipants: event.attendees?.map(attendee => attendee.email) || [],
        isExcludeMeFromEvent: false,
        visibility: event.visibility || 'private',
        status: event.status || 'confirmed',
        callType: 'video',
        others: '',
        description: event.description || '',
        permissons: [],
        organizerRoleId: '',
        notifyTimeInMinutes: [10],
      };

      await axios.post('https://qa-events.amurahealth.com:3000/scheduler/event/createEvent', amuraEvent, {
        headers: {
          'Authorization': `Bearer ${customApiToken}`,
          'Content-Type': 'application/json',
        },
      });

      res.status(200).send('Event synced successfully');
    } else {
      res.status(400).send('Invalid channel ID or Sync is disabled');
    }
  } catch (error) {
    console.error('Error handling calendar webhook:', error);
    res.status(500).send('Internal server error');
  }
};


export const syncOldGoogleCalendarEvents = async (userId: string) => {
  try {

    const credentials = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'token.json'), 'utf-8'));
    const oAuth2Client = new google.auth.OAuth2(
      '27988681367-s11eg058duue72oveo0lkjj4v8af6vjh.apps.googleusercontent.com',
      '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',
      'http://localhost:8080/oauth2callback'
    );
    oAuth2Client.setCredentials(credentials);

    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
    let pageToken: string | undefined;
    let moreEvents = true;

    while (moreEvents) {
      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: new Date('2000-01-01T00:00:00Z').toISOString(),
        timeMax: new Date().toISOString(),
        maxResults: 10,
        singleEvents: true,
        orderBy: 'startTime',
        pageToken: pageToken || undefined,
      });

      const events = response.data.items || [];
      moreEvents = !!response.data.nextPageToken;
      pageToken = response.data.nextPageToken || undefined;
      for (const event of events) {
        const startDateTime = event.start?.dateTime || event.start?.date || new Date().toISOString();
        const endDateTime = event.end?.dateTime || event.end?.date || new Date().toISOString();

        const eventData = {
          userId,
          organizer: 'Google Calendar',
          title: event.summary || 'No Title',
          eventType: 'events',
          timeZone: event.start?.timeZone || 'UTC',
          tenantName: 'amura',
          eventDate: startDateTime,
          fromTime: startDateTime,
          toDate: endDateTime,
          toTime: endDateTime,
          duration: calculateDuration(startDateTime, endDateTime),
          repeatType: 'doesntRepeat',
          reccurance: {},
          tenantId: 'amura',
          notify: [],
          tenantParticipants: [],
          externalParticipants: event.attendees?.map(attendee => attendee.email) || [],
          isExcludeMeFromEvent: false,
          visibility: event.visibility || 'private',
          status: event.status || 'confirmed',
          callType: 'video',
          others: '',
          description: event.description || '',
          permissons: [],
          organizerRoleId: '',
          notifyTimeInMinutes: [10],
        };

        try {
          // Send event data to Amura API
          await axios.post(`${baseURL}/scheduler/event/createEvent`, eventData, {
            headers: {
              'Authorization': `Bearer ${customApiToken}`,
              'Content-Type': 'application/json',
            },
          });
          console.log(`Event "${eventData.title}" synced successfully.`);
        } catch (postError) {
          console.error(`Failed to sync event "${eventData.title}":`, postError);
        }
      }

      // Optional: Add delay to prevent hitting API rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('All events synced to Amura');
  } catch (error) {
    console.error('Error syncing old events:', error);
  }
};
// Get events
export const getEvents = async (req: Request, res: Response) => {
  try {
    await authenticate();

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date().toISOString(),
      maxResults: 10,
      singleEvents: true,
      orderBy: 'startTime',
    });
    console.log('req.query:', req.query);

    // Log the full response for debugging
    console.log('Google Calendar API response:', response.data);

    // Check if response.data and response.data.items are defined
    if (response.data && response.data.items) {
      if (response.data.items.length === 0) {
        console.log('No upcoming events found');
        res.status(200).json(response.data);
      } else {
        console.log('Upcoming events:', response.data);
        res.status(200).json(response.data);
      }
    } else {
      console.log('No data or items found in the response');
      res.status(200).json(response.data);
    }

  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'An unknown error occurred' });
  }
};

// Create an event
export const createEvent = async (req: Request, res: Response) => {
  try {
    await authenticate();

    // Map the time zone before creating the event
    const timeZone = mapTimeZone(req.body.timeZone);

    const event = {
      summary: req.body.title,
      description: req.body.description || '',
      start: {
        dateTime: req.body.fromTime,
        timeZone: timeZone,  // Use the mapped time zone here
      },
      end: {
        dateTime: req.body.toTime,
        timeZone: timeZone,  // Use the mapped time zone here
      },
      attendees: req.body.externalParticipants.map((email: string) => ({ email })),
      reminders: {
        useDefault: false,
        overrides: req.body.notifyTimeInMinutes.map((minutes: number) => ({
          method: 'popup',
          minutes,
        })),
      },
    };

    // Create event in Google Calendar
    const googleResponse = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
    });
/*
    // Prepare the event data for the custom API
    const eventData = {
      userId: req.body.userId,
      organizer: req.body.organizer,
      title: req.body.title,
      eventType: req.body.eventType,
      timeZone: timeZone,  // Use the mapped time zone here
      tenantName: req.body.tenantName,
      eventDate: req.body.eventDate,
      fromTime: req.body.fromTime,
      toDate: req.body.toDate,
      toTime: req.body.toTime,
      duration: req.body.duration,
      repeatType: req.body.repeatType,
      reccurance: req.body.reccurance || {},
      tenantId: req.body.tenantId,
      notify: req.body.notify || [],
      tenantParticipants: req.body.tenantParticipants || [],
      externalParticipants: req.body.externalParticipants || [],
      isExcludeMeFromEvent: req.body.isExcludeMeFromEvent || false,
      visibility: req.body.visibility || 'private',
      status: req.body.status || 'busy',
      callType: req.body.callType || 'video',
      others: req.body.others || '',
      description: req.body.description || '',
      permissons: req.body.permissons || [],
      organizerRoleId: req.body.organizerRoleId || '',
      notifyTimeInMinutes: req.body.notifyTimeInMinutes || [],
    };

    // Send a request to the custom API to create the event
    const customApiResponse = await axios.post(`${baseURL}/scheduler/event/createEvent`, eventData, {
      headers: {
        'Authorization': `Bearer ${customApiToken}`,
        'Content-Type': 'application/json'
      }
    });
*/
    // Combine responses or handle as needed
    res.status(200).json({
      status: 200,
      message: 'Event created successfully.',
      googleCalendar: googleResponse.data,
    //  customApi: customApiResponse.data,
    });
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'An unknown error occurred' });
  }
};
// Update an event
export const updateEvent = async (req: Request, res: Response) => {
  try {
    await authenticate();

    const eventId = req.body.eventId;
    const event = {
      summary: req.body.title,
      description: req.body.description,
      start: {
        dateTime: req.body.fromTime,
        timeZone: req.body.timeZone,
      },
      end: {
        dateTime: req.body.toTime,
        timeZone: req.body.timeZone,
      },
      attendees: req.body.externalParticipants.map((email: string) => ({ email })),
    };

    // Update event in Google Calendar
    const googleResponse = await calendar.events.update({
      calendarId: 'primary',
      eventId,
      requestBody: event,
    });

    // Prepare the event data for the custom API
    const eventData = {
      eventId: req.body.eventId,
      parentId: req.body.parentId,
      organizer: req.body.organizer,
      title: req.body.title,
      eventType: req.body.eventType,
      timeZone: req.body.timeZone,
      tenantName: req.body.tenantName,
      eventDate: req.body.eventDate,
      toDate: req.body.toDate,
      fromTime: req.body.fromTime,
      toTime: req.body.toTime,
      duration: req.body.duration,
      repeatType: req.body.repeatType,
      reccurance: req.body.reccurance || {},
      tenantId: req.body.tenantId,
      notify: req.body.notify || [],
      tenantParticipants: req.body.tenantParticipants || [],
      externalParticipants: req.body.externalParticipants || [],
      isExcludeMeFromEvent: req.body.isExcludeMeFromEvent || false,
      visibility: req.body.visibility || 'private',
      status: req.body.status || 'busy',
      callType: req.body.callType || 'video',
      others: req.body.others || '',
      description: req.body.description || '',
      permissons: req.body.permissons || [],
    };

    // Send a request to the custom API to update the event
    const customApiResponse = await axios.put(`${baseURL}/scheduler/event/updateEvent`, eventData, {
      headers: {
        'Authorization': `Bearer ${customApiToken}`,
        'Content-Type': 'application/json',
      },
    });

    // Combine responses or handle as needed
    res.status(200).json({
      googleCalendar: googleResponse.data,
      customApi: customApiResponse.data,
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'An unknown error occurred' });
  }
};

// Delete an event
export const deleteEvent = async (req: Request, res: Response) => {
  try {
    await authenticate();

    const eventId = req.body.eventId;

    // Delete event from Google Calendar
    await calendar.events.delete({
      calendarId: 'primary',
      eventId,
    });

    // Prepare the delete data for the custom API
    const deleteData = {
      userId: req.body.userId,
      organizer: req.body.organizer,
      title: req.body.title,
      eventType: req.body.eventType,
      timeZone: req.body.timeZone,
      tenantName: req.body.tenantName,
      eventDate: req.body.eventDate,
      toDate: req.body.toDate,
      fromTime: req.body.fromTime,
      toTime: req.body.toTime,
      duration: req.body.duration,
      repeatType: req.body.repeatType,
      reccurance: req.body.reccurance || {},
      tenantId: req.body.tenantId,
      notify: req.body.notify || [],
      tenantParticipants: req.body.tenantParticipants || [],
      externalParticipants: req.body.externalParticipants || [],
      isExcludeMeFromEvent: req.body.isExcludeMeFromEvent || false,
      visibility: req.body.visibility || 'private',
      status: req.body.status || 'busy',
      callType: req.body.callType || 'video',
      others: req.body.others || '',
      description: req.body.description || '',
      permissons: req.body.permissons || [],
      parentId: req.body.parentId,
      updatedBy: req.body.updatedBy,
      deleteObject: req.body.deleteObject,
    };

    // Send a request to the custom API to delete the event
    const customApiResponse = await axios.post(`${baseURL}/scheduler/event/deleteEvent`, deleteData, {
      headers: {
        'Authorization': `Bearer ${customApiToken}`,
        'Content-Type': 'application/json',
      },
    });

    res.status(200).json({ 
      message: 'Event deleted successfully',
      customApi: customApiResponse.data,
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'An unknown error occurred' });
  }
};
 