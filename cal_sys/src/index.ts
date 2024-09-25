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
import { watchGoogleCalendar, syncOldGoogleCalendarEvents, processWebhookEvent, createEvent, getEvents ,syncEventsForCalSyncConfig} from './controllers/calendarController';
import { checkAndRefreshToken, refreshTokenScheduler } from './tokenManager';
import axios from 'axios';
// const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(bodyParser.json());
setupSwagger(app);

const oAuth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URI_4
);



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
app.get('/auth', (req, res) => {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/calendar',      // Existing scope for Calendar API
      'https://www.googleapis.com/auth/userinfo.profile', // Scope for user profile info
      'https://www.googleapis.com/auth/userinfo.email'   // Scope for user email info
    ],
    redirect_uri: process.env.REDIRECT_URI_4
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
 */app.get('/', async (req, res) => {
  const code = req.query.code as string | undefined;
  if (code) {
    try {
      const { tokens } = await oAuth2Client.getToken(code);
      oAuth2Client.setCredentials(tokens);

      // Save tokens to a file
      fs.writeFileSync(path.join(__dirname, '..', 'token.json'), JSON.stringify(tokens));

      // Set the OAuth 2.0 client credentials
      oAuth2Client.setCredentials({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: tokens.expiry_date,
      });

      // Fetch the user's profile
      const oauth2 = google.oauth2({ auth: oAuth2Client, version: 'v2' });
      const userInfo = await oauth2.userinfo.get();

      // Optionally, save the user's email for later use
      const email = userInfo.data.email || 'unknown';
      fs.writeFileSync(path.join(__dirname, '..', 'email.txt'), email);

      res.send('Authentication successful! You can close this tab.');
    } catch (error) {
      console.error('Error during OAuth callback:', error);
      res.status(500).send('Authentication failed.');
    }
  } else {
    res.status(400).send('No code found in query parameters');
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
app.get('/webhookcall', async (req, res) => {
  try {
    const tokens = JSON.parse(fs.readFileSync(path.join(__dirname, '../token.json'), 'utf-8'));
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
app.use('/calendar', checkAndRefreshToken, calendarRouter);
app.use('/calendar', express.static(path.join(__dirname, '../../public')));
app.post('/webhook', processWebhookEvent);
app.use('/calendar', calendarRouter);
app.use('/syscal_config',syncEventsForCalSyncConfig)



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

*/