import axios from 'axios';
import dotenv from 'dotenv';
import { Request, Response } from 'express';
import fs from 'fs';
import { calendar_v3, google } from 'googleapis';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { calculateDuration, calculateDurations } from '../utils/utils'; // Correct relative path
import { Client } from '@microsoft/microsoft-graph-client';


let isSyncBoolean: boolean = false;
let oldSyncBoolean: boolean = false;
// Load OAuth 2.0 credentials
const credentialsPath = path.join(__dirname, '../../credentials.json');
const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));
const baseURL = 'https://qa-events.amurahealth.com:3000';
// Utility function to map custom time zones to IANA time zones
function mapTimeZone(timeZone: string): string {
  const timeZoneMapping: Record<string, string> = {
    indianStandardTime: 'Asia/Kolkata' // Example: Mapping custom time zone to IANA time zone
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
async function authenticateTokenfromDb(token: string) {
  console.log("authenticateTokenfromDb method : " + token);
  
  try {
    // Set credentials to use refresh token
    oAuth2Client.setCredentials({ refresh_token: token });

    await oAuth2Client.getAccessToken().then(token => {
      console.log("New access token: " + token.token);
    });
    
    // Try refreshing the access token
    const { credentials } = await oAuth2Client.refreshAccessToken();
    
    if (credentials.access_token) {
      oAuth2Client.setCredentials(credentials);  // Set the new access token
      console.log("Access token refreshed successfully.");
    } else {
      throw new Error("Failed to refresh access token.");
    }
  } catch (error) {
    if (error && error === "invalid_grant") {
      // Handle token expiration or revocation
      console.error("The provided token is either expired or revoked. Please reauthenticate.");
    } else {
      console.error("Error refreshing token:", error);
    }
    throw error;
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
        address: 'https://eoi7erk35cc5yfe.m.pipedream.net/'
      }
    });

    console.log('Watch response:', response.data);
    res.status(200).json(response.data);
  } catch (error) {
    console.error('Error setting up calendar watch:', error);
    res.status(500).json({
      error:
        error instanceof Error ? error.message : 'An unknown error occurred'
    });
  }
};

