import React, { useState, useCallback, useMemo } from "react";
import { Upload, X, Bot } from "lucide-react"; // Removed HomeIcon alias as it wasn't used after refactor
import Header from "./header/Header";
import { Button } from "@/components/ui/button";
// ThemeToggle import removed as it wasn't used directly in home.tsx after refactor
// Card imports removed as they weren't used directly in home.tsx after refactor
// Badge import removed as it wasn't used directly in home.tsx after refactor
// ScrollArea import removed as it wasn't used directly in home.tsx after refactor
// Log viewer component imports removed as they are now used within FileView
import RecentFiles, { RecentFile } from "./log-viewer/RecentFiles";
import { parseLogLine, parseTimestamp } from "@/lib/utils";
import { type FilterPreset } from "./log-viewer/FilterPresets"; // Only type needed now
import ExportButton from "./log-viewer/ExportButton"; // Keep for top bar
import ChatPanel from "./chat-panel/ChatPanel";
// Resizable components imports removed as they are now used within FileView
// Tabs imports removed as they are now used within FileView
// Tooltip imports removed as they are now used within FileView
import InitialView from "./home/InitialView"; // Import InitialView
import FileView from "./home/FileView"; // Import FileView

// Keep the exported interface
export interface LogFile {
  id: string;
  name: string;
  content: string[];
  startDate?: Date;
  endDate?: Date;
  filters?: Array<{
    id: string;
    type: "include" | "exclude";
    term: string;
    isRegex?: boolean;
    operator?: "AND" | "OR";
  }>;
  filterLogic?: "AND" | "OR";
  bucketSize?: string;
  timeRange?: { startDate?: Date; endDate?: Date };
  isLoading?: boolean;
  notes?: string;
  tags?: string[];
  interestingLines?: number[];
  showOnlyMarked?: boolean;
}

