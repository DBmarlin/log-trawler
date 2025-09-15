import React, { useState, useCallback, useMemo } from "react";
import { LogFile } from "@/components/home"; // Assuming LogFile is exported from home.tsx or moved
import { RecentFile } from "@/components/log-viewer/RecentFiles";
import { parseLogLine, parseTimestamp } from "@/lib/utils";
import { getLogFileById, saveLogFile, updateLogFile } from "@/lib/indexedDB-fix"; // Assuming these are correctly exported

export function useFileManagement() {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<LogFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [loadingFiles, setLoadingFiles] = useState<{ [key: string]: number }>({});
  const [showUrlDialog, setShowUrlDialog] = useState(false);
  const [urlInputValue, setUrlInputValue] = useState("");
  const [isUrlLoading, setIsUrlLoading] = useState(false);

  const activeFile = useMemo(() => files.find((f) => f.id === activeFileId), [files, activeFileId]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const updateFileState = useCallback((fileId: string, updates: Partial<LogFile>) => {
    setFiles(prevFiles => {
        const newFiles = prevFiles.map(file =>
            file.id === fileId ? { ...file, ...updates } : file
        );
        // Persist change to IndexedDB
        try {
            // Convert Date objects back to strings/undefined for storage
            const updatesForDB: Partial<any> = { ...updates };

            if ('startDate' in updates && updates.startDate instanceof Date) {
                updatesForDB.startDate = updates.startDate.toISOString();
            } else if ('startDate' in updates && updates.startDate === undefined) {
                 updatesForDB.startDate = undefined;
            }

            if ('endDate' in updates && updates.endDate instanceof Date) {
                updatesForDB.endDate = updates.endDate.toISOString();
            } else if ('endDate' in updates && updates.endDate === undefined) {
                 updatesForDB.endDate = undefined;
            }

            if ('timeRange' in updates) {
                if (updates.timeRange) {
                    updatesForDB.timeRange = {
                        startDate: updates.timeRange.startDate instanceof Date
                            ? updates.timeRange.startDate.toISOString()
                            : updates.timeRange.startDate,
                        endDate: updates.timeRange.endDate instanceof Date
                            ? updates.timeRange.endDate.toISOString()
                            : updates.timeRange.endDate,
                    };
                } else {
                     updatesForDB.timeRange = undefined;
                }
            }

            const finalUpdatesForDB = Object.fromEntries(
              Object.entries(updatesForDB).filter(([key, value]) => !(value instanceof Date))
            );

            updateLogFile(fileId, finalUpdatesForDB).catch(err =>
                console.error(`Failed to update ${Object.keys(finalUpdatesForDB).join(', ')} in IndexedDB:`, err)
            );
        } catch (error) {
            console.error("Error preparing update for IndexedDB:", error);
        }
        return newFiles;
    });
  }, []);


  const processFilesInternal = useCallback(async (droppedFiles: File[]) => {
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

    if (loadingFileIds.length > 0 && !activeFileId) {
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

          const maxLines = isVeryLargeFile ? 2500000 : 500000;
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
          setLoadingFiles((prev) => ({ ...prev, [fileId]: 100 }));
        }
      } catch (error) {
        console.error("Error processing file:", error);
        lines = [`[ERROR] Failed to process file: ${file.name}.`];
      }

      parseLogLine(undefined);
      parseLogLine("-");
      const dates: Date[] = [];
      let firstDate: Date | null = null;
      let lastDate: Date | null = null;

      for (let i = 0; i < Math.min(1000, lines.length); i++) {
        if (!lines[i]?.trim()) continue;
        const date = parseTimestamp(parseLogLine(lines[i]).timestamp);
        if (date) { firstDate = date; dates.push(date); break; }
      }
      for (let i = lines.length - 1; i >= Math.max(0, lines.length - 1000); i--) {
         if (!lines[i]?.trim()) continue;
         const date = parseTimestamp(parseLogLine(lines[i]).timestamp);
         if (date) { lastDate = date; dates.push(date); break; }
      }
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
        notes: "", tags: [], interestingLines: [], showOnlyMarked: false, filters: [], filterLogic: "OR", timeRange: undefined,
      };

      try {
          const fileToSaveForDB = {
            id: processedFile.id,
            name: processedFile.name,
            content: processedFile.content,
            startDate: processedFile.startDate?.toISOString(),
            endDate: processedFile.endDate?.toISOString(),
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
            timeRange: { startDate: undefined, endDate: undefined }
          };
          saveLogFile(fileToSaveForDB as any).catch(console.error);
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
  }, []); // Removed activeFileId dependency

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    console.log("Drop event triggered");
    console.log("Files received:", e.dataTransfer.files);
    e.preventDefault();
    setIsDragging(false);
    await processFilesInternal(Array.from(e.dataTransfer.files));
  }, [processFilesInternal]);

  const handleRemoveFile = useCallback((fileId: string) => {
    const fileToRemove = files.find((f) => f.id === fileId);
    if (fileToRemove?.filters?.length || fileToRemove?.notes || fileToRemove?.tags?.length || fileToRemove?.interestingLines?.length || fileToRemove?.timeRange) {
      try {
          const updatesForDB: Partial<any> = {};
          if (fileToRemove.filters?.length) updatesForDB.filters = fileToRemove.filters;
          if (fileToRemove.filterLogic) updatesForDB.filterLogic = fileToRemove.filterLogic;
          if (fileToRemove.notes) updatesForDB.notes = fileToRemove.notes;
          if (fileToRemove.tags?.length) updatesForDB.tags = fileToRemove.tags;
          if (fileToRemove.interestingLines?.length) updatesForDB.interestingLines = fileToRemove.interestingLines;
          if (fileToRemove.showOnlyMarked) updatesForDB.showOnlyMarked = fileToRemove.showOnlyMarked;
          if (fileToRemove.timeRange) {
              updatesForDB.timeRange = {
                  startDate: fileToRemove.timeRange.startDate?.toISOString(),
                  endDate: fileToRemove.timeRange.endDate?.toISOString()
              };
          }
          if (Object.keys(updatesForDB).length > 0) {
              updateLogFile(fileId, updatesForDB).catch(console.error);
          }
      } catch (error) { console.error("Error saving state before close:", error); }
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
  }, [files, activeFileId]);

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
      const logFile = await getLogFileById(recentFile.id);

      if (logFile?.content?.length > 0) {
        const processedFile: LogFile = {
          ...logFile,
          // Ensure dates are Date objects when loading into state
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
          filters: logFile.filters || [],
          filterLogic: logFile.filterLogic || "OR",
          isLoading: false, // Ensure isLoading is false
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
      await processFilesInternal([file]);
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
  }, [processFilesInternal]);

  // Context menu handlers
  const handleCloseOtherTabs = useCallback((fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id === fileId));
    setActiveFileId(fileId);
  }, []);

  const handleCloseTabsToLeft = useCallback((fileId: string) => {
    const fileIndex = files.findIndex((f) => f.id === fileId);
    if (fileIndex > 0) {
      setFiles((prev) => prev.filter((_, i) => i >= fileIndex));
      setActiveFileId(fileId); // Keep the clicked one active
    }
  }, [files]);

  const handleCloseTabsToRight = useCallback((fileId: string) => {
    const fileIndex = files.findIndex((f) => f.id === fileId);
    if (fileIndex < files.length - 1) {
      setFiles((prev) => prev.filter((_, i) => i <= fileIndex));
      setActiveFileId(fileId); // Keep the clicked one active
    }
  }, [files]);


  return {
    isDragging,
    files,
    activeFileId,
    activeFile,
    loadingFiles,
    showUrlDialog,
    urlInputValue,
    isUrlLoading,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleRemoveFile,
    handleRecentFileSelect,
    fetchLogFromUrl,
    setActiveFileId,
    setShowUrlDialog,
    setUrlInputValue,
    updateFileState, // Expose the state updater
    handleCloseOtherTabs,
    handleCloseTabsToLeft,
    handleCloseTabsToRight,
    processFiles: processFilesInternal // Expose the processing function
  };
}