async function getEventDetails(
  eventId: string
): Promise<calendar_v3.Schema$Event> {
  try {
    const response = await calendar.events.get({
      calendarId: 'primary',
      eventId: eventId
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
    const userEmail = 'nbitspace01@gmail.com';  //await getAuthenticatedUserEmail();

    // Fetch the full event details from Google Calendar using the event ID
    const eventDetails = await getEventDetails(event_id);
    // Extract event details
    const { summary, start, end, attendees, description, status, visibility } =
      eventDetails;
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
      duration: calculateDurations(
        start?.dateTime || start?.date || '',
        end?.dateTime || end?.date || ''
      ),
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
      notifyTimeInMinutes: [10] // Customize this as needed
    };

    // Send the event data to the Amura API
    const customApiResponse = await axios.post(
      `${baseURL}/scheduler/event/createEvent`,
      eventData,
      {
        headers: {
          Authorization: `Bearer ${customApiToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

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
        eventId
      });

      const event = eventResponse.data;
      const startDateTime =
        event.start?.dateTime || event.start?.date || new Date().toISOString();
      const endDateTime =
        event.end?.dateTime || event.end?.date || new Date().toISOString();

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
        externalParticipants:
          event.attendees?.map((attendee) => attendee.email) || [],
        isExcludeMeFromEvent: false,
        visibility: event.visibility || 'private',
        status: event.status || 'confirmed',
        callType: 'video',
        others: '',
        description: event.description || '',
        permissons: [],
        organizerRoleId: '',
        notifyTimeInMinutes: [10]
      };

      await axios.post(
        'https://qa-events.amurahealth.com:3000/scheduler/event/createEvent',
        amuraEvent,
        {
          headers: {
            Authorization: `Bearer ${customApiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

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
    const credentials = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', 'token.json'), 'utf-8')
    );
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
        pageToken: pageToken || undefined
      });

      const events = response.data.items || [];
      moreEvents = !!response.data.nextPageToken;
      pageToken = response.data.nextPageToken || undefined;
      for (const event of events) {
        const startDateTime =
          event.start?.dateTime ||
          event.start?.date ||
          new Date().toISOString();
        const endDateTime =
          event.end?.dateTime || event.end?.date || new Date().toISOString();

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
          externalParticipants:
            event.attendees?.map((attendee) => attendee.email) || [],
          isExcludeMeFromEvent: false,
          visibility: event.visibility || 'private',
          status: event.status || 'confirmed',
          callType: 'video',
          others: '',
          description: event.description || '',
          permissons: [],
          organizerRoleId: '',
          notifyTimeInMinutes: [10]
        };

        try {
          // Send event data to Amura API
          await axios.post(
            `${baseURL}/scheduler/event/createEvent`,
            eventData,
            {
              headers: {
                Authorization: `Bearer ${customApiToken}`,
                'Content-Type': 'application/json'
              }
            }
          );
          console.log(`Event "${eventData.title}" synced successfully.`);
        } catch (postError) {
          console.error(
            `Failed to sync event "${eventData.title}":`,
            postError
          );
        }
      }

      // Optional: Add delay to prevent hitting API rate limits
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    console.log('All events synced to Amura');
  } catch (error) {
    console.error('Error syncing old events:', error);
  }
};

// Get events
/**
 * @swagger
 * /events:
 *   get:
 *     summary: Fetch upcoming events from Google Calendar
 *     tags: [Events]
 *     parameters:
 *       - in: query
 *         name: maxResults
 *         schema:
 *           type: integer
 *           default: 10
 *         description: The maximum number of events to return
 *       - in: query
 *         name: timeMin
 *         schema:
 *           type: string
 *           format: date-time
 *         description: The start time for fetching events (default is current time)
 *     responses:
 *       200:
 *         description: Events fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Events fetched successfully
 *                 events:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       summary:
 *                         type: string
 *                       description:
 *                         type: string
 *                       start:
 *                         type: object
 *                       end:
 *                         type: object
 *                       attendees:
 *                         type: array
 *                       organizer:
 *                         type: object
 *       400:
 *         description: Bad request - invalid input parameters
 *       500:
 *         description: Server error
 */
export const getEvents = async (req: Request, res: Response) => {
  try {
    await authenticate();

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date().toISOString(),
      maxResults: 10,
      singleEvents: true,
      orderBy: 'startTime'
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
    res.status(500).json({
      error:
        error instanceof Error ? error.message : 'An unknown error occurred'
    });
  }
};

// Create an event
/**
 * @swagger
 * /events:
 *   post:
 *     summary: Create a new event in Google Calendar
 *     tags: [Events]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - fromTime
 *               - toTime
 *               - timeZone
 *             properties:
 *               title:
 *                 type: string
 *                 description: The title of the event
 *               description:
 *                 type: string
 *                 description: Optional description of the event
 *               fromTime:
 *                 type: string
 *                 format: date-time
 *                 description: Start time of the event (ISO 8601 format)
 *               toTime:
 *                 type: string
 *                 format: date-time
 *                 description: End time of the event (ISO 8601 format)
 *               timeZone:
 *                 type: string
 *                 description: Time zone for the event
 *               externalParticipants:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: email
 *                 description: List of external participants' email addresses
 *               notifyTimeInMinutes:
 *                 type: array
 *                 items:
 *                   type: number
 *                 description: List of reminder times in minutes before the event
 *     responses:
 *       201:
 *         description: Event created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Event created successfully.
 *                 event:
 *                   type: object
 *                   description: The created event object from Google Calendar
 *       400:
 *         description: Bad request - missing required fields or invalid input
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Missing required fields
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: An unknown error occurred
 */
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
        timeZone: timeZone // Use the mapped time zone here
      },
      end: {
        dateTime: req.body.toTime,
        timeZone: timeZone // Use the mapped time zone here
      },
      attendees: req.body.externalParticipants.map((email: string) => ({
        email
      })),
      reminders: {
        useDefault: false,
        overrides: req.body.notifyTimeInMinutes.map((minutes: number) => ({
          method: 'popup',
          minutes
        }))
      }
    };

    // Create event in Google Calendar
    const googleResponse = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event
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
      googleCalendar: googleResponse.data
      //  customApi: customApiResponse.data,
    });
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({
      error:
        error instanceof Error ? error.message : 'An unknown error occurred'
    });
  }
};interface CreateGoogleEventData {
  title: string;
  description?: string;
  fromTime: string;
  toTime: string;
  timeZone: string;
  externalParticipants: string[];
  notifyTimeInMinutes: number[];
}

