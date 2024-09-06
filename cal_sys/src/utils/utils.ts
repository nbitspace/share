
/**
 * Utility function to calculate the duration between two timestamps in minutes.
 * @param startDateTime - Start date and time as a string or undefined.
 * @param endDateTime - End date and time as a string or undefined.
 * @returns The duration in minutes. Returns 0 if any date is missing.
 */
export function calculateDuration(startDateTime: string | undefined, endDateTime: string | undefined): number {
    if (!startDateTime || !endDateTime) {
      return 0; // If either date is missing, return 0
    }
  
    const start = new Date(startDateTime);
    const end = new Date(endDateTime);
  
    // Calculate the difference in milliseconds
    const durationInMs = end.getTime() - start.getTime();
  
    // Convert milliseconds to minutes and return
    return Math.floor(durationInMs / (1000 * 60)); // Duration in minutes
  }
  
  /**
   * Function to calculate the duration between two ISO date strings in minutes.
   * @param start - The start date as an ISO string.
   * @param end - The end date as an ISO string.
   * @returns The duration in minutes.
   */
  export function calculateDurations(start: string, end: string): number {
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();
    return (endTime - startTime) / (1000 * 60); // duration in minutes
  }
  