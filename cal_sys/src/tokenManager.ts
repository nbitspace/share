import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { Request, Response, NextFunction } from 'express';

const tokenPath = path.join(__dirname, '..', 'token.json');

// Set up OAuth 2.0 client
const oAuth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URI_4
);

// Middleware to check and refresh the token if expired
export const checkAndRefreshToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Load the saved tokens
    const tokens = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));

    // Set the tokens to the OAuth2 client
    oAuth2Client.setCredentials(tokens);

    // Check if the token is expired
    const now = Date.now();
    const tokenExpiryTime = tokens.expiry_date || 0;

    if (now >= tokenExpiryTime) {
      // If the token is expired, refresh the token
      const newTokens = await oAuth2Client.refreshAccessToken();
      oAuth2Client.setCredentials(newTokens.credentials);

      // Save the new tokens
      fs.writeFileSync(tokenPath, JSON.stringify(newTokens.credentials));

      console.log('Access token refreshed successfully!');
    }

    // Proceed with the request
    next();
  } catch (error) {
    console.error('Error refreshing token:', error);
    res.status(500).send('Failed to refresh access token');
  }
};

// Scheduler to refresh token periodically
export const refreshTokenScheduler = async () => {
  try {
    // Load the saved tokens
    const tokens = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));

    // Set the tokens to the OAuth2 client
    oAuth2Client.setCredentials(tokens);

    // Check if the token is expired
    const now = Date.now();
    const tokenExpiryTime = tokens.expiry_date || 0;

    if (now >= tokenExpiryTime) {
      // If the token is expired, refresh the token
      const newTokens = await oAuth2Client.refreshAccessToken();
      oAuth2Client.setCredentials(newTokens.credentials);

      // Save the new tokens
      fs.writeFileSync(tokenPath, JSON.stringify(newTokens.credentials));

      console.log('Access token refreshed successfully!');
    }
  } catch (error) {
    console.error('Error refreshing token via scheduler:', error);
  }
};
