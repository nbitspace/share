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
import { watchGoogleCalendar, syncOldGoogleCalendarEvents, processWebhookEvent, createEvent, getEvents } from './controllers/calendarController';

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(bodyParser.json());
setupSwagger(app);

// Set up OAuth 2.0 client using environment variables
const oAuth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URI_4
);

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
    scope: ['https://www.googleapis.com/auth/calendar'],
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
 */
app.get('/', async (req, res) => {
  const code = req.query.code as string | undefined;
  if (code) {
    try {
      const response = await oAuth2Client.getToken(code);
      const tokens = response.tokens;
      oAuth2Client.setCredentials(tokens);
      fs.writeFileSync(path.join(__dirname, '..', 'token.json'), JSON.stringify(tokens));
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
    await syncOldGoogleCalendarEvents('nbitspace01@gmail.com');
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
app.use('/calendar', express.static(path.join(__dirname, '../../public')));
app.post('/webhook', processWebhookEvent);
app.use('/calendar', calendarRouter);




// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});