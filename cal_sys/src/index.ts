import express from 'express'; 
import bodyParser from 'body-parser';
import path from 'path';
import fs from 'fs';
import { google } from 'googleapis';
import http from 'http';
import { Server } from 'socket.io';
import Imap from 'imap-simple';
import { simpleParser } from 'mailparser';
import nodemailer from 'nodemailer';
import calendarRouter from './routes/calendarRoutes';
import { setupSwagger } from './swaggerConfig';
import { getEventDetails,handleOAuthCallback, syncOldGoogleCalendarEvents, processWebhookEvent, createEvent, getEvents ,syncEventsForCalSyncConfig,} from './controllers/calendarController';
import { checkAndRefreshToken, refreshTokenScheduler } from './tokenManager';
import axios from 'axios';
import { AxiosResponse } from 'axios';
import {handleLambdaUpdateEvent} from './handleLambdaUpdateEvent'
import { handleLambdaEvents } from "./handleLambdaEvents"
import { Request, Response } from 'express';

// const mongoose = require('mongoose');
// Define the interface for the response
interface CalendarSyncResponse {
  status: number;
  message: string;
  item: {
    part_key: string;
    sort_key: string;
    id: number;
    pms_cal_id: string;
    email: string;
    cal_type: string;
    token_type: string;
    full_token: string;  // Full token serialized as a JSON string
    is_sync_enabled: boolean;
    last_sync_time: string;
  };
}

interface CalendarSyncSetting {
  sort_key: string; // Ensure this matches the actual property names in your data
  temp_api_key: string; // Assuming you have this field to check against token
  // Add any other properties that you expect in the setting
}

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(bodyParser.json());
setupSwagger(app);
const oAuth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.WEB_APP_BASE_URL + "/callback/oauth-google/user"
);

//update , delete both side 

/*
async function getUserEmail() {
  const oauth2 = google.oauth2({ version: 'v2', auth: oAuth2Client });
  const response = await oauth2.userinfo.get();
  return response.data.email;
}*/
// Example of reading the token
const tokenPath = path.join(__dirname, '..', 'token.json');

/**
 * @swagger
 * /auth:
 *   get:
 *     summary: Initiate Google OAuth flow
 *     description: Redirects the user to Google's OAuth 2.0 consent screen to authorize the app.
 *     responses:
 *       302:
 *         description: Redirect to Google OAuth.
 */
app.get('/calender/auth-google', (req, res) => {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/calendar',      // Existing scope for Calendar API
      'https://www.googleapis.com/auth/userinfo.profile', // Scope for user profile info
      'https://www.googleapis.com/auth/userinfo.email'   // Scope for user email info
    ],
    redirect_uri:  process.env.WEB_APP_BASE_URL + "/callback/oauth-google/user" //TODO add userId to the url
  });
  

  res.redirect(authUrl);
});

