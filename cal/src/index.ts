// src/index.ts
import { google, calendar_v3 } from 'googleapis';
import axios from 'axios';
import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import fs from 'fs';
import path from 'path';
import { OAuth2Client } from 'google-auth-library';

// Your custom calendar API URL
const MY_CALENDAR_API_URL = 'https://mycalendarapi.com';
const MY_CALENDAR_API_KEY = 'your_api_key';

// Google Calendar setup
const SCOPES = ['https://www.googleapis.com/auth/calendar'];
const TOKEN_PATH = path.join(__dirname, 'token.json');
const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');

// Initialize Express
const app = express();
app.use(bodyParser.json());

async function authorize(): Promise<OAuth2Client> {
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
  const { client_secret, client_id, redirect_uris } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  if (fs.existsSync(TOKEN_PATH)) {
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
    oAuth2Client.setCredentials(token);
  } else {
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
    });
    console.log('Authorize this app by visiting this url:', authUrl);
    throw new Error('Token not found. Please authorize the app.');
  }

  return oAuth2Client;
}

async function syncGoogleToMyCalendar(auth: OAuth2Client) {
  const calendar = google.calendar({ version: 'v3', auth });

  const events = await calendar.events.list({
    calendarId: 'primary',
    timeMin: new Date().toISOString(),
    maxResults: 10,
    singleEvents: true,
    orderBy: 'startTime',
  });

  const googleEvents = events.data.items || [];

  for (const event of googleEvents) {
    // Sync each event to your custom calendar
    await axios.post(
      `${MY_CALENDAR_API_URL}/events`,
      {
        title: event.summary,
        start: event.start?.dateTime || event.start?.date,
        end: event.end?.dateTime || event.end?.date,
        description: event.description,
      },
      {
        headers: {
          'Authorization': `Bearer ${MY_CALENDAR_API_KEY}`,
        },
      }
    );
  }
}

async function syncMyCalendarToGoogle(auth: OAuth2Client) {
  const calendar = google.calendar({ version: 'v3', auth });

  const myEventsResponse = await axios.get(`${MY_CALENDAR_API_URL}/events`, {
    headers: {
      'Authorization': `Bearer ${MY_CALENDAR_API_KEY}`,
    },
  });

  const myEvents = myEventsResponse.data;

  for (const event of myEvents) {
    await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: event.title,
        description: event.description,
        start: {
          dateTime: event.start,
        },
        end: {
          dateTime: event.end,
        },
      },
    });
  }
}

app.get('/sync', async (req, res) => {
  try {
    const auth = await authorize();
    await syncGoogleToMyCalendar(auth);
    await syncMyCalendarToGoogle(auth);
    res.send('Sync completed successfully!');
  } catch (error) {
    console.error('Error during sync:', error);
    res.status(500).send('An error occurred during sync.');
  }
});

app.get('/settings/calendar/sync/google', async (req: Request, res : Response) => {

});

app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});