export const createGoogleEvent = async (data: CreateGoogleEventData, token: string) => {
  try {
    // Use the token from CalSyncConfig
    await authenticateTokenfromDb(token);
console.log("authenticateTokenfromDb"+authenticateTokenfromDb+"token")
    // Map the time zone before creating the event
    const timeZone = mapTimeZone(data.timeZone);

    const event = {
      summary: data.title,
      description: data.description || '',
      start: {
        dateTime: data.fromTime,
        timeZone: timeZone // Use the mapped time zone here
      },
      end: {
        dateTime: data.toTime,
        timeZone: timeZone // Use the mapped time zone here
      },
      attendees: data.externalParticipants.map((email: string) => ({ email })),
      reminders: {
        useDefault: false,
        overrides: data.notifyTimeInMinutes.map((minutes: number) => ({
          method: 'popup',
          minutes
        }))
      }
    };

    // Create event in Google Calendar
    const googleResponse = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event
    });
    
    console.log('Event created successfully:', googleResponse.data);
    return googleResponse.data;
  } catch (error) {
    console.error('Error creating event:', error);
    throw new Error(error instanceof Error ? error.message : 'An unknown error occurred');
  }
};


// Update an event
/**
 * @swagger
 * /events:
 *   put:
 *     summary: Update an existing event in Google Calendar and custom API
 *     tags: [Events]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - eventId
 *               - title
 *               - fromTime
 *               - toTime
 *               - timeZone
 *             properties:
 *               eventId:
 *                 type: string
 *                 description: The ID of the event to update
 *               title:
 *                 type: string
 *                 description: The updated title of the event
 *               description:
 *                 type: string
 *                 description: Updated description of the event
 *               fromTime:
 *                 type: string
 *                 format: date-time
 *                 description: Updated start time of the event (ISO 8601 format)
 *               toTime:
 *                 type: string
 *                 format: date-time
 *                 description: Updated end time of the event (ISO 8601 format)
 *               timeZone:
 *                 type: string
 *                 description: Updated time zone for the event
 *               externalParticipants:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: email
 *                 description: Updated list of external participants' email addresses
 *               # ... other fields as needed
 *     responses:
 *       200:
 *         description: Event updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Event updated successfully
 *                 googleCalendar:
 *                   type: object
 *                   description: The updated event object from Google Calendar
 *                 customApi:
 *                   type: object
 *                   description: The response from the custom API
 *       400:
 *         description: Bad request - missing required fields or invalid input
 *       500:
 *         description: Server error
 */
