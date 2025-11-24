/**
 * Converts a date string to a local time string in ISO 8601 format with timezone offset
 * @param dateStr - Date string in ISO format (e.g., '2023-11-21T11:30:00Z')
 * @returns Formatted date string in 'YYYY-MM-DDTHH:MM:SS+05:30' format (IST)
 */
export const getLocalTime = (dateStr: string): string => {
    const d = new Date(dateStr);
    const local = d.toLocaleString("sv-SE", { hour12: false });
    return local.replace(" ", "T") + "+05:30"; // For IST only
};

/**
 * Gets the current timestamp in ISO format with timezone offset
 * @returns Current timestamp in 'YYYY-MM-DDTHH:MM:SS+05:30' format (IST)
 */
export const getCurrentLocalTime = (): string => {
    return getLocalTime(new Date().toISOString());
};
