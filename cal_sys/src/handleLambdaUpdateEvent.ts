import { google } from 'googleapis';
import axios from 'axios';
import { Request, Response } from 'express';


// Define the shape of inputEventData directly in the handler
interface TenantParticipant {
  userId: string;
}

// Define the structure of InputEventData
export interface InputEventData {
  eventId: string; // The unique ID of the event
  parentId: string; // The ID of the parent event (if applicable)
  organizer: string; // Organizer's user ID
  title: string; // Event title
  eventType: string; // Type of event (e.g., meeting, appointment)
  tenantName: string; // Tenant/Organization name
  eventDate: string; // ISO string for the event date
  fromTime: string; // Start time of the event (ISO string)
  toTime: string; // End time of the event (ISO string)
  duration: number; // Duration of the event in minutes
  timeZone: string; // Event timezone
  repeatType: string; // Recurrence type (e.g., "doesntRepeat", "weekly", "monthly")
  reccurance?: Record<string, any>; // Additional recurrence details (optional)
  tenantId: string; // Tenant/Organization ID
  notify: string[]; // Notification times (e.g., ["10 minutes before"])
  tenantParticipants: Participant[]; // List of participants in the event
  externalParticipants: Participant[]; // External participants (if any)
  isExcludeMeFromEvent?: boolean; // Exclude the user from the event
  callType: string; // Type of the call (e.g., "video", "phone")
  description?: string; // Event description
  others?: string; // Additional information
  visibility: string; // Visibility of the event (e.g., "public", "private")
  status: string; // Event status (e.g., "busy", "available")
  permissons: string[]; // Permissions associated with the event
  organizerRoleId: string; // Role of the organizer
  action: EventAction; // Actions like updating or deleting events
  notifyTimeInMinutes: number[]; // Notification times in minutes
}

// Define the structure for Participant
export interface Participant {
  userId: string; // User ID of the participant
  roleId: string; // Role of the participant (e.g., "L1 - Treating Doctor")
}

// Define the structure for EventAction
export interface EventAction {
  thisEvent: boolean; // Whether the action affects only this event
  allEvents: boolean; // Whether the action affects all events
  value: string; // Action type (e.g., "update", "delete")
}

// Main handler function
export const handleLambdaUpdateEvent = async (req: Request<any, any, InputEventData>, res: Response) => {
  try {
    // Extract input data from the request body
    const inputEventData: InputEventData = req.body;
    const tenantUserId = inputEventData.tenantParticipants[0]?.userId;

    // Fetch Google Calendar Sync Settings (to get access tokens)
    const calendarSyncSettings = await getCalendarSyncSettings(tenantUserId);

    if (!calendarSyncSettings || calendarSyncSettings.length === 0) {
      throw new Error('No sync settings found for the user');
    }

    // Get the user's Google OAuth token from the sync settings
    const googleSyncSettings = calendarSyncSettings.find(config => config.provider === 'google');
    if (!googleSyncSettings) {
      throw new Error('Google Calendar sync settings not found for the user');
    }

    // Initialize Google Calendar API client with OAuth token
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: googleSyncSettings.accessToken,
      refresh_token: googleSyncSettings.refreshToken,
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Prepare event details for update using input data
    const updatedEvent = {
      summary: inputEventData.title,
      description: inputEventData.description || "",
      start: {
        dateTime: inputEventData.fromTime,
        timeZone: inputEventData.timeZone || "UTC",
      },
      end: {
        dateTime: inputEventData.toTime,
        timeZone: inputEventData.timeZone || "UTC",
      },
      attendees: inputEventData.tenantParticipants.map(participant => ({
        email: participant.userId,  // Assuming userId is email; update this if necessary
      })),
      reminders: {
        useDefault: false,
        overrides: inputEventData.notifyTimeInMinutes.map(min => ({
          method: 'popup',
          minutes: min,
        })),
      },
    };

    // Update the event in Google Calendar using the eventId from the input payload
    const updateResponse = await calendar.events.update({
      calendarId: 'primary', // Use the default calendar or change as needed
      eventId: inputEventData.eventId,
      requestBody: updatedEvent,
    });

    // Call syscal_config API with sync settings and input event data
    const syncResponse = await syncCalendarSettings(calendarSyncSettings, inputEventData);

    // Return the success response
    return res.status(200).json({
      Status: "Success",
      Message: "Google Calendar event updated and data processed",
      googleCalendarUpdate: updateResponse.data,
      syncResponse,
    });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({
      Status: "Failure",
      Message: error,
    });
  }
};

// Helper function to get calendar sync settings by userId
const getCalendarSyncSettings = async (userId: string) => {
  try {
    const response = await axios.get(`http://localhost:3000/scheduler/event/getSyncSettings/${userId}`);
    
    // Ensure response is an array before returning
    if (response.status === 200 && Array.isArray(response.data)) {
      return response.data;  // Return the array of sync settings
    } else {
      throw new Error('Failed to fetch calendar sync settings');
    }
  } catch (error) {
    console.error("Error fetching sync settings:", error);
    throw error;
  }
};

// Helper function to call syscal_config API
const syncCalendarSettings = async (syncSettings: any[], inputEventData: any) => {
  try {
    const payload = {
      configs: syncSettings,  // Array of sync settings
      inputEventData,         // Event data to sync
    };

    // Call the API to sync the settings
    const response = await axios.post('http://localhost:8080/syscal_config', payload);

    if (response.status === 200) {
      return response.data;  // Return the sync response data
    } else {
      throw new Error('Failed to sync calendar settings');
    }
  } catch (error) {
    console.error("Error syncing calendar settings:", error);
    throw error;
  }
};
