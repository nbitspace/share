const axios = require('axios');
//const yourBearerToken ="eyJraWQiOiJZUU5JbzV0WnQ3UFZBbnRwNTZWYUhoVVJBSzJmOGlcL1FPbktvQTk4XC9wYzg9IiwiYWxnIjoiUlMyNTYifQ.eyJzdWIiOiI4MjNjMDkxNi05ZTlkLTRhOWMtODEzZi1hZDJjMDllYWMzOGIiLCJ6b25laW5mbyI6InRydWUiLCJlbWFpbF92ZXJpZmllZCI6ZmFsc2UsImlzcyI6Imh0dHBzOlwvXC9jb2duaXRvLWlkcC5hcC1zb3V0aC0xLmFtYXpvbmF3cy5jb21cL2FwLXNvdXRoLTFfZlhtWWxiZFlKIiwicGhvbmVfbnVtYmVyX3ZlcmlmaWVkIjp0cnVlLCJjb2duaXRvOnVzZXJuYW1lIjoiODIzYzA5MTYtOWU5ZC00YTljLTgxM2YtYWQyYzA5ZWFjMzhiIiwiZ2l2ZW5fbmFtZSI6Illhc2h3YW50aCIsImF1ZCI6IjV2ZTh1Z3ZtMTFkM2U2YWoxZWtobWpkbW04IiwiZXZlbnRfaWQiOiJlMTJiNzcxYS1iYTA0LTQwYWItYjU0OC1mNGZjMjEyZDk1YmEiLCJ0b2tlbl91c2UiOiJpZCIsImF1dGhfdGltZSI6MTcyNTAwMTEzNiwicGhvbmVfbnVtYmVyIjoiKzkxMTExMDAwNDQxMCIsImV4cCI6MTcyNTA4NzUzNiwiaWF0IjoxNzI1MDAxMTM2LCJmYW1pbHlfbmFtZSI6IkdDLTQiLCJlbWFpbCI6InRlc3RAZ21haWwuY29tIn0.skQdAIUOclu5_NexfyfjtrmKxc0gltNN5TZdZFjPiDQFi7LQoBtf6qnTX-3pJz9ClIkoukqsd1T7GssukEBkgt9HL9T9r0EtuGwicSb3-MV28_cqbOKlov_dycAHFHNhVUZWs_xpqdd9AM-i9SApj236cSmOA3reDo2mehy94gIMZGahEaKGx2ynSXcv_G3MXB0yw-UQjCHz1dF0Q0BsEeV0b-hFbDgmrr_j27zln4yKHMCrtANYP7EqxMsRaTEk--VsU5lTQypwz6ar_UtGZPFyve4AaVl0n4M5aqogZdqxBbVvl1firwInx_9D6sCdcUjNqeMVROzfiZ8ea-8v8Q";
import { Request, Response } from 'express';


// Define the shape of inputEventData directly in the handler
interface TenantParticipant {
  userId: string;
}

interface InputEventData {
  userId: string;
  organizer: string;
  fromTime: string;
  toTime: string;   
  title: string;
  eventType: string;
  duration: number;
  notify: boolean;
  tenantParticipants: TenantParticipant[];
}

// Main handler function
export const handleLambdaEvents = async (req: Request<any, any, InputEventData>, res: Response) => {
  try {
    // Extract input data from the request body
    const inputEventData: InputEventData = req.body;
    console.log("handleLambdaEvents : "+inputEventData.tenantParticipants);
    const tenantUserId = inputEventData.tenantParticipants[0]?.userId; // Using optional chaining to avoid errors if the array is empty

/*    const esQueryPayload = {
      index: "calendar_events",
      query: {
        bool: {
          filter: [
            {
              range: {
                fromTime: { lte: inputEventData.toTime },
              },
            },
            {
              range: {
                toTime: { gte: inputEventData.fromTime },
              },
            },
            {
              bool: {
                should: [
                  {
                    match_phrase: {
                      "tenantParticipants.userId": tenantUserId, // Use single userId
                    },
                  },
                  {
                    match_phrase: {
                      organizer: inputEventData.organizer,
                    },
                  },
                ],
              },
            },
          ],
        },
      },
      size: 10000,
    };
    

    // Call ElasticSearch API (searchInES)
    const esResponse = await axios.post('http://localhost:3000/searchInES', esQueryPayload, {
      headers: {
        Authorization: `Bearer ${yourBearerToken}`,
      },
    });

    if (esResponse.data.Status !== "Success") {
      throw new Error('Failed to fetch events from ElasticSearch');
    }
    if (esResponse.data.Status == "Success") {
      const calendarEvents = esResponse.data.body[0];
      console.log("calendarEvents get resp"+calendarEvents);

    }

    const calendarEvents = esResponse.data.body;
8*/    // Fetch calendar sync settings using the userId from the event data
    const calendarSyncSettings = await getCalendarSyncSettings(inputEventData.userId);

    // Call syscal_config API with the sync settings and input event data
    const syncResponse = await syncCalendarSettings(calendarSyncSettings, inputEventData);


    return res.status(200).json({
      Status: "Success",
      Message: "Calendar data processed",
     //  calendarEvents,
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
    // Prepare payload with the array of sync settings and event data
    const payload = {
      configs: syncSettings, // Array of sync settings
      inputEventData, // Event data to sync
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