/**
 * @swagger
 * /:
 *   get:
 *     summary: Handle Google OAuth2 callback
 *     description: After the user authorizes the app, Google redirects to this route with an authorization code.
 *     parameters:
 *       - in: query
 *         name: code
 *         schema:
 *           type: string
 *         required: true
 *         description: Google OAuth2 authorization code.
 *     responses:
 *       200:
 *         description: Successful authentication
 *       400:
 *         description: Code not found in query parameters
 *       500:
 *         description: Authentication failed
 */app.get('/callback/oauth-google/user', async (req, res) => {//TODO add  ${userid} & /callback/oauth-google/user/
  const code = req.query.code as string | undefined;

  if (code) {
    try {
      const { tokens } = await oAuth2Client.getToken(code);
      oAuth2Client.setCredentials(tokens);

      // Save tokens to a file
      fs.writeFileSync(path.join(__dirname, '..', 'token.json'), JSON.stringify(tokens));

      // Fetch the user's profile
      const oauth2 = google.oauth2({ auth: oAuth2Client, version: 'v2' });
      const userInfo = await oauth2.userinfo.get();
      const email = userInfo.data.email || 'unknown';
      const calendarData = {
        userId: "859deb6d-3efa-4e5b-8d52-fbaba74832dd",
        pms_cal_id: 'amura-calendar-1',
        email: email,
        cal_type: 'Google Calendar',
        token_type: "OAuth2",
        full_token: JSON.stringify(tokens),  
       //api_key: tokens.access_token, // tokens 
       //temp_api_key: tokens.refresh_token,// is null
       //expiry_time_key: tokens.expiry_date,
        is_sync_enabled: true,
        last_sync_time: new Date().toISOString(),
      };

      //TODO call method SchedulerController.saveCalendarSyncSettings inside the calling api 
      // Make a POST request to save the calendar sync settings
      const response: AxiosResponse<CalendarSyncResponse> = await axios.post(
        'http://localhost:3000/scheduler/event/syncSettings',
        calendarData,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.CUSTOM_API_TOKEN}`,
          },
        }
      );
    //TODO handleOAuthCallback(code as string, res); Call subcription code

      // Send response based on the result of the POST request
      if (response.status === 200) {
        res.send('Authentication successful and calendar sync settings saved! You can close this tab.');
        await handleOAuthCallback(response.data, code, res);
      } else {
        res.status(response.status).send('Failed to save calendar sync settings.');
      }
    } catch (error) {
      console.error('Error during OAuth callback:', error);
      res.status(500).send('Authentication failed.');
    }
  } else {
    res.status(400).send('Code not found in query parameters');
  }
});


/**
 * @swagger
 * /sync:
 *   get:
 *     summary: Synchronize old Google Calendar events
 *     description: Synchronizes old events from the Google Calendar.
 *     responses:
 *       200:
 *         description: Synchronization completed
 *       500:
 *         description: Error syncing events
 */
app.get('/sync', async (req, res) => {
  try {
    const tokens = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'token.json'), 'utf-8'));
    oAuth2Client.setCredentials(tokens);

      // Read the email from the saved file
      const email = fs.readFileSync(path.join(__dirname, '..', 'email.txt'), 'utf-8');

      // Use the email here
      await syncOldGoogleCalendarEvents(email);
    res.send('Synchronization completed!');
  } catch (error) {
    console.error('Error syncing old events:', error);
    res.status(500).send('Error syncing events.');
  }
});

/**
 * @swagger
 * /webhookcall:
 *   get:
 *     summary: Setup Google Calendar webhook
 *     description: Starts watching the Google Calendar for changes.
 *     responses:
 *       200:
 *         description: Calendar watch started
 *       500:
 *         description: Error syncing events
 */

// Webhook endpoint to handle Google Calendar notifications
app.post('/webhook/calendar/oauth-google', async (req, res) => {
  const resourceId = req.headers['x-goog-resource-id'];
  const channelId = req.headers['x-goog-channel-id'] as string | undefined;
  const token = req.headers['x-goog-channel-token'] as string | undefined;
  const eventID = req.headers['x-goog-event-id'];

  // Check if channelId exists
  if (!channelId) {
    return res.status(400).send('Missing channelId');
  }

  // Separate part_key and sort_key
  const indexOfSortKey = channelId.indexOf('CALENDAR#');
  if (indexOfSortKey === -1) {
    return res.status(400).send('Invalid channelId format');
  }

  const part_key = channelId.slice(0, indexOfSortKey);  // Extract part_key
  const sort_key = channelId.slice(indexOfSortKey);     // Extract sort_key

  // Fetch the data from the API using the sort_key
  try {
    const calendarSyncSettings: CalendarSyncSetting[] = await getCalendarSyncSettingsFromAPI(sort_key);

    if (!calendarSyncSettings || calendarSyncSettings.length === 0) {
      return res.status(404).send('Calendar sync settings not found');
    }

    // Check if any sort_key in the settings matches the incoming token
    const validSetting = calendarSyncSettings.find((setting: CalendarSyncSetting) => setting.sort_key === token);

    if (!validSetting) {
      return res.status(403).send('Invalid token');
    }

    console.log(`Received notification for resource ID: ${resourceId}`);
    console.log(`Event ID: ${eventID}`);

    // Ensure eventID is a string before using it
    if (typeof eventID === 'string') {
      const eventDetails = await getEventDetails(eventID);
      console.log('Event Details:', eventDetails);
    }

    // Send back a success response
    res.status(200).send('Notification received');
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).send('Error processing webhook');
  }
});

// Function to get calendar sync settings from external API by sort_key
const getCalendarSyncSettingsFromAPI = async (sort_key: string): Promise<CalendarSyncSetting[]> => {
  try {
    const response = await axios.get(
      `http://localhost:3000/scheduler/event/getSyncSettings/${sort_key}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.CUSTOM_API_TOKEN}`,  
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.status === 200) {
      return response.data;
    } else {
      console.error('Failed to fetch calendar sync settings:', response.statusText);
      return []
    }
  } catch (error) {
    console.error('Error fetching calendar sync settings:', error);
    throw error;
  }
};

// Webhook handler for Google Calendar updates
app.post('/google-calendar-webhook', async (req: Request, res: Response) => {//TODO change api 
  try {
    const webhookPayload = req.body;

    // Extract the relevant eventId and calendarId from the webhook notification
    const { eventId, calendarId } = webhookPayload;
    //TODO eventType == update
    // Fetch full event details from Google Calendar
    const eventDetails = await fetchGoogleCalendarEventDetails(calendarId, eventId);

    if (!eventDetails) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Process the full event data and prepare the payload
    const payload = mapEventDetailsToPayload(eventDetails);

    // Send the payload to your updateEvent API
    const updateEventResponse = await axios.post('http://localhost:3000/scheduler/event/updateEvent', payload);

    // Send success response
    return res.status(200).json({ message: 'Event data processed and forwarded', updateEventResponse: updateEventResponse.data });

  } catch (error) {
    console.error('Error in Google Calendar webhook handler:', error);
    return res.status(500).json({ message: 'Internal server error', error: error });
  }
});

// Function to fetch full event details from Google Calendar API
const fetchGoogleCalendarEventDetails = async (calendarId: string, eventId: string) => {
  try {
    const response = await axios.get(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${eventId}`,
      {
        headers: {
          Authorization: `Bearer YOUR_ACCESS_TOKEN`, // Use the valid OAuth token
        },
      }
    );
    return response.data; // Return the full event details
  } catch (error) {
    console.error('Error fetching event details:', error);
    return null;
  }
};

// Utility function to map Google Calendar event data to your payload
const mapEventDetailsToPayload = (googleEvent: any) => {
  return {
    eventId: googleEvent.id,
    parentId: googleEvent.recurringEventId || '',
    organizer: googleEvent.organizer.email,
    title: googleEvent.summary || 'No title',
    eventType: 'events',
    tenantName: 'amura',
    eventDate: googleEvent.start.dateTime || googleEvent.start.date,
    fromTime: googleEvent.start.dateTime || googleEvent.start.date,
    toDate: googleEvent.end.dateTime || googleEvent.end.date,
    toTime: googleEvent.end.dateTime || googleEvent.end.date,
    duration: calculateDuration(googleEvent.start, googleEvent.end),
    timeZone: googleEvent.start.timeZone || 'indianStandardTime',
    repeatType: googleEvent.recurrence ? 'recurring' : 'doesntRepeat',
    reccurance: googleEvent.recurrence || {},
    tenantId: 'amura',
    notify: ['10 minutes before'],
    tenantParticipants: [
      {
        userId: googleEvent.organizer.email,
        roleId: 'L1 - Treating Doctor',
      },
    ],
    externalParticipants: googleEvent.attendees?.map((attendee: any) => ({
      userId: attendee.email,
      roleId: 'Participant',
    })) || [],
    isExcludeMeFromEvent: false,
    callType: googleEvent.conferenceData ? 'video' : 'none',
    description: googleEvent.description || '',
    others: '',
    visibility: googleEvent.visibility || 'public',
    status: googleEvent.status || 'busy',
    permissons: ['None'],
    organizerRoleId: 'L1 - Treating Doctor',
    action: {
      thisEvent: true,
      allEvents: false,
      value: 'update',
    },
    notifyTimeInMinutes: [10],
  };
};

// Utility function to calculate event duration
const calculateDuration = (start: any, end: any) => {
  const startTime = new Date(start.dateTime || start.date).getTime();
  const endTime = new Date(end.dateTime || end.date).getTime();
  return (endTime - startTime) / 60000; // Convert milliseconds to minutes
};


// Serve static files (if needed)
app.use('/calendar', checkAndRefreshToken, calendarRouter);
app.use('/calendar', express.static(path.join(__dirname, '../../public')));
app.post('/webhook', processWebhookEvent);
app.use('/calendar', calendarRouter);
app.use('/syscal_config',syncEventsForCalSyncConfig)

app.post('/calltestfunc', handleLambdaEvents);
app.post('/calltestupdate', handleLambdaUpdateEvent);



// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
/*


// Microsoft OAuth Login Route
app.get('/auth/microsoft', (req, res) => {
  const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${process.env.MICROSOFT_CLIENT_ID}&response_type=code&redirect_uri=${process.env.MICROSOFT_REDIRECT_URI}&response_mode=query&scope=offline_access%20Calendars.ReadWrite%20User.Read`;
  res.redirect(authUrl);
});

// Microsoft OAuth Callback Route
app.get('/auth/microsoft/callback', async (req, res) => {
  const code = req.query.code;
  const tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

  try {
    const tokenResponse = await axios.post(tokenUrl, null, {
      params: {
        client_id: process.env.MICROSOFT_CLIENT_ID,
        scope: 'offline_access Calendars.ReadWrite User.Read',
        code,
        redirect_uri: process.env.MICROSOFT_REDIRECT_URI,
        grant_type: 'authorization_code',
        client_secret: process.env.MICROSOFT_CLIENT_SECRET,
      },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const tokens = tokenResponse.data;
    fs.writeFileSync(path.join(__dirname, '..', 'microsoft_token.json'), JSON.stringify(tokens));

    res.send('Microsoft Authentication Successful. You can close this tab.');
  } catch (error) {
    console.error('Error during Microsoft OAuth callback:', error);
    res.status(500).send('Authentication with Microsoft failed.');
  }
});

app.post('/webhook/calendar/oauth-google', (req, res) => {
  const resourceId = req.headers['x-goog-resource-id'];
  const channelId = req.headers['x-goog-channel-id'];
  const token = req.headers['x-goog-channel-token'];
  const eventID = req.headers['x-goog-event-id'];
  console.log(eventID)
  // Check if channelId exists
  if (!channelId) {
  return res.status(400).send('Missing channelId');
  }

  // Separate part_key and sort_key
  const indexOfSortKey = channelId.indexOf('CALENDAR#');
  if (indexOfSortKey === -1) {
    return res.status(400).send('Invalid channelId format');
  }
  if (typeof eventID === 'string') {
    // Call getEventDetails with await inside async function
    const eventDetails =  getEventDetails(eventID);
    console.log(eventDetails);
  } else {
    return res.status(400).send('Invalid or missing event ID');
  }


  //TODO parse channelId & get cal config data from Db 
  //TODO Verify the token 
  if (false) {
      return res.status(403).send('Invalid token');
  }

  console.log(`Received notification for resource ID: ${resourceId}`);
  // Further processing...
  //TODO GetEventdataByEventId
  //TODO createEvent in amura 
  res.status(200).send('Notification received');
});
*/