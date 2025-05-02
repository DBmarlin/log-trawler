import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { parse, isValid } from "date-fns";
import { parseISO } from "date-fns";

const includeColors = [
  {
    bg: "bg-blue-500",
    text: "text-white",
    highlight: "bg-blue-100 text-blue-700",
  },
  {
    bg: "bg-green-500",
    text: "text-white",
    highlight: "bg-green-100 text-green-700",
  },
  {
    bg: "bg-purple-500",
    text: "text-white",
    highlight: "bg-purple-100 text-purple-700",
  },
  {
    bg: "bg-orange-500",
    text: "text-white",
    highlight: "bg-orange-100 text-orange-700",
  },
  {
    bg: "bg-cyan-500",
    text: "text-white",
    highlight: "bg-cyan-100 text-cyan-700",
  },
];

const excludeColors = [
  {
    bg: "bg-red-500",
    text: "text-white",
    highlight: "bg-red-100 text-red-700",
  },
  {
    bg: "bg-pink-500",
    text: "text-white",
    highlight: "bg-pink-100 text-pink-700",
  },
  {
    bg: "bg-rose-500",
    text: "text-white",
    highlight: "bg-rose-100 text-rose-700",
  },
  {
    bg: "bg-fuchsia-500",
    text: "text-white",
    highlight: "bg-fuchsia-100 text-fuchsia-700",
  },
  {
    bg: "bg-amber-500",
    text: "text-white",
    highlight: "bg-amber-100 text-amber-700",
  },
];

export interface ParsedLogLine {
  timestamp: string;
  message: string;
}

const DATE_FORMATS = [
  "yyyy-MM-dd HH:mm:ss", // 2024-12-12 01:48:36
  "dd-MMM-yyyy HH:mm:ss.SSS", // 25-Dec-2024 00:00:06.596
  "dd-MMM-yyyy HH:mm:ss", // 25-Dec-2024 00:00:06
  "dd/MMM/yyyy:HH:mm:ss", // Apache format: 22/Dec/2024:07:04:02
  "yyyy-MM-dd'T'HH:mm:ss.SSSX", // ISO format
  "yyyy-MM-dd'T'HH:mm:ssX", // ISO format without ms
  "MM/dd/yyyy HH:mm:ss", // American format
  "dd/MM/yyyy HH:mm:ss", // European format
  "yyyy.MM.dd HH:mm:ss", // Dot separated
  "yyyy/MM/dd HH:mm:ss", // Slash separated with year first: 2025/01/13 12:51:06
  "EEE MMM dd HH:mm:ss yyyy", // Format: Sun Dec 04 04:47:44 2024
  "MMM dd HH:mm:ss", // Format without year: Dec 10 06:55:46
  "MM-dd HH:mm:ss.SSS", // Format without year: 03-17 16:13:38.811
  "MM-dd HH:mm:ss", // Format without year: 03-17 16:13:38
];

const tryParseDate = (timestamp: string, format: string): Date | null => {
  try {
    // For formats without year, ensure we use current year
    const referenceDate = new Date();
    const date = parse(timestamp, format, referenceDate);

    // Special handling for formats without year
    // If the parsed date is valid but has year 1970 (default when no year in format),
    // set it to the current year
    if (
      isValid(date) &&
      (format === "MMM dd HH:mm:ss" ||
        format === "MM-dd HH:mm:ss.SSS" ||
        format === "MM-dd HH:mm:ss") &&
      date.getFullYear() === 1970
    ) {
      date.setFullYear(referenceDate.getFullYear());

      // If the resulting date is in the future, it's likely from the previous year
      if (date > referenceDate) {
        date.setFullYear(referenceDate.getFullYear() - 1);
      }
    }

    return isValid(date) ? date : null;
  } catch {
    return null;
  }
};

// Keep track of the last valid timestamp for stacktrace lines
let lastValidTimestamp = "-";

