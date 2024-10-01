import { google } from 'googleapis';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { calculateDuration } from './utils/utils'; // Correct relative path
import { calendar_v3 } from 'googleapis';

// Google Calendar API setup
const credentials = JSON.parse(process.env.CREDENTIALS ?? '{}'); // Ensure fallback if undefined
const oAuth2Client = new google.auth.OAuth2(
  credentials.web?.client_id ?? '', // Fallback if undefined
  credentials.web?.client_secret ?? '', // Fallback if undefined
  credentials.web?.redirect_uris?.[0] ?? '' // Fallback if undefined
);

const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
const customApiToken = process.env.CUSTOM_API_TOKEN ?? ''; // Ensure fallback
const baseURL = 'https://qa-events.amurahealth.com:3000';

// Authenticate with token
async function authenticate() {
  const token = JSON.parse(process.env.TOKEN ?? '{}'); // Fallback to empty object if undefined
  if (token) {
    oAuth2Client.setCredentials(token);
  } else {
    throw new Error('Token not found. Please authenticate.');
  }
}

// Get Google Calendar events
async function getGoogleCalendarEvents(): Promise<calendar_v3.Schema$Event[]> {
  await authenticate();
  const response = await calendar.events.list({
    calendarId: 'primary',
    maxResults: 10, // Adjust the number of events
    singleEvents: true,
    orderBy: 'startTime',
  });
  return response.data.items ?? []; // Ensure fallback to empty array
}

// Create an event in Amura
async function createAmuraEvent(event: calendar_v3.Schema$Event) {

    const startDateTime =
    event.start?.dateTime || event.start?.date || new Date().toISOString();
  const endDateTime =
    event.end?.dateTime || event.end?.date || new Date().toISOString();
  const eventData = {
    userId: 'nbitspace01@gmail.com',  // Replace with dynamic email if needed
    organizer: 'Google Calendar',
    title: event.summary ?? 'No Title',
    eventType: 'events',
    tenantName: 'amura',
    eventDate: event.start?.dateTime ?? event.start?.date ?? '',  // Use fallback if undefined
    fromTime: event.start?.dateTime ?? event.start?.date ?? '',   // Use fallback if undefined
    toDate: event.end?.dateTime ?? event.end?.date ?? '',         // Use fallback if undefined
    toTime: event.end?.dateTime ?? event.end?.date ?? '',         // Use fallback if undefined
    duration: calculateDuration(startDateTime, endDateTime),
    repeatType: 'doesntRepeat',
    tenantId: 'amura',
    notify: [],
    tenantParticipants: [],
    externalParticipants: event.attendees?.map(attendee => attendee.email) ?? [], // Use fallback to empty array
    isExcludeMeFromEvent: false,
    visibility: event.visibility ?? 'private',  // Use fallback
    status: event.status ?? 'confirmed',        // Use fallback
    callType: 'video',
    description: event.description ?? '',       // Use fallback
    organizerRoleId: '',
    notifyTimeInMinutes: [10]
  };

  return axios.post(`${baseURL}/scheduler/event/createEvent`, eventData, {
    headers: {
      Authorization: `Bearer ${customApiToken}`,
      'Content-Type': 'application/json',
    },
  });
}

// Sync Google Calendar events to Amura
exports.handler = async (event: any, context: any) => {  // Define `any` for `event` and `context` for Lambda signature
  try {
    const googleEvents = await getGoogleCalendarEvents();
    for (const googleEvent of googleEvents) {
      await createAmuraEvent(googleEvent);
    }
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Events synced successfully.' }),
    };
  } catch (error) {
    console.error('Error syncing events:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error syncing events.', error: error}),
    };
  }
};
