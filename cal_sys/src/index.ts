import express from 'express';
import bodyParser from 'body-parser';
import path from 'path';
import fs from 'fs';
import { google } from 'googleapis';


import { watchGoogleCalendar, syncOldGoogleCalendarEvents, processWebhookEvent, createEvent, getEvents } from './controllers/calendarController';

let isSyncBoolean: boolean = false;
let oldSyncBoolean: boolean = false;
const app = express();
app.use(bodyParser.json());

// Load OAuth 2.0 credentials
const credentials = {
  web: {
    client_id: '27988681367-s11eg058duue72oveo0lkjj4v8af6vjh.apps.googleusercontent.com',
    project_id: 'aaga-connect',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_secret: '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',
    redirect_uris: [
      'https://webhook.site/1d9dbeb5-9b44-48ee-834b-3cd44202c8ab',
      'http://localhost',
      'http://localhost:8080'
    ],
    javascript_origins: [
      'https://webhook.site',
      'http://localhost',
      'http://localhost:8080'
    ]
  }
};


const oAuth2Client = new google.auth.OAuth2(
  credentials.web.client_id,
  credentials.web.client_secret,
  credentials.web.redirect_uris[2] // Use the first redirect URI
);

// Route to initiate Google OAuth flow
app.get('/auth', (req, res) => {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar'],
    // Make sure this matches one of your authorized redirect URIs
    redirect_uri: 'http://localhost:8080',
  });

  res.redirect(authUrl);
});


// OAuth2 callback to handle Google's response
app.get('/', async (req, res) => {
  const code = req.query.code as string | undefined;
  if (code) {
    try {
      const response = await oAuth2Client.getToken(code);
      const tokens = response.tokens;
      oAuth2Client.setCredentials(tokens);
      fs.writeFileSync(path.join(__dirname, '../token.json'), JSON.stringify(tokens));
      res.send('Authentication successful! You can close this tab.');
    } catch (error) {
      console.error('Error during OAuth callback:', error);
      res.status(500).send('Authentication failed.');
    }
  } else {
    res.status(400).send('No code found in query parameters');
  }
});

// Example endpoint to synchronize old calendar events
app.get('/sync', async (req, res) => {
  try {
    const tokens = JSON.parse(fs.readFileSync(path.join(__dirname, '../../token.json'), 'utf-8'));
    oAuth2Client.setCredentials(tokens);
    await syncOldGoogleCalendarEvents('nbitspace01@gmail.com');
    res.send('Synchronization completed!');
  } catch (error) {
    console.error('Error syncing old events:', error);
    res.status(500).send('Error syncing events.');
  }
});

app.get('/webhookcall', async (req, res) => {
  try {
    const tokens = JSON.parse(fs.readFileSync(path.join(__dirname, '../../token.json'), 'utf-8'));
    oAuth2Client.setCredentials(tokens);
    
    // Pass the request and response objects to watchGoogleCalendar
    await watchGoogleCalendar(req, res);
    
    // No need to send another response, as watchGoogleCalendar already sends one
  } catch (error) {
    console.error('Error syncing old events:', error);
    res.status(500).send('Error syncing events.');
  }
});
// Serve static files (if needed)
app.use('/calendar', express.static(path.join(__dirname, '../../public')));
app.post('/webhook', processWebhookEvent);


// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});