export const parseLogLine = (line: string): ParsedLogLine => {
  // Handle undefined or null lines
  if (line === undefined || line === null) {
    // Reset the lastValidTimestamp when undefined is passed
    if (line === undefined) {
      lastValidTimestamp = "-";
    }
    return {
      timestamp: lastValidTimestamp,
      message: "",
    };
  }

  // Skip empty lines
  if (!line.trim()) {
    return {
      timestamp: lastValidTimestamp,
      message: line,
    };
  }

  // Try to match common log formats

  // Format: [Sun Dec 04 04:47:44 2024] or [Dec 10 06:55:46]
  const bracketedDateMatch = line.match(
    /\[([A-Za-z]{3}\s[A-Za-z]{3}\s\d{2}\s\d{2}:\d{2}:\d{2}(?:\s\d{4})?)\]\s*(.*)/,
  );
  if (bracketedDateMatch) {
    lastValidTimestamp = bracketedDateMatch[1];
    return {
      timestamp: lastValidTimestamp,
      message: line,
    };
  }

  // Format: 07-Mar-2025 00:00:00.744 [INFO] Starting application
  const timestampWithMillisMatch = line.match(
    /^(\d{2}-[A-Za-z]{3}-\d{4}\s\d{2}:\d{2}:\d{2}\.\d{3})\s+(.+)/,
  );
  if (timestampWithMillisMatch) {
    lastValidTimestamp = timestampWithMillisMatch[1];
    return {
      timestamp: lastValidTimestamp,
      message: line,
    };
  }

  // Format: 2024-12-21 21:41:36 ERROR [thread-94] org.apache.coyote.AbstractProtocol
  const standardLogMatch = line.match(
    /^(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2})\s+([A-Z]+)\s+\[(.+?)\]\s+(.+)/,
  );
  if (standardLogMatch) {
    lastValidTimestamp = standardLogMatch[1];
    return {
      timestamp: lastValidTimestamp,
      message: line,
    };
  }

  // Try Apache format first (since it's more specific)
  const apacheMatch = line.match(
    /\[(\d{2}\/[A-Za-z]+\/\d{4}:\d{2}:\d{2}:\d{2})\s*]/i,
  );
  if (apacheMatch) {
    lastValidTimestamp = apacheMatch[1];
    return {
      timestamp: lastValidTimestamp,
      message: line,
    };
  }

  // Match various timestamp formats
  const timestampRegex =
    /(\d{4}-\d{2}-\d{2}(?:[T\s])\d{1,2}:\d{2}:\d{2}(?:,\d{3})?(?:\.\d{3})?(?:[Z])?|\d{2}[-/](?:[A-Za-z]+|\d{2})[-/]\d{4}(?:\s|:)\d{1,2}:\d{2}:\d{2}(?:\.\d{3})?|\d{4}\/\d{2}\/\d{2}\s\d{1,2}:\d{2}:\d{2}(?:\.\d{3})?|\[?(?:[A-Za-z]{3}\s[A-Za-z]{3}\s\d{2}\s\d{2}:\d{2}:\d{2}(?:\s\d{4})?)\]?|(?:[A-Za-z]{3}\s\d{1,2}\s\d{2}:\d{2}:\d{2})|(?:\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}(?:\.\d{3})?))/;
  const match = line.match(timestampRegex);

  if (match) {
    lastValidTimestamp = match[1];
    return {
      timestamp: lastValidTimestamp,
      message: line,
    };
  }

  // If no timestamp is found, use the last valid timestamp (for stacktraces)
  return {
    timestamp: lastValidTimestamp,
    message: line,
  };
};

export const parseTimestamp = (timestamp: string): Date | undefined => {
  try {
    if (timestamp === "-") return undefined;

    // Try ISO format first
    try {
      const isoDate = parseISO(timestamp);
      if (isValid(isoDate)) return isoDate;
    } catch {}

    // Try each format until one works
    for (const format of DATE_FORMATS) {
      const date = tryParseDate(timestamp, format);
      if (date) return date;
    }

    // Try to parse standard log format: 2024-12-21 21:41:36
    if (timestamp.match(/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}$/)) {
      const date = new Date(timestamp.replace(" ", "T"));
      if (isValid(date)) return date;
    }

    // Handle formats like "Dec 10 06:55:46" or "Jun 14 15:16:01" without explicit year
    const monthDayTimeMatch = timestamp.match(
      /([A-Za-z]{3})\s+(\d{1,2})\s+(\d{2}:\d{2}:\d{2})/,
    );

    // Handle formats like "03-17 16:13:38.811" without explicit year
    const numericMonthDayTimeMatch = timestamp.match(
      /(\d{2})-(\d{2})\s+(\d{2}:\d{2}:\d{2}(?:\.\d{3})?)/,
    );
    if (monthDayTimeMatch) {
      const [_, month, day, time] = monthDayTimeMatch;
      const currentYear = new Date().getFullYear();
      const fullTimestamp = `${month} ${day} ${time} ${currentYear}`;
      const date = new Date(fullTimestamp);

      // If the resulting date is in the future, it's likely from the previous year
      if (isValid(date)) {
        if (date > new Date()) {
          date.setFullYear(currentYear - 1);
        }
        return date;
      }
    }

    // Handle numeric month-day format
    if (numericMonthDayTimeMatch) {
      const [_, month, day, time] = numericMonthDayTimeMatch;
      const currentYear = new Date().getFullYear();
      // Create a date in format YYYY-MM-DD HH:MM:SS
      const fullTimestamp = `${currentYear}-${month}-${day} ${time}`;
      const date = new Date(fullTimestamp.replace(" ", "T"));

      // If the resulting date is in the future, it's likely from the previous year
      if (isValid(date)) {
        if (date > new Date()) {
          date.setFullYear(currentYear - 1);
        }
        return date;
      }
    }

    // Try direct Date constructor as last resort
    try {
      const date = new Date(timestamp);
      if (isValid(date) && date.getFullYear() > 2000) return date;
    } catch {}

    return undefined;
  } catch (error) {
    console.error("Error parsing timestamp:", error);
    return undefined;
  }
};

export const getFilterColor = (type: "include" | "exclude", index: number) => {
  const colors = type === "include" ? includeColors : excludeColors;
  return colors[index % colors.length];
};

export const getFilterIndex = (filters: any[], id: string) => {
  const typeFilters = filters.filter(
    (f) => f.type === filters.find((filter) => filter.id === id)?.type,
  );
  return typeFilters.findIndex((f) => f.id === id);
};

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Detects if the application is running in Electron
 * @returns {boolean} True if running in Electron, false if running in a browser
 */
export function isElectron(): boolean {
  // Check if the process object exists and has an electron version
  return typeof window !== 'undefined' && 
         typeof window.process === 'object' && 
         !!window.process?.versions?.electron;
}
