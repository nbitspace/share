import bodyParser from 'body-parser';
import express from 'express';
import fs from 'fs';
import { google } from 'googleapis';
import http from 'http';
import path from 'path';
import { Server } from 'socket.io';
import calendarRouter from './routes/calendarRoutes';

import {
  processWebhookEvent,
  syncOldGoogleCalendarEvents,
  watchGoogleCalendar
} from './controllers/calendarController';
import swaggerDocs from './utils/swagger';

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(bodyParser.json());

// Set up OAuth 2.0 client using environment variables
const oAuth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URI_4
);

// Example of reading the token
const tokenPath = path.join(__dirname, '..', 'token.json');

// Utility function to authenticate using stored tokens
async function authenticate() {
  if (fs.existsSync(tokenPath)) {
    const token = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
    oAuth2Client.setCredentials(token);
  } else {
    throw new Error('Token not found. Please authenticate via /auth');
  }
}

// Route to initiate Google OAuth flow
app.get('/auth', (req, res) => {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar'],
    // Make sure this matches one of your authorized redirect URIs
    redirect_uri: process.env.REDIRECT_URI_4
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
      fs.writeFileSync(
        path.join(__dirname, '..', 'token.json'),
        JSON.stringify(tokens)
      );
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
    const tokens = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', 'token.json'), 'utf-8')
    );
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
    const tokens = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../token.json'), 'utf-8')
    );
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
app.use('/calendar', calendarRouter);

// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  swaggerDocs(app, 8080);
});
