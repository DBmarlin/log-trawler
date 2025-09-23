import React, { useState, useEffect } from "react";
import { LogFile } from "@/components/home"; // Assuming LogFile is exported or moved
import { parseLogLine, parseTimestamp } from "@/lib/utils";

// Define the structure of a processed log entry
export interface ProcessedLogEntry {
  lineNumber: number;
  timestamp: string | Date; // Keep original timestamp string for display, Date for filtering
  message: string;
  // Add other potential fields extracted by parseLogLine if any
}

export function useLogProcessing(activeFile: LogFile | undefined) {
  const [processedEntries, setProcessedEntries] = useState<ProcessedLogEntry[]>([]);
  const [visibleEntries, setVisibleEntries] = useState<ProcessedLogEntry[]>([]);

  // Effect to process raw lines into structured entries
  useEffect(() => {
    if (!activeFile || activeFile.type === 'folder') {
      setProcessedEntries([]);
      return;
    }

    parseLogLine(undefined); // Reset timestamp parser state
    parseLogLine("-"); // Initialize parser state if needed

    let isCancelled = false; // Flag to prevent state updates if component unmounts or activeFile changes quickly

    const processAllLines = async () => {
      try {
        const lines = activeFile.content || [];
        if (lines.length > 10000 && typeof Worker !== 'undefined') {
          // --- Web Worker Processing ---
          const initialBatch = lines.slice(0, 1000).map((line, i) => ({
            lineNumber: i + 1, ...parseLogLine(line),
          }));
          if (!isCancelled) setProcessedEntries(initialBatch);

          const workerFunctionStr = `
            self.onmessage = function(e) {
              const { lines, startIndex } = e.data;
              const results = [];
              // Minimal parseLogLine for worker - adjust if more complex parsing is needed
              const parseLogLine = (line) => {
                if (!line || !line.trim()) return { timestamp: "-", message: line || "" };
                const timestampRegex = /(\\d{4}-\\d{2}-\\d{2}(?:[T\\s])\\d{1,2}:\\d{2}:\\d{2}(?:\\.\\d{3})?(?:[Z])?|\\d{2}[-/](?:[A-Za-z]+|\\d{2})[-/]\\d{4}(?:\\s|:)\\d{1,2}:\\d{2}:\\d{2}(?:\\.\\d{3})?|\\d{4}\\/\\d{2}\\/\\d{2}\\s\\d{1,2}:\\d{2}:\\d{2}(?:\\.\\d{3})?)/.exec(line);
                return timestampRegex ? { timestamp: timestampRegex[1], message: line } : { timestamp: "-", message: line };
              };
              for (let i = 0; i < lines.length; i++) {
                results.push({ lineNumber: startIndex + i + 1, ...parseLogLine(lines[i]) });
              }
              self.postMessage(results);
            };`;
          const blob = new Blob([workerFunctionStr], { type: "application/javascript" });
          const workerUrl = URL.createObjectURL(blob);
          const worker = new Worker(workerUrl);
          const batchSize = 10000;
          let currentIndex = 1000;
          let accumulatedResults: ProcessedLogEntry[] = [];

          worker.onmessage = (e) => {
            if (isCancelled) {
              worker.terminate();
              URL.revokeObjectURL(workerUrl);
              return;
            }
            accumulatedResults = [...accumulatedResults, ...e.data];
            // Update state less frequently for performance
            if (accumulatedResults.length > 50000 || currentIndex + batchSize >= lines.length) {
                 setProcessedEntries((prev) => [...prev, ...accumulatedResults]);
                 accumulatedResults = [];
            }

            currentIndex += batchSize;
            if (currentIndex < lines.length) {
              const nextBatch = lines.slice(currentIndex, currentIndex + batchSize);
              worker.postMessage({ lines: nextBatch, startIndex: currentIndex });
            } else {
              if (accumulatedResults.length > 0) {
                 setProcessedEntries((prev) => [...prev, ...accumulatedResults]);
              }
              worker.terminate();
              URL.revokeObjectURL(workerUrl);
            }
          };

          worker.onerror = (error) => {
            console.error("Worker error:", error);
            if (!isCancelled) {
                setProcessedEntries([{ lineNumber: 1, timestamp: new Date().toISOString(), message: `[ERROR] Worker failed during processing.` }]);
            }
            worker.terminate();
            URL.revokeObjectURL(workerUrl);
          };

          const firstBatch = lines.slice(1000, 1000 + batchSize);
          worker.postMessage({ lines: firstBatch, startIndex: 1000 });

          // Cleanup function for the worker effect
          return () => {
            isCancelled = true;
            worker.terminate();
            URL.revokeObjectURL(workerUrl);
          };

        } else {
          // --- Synchronous or Batched Processing (No Worker or Small File) ---
          const processed: ProcessedLogEntry[] = [];
          const batchSize = 7500; // Process in batches to avoid blocking UI
          let currentIndex = 0;

          const processBatch = () => {
            if (isCancelled || currentIndex >= lines.length) return;
            const endTime = performance.now() + 16; // Target ~60fps

            while (performance.now() < endTime && currentIndex < lines.length) {
              processed.push({ lineNumber: currentIndex + 1, ...parseLogLine(lines[currentIndex]) });
              currentIndex++;
            }

            if (currentIndex < lines.length) {
              // Schedule next batch
              requestAnimationFrame(processBatch);
            }
            // Update state incrementally
            setProcessedEntries([...processed]);
          };

          requestAnimationFrame(processBatch);
        }
      } catch (error) {
        console.error("Error processing entries:", error);
        if (!isCancelled) {
            setProcessedEntries([{ lineNumber: 1, timestamp: new Date().toISOString(), message: `[ERROR] Failed to process file.` }]);
        }
      }
    };

    let workerCleanup: (() => void) | undefined;
    processAllLines().then(cleanupFunc => {
        if (typeof cleanupFunc === 'function') {
            workerCleanup = cleanupFunc;
        }
    });

    // Cleanup function for the main effect
    return () => {
      isCancelled = true;
      if (workerCleanup) {
        workerCleanup(); // Call worker cleanup if it exists
      }
    };

  }, [activeFile]); // Re-run only when activeFile changes

  // Effect to filter processed entries into visible entries
  useEffect(() => {
    if (!processedEntries.length || !activeFile || activeFile.type === 'folder') {
      setVisibleEntries([]);
      return;
    }

    let isCancelled = false;

    const filterEntries = () => {
        const filtered = processedEntries.filter((entry) => {
          if (isCancelled) throw new Error("Filtering cancelled"); // Break early

          // Time Range Filter
          if (activeFile.timeRange?.startDate || activeFile.timeRange?.endDate) {
            // Handle both string and Date types for timestamp
            const entryDate = entry.timestamp instanceof Date ? entry.timestamp : parseTimestamp(entry.timestamp);
            if (entryDate) { // Only filter if timestamp was parsable to a valid Date
              if (activeFile.timeRange?.startDate && entryDate < activeFile.timeRange.startDate) return false;
              if (activeFile.timeRange?.endDate && entryDate > activeFile.timeRange.endDate) return false;
            } else if (activeFile.timeRange.startDate || activeFile.timeRange.endDate) {
              // If a time filter is set but the entry has no valid date, exclude it
              return false;
            }
          }

          // Include/Exclude Filters
          const filters = activeFile.filters || [];
          const filterLogic = activeFile.filterLogic || "OR";
          const excludeFilters = filters.filter((f) => f.type === "exclude");
          const includeFilters = filters.filter((f) => f.type === "include");

          // Check Exclude Filters first
          if (excludeFilters.length > 0) {
            const shouldExclude = excludeFilters.some((filter) => {
              try {
                const searchTerm = filter.term.toLowerCase();
                const message = entry.message.toLowerCase();
                return filter.isRegex
                  ? new RegExp(filter.term, "i").test(entry.message) // Use original case for regex
                  : message.includes(searchTerm);
              } catch { return false; } // Ignore invalid regex
            });
            if (shouldExclude) return false; // Exclude if any exclude filter matches
          }

          // Check Include Filters if any exist
          if (includeFilters.length > 0) {
            const testFn = (filter: typeof includeFilters[0]) => {
               try {
                 const searchTerm = filter.term.toLowerCase();
                 const message = entry.message.toLowerCase();
                 return filter.isRegex
                   ? new RegExp(filter.term, "i").test(entry.message) // Use original case for regex
                   : message.includes(searchTerm);
               } catch { return false; } // Ignore invalid regex
            };
            // Return true only if include conditions are met
            return filterLogic === "AND" ? includeFilters.every(testFn) : includeFilters.some(testFn);
          }

          // If no include filters, include the entry (since it wasn't excluded)
          return true;
        });

        if (!isCancelled) {
            setVisibleEntries(filtered);
        }
    };

    // Run filtering asynchronously to avoid blocking
    const timeoutId = setTimeout(filterEntries, 0);

    return () => {
        isCancelled = true;
        clearTimeout(timeoutId);
    };

  }, [processedEntries, activeFile?.filters, activeFile?.filterLogic, activeFile?.timeRange]); // Re-run when dependencies change

  return { processedEntries, visibleEntries };
}