export const updateEvent = async (req: Request, res: Response) => {
  try {
    await authenticate();

    const eventId = req.body.eventId;
    const event = {
      summary: req.body.title,
      description: req.body.description,
      start: {
        dateTime: req.body.fromTime,
        timeZone: req.body.timeZone
      },
      end: {
        dateTime: req.body.toTime,
        timeZone: req.body.timeZone
      },
      attendees: req.body.externalParticipants.map((email: string) => ({
        email
      }))
    };

    // Update event in Google Calendar
    const googleResponse = await calendar.events.update({
      calendarId: 'primary',
      eventId,
      requestBody: event
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
      permissons: req.body.permissons || []
    };

    // Send a request to the custom API to update the event
    const customApiResponse = await axios.put(
      `${baseURL}/scheduler/event/updateEvent`,
      eventData,
      {
        headers: {
          Authorization: `Bearer ${customApiToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // Combine responses or handle as needed
    res.status(200).json({
      googleCalendar: googleResponse.data,
      customApi: customApiResponse.data
    });
  } catch (error) {
    res.status(500).json({
      error:
        error instanceof Error ? error.message : 'An unknown error occurred'
    });
  }
};

// Delete an event
/**
 * @swagger
 * /events:
 *   delete:
 *     summary: Delete an event from Google Calendar and custom API
 *     tags: [Events]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - eventId
 *               - userId
 *               - organizer
 *             properties:
 *               eventId:
 *                 type: string
 *                 description: The ID of the event to delete
 *               userId:
 *                 type: string
 *                 description: The ID of the user deleting the event
 *               organizer:
 *                 type: string
 *                 description: The organizer of the event
 *               title:
 *                 type: string
 *                 description: The title of the event
 *               eventType:
 *                 type: string
 *                 description: The type of the event
 *               timeZone:
 *                 type: string
 *                 description: The time zone of the event
 *               # ... other fields as needed
 *     responses:
 *       200:
 *         description: Event deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Event deleted successfully
 *                 customApi:
 *                   type: object
 *                   description: The response from the custom API
 *       400:
 *         description: Bad request - missing required fields
 *       500:
 *         description: Server error
 */
export const deleteEvent = async (req: Request, res: Response) => {
  try {
    await authenticate();

    const eventId = req.body.eventId;

    if (!eventId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Delete event from Google Calendar
    await calendar.events.delete({
      calendarId: 'primary',
      eventId
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
      deleteObject: req.body.deleteObject
    };

    // Send a request to the custom API to delete the event
    const customApiResponse = await axios.post(
      `${baseURL}/scheduler/event/deleteEvent`,
      deleteData,
      {
        headers: {
          Authorization: `Bearer ${customApiToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    res.status(200).json({
      message: 'Event deleted successfully',
      customApi: customApiResponse.data
    });
  } catch (error) {
    res.status(500).json({
      error:
        error instanceof Error ? error.message : 'An unknown error occurred'
    });
  }
};
// Dummy data for the response
const dummyAmuraResponse = {
  metaData: { totalItems: 10 },
  events: [
    {
      platform: 'GOOGLE',
      title: 'Google Meeting',
      description: 'Google Calendar Event Description',
      fromTime: '2024-08-29T09:00:00.000Z',
      toTime: '2024-08-29T10:00:00.000Z',
      externalParticipants: ['email1@example.com'],
      timeZone: 'America/New_York',
      notifyTimeInMinutes: [30],
    },
    {
      platform: 'MICROSOFT',
      title: 'Microsoft Meeting',
      description: 'Microsoft Calendar Event Description',
      fromTime: '2024-08-30T11:00:00.000Z',
      toTime: '2024-08-30T12:00:00.000Z',
      externalParticipants: ['email2@example.com'],
      timeZone: 'America/Los_Angeles',
      notifyTimeInMinutes: [15],
    },
  ],
};

// Function to process Amura events and create calendar events
export const processAmuraEvents = async (req: Request, res: Response) => {
  try {
    // Iterate over the list of events from the Amura response
    for (const event of dummyAmuraResponse.events) {
      // Prepare the request body for creating an event
      const requestBody = {
        title: event.title,
        description: event.description,
        fromTime: event.fromTime,
        toTime: event.toTime,
        externalParticipants: event.externalParticipants,
        timeZone: event.timeZone,
        notifyTimeInMinutes: event.notifyTimeInMinutes,
      };

      // Check if the platform is Google and call the createEvent function
      if (event.platform === 'GOOGLE') {
        const createdEvent = await createEvent({ body: requestBody } as Request, res);
        console.log('Created Google Calendar event:', createdEvent);
      }
      // Handle Microsoft events if needed
      else if (event.platform === 'MICROSOFT') {
       await createMicrosoftCalendarEvent(event);
      }
    }

    res.status(200).send('All relevant events processed and posted to calendars');
  } catch (error) {
    console.error('Error processing Amura events:', error);
    res.status(500).send('Failed to process Amura events');
  }
};

// Dummy function to create event in Microsoft Calendar (placeholder)
const createMicrosoftCalendarEvent = async (event: any) => {
  console.log('Creating event in Microsoft Calendar with data:', event);
  // Logic to post event to Microsoft Calendar API
};
// Dummy data for CalSyncConfig table
const calSyncConfigs = [
  {
    id: 1,
    pms_cal_id: "amura-calendar-1",
    email: 'vaishanth001@gmail.com',
    cal_type: 'google',
    token_type: 'OAuth',
    api_key: 'ya29.a0AcM612winR5qNJWMCTplrcYK4m1xKp-lXA0zkL-qvJbXvD4W6YZVH1Wxkbjd0TY8-D0rLVbOkWoq_n2C9spgP-NqayH75xj4AlYlRhJkSA5CNupfpU6LYTpRhtzDPtx_5bnDJIrZW8xgci0Q6WISgkJRgR87cTn5rloaCgYKAa4SARASFQHGX2MikemPO2bYtkG3Nvpebkwjhg0170',
    temp_api_key: null, // Access Token (optional)
    expiry_time_key: null, // Token expiry time (optional)
    is_sync_enabled: true,
    last_sync_time: "2024-08-29T16:30:00.000Z"
  },
  {
    id: 2,
    pms_cal_id: "amura-calendar-2",
    email: 'vaishanth7585@gmail.com',
    cal_type: 'microsoft',
    token_type: 'OAuth',
    api_key: 'ya29.a0AcM612winR5qNJWMCTplrcYK4m1xKp-lXA0zkL-qvJbXvD4W6YZVH1Wxkbjd0TY8-D0rLVbOkWoq_n2C9spgP-NqayH75xj4AlYlRhJkSA5CNupfpU6LYTpRhtzDPtx_5bnDJIrZW8xgci0Q6WISgkJRgR87cTn5rloaCgYKAa4SARASFQHGX2MikemPO2bYtkG3Nvpebkwjhg0170',
    temp_api_key: null, // Access Token (optional)
    expiry_time_key: null, // Token expiry time (optional)
    is_sync_enabled: true,
    last_sync_time: "2024-08-30T16:30:00.000Z"
  }
];

const searchResponse = {
  Status: "Success",
  Message: "Elastic search response",
  "body": [
    {
        "_index": "calendar_events",
        "_id": "fd7d24aa-d305-4bb5-8f0c-8857ee2dc5d7",
        "_score": 0,
        "_source": {
            "userId": "3220a87b-e81d-451f-ae59-a10b991ebe60",
            "organizer": "3220a87b-e81d-451f-ae59-a10b991ebe60",
            "title": "second event",
            "eventType": "events",
            "tenantName": "amura",
            "eventDate": "2024-08-30T16:30:00.000Z",
            "fromTime": "2024-08-30T16:30:00.000Z",
            "toDate": "2024-08-30T17:00:00.000Z",
            "toTime": "2024-08-30T17:00:00.000Z",
            "duration": 30,
            "timeZone": "indianStandardTime",
            "repeatType": "doesntRepeat",
            "reccurance": {},
            "tenantId": "amura",
            "notify": [
                "10 minutes before"
            ],
            "tenantParticipants": [
                {
                    "userId": "3220a87b-e81d-451f-ae59-a10b991ebe60",
                    "roleId": "L1 - Treating Doctor"
                }
            ],
            "externalParticipants": [],
            "isExcludeMeFromEvent": false,
            "visibility": "public",
            "status": "busy",
            "callType": "video",
            "others": "",
            "description": "",
            "permissons": [
                "None"
            ],
            "organizerRoleId": "L1 - Treating Doctor",
            "notifyTimeInMinutes": [
                10
            ],
            "createdOn": "2024-08-30T14:00:36.837Z",
            "parentId": "afb3a7fb-ab69-47dc-969b-79466f680d22",
            "eventId": "fd7d24aa-d305-4bb5-8f0c-8857ee2dc5d7",
            "updatedBy": "3220a87b-e81d-451f-ae59-a10b991ebe60",
            "rsvp": {},
            "acceptedParticipants": [],
            "notifyTimeStrings": [
                "2024-08-30T16:20:00.000Z"
            ]
        }
    },
    {
        "_index": "calendar_events",
        "_id": "6a51b78b-6181-4c75-908a-ee26dcb3249a",
        "_score": 0,
        "_source": {
            "eventId": "6a51b78b-6181-4c75-908a-ee26dcb3249a",
            "parentId": "c6382771-4fcc-4a5b-9bb3-954f29442a19",
            "organizer": "3220a87b-e81d-451f-ae59-a10b991ebe60",
            "title": "new event update",
            "eventType": "events",
            "tenantName": "amura",
            "eventDate": "2024-08-30T15:00:00.000Z",
            "fromTime": "2024-08-30T15:00:00.000Z",
            "toDate": "2024-08-30T15:30:00.000Z",
            "toTime": "2024-08-30T15:30:00.000Z",
            "duration": 30,
            "timeZone": "indianStandardTime",
            "repeatType": "doesntRepeat",
            "reccurance": {},
            "tenantId": "amura",
            "notify": [
                "10 minutes before"
            ],
            "tenantParticipants": [
                {
                    "userId": "3220a87b-e81d-451f-ae59-a10b991ebe60",
                    "roleId": "L1 - Treating Doctor"
                }
            ],
            "externalParticipants": [],
            "isExcludeMeFromEvent": false,
            "callType": "video",
            "description": "",
            "others": "",
            "visibility": "public",
            "status": "busy",
            "permissons": [
                "None"
            ],
            "organizerRoleId": "L1 - Treating Doctor",
            "action": {
                "thisEvent": true,
                "allEvents": false,
                "value": "update"
            },
            "notifyTimeInMinutes": [
                10
            ],
            "updatedBy": "823c0916-9e9d-4a9c-813f-ad2c09eac38b",
            "acceptedParticipants": [],
            "rsvp": {},
            "notifyTimeStrings": [
                "2024-08-30T14:50:00.000Z"
            ]
        }
    }
]
};

const getCalSyncConfigById = (id: number) => {
  return calSyncConfigs.find(config => config.id === id);
};




const mapElasticSearchDataToGoogleEvent = (eventData: any) => {
  const { title, fromTime, toTime, timeZone, externalParticipants, notifyTimeInMinutes } = eventData._source;

  return {
    summary: title,
    start: {
      dateTime: fromTime,
      timeZone: timeZone
    },
    end: {
      dateTime: toTime,
      timeZone: timeZone
    },
    attendees: externalParticipants.map((participant: any) => ({ email: participant.email })),
    reminders: {
      useDefault: false,
      overrides: notifyTimeInMinutes.map((minutes: number) => ({
        method: "popup",
        minutes
      }))
    }
  };
};

export const syncEventsForCalSyncConfig = async (configId: number) => {
  // Fetch the calendar sync config by ID
  const id = 1;
  console.log("configId"+configId)
  const config = getCalSyncConfigById(id);
  
  if (!config || !config.is_sync_enabled) {
    console.log("Sync is disabled for this calendar configuration.");
    return;
  }

  // Iterate over Elastic Search event data and map to Google events
  searchResponse.body.forEach(async (eventData) => {
    const eventToCreate = mapElasticSearchDataToGoogleEvent(eventData);

    // Define the request data structure as expected by createGoogleEvent
    const reqData: CreateGoogleEventData = {
      title: eventToCreate.summary,
      fromTime: eventToCreate.start.dateTime,
      toTime: eventToCreate.end.dateTime,
      timeZone: eventToCreate.start.timeZone,
      externalParticipants: [], // Map participants if needed
      notifyTimeInMinutes: eventToCreate.reminders.overrides.map((override: { method: string, minutes: number }) => override.minutes)
    };

    console.log("Creating event:", reqData);

    // Call createGoogleEvent with reqData and API key
    await createGoogleEvent(reqData, config.api_key);
  });
};




// Hypothetical placeholder for Microsoft event creation method
async function createMicrosoftCalendarEvents(req: Request, res: Response) {
  // Microsoft Calendar API integration logic goes here
  // This is a placeholder function, you would need to implement the Microsoft-specific API calls.
  console.log('Creating event in Microsoft Calendar...');
}



/*
const syncEventsForCalSyncConfigOrg = async (config: CalendarSyncConfig, esResponse: any) => {
  try {
      // Process each event from the ElasticSearch response
      await Promise.all(esResponse.body.map(async (eventData) => {
          const eventToSync = mapElasticSearchDataToGoogleEventOrg(eventData);
          const requestData = {
              title: eventToSync.summary,
              fromTime: eventToSync.start.dateTime,
              toTime: eventToSync.end.dateTime,
              timeZone: eventToSync.start.timeZone,
              externalParticipants: [], // Sync participants if needed
              notifyTimeInMinutes: eventToSync.reminders.overrides.map(override => override.minutes)
          };

          console.log("Syncing event:", requestData);

          // Call external API to sync event (e.g., Google Calendar API)
          await createGoogleEvent(requestData, config.api_key);
      }));
  } catch (error) {
      throw new Error("Event sync failed: " + error);
  }
};


// Example mapping function (adjust as per your needs)
const mapElasticSearchDataToGoogleEventOrg = (esEventData) => {
  return {
      summary: esEventData._source.title,
      start: {
          dateTime: esEventData._source.fromTime,
          timeZone: esEventData._source.timeZone
      },
      end: {
          dateTime: esEventData._source.toTime,
          timeZone: esEventData._source.timeZone
      },
      reminders: {
          useDefault: false,
          overrides: esEventData._source.notifyTimeInMinutes.map(minuteVal => ({
              method: 'popup',
              minutes: minuteVal
          }))
      }
  };
};




const microsoftTokenPath = path.join(__dirname, '..', 'microsoft_token.json');

// Sync Microsoft Calendar Events with Amura
export const syncMicrosoftCalendarEvents = async (req: Request, res: Response) => {
  try {
    const tokens = JSON.parse(fs.readFileSync(microsoftTokenPath, 'utf-8'));
    const accessToken = tokens.access_token;

    // Get Microsoft Calendar events
    const response = await axios.get('https://graph.microsoft.com/v1.0/me/events', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const events = response.data.value;
    const userId = fs.readFileSync(path.join(__dirname, '..', 'email.txt'), 'utf-8');

    // Sync each event to Amura
    for (const event of events) {
      const startDateTime = event.start.dateTime;
      const endDateTime = event.end.dateTime;

      const eventData = {
        userId,
        organizer: 'Microsoft Calendar',
        title: event.subject || 'No Title',
        eventType: 'events',
        timeZone: event.start.timeZone || 'UTC',
        tenantName: 'amura',
        eventDate: startDateTime,
        fromTime: startDateTime,
        toDate: endDateTime,
        toTime: endDateTime,
        duration: calculateDuration(startDateTime, endDateTime),
        repeatType: 'doesntRepeat',
        tenantId: 'amura',
        notify: [],
        tenantParticipants: [],
        externalParticipants: event.attendees?.map((attendee: any) => attendee.emailAddress.address) || [],
        isExcludeMeFromEvent: false,
        visibility: event.sensitivity || 'private',
        status: event.isCancelled ? 'cancelled' : 'confirmed',
        callType: 'video',
        others: '',
        description: event.bodyPreview || '',
        notifyTimeInMinutes: [10]
      };

      // Send the event data to Amura
      try {
        await axios.post(`${baseURL}/scheduler/event/createEvent`, eventData, {
          headers: {
            Authorization: `Bearer ${customApiToken}`,
            'Content-Type': 'application/json'
          }
        });
        console.log(`Microsoft Event "${eventData.title}" synced successfully.`);
      } catch (postError) {
        console.error(`Failed to sync Microsoft event "${eventData.title}":`, postError);
      }
    }

    res.send('Microsoft Calendar events synced successfully!');
  } catch (error) {
    console.error('Error syncing Microsoft events:', error);
    res.status(500).send('Error syncing Microsoft calendar events.');
  }}

// Function to create an event
export const createMicrosoftEvent = async (req: Request, res: Response) => {
  const { title, startTime, endTime, attendees } = req.body;

  try {
      const client = Client.initWithMiddleware({ authProvider });

      const event = {
          subject: title,
          start: {
              dateTime: startTime,
              timeZone: 'UTC', // Adjust as needed
          },
          end: {
              dateTime: endTime,
              timeZone: 'UTC',
          },
          attendees: attendees.map(email => ({
              emailAddress: { address: email },
              type: 'required',
          })),
      };

      const createdEvent = await client.api('/me/events').post(event);
      res.status(201).json(createdEvent);
  } catch (error) {
      console.error('Error creating event:', error);
      res.status(500).json({ error: error.message });
  }
};

*/