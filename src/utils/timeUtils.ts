
// export const getLocalTime = (dateStr: string): string => {
//     const d = new Date(dateStr);
//     const local = d.toLocaleString("sv-SE", { hour12: false });
//     return local.replace(" ", "T") + "+05:30"; // For IST only
// };

// export const getCurrentLocalTime = (): string => {
//     return getLocalTime(new Date().toISOString());
// };

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

export const toUTC = (dateStr: string): string => {
    return dayjs.tz(dateStr, "Asia/Kolkata").utc().toISOString();
};
