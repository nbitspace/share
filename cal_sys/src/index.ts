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
import {authenticateTokenfromDb,syncEventsForCalSyncAndUpdateData,syncEventsForCalSyncAndDeleteData,syncEventsForCalSyncAndPostData,  getEventDetails,handleOAuthCallback, syncOldGoogleCalendarEvents, processWebhookEvent, createEvent, getEvents ,syncEventsForCalSyncConfig,} from './controllers/calendarController';
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
    redirect_uri:  process.env.WEB_APP_BASE_URL + "/callback/oauth-google/" //TODO add userId to the url
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
 */app.get('/callback/oauth-google', async (req, res) => {//TODO add  ${userid} & /callback/oauth-google/user/
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
    const calendarSyncSettings = await getCalendarSyncSettingsFromAPI(sort_key);

    if (!calendarSyncSettings || calendarSyncSettings.length === 0) {
      return res.status(404).send('Calendar sync settings not found');
    }

    // Check if any sort_key in the settings matches the incoming token
    const validSetting = calendarSyncSettings.find((setting: any) => setting.sort_key === token);

    if (!validSetting) {
      return res.status(403).send('Invalid token');
    }

    console.log(`Received notification for resource ID: ${resourceId}`);
    console.log(`Event ID: ${eventID}`);

    // Ensure eventID is a string before using it
    if (typeof eventID === 'string') {
      const { full_token } = validSetting.item;

      const parsedToken = JSON.parse(full_token);
  
      // Set the credentials to the OAuth2 client using the full token
      oAuth2Client.setCredentials(parsedToken);
  
      // Fetch user's profile using the OAuth2 client with the full token
      const oauth2 = google.oauth2({ auth: oAuth2Client, version: 'v2' });
  
      const eventDetails = await getEventDetails(eventID,full_token);
      console.log('Event Details:', eventDetails);



      // Determine if it's an update or delete operation
      const actionType = req.headers['x-goog-resource-state']; // Could be 'exists' for update, 'deleted' for deletion

      if (actionType === 'deleted') {
        // Handle DELETE
        const inputEventData = eventDetails;  // Pass the event details to the delete function
        await syncEventsForCalSyncAndDeleteData({
          body: {
            configs: calendarSyncSettings,
            inputEventData, // Event details for deletion
          },
        }, res); // Pass the response object
      } else if (actionType === 'exists') {
        // Handle UPDATE
        const inputEventData = eventDetails;  // Pass the event details to the update function
        await syncEventsForCalSyncAndUpdateData({
          body: {
            configs: calendarSyncSettings,
            inputEventData, // Event details for updating
          },
        }, res); // Pass the response object
      } else {
        // Default to creation if not identified as an update or delete
        const inputEventData = eventDetails;
        await syncEventsForCalSyncAndPostData({
          body: {
            configs: calendarSyncSettings,
            inputEventData, // Event details for creation
          },
        }, res); // Pass the response object
      }
      return res.status(200).send('Notification received and processed'); // Send success response
    } else {
      return res.status(400).send('Invalid event ID format'); // Handle invalid event ID
    }

  } catch (error) {
    console.error('Error processing webhook:', error);
    return res.status(500).send('Error processing webhook'); // Send error response
  }
});


// Function to get calendar sync settings from external API by sort_key
const getCalendarSyncSettingsFromAPI = async (sort_key: string): Promise<CalendarSyncResponse[]> => {
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

app.post('/google-calendar-webhook', async (req: Request, res: Response) => {// dont need this api
  try {
    const webhookPayload = req.body;
    const { eventId, calendarId, resourceState } = webhookPayload;

    if (resourceState === 'deleted') {
      const eventDetails = await fetchGoogleCalendarEventDetails(calendarId, eventId);
      // const deletePayload = mapDeleteEventPayload(eventDetails);
      // const deleteEventResponse = await axios.post('http://localhost:3000/scheduler/event/updateEvent', deletePayload);
      // return res.status(200).json({ message: 'Event deleted', deleteEventResponse: deleteEventResponse.data });
    } else if (resourceState === 'exists') {
      // Handle updates or new events
      const eventDetails = await fetchGoogleCalendarEventDetails(calendarId, eventId);
      const updatePayload = mapEventDetailsToPayload(eventDetails);
      const updateEventResponse = await axios.post('http://localhost:3000/scheduler/event/updateEvent', updatePayload);
      return res.status(200).json({ message: 'Event updated', updateEventResponse: updateEventResponse.data });
    } else {
      return res.status(400).json({ message: 'Unsupported resource state' });
    }

  } catch (error) {
    console.error('Error in Google Calendar webhook handler:', error);
    return res.status(500).json({ message: 'Internal server error', error });
  }
});



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

// Helper function to get calendar sync settings by pms_cal_id
const getCalendarSyncSettingsBypmsCalId = async (pms_cal_id: string) => {
  try {
    // Make the API call to the backend using axios
    const response = await axios.get(`http://localhost:3000/scheduler/event/getSyncSettingsByCalId/${pms_cal_id}`);
    
    // Ensure the response status is 200 and the data is an array before returning
    if (response.status === 200 && Array.isArray(response.data)) {
      return response.data;  // Return the array of sync settings
    } else {
      throw new Error('Failed to fetch calendar sync settings by pms_cal_id');
    }
  } catch (error) {
    console.error("Error fetching sync settings by pms_cal_id:", error);
    throw error;
  }
};
// Helper function to soft delete calendar sync settings by pms_cal_id
const deleteCalendarSyncSettingsBypmsCalId = async (pms_cal_id: string) => {
  try {
    // Make the API call to the backend using axios
    const response = await axios.post(`http://localhost:3000/scheduler/event/deleteSyncSettingsByCalId/${pms_cal_id}`);
    
    if (response.status === 200) {
      return response.data;  // Return success message
    } else {
      throw new Error('Failed to soft delete calendar sync settings by pms_cal_id');
    }
  } catch (error) {
    console.error("Error soft deleting sync settings by pms_cal_id:", error);
    throw error;
  }
};

// Serve static files (if needed)
app.use('/calendar', checkAndRefreshToken, calendarRouter);
app.use('/calendar', express.static(path.join(__dirname, '../../public')));
app.post('/webhook', processWebhookEvent);
app.use('/calendar', calendarRouter);
app.use('/syscal_config',syncEventsForCalSyncConfig)

app.post('/calltestfunc', handleLambdaEvents);
app.put('/calltestupdate', handleLambdaUpdateEvent);
app.get('/getCalendar', getCalendarSyncSettingsBypmsCalId);
app.put('/getCalendar', deleteCalendarSyncSettingsBypmsCalId);



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