const Home = () => {
  // --- State Management ---
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<LogFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isRegexSearch, setIsRegexSearch] = useState(false);
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [processedEntries, setProcessedEntries] = useState<any[]>([]);
  const [visibleEntries, setVisibleEntries] = useState<any[]>([]);
  const [statsVisible, setStatsVisible] = useState(() => {
    return window.innerWidth >= 768;
  });
  const [loadingFiles, setLoadingFiles] = useState<{ [key: string]: number }>(
    {},
  );
  const [chatPanelOpen, setChatPanelOpen] = useState(false);
  const [chartVisible, setChartVisible] = useState(true);
  const [showUrlDialog, setShowUrlDialog] = useState(false);
  const [urlInputValue, setUrlInputValue] = useState("");
  const [isUrlLoading, setIsUrlLoading] = useState(false);

  // --- Memoized Values ---
  const activeFile = useMemo(() => files.find((f) => f.id === activeFileId), [files, activeFileId]);
  const chartEntries = useMemo(() => {
    if (!activeFile) return [];
    const sampleSize = Math.min(2000, activeFile.content.length);
    const step = Math.max(
      1,
      Math.floor(activeFile.content.length / sampleSize),
    );
    const sample = [];
    for (let i = 0; i < activeFile.content.length; i += step) {
      sample.push(activeFile.content[i]);
    }
    return sample;
  }, [activeFile]);


  // --- Effect Hooks ---
  React.useEffect(() => {
    const handleSetChatPanelOpen = (event: CustomEvent<{ open: boolean }>) => {
      if (event.detail.open) {
        setChatPanelOpen(true);
      }
    };
    document.addEventListener("setChatPanelOpen", handleSetChatPanelOpen as EventListener);
    return () => {
      document.removeEventListener("setChatPanelOpen", handleSetChatPanelOpen as EventListener);
    };
  }, []);

  React.useEffect(() => {
    if (!activeFile) {
      setProcessedEntries([]);
      setVisibleEntries([]);
      return;
    }

    parseLogLine(undefined); // Reset timestamp parser state
    parseLogLine("-");

    try {
      if (activeFile.content.length > 10000) {
        const initialBatch = activeFile.content.slice(0, 1000).map((line, i) => ({
          lineNumber: i + 1, ...parseLogLine(line),
        }));
        setProcessedEntries(initialBatch);

        const useWebWorker = window.Worker !== undefined;
        if (useWebWorker) {
          const workerFunctionStr = `
            self.onmessage = function(e) {
              const { lines, startIndex } = e.data;
              const results = [];
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

          worker.onmessage = (e) => {
            setProcessedEntries((prev) => [...prev, ...e.data]);
            currentIndex += batchSize;
            if (currentIndex < activeFile.content.length) {
              const nextBatch = activeFile.content.slice(currentIndex, currentIndex + batchSize);
              worker.postMessage({ lines: nextBatch, startIndex: currentIndex });
            } else {
              worker.terminate();
              URL.revokeObjectURL(workerUrl);
            }
          };
          const firstBatch = activeFile.content.slice(1000, 1000 + batchSize);
          worker.postMessage({ lines: firstBatch, startIndex: 1000 });

        } else { // Fallback without worker
          setTimeout(() => {
            const batchSize = 7500;
            let currentIndex = 1000;
            const processNextBatch = () => {
              if (currentIndex >= activeFile.content.length) return;
              const endIndex = Math.min(currentIndex + batchSize, activeFile.content.length);
              requestAnimationFrame(() => {
                const nextBatch = [];
                const batchLines = activeFile.content.slice(currentIndex, endIndex);
                for (let i = 0; i < batchLines.length; i++) {
                  nextBatch.push({ lineNumber: currentIndex + i + 1, ...parseLogLine(batchLines[i]) });
                }
                setProcessedEntries((prev) => [...prev, ...nextBatch]);
                currentIndex += batchSize;
                if (currentIndex < activeFile.content.length) {
                  setTimeout(processNextBatch, 50);
                }
              });
            };
            processNextBatch();
          }, 50);
        }
      } else {
        const processed = activeFile.content.map((line, i) => ({
          lineNumber: i + 1, ...parseLogLine(line),
        }));
        setProcessedEntries(processed);
      }
    } catch (error) {
      console.error("Error processing entries:", error);
      setProcessedEntries([{ lineNumber: 1, timestamp: new Date().toISOString(), message: `[ERROR] Failed to process file.` }]);
    }
  }, [activeFile]); // Only re-run when activeFile changes

  React.useEffect(() => {
    if (!processedEntries.length || !activeFile) {
      setVisibleEntries([]);
      return;
    }

    const filtered = processedEntries.filter((entry) => {
      if (activeFile.timeRange?.startDate || activeFile.timeRange?.endDate) {
        const entryDate = parseTimestamp(entry.timestamp);
        if (entryDate) {
          if (activeFile.timeRange?.startDate && entryDate < activeFile.timeRange.startDate) return false;
          if (activeFile.timeRange?.endDate && entryDate > activeFile.timeRange.endDate) return false;
        }
      }

      const filters = activeFile.filters || [];
      const filterLogic = activeFile.filterLogic || "OR";
      const excludeFilters = filters.filter((f) => f.type === "exclude");
      const includeFilters = filters.filter((f) => f.type === "include");

      if (excludeFilters.length > 0) {
        const shouldExclude = excludeFilters.some((filter) => {
          try {
            return filter.isRegex
              ? new RegExp(filter.term, "i").test(entry.message)
              : entry.message.toLowerCase().includes(filter.term.toLowerCase());
          } catch { return false; }
        });
        if (shouldExclude) return false;
      }

      if (includeFilters.length > 0) {
        const testFn = (filter: typeof includeFilters[0]) => {
           try {
            return filter.isRegex
              ? new RegExp(filter.term, "i").test(entry.message)
              : entry.message.toLowerCase().includes(filter.term.toLowerCase());
          } catch { return false; }
        };
        return filterLogic === "AND" ? includeFilters.every(testFn) : includeFilters.some(testFn);
      }

      return true; // No include filters, so include if not excluded
    });

    setVisibleEntries(filtered);
  }, [processedEntries, activeFile?.filters, activeFile?.filterLogic, activeFile?.timeRange]); // Depend on specific activeFile properties


  // --- Handlers ---
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleRecentFileSelect = useCallback(async (recentFile: RecentFile) => {
    if (recentFile.id.match(/^0\.[0-9]+$/)) {
      recentFile.id = recentFile.name.replace(/[^a-z0-9]/gi, "_") + "_" + recentFile.lastOpened;
    }
    const existingFile = files.find((f) => f.id === recentFile.id);
    if (existingFile) {
      setActiveFileId(existingFile.id);
      return;
    }

    const notification = document.createElement("div");
    notification.className = "fixed bottom-4 right-4 bg-primary text-primary-foreground px-4 py-2 rounded-md shadow-md z-50";
    notification.innerHTML = `Loading <strong>${recentFile.name}</strong> from storage...`;
    document.body.appendChild(notification);

    try {
      const { getLogFileById } = await import("@/lib/indexedDB-fix");
      const logFile = await getLogFileById(recentFile.id);

      if (logFile?.content?.length > 0) {
        const processedFile: LogFile = {
          ...logFile,
          startDate: logFile.startDate ? new Date(logFile.startDate) : undefined,
          endDate: logFile.endDate ? new Date(logFile.endDate) : undefined,
          timeRange: logFile.timeRange ? {
            startDate: logFile.timeRange.startDate ? new Date(logFile.timeRange.startDate) : undefined,
            endDate: logFile.timeRange.endDate ? new Date(logFile.timeRange.endDate) : undefined,
          } : undefined,
          notes: logFile.notes || "",
          tags: logFile.tags || [],
          interestingLines: logFile.interestingLines || [],
          showOnlyMarked: logFile.showOnlyMarked || false,
        };
        setFiles((prev) => {
          const existingIndex = prev.findIndex((f) => f.id === processedFile.id);
          if (existingIndex >= 0) {
            const newFiles = [...prev];
            newFiles[existingIndex] = processedFile;
            return newFiles;
          }
          return [...prev, processedFile];
        });
        setActiveFileId(processedFile.id);
        notification.innerHTML = `Successfully loaded <strong>${recentFile.name}</strong>`;
        notification.className = "fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded-md shadow-md z-50";
        setTimeout(() => {
          notification.classList.add("opacity-0", "transition-opacity", "duration-500");
          setTimeout(() => document.body.removeChild(notification), 500);
        }, 3000);
      } else {
        notification.innerHTML = `Please select <strong>${recentFile.name}</strong> from the file dialog`;
        document.getElementById("fileInput")?.click();
        setTimeout(() => {
          notification.classList.add("opacity-0", "transition-opacity", "duration-500");
          setTimeout(() => document.body.removeChild(notification), 500);
        }, 5000);
      }
    } catch (error) {
      console.error("Error loading file from IndexedDB:", error);
      notification.innerHTML = `Error loading file. Please select it manually.`;
      notification.className = "fixed bottom-4 right-4 bg-destructive text-destructive-foreground px-4 py-2 rounded-md shadow-md z-50";
      document.getElementById("fileInput")?.click();
      setTimeout(() => {
        notification.classList.add("opacity-0", "transition-opacity", "duration-500");
        setTimeout(() => document.body.removeChild(notification), 500);
      }, 5000);
    }
  }, [files]); // Dependency on files to check existing

  const processFiles = useCallback(async (droppedFiles: File[]) => {
    const loadingFileIds = droppedFiles.map((file) => ({
      id: file.name.replace(/[^a-z0-9]/gi, "_") + "_" + Date.now(),
      name: file.name,
    }));

    setLoadingFiles((prev) => {
      const newState = { ...prev };
      loadingFileIds.forEach(file => newState[file.id] = 0);
      return newState;
    });

    setFiles((prev) => [
      ...prev,
      ...loadingFileIds.map((file) => ({
        id: file.id, name: file.name, content: [], isLoading: true,
      })),
    ]);

    if (loadingFileIds.length > 0) {
      setActiveFileId(loadingFileIds[0].id);
    }

    const processedFilesPromises = droppedFiles.map(async (file, index) => {
      const fileId = loadingFileIds[index].id;
      const isLargeFile = file.size > 50 * 1024 * 1024;
      const isVeryLargeFile = file.size > 200 * 1024 * 1024;
      let lines: string[] = [];

      try {
        if (isLargeFile) {
          const chunkSize = isVeryLargeFile ? 20 * 1024 * 1024 : 10 * 1024 * 1024;
          const totalChunks = Math.ceil(file.size / chunkSize);
          let loadedChunks = 0;
          let processedLines: string[] = [];

          if (isVeryLargeFile) {
            const maxChunksToProcess = 10;
            const chunksToProcess = Math.min(totalChunks, maxChunksToProcess);
            for (let i = 0; i < chunksToProcess; i++) {
              let chunkIndex = i < 4 ? i : (i < 7 ? Math.floor(totalChunks / 2) + (i - 4) : totalChunks - (10 - i));
              const start = chunkIndex * chunkSize;
              const chunk = file.slice(start, start + chunkSize);
              const chunkText = await chunk.text();
              processedLines.push(...chunkText.split("\n"));
              loadedChunks++;
              setLoadingFiles((prev) => ({ ...prev, [fileId]: Math.round((loadedChunks / chunksToProcess) * 100) }));
            }
            processedLines.unshift(`[NOTICE] Very large file (${(file.size / (1024 * 1024)).toFixed(1)}MB). Showing sample.`);
          } else {
            for (let start = 0; start < file.size; start += chunkSize) {
              const chunk = file.slice(start, start + chunkSize);
              const chunkText = await chunk.text();
              const chunkLines = chunkText.split("\n");
              if (start > 0 && processedLines.length > 0 && chunkLines.length > 0) {
                processedLines[processedLines.length - 1] += chunkLines[0];
                processedLines.push(...chunkLines.slice(1));
              } else {
                processedLines.push(...chunkLines);
              }
              loadedChunks++;
              setLoadingFiles((prev) => ({ ...prev, [fileId]: Math.round((loadedChunks / totalChunks) * 100) }));
            }
          }

          const maxLines = isVeryLargeFile ? 200000 : 500000;
          if (processedLines.length > maxLines) {
            const samplingRate = Math.ceil(processedLines.length / maxLines);
            lines = processedLines.filter((_, i) => i % samplingRate === 0);
            console.log(`Sampled large file from ${processedLines.length} to ${lines.length} lines`);
          } else {
            lines = processedLines;
          }
        } else {
          const text = await file.text();
          lines = text.split("\n");
          setLoadingFiles((prev) => ({ ...prev, [fileId]: 100 })); // Mark as loaded for smaller files
        }
      } catch (error) {
        console.error("Error processing file:", error);
        lines = [`[ERROR] Failed to process file: ${file.name}.`];
      }

      parseLogLine(undefined); // Reset parser state
      parseLogLine("-");
      const dates: Date[] = [];
      let firstDate: Date | null = null;
      let lastDate: Date | null = null;

      // Find first date
      for (let i = 0; i < Math.min(1000, lines.length); i++) {
        if (!lines[i]?.trim()) continue;
        const date = parseTimestamp(parseLogLine(lines[i]).timestamp);
        if (date) { firstDate = date; dates.push(date); break; }
      }
      // Find last date
      for (let i = lines.length - 1; i >= Math.max(0, lines.length - 1000); i--) {
         if (!lines[i]?.trim()) continue;
         const date = parseTimestamp(parseLogLine(lines[i]).timestamp);
         if (date) { lastDate = date; dates.push(date); break; }
      }
      // Sample if needed
      if (!firstDate || !lastDate) {
        const sampleSize = Math.min(1000, lines.length);
        const step = Math.max(1, Math.floor(lines.length / sampleSize));
        for (let i = 0; i < lines.length; i += step) {
          if (!lines[i]?.trim()) continue;
          const date = parseTimestamp(parseLogLine(lines[i]).timestamp);
          if (date) dates.push(date);
        }
      }

      const validDates = dates.filter(d => d instanceof Date && !isNaN(d.getTime()));
      const startDate = validDates.length > 0 ? new Date(Math.min(...validDates.map(d => d.getTime()))) : undefined;
      const endDate = validDates.length > 0 ? new Date(Math.max(...validDates.map(d => d.getTime()))) : undefined;

      let bucketSize = "5m";
      if (startDate && endDate) {
        const diffMinutes = (endDate.getTime() - startDate.getTime()) / 60000;
        if (diffMinutes <= 1) bucketSize = "5s";
        else if (diffMinutes <= 60) bucketSize = "30s";
        else {
          const idealBucketSizeMinutes = Math.max(1, Math.ceil(diffMinutes / 120));
          if (idealBucketSizeMinutes <= 0.08) bucketSize = "5s";
          else if (idealBucketSizeMinutes <= 0.17) bucketSize = "10s";
          else if (idealBucketSizeMinutes <= 0.5) bucketSize = "30s";
          else if (idealBucketSizeMinutes <= 1) bucketSize = "1m";
          else if (idealBucketSizeMinutes <= 5) bucketSize = "5m";
          else if (idealBucketSizeMinutes <= 10) bucketSize = "10m";
          else if (idealBucketSizeMinutes <= 30) bucketSize = "30m";
          else if (idealBucketSizeMinutes <= 60) bucketSize = "60m";
          else if (idealBucketSizeMinutes <= 360) bucketSize = "360m";
          else if (idealBucketSizeMinutes <= 720) bucketSize = "720m";
          else if (idealBucketSizeMinutes <= 1440) bucketSize = "1440m";
          else bucketSize = "10080m";
        }
      }

      const recentFileEntry: RecentFile = {
        id: fileId, name: file.name, lastOpened: Date.now(), size: file.size, lines: lines.length,
        startDate: startDate?.toISOString(), endDate: endDate?.toISOString(),
      };
      try {
        const stored = localStorage.getItem("logTrawler_recentFiles");
        let recentFilesList: RecentFile[] = stored ? JSON.parse(stored) : [];
        recentFilesList = recentFilesList.filter(f => f.name !== file.name);
        recentFilesList.unshift(recentFileEntry);
        localStorage.setItem("logTrawler_recentFiles", JSON.stringify(recentFilesList.slice(0, 20)));
      } catch (error) { console.error("Failed to update recent files", error); }

      const processedFile: LogFile = {
        id: fileId, name: file.name, content: lines, startDate, endDate, bucketSize, isLoading: false,
        notes: "", tags: [], interestingLines: [], showOnlyMarked: false, // Initialize new fields
      };

      // Save to IndexedDB (Convert Dates to ISO strings)
      try {
        import("@/lib/indexedDB-fix").then(({ saveLogFile }) => {
          // Explicitly create the object for DB, ensuring correct types for dates/timeRange
          const fileToSaveForDB = {
            id: processedFile.id,
            name: processedFile.name,
            content: processedFile.content,
            startDate: processedFile.startDate?.toISOString(), // string | undefined
            endDate: processedFile.endDate?.toISOString(),     // string | undefined
            bucketSize: processedFile.bucketSize,
            isLoading: processedFile.isLoading,
            lastOpened: Date.now(),
            size: file.size,
            notes: processedFile.notes || "",
            tags: processedFile.tags || [],
            interestingLines: processedFile.interestingLines || [],
            showOnlyMarked: processedFile.showOnlyMarked || false,
            filters: processedFile.filters || [],
            filterLogic: processedFile.filterLogic || "OR",
            // Ensure timeRange exists but nested dates are string | undefined
            timeRange: {
                startDate: undefined, // Initially undefined
                endDate: undefined    // Initially undefined
            }
          };
          // Assert type if necessary, assuming LogFileData expects string dates
          saveLogFile(fileToSaveForDB as any).catch(console.error); // Use 'as any' as a temporary workaround if type inference fails
        });
      } catch (error) { console.error("Error saving to IndexedDB:", error); }

      return processedFile;
    });

    const results = await Promise.all(processedFilesPromises);

    setFiles((prev) => prev.map(f => results.find(pf => pf.id === f.id) || f));

    setTimeout(() => {
      setLoadingFiles((prev) => {
        const newState = { ...prev };
        loadingFileIds.forEach(file => delete newState[file.id]);
        return newState;
      });
    }, 500);
  }, []); // Empty dependency array as it doesn't depend on component state directly

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    await processFiles(Array.from(e.dataTransfer.files));
  }, [processFiles]);

  const handleRemoveFile = useCallback((fileId: string) => {
    const fileToRemove = files.find((f) => f.id === fileId);
    if (fileToRemove?.filters?.length) {
      try {
        import("@/lib/indexedDB-fix").then(({ updateLogFile }) => {
          updateLogFile(fileId, { filters: fileToRemove.filters, filterLogic: fileToRemove.filterLogic || "OR" }).catch(console.error);
        });
      } catch (error) { console.error("Error saving filters before close:", error); }
    }

    setFiles((prev) => prev.filter((f) => f.id !== fileId));
    if (activeFileId === fileId) {
      setActiveFileId(files.find((f) => f.id !== fileId)?.id || null);
    }

    try {
      const stored = localStorage.getItem("logTrawler_recentFiles");
      if (stored) {
        const recent = JSON.parse(stored).filter((f: RecentFile) => f.id !== fileId);
        localStorage.setItem("logTrawler_recentFiles", JSON.stringify(recent));
      }
    } catch (error) { console.error("Error updating localStorage on remove:", error); }
  }, [files, activeFileId]); // Depends on files and activeFileId

  const updateFileState = useCallback((fileId: string, updates: Partial<LogFile>) => {
    setFiles(prevFiles => {
        const newFiles = prevFiles.map(file =>
            file.id === fileId ? { ...file, ...updates } : file
        );
        // Persist change to IndexedDB
        try {
            import("@/lib/indexedDB-fix").then(({ updateLogFile }) => {
                // Convert Date objects back to strings/undefined for storage
                const updatesForDB: Partial<any> = { ...updates }; // Use 'any' temporarily for conversion flexibility

                if ('startDate' in updates && updates.startDate instanceof Date) {
                    updatesForDB.startDate = updates.startDate.toISOString();
                } else if ('startDate' in updates && updates.startDate === undefined) {
                     updatesForDB.startDate = undefined; // Explicitly handle undefined
                }

                if ('endDate' in updates && updates.endDate instanceof Date) {
                    updatesForDB.endDate = updates.endDate.toISOString();
                } else if ('endDate' in updates && updates.endDate === undefined) {
                     updatesForDB.endDate = undefined; // Explicitly handle undefined
                }

                if ('timeRange' in updates) {
                    if (updates.timeRange) {
                        updatesForDB.timeRange = {
                            startDate: updates.timeRange.startDate instanceof Date
                                ? updates.timeRange.startDate.toISOString()
                                : updates.timeRange.startDate, // Keep as is if already string/undefined
                            endDate: updates.timeRange.endDate instanceof Date
                                ? updates.timeRange.endDate.toISOString()
                                : updates.timeRange.endDate, // Keep as is if already string/undefined
                        };
                    } else {
                         updatesForDB.timeRange = undefined; // Handle case where timeRange is set to undefined
                    }
                }

                // Remove properties that are Date objects in the original updates to avoid type errors with updateLogFile if its type is strict
                // This assumes updateLogFile correctly handles Partial<LogFileData> where dates are strings
                const finalUpdatesForDB = Object.fromEntries(
                  Object.entries(updatesForDB).filter(([key, value]) => !(value instanceof Date))
                );


                updateLogFile(fileId, finalUpdatesForDB).catch(err =>
                    console.error(`Failed to update ${Object.keys(finalUpdatesForDB).join(', ')} in IndexedDB:`, err)
                );
            });
        } catch (error) {
            console.error("Error importing IndexedDB module for update:", error);
        }
        return newFiles;
    });
  }, []);


  const handleAddFilter = useCallback((term: string, type: "include" | "exclude", isRegex = false) => {
    if (!term || !activeFile) return;
    const newFilter = { id: Math.random().toString(), type, term, isRegex };
    const currentFilters = activeFile.filters || [];
    updateFileState(activeFile.id, { filters: [...currentFilters, newFilter] });
  }, [activeFile, updateFileState]);

  const handleFilterLogicChange = useCallback((logic: "AND" | "OR") => {
    if (!activeFile) return;
    updateFileState(activeFile.id, { filterLogic: logic });
  }, [activeFile, updateFileState]);

  const handleRemoveFilter = useCallback((id: string) => {
    if (!activeFile?.filters) return;
    const updatedFilters = activeFile.filters.filter((f) => f.id !== id);
    updateFileState(activeFile.id, { filters: updatedFilters });
  }, [activeFile, updateFileState]);

  const handleClearFilters = useCallback(() => {
    if (!activeFile) return;
    updateFileState(activeFile.id, { filters: [] });
  }, [activeFile, updateFileState]);

  const handleTimeRangeSelect = useCallback((startDate?: Date, endDate?: Date) => {
    if (!activeFile) return;
    const newTimeRange = startDate || endDate ? { startDate, endDate } : undefined;
    updateFileState(activeFile.id, { timeRange: newTimeRange });
  }, [activeFile, updateFileState]);

  const handleBucketSizeChange = useCallback((size: string) => {
    if (!activeFile) return;
    updateFileState(activeFile.id, { bucketSize: size });
  }, [activeFile, updateFileState]);

  const handleSearch = useCallback((term: string, isRegex: boolean = false) => {
    setSearchTerm(term);
    setIsRegexSearch(isRegex);
  }, []);

  const fetchLogFromUrl = useCallback(async (url: string) => {
    if (!url) return;
    setIsUrlLoading(true);
    setShowUrlDialog(false);
    const notification = document.createElement("div");
    notification.className = "fixed bottom-4 right-4 bg-primary text-primary-foreground px-4 py-2 rounded-md shadow-md z-50";
    notification.innerHTML = `Loading log from <strong>${url}</strong>...`;
    document.body.appendChild(notification);

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);
      const text = await response.text();
      const fileName = url.split("/").pop() || "remote-log.log";
      const file = new File([text], fileName, { type: "text/plain" });
      await processFiles([file]); // Use the existing processFiles logic
      notification.innerHTML = `Successfully loaded <strong>${fileName}</strong>`;
      notification.className = "fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded-md shadow-md z-50";
      setTimeout(() => {
        notification.classList.add("opacity-0", "transition-opacity", "duration-500");
        setTimeout(() => document.body.removeChild(notification), 500);
      }, 3000);
    } catch (error) {
      console.error("Error fetching log from URL:", error);
      notification.innerHTML = `Error loading log: ${error instanceof Error ? error.message : "Unknown error"}`;
      notification.className = "fixed bottom-4 right-4 bg-destructive text-destructive-foreground px-4 py-2 rounded-md shadow-md z-50";
      setTimeout(() => {
        notification.classList.add("opacity-0", "transition-opacity", "duration-500");
        setTimeout(() => document.body.removeChild(notification), 500);
      }, 5000);
    } finally {
      setIsUrlLoading(false);
      setUrlInputValue("");
    }
  }, [processFiles]);

  const handleSaveNotes = useCallback((fileId: string, notes: string) => {
    updateFileState(fileId, { notes });
  }, [updateFileState]);

  const handleSaveTags = useCallback((fileId: string, tags: string[]) => {
    updateFileState(fileId, { tags });
  }, [updateFileState]);

  const handleUpdateInterestingLines = useCallback((fileId: string, lines: number[]) => {
    updateFileState(fileId, { interestingLines: lines });
  }, [updateFileState]);

  const handleUpdateShowOnlyMarked = useCallback((fileId: string, showOnly: boolean) => {
    updateFileState(fileId, { showOnlyMarked: showOnly });
  }, [updateFileState]);

  const handleLoadPreset = useCallback((preset: FilterPreset) => {
     if (!activeFile) return;
     updateFileState(activeFile.id, { filters: preset.filters });
  }, [activeFile, updateFileState]);

  // Context menu handlers remain here as they modify the `files` state directly
  const handleCloseOtherTabs = useCallback((fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id === fileId));
    setActiveFileId(fileId);
  }, []);

  const handleCloseTabsToLeft = useCallback((fileId: string) => {
    const fileIndex = files.findIndex((f) => f.id === fileId);
    if (fileIndex > 0) {
      setFiles((prev) => prev.filter((_, i) => i >= fileIndex));
      setActiveFileId(fileId);
    }
  }, [files]);

  const handleCloseTabsToRight = useCallback((fileId: string) => {
    const fileIndex = files.findIndex((f) => f.id === fileId);
    if (fileIndex < files.length - 1) {
      setFiles((prev) => prev.filter((_, i) => i <= fileIndex));
      setActiveFileId(fileId);
    }
  }, [files]);

  const handleSummarizeClick = useCallback(() => {
    if (!activeFile || !visibleEntries.length) return;
    const MAX_LINES_FOR_SUMMARY = 500;
    const linesToSummarize = visibleEntries.length > MAX_LINES_FOR_SUMMARY
      ? visibleEntries.slice(0, MAX_LINES_FOR_SUMMARY)
      : visibleEntries;
    const visibleLinesText = linesToSummarize
      .map((entry) => activeFile.content[entry.lineNumber - 1])
      .join("\n");
    let prompt = `Summarize the following log lines:\n\n\`\`\`\n${visibleLinesText}\n\`\`\``;
    if (visibleEntries.length > MAX_LINES_FOR_SUMMARY) {
        prompt += `\n\n(Note: Summarizing the first ${MAX_LINES_FOR_SUMMARY} of ${visibleEntries.length} visible lines.)`;
    }
    const event = new CustomEvent("openChatWithPrompt", { detail: { prompt, autoSubmit: true } });
    document.dispatchEvent(event);
  }, [activeFile, visibleEntries]);


  return (
    <div
      className="min-h-screen bg-background flex flex-col relative"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragLeave={handleDragLeave}
    >
      <Header
        onFileInputClick={() => document.getElementById("fileInput")?.click()}
        onLogoClick={() => setActiveFileId(null)}
        showDateControls={!!activeFileId}
        startDate={activeFile?.timeRange?.startDate || activeFile?.startDate}
        endDate={activeFile?.timeRange?.endDate || activeFile?.endDate}
        onRangeChange={(start, end) => {
          handleTimeRangeSelect(start, end);
          // No need to call setFiles here, handleTimeRangeSelect uses updateFileState
        }}
      />
      <div className="p-4 flex flex-col gap-4 flex-grow">
        <ChatPanel
          isOpen={chatPanelOpen}
          onClose={() => setChatPanelOpen(false)}
        />
        <div className="fixed bottom-4 right-4 flex items-center gap-2 text-muted-foreground z-10">
          <Button
            variant="outline"
            size="icon"
            className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => setChatPanelOpen(!chatPanelOpen)}
          >
            <Bot className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          {/* Top info bar */}
          {activeFileId && activeFile && (
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="bg-muted/30 p-1 rounded">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-primary"
                    >
                      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>
                  <span className="font-medium text-sm">{activeFile.name}</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <div className="hidden lg:block text-sm text-muted-foreground whitespace-nowrap">
                  Total Lines:{" "}
                  <span className="font-medium">
                    {activeFile.content.length.toLocaleString()}
                  </span>
                  <span className="mx-2">•</span>
                  Visible Lines:{" "}
                  <span className="font-medium">
                    {visibleEntries.length.toLocaleString()}
                  </span>
                  <span className="mx-2">•</span>(
                  {(
                    (visibleEntries.length / (activeFile.content.length || 1)) *
                    100
                  ).toFixed(1)}
                  % visible)
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-4 order-first">
                    <Button
                      variant="default"
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-1 px-2 py-1 rounded-md text-xs"
                      onClick={handleSummarizeClick}
                    >
                      <Bot className="h-3 w-3" />
                      Summarize with AI
                    </Button>
                  </div>
                  <ExportButton
                    fileName={activeFile.name}
                    content={visibleEntries.map(
                      (entry) => activeFile.content[entry.lineNumber - 1],
                    )}
                    disabled={!visibleEntries.length}
                  />
                </div>
              </div>
              <input
                id="fileInput"
                type="file"
                multiple
                className="hidden"
                onChange={async (e) => {
                  if (e.target.files) {
                    await processFiles(Array.from(e.target.files));
                  }
                }}
              />
            </div>
          )}

          {/* Conditional Rendering */}
          {!activeFileId ? (
            <InitialView
              isDragging={isDragging}
              files={files}
              onFileInputClick={() => document.getElementById("fileInput")?.click()}
              onUrlInputClick={() => setShowUrlDialog(true)}
              fetchLogFromUrl={fetchLogFromUrl}
              handleRecentFileSelect={handleRecentFileSelect}
              onMultipleFilesSelect={async (selectedFiles) => {
                for (const file of selectedFiles) {
                  await handleRecentFileSelect(file);
                }
              }}
              setActiveFileId={setActiveFileId}
            />
          ) : (
            <FileView
              files={files}
              activeFile={activeFile}
              activeFileId={activeFileId}
              setActiveFileId={setActiveFileId}
              handleRemoveFile={handleRemoveFile} // Pass the main handler
              loadingFiles={loadingFiles}
              chartVisible={chartVisible}
              setChartVisible={setChartVisible}
              chartEntries={chartEntries}
              visibleEntries={visibleEntries}
              processedEntries={processedEntries}
              handleTimeRangeSelect={handleTimeRangeSelect}
              handleBucketSizeChange={handleBucketSizeChange}
              statsVisible={statsVisible}
              setStatsVisible={setStatsVisible}
              handleAddFilter={handleAddFilter}
              handleFilterLogicChange={handleFilterLogicChange}
              handleRemoveFilter={handleRemoveFilter}
              handleClearFilters={handleClearFilters}
              handleSearch={handleSearch}
              searchTerm={searchTerm}
              isRegexSearch={isRegexSearch}
              presets={presets}
              setPresets={setPresets} // Pass state setter
              handleSummarizeClick={handleSummarizeClick}
              onUpdateInterestingLines={handleUpdateInterestingLines}
              onUpdateShowOnlyMarked={handleUpdateShowOnlyMarked}
              onSaveNotes={handleSaveNotes}
              onSaveTags={handleSaveTags}
              // Pass down context menu handlers if needed in FileView
              // handleCloseOtherTabs={handleCloseOtherTabs}
              // handleCloseTabsToLeft={handleCloseTabsToLeft}
              // handleCloseTabsToRight={handleCloseTabsToRight}
              // Pass down preset load handler if needed in FileView
              // handleLoadPreset={handleLoadPreset}
            />
          )}
        </div>
      </div>

      <footer className="w-full py-4 border-t mt-auto bg-background">
        <div className="flex items-center gap-4 px-6">
          <div className="text-xs text-muted-foreground">
            Made with ♥️ by{" "}
            <a
              href="https://www.dbmarlin.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary transition-colors"
            >
              dbmarlin.com
            </a>
          </div>
          <a
            href="https://github.com/DBmarlin/log-trawler"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="lucide lucide-github"
            >
              <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
              <path d="M9 18c-4.51 2-5-2-7-2" />
            </svg>
            <span>v0.3.0</span>
          </a>
        </div>
      </footer>

      {showUrlDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">
              Open Log File from URL
            </h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="url-input" className="text-sm font-medium">
                  Enter the URL of the log file:
                </label>
                <input
                  id="url-input"
                  type="url"
                  value={urlInputValue}
                  onChange={(e) => setUrlInputValue(e.target.value)}
                  placeholder="https://example.com/logfile.log"
                  className="w-full px-3 py-2 border rounded-md text-sm bg-background text-foreground"
                  autoFocus
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowUrlDialog(false);
                    setUrlInputValue("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  disabled={!urlInputValue || isUrlLoading}
                  onClick={() => fetchLogFromUrl(urlInputValue)}
                >
                  {isUrlLoading ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-2 h-4 w-4"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Loading...
                    </>
                  ) : (
                    "Open"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
