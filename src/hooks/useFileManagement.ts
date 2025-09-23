import React, { useState, useCallback, useMemo } from "react";
import { FileItem } from "@/types/fileSystem";
import { parseLogLine, parseTimestamp } from "@/lib/utils";
import { getLogFileById, saveLogFile, updateLogFile, deleteLogFile } from "@/lib/indexedDB-fix";

type RecentFile = Omit<FileItem, 'content'> & { lines?: number };
type LogFile = FileItem & { isLoading?: boolean };

export function useFileManagement() {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<FileItem[]>([]);
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

  const updateFileState = useCallback((fileId: string, updates: Partial<FileItem>) => {
    setFiles(prevFiles => {
        const newFiles = prevFiles.map(file =>
            file.id === fileId ? { ...file, ...updates } : file
        );
        // Persist change to IndexedDB
        try {
            updateLogFile(fileId, updates).catch(err =>
                console.error(`Failed to update in IndexedDB:`, err)
            );
        } catch (error) {
            console.error("Error preparing update for IndexedDB:", error);
        }
        return newFiles;
    });
  }, []);


  const processFilesInternal = useCallback(async (droppedFiles: File[]) => {
    // Dynamically import archive libraries
    const JSZip = (await import("jszip")).default;
    const { gunzipSync, strFromU8 } = await import("fflate");
    // Minimal tar extraction utility for .tar parsing
    function extractTarEntries(tarBuffer: Uint8Array) {
      const files: { name: string, data: Uint8Array }[] = [];
      let offset = 0;
      while (offset < tarBuffer.length) {
        // Read header
        const name = new TextDecoder().decode(tarBuffer.slice(offset, offset + 100)).replace(/\0.*$/, "");
        if (!name) break;
        const sizeOctal = new TextDecoder().decode(tarBuffer.slice(offset + 124, offset + 136)).replace(/\0.*$/, "");
        const size = parseInt(sizeOctal.trim(), 8);
        const dataStart = offset + 512;
        const dataEnd = dataStart + size;
        files.push({ name, data: tarBuffer.slice(dataStart, dataEnd) });
        offset = dataEnd + (512 - (size % 512 || 512));
      }
      return files;
    }

    // Helper to process a log file (from archive or direct)
    async function processLogFile(name: string, content: string | Uint8Array) {
      const fileId = name.replace(/[^a-z0-9]/gi, "_") + "_" + Date.now();
      let lines: string[] = [];
      if (typeof content === "string") {
        lines = content.split("\n");
      } else {
        // Uint8Array: decode as UTF-8 string
        const decoder = new TextDecoder("utf-8");
        lines = decoder.decode(content).split("\n");
      }
      // (The rest of the logic for date parsing, bucket size, etc. is unchanged)
      // ... (copy from below, see after this block)
      return { fileId, name, lines };
    }

    // Gather all log files to process (direct or extracted)
    let logFilesToProcess: { name: string, content: string | Uint8Array, folderId?: string, children?: string[] }[] = [];

    for (const file of droppedFiles) {
      if (file.name.endsWith(".zip") || file.name.endsWith(".tar.gz")) {
        // Group extracted files into a folder named after the archive (extension stripped)
        const isZip = file.name.endsWith(".zip");
        const baseName = isZip
          ? file.name.replace(/\.zip$/i, "")
          : file.name.replace(/\.tar\.gz$/i, "");
        const folderId = `folder_${baseName.replace(/[^a-z0-9]/gi, "_")}_${Date.now()}`;
        const folder = {
          id: folderId,
          name: baseName,
          type: "folder" as const,
          lastOpened: Date.now(),
          children: [],
        };
        await saveLogFile(folder as FileItem);

        let extractedEntries: { name: string; content: Uint8Array }[] = [];
        if (isZip) {
          const arrayBuffer = await file.arrayBuffer();
          const zip = await JSZip.loadAsync(arrayBuffer);
          for (const [zipEntryName, zipEntry] of Object.entries(zip.files)) {
            if (!zipEntry.dir && zipEntryName.endsWith(".log")) {
              const content = await zipEntry.async("uint8array");
              extractedEntries.push({ name: zipEntryName, content });
            }
          }
        } else {
          // tar.gz
          const arrayBuffer = await file.arrayBuffer();
          const uint8 = new Uint8Array(arrayBuffer);
          const tarData = gunzipSync(uint8);
          const entries = extractTarEntries(tarData);
          for (const entry of entries) {
            if (entry.name.endsWith(".log")) {
              extractedEntries.push({ name: entry.name, content: entry.data });
            }
          }
        }

        // Save each extracted log file with parentId = folderId
        const fileIds: string[] = [];
        for (const entry of extractedEntries) {
          const logFileId = `file_${entry.name.replace(/[^a-z0-9]/gi, "_")}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const decoder = new TextDecoder("utf-8");
          const lines = decoder.decode(entry.content).split("\n");
          // Parse startDate and endDate from lines (same logic as main processing)
          parseLogLine(undefined); // Reset timestamp parser state
          parseLogLine("-"); // Initialize parser state if needed
          let startDate: Date | undefined = undefined;
          let endDate: Date | undefined = undefined;
          const dates: Date[] = [];
          for (let i = 0; i < Math.min(1000, lines.length); i++) {
            if (!lines[i]?.trim()) continue;
            const date = parseTimestamp(parseLogLine(lines[i]).timestamp);
            if (date) { startDate = date; dates.push(date); break; }
          }
          for (let i = lines.length - 1; i >= Math.max(0, lines.length - 1000); i--) {
            if (!lines[i]?.trim()) continue;
            const date = parseTimestamp(parseLogLine(lines[i]).timestamp);
            if (date) { endDate = date; dates.push(date); break; }
          }
          if (!startDate || !endDate) {
            const sampleSize = Math.min(1000, lines.length);
            const step = Math.max(1, Math.floor(lines.length / sampleSize));
            for (let i = 0; i < lines.length; i += step) {
              if (!lines[i]?.trim()) continue;
              const date = parseTimestamp(parseLogLine(lines[i]).timestamp);
              if (date) dates.push(date);
            }
          }
          const validDates = dates.filter(d => d instanceof Date && !isNaN(d.getTime()));
          if (!startDate && validDates.length > 0) startDate = new Date(Math.min(...validDates.map(d => d.getTime())));
          if (!endDate && validDates.length > 0) endDate = new Date(Math.max(...validDates.map(d => d.getTime())));

          // Calculate bucket size (same logic as single files)
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

          const logFile = {
            id: logFileId,
            name: entry.name,
            type: "file" as const,
            lastOpened: Date.now(),
            parentId: folderId,
            content: lines,
            size: entry.content.length,
            lines: lines.length,
            startDate: startDate,
            endDate: endDate,
            bucketSize: bucketSize,
          };
          await saveLogFile(logFile as FileItem);
          fileIds.push(logFileId);
        }
        // Update folder with children (no startDate/endDate for folders)
        await updateLogFile(folderId, { children: fileIds });

        // Add folder to localStorage recent files
        try {
          const stored = localStorage.getItem("logTrawler_recentFiles");
          let recentFilesList: RecentFile[] = stored ? JSON.parse(stored) : [];
          recentFilesList = recentFilesList.filter(f => f.name !== baseName);
          recentFilesList.unshift({
            id: folderId,
            name: baseName,
            lastOpened: Date.now(),
            type: 'folder',
          });
          localStorage.setItem("logTrawler_recentFiles", JSON.stringify(recentFilesList.slice(0, 20)));
        } catch (error) { console.error("Failed to update recent files", error); }
      } else if (file.name.endsWith(".log")) {
        // Direct log file
        logFilesToProcess.push({ name: file.name, content: await file.text() });
      }
      // Ignore other file types
    }

    // Now process all log files (direct or extracted)
    const loadingFileIds = logFilesToProcess.map((file) => ({
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
        id: file.id, name: file.name, content: [], type: "file" as const, lastOpened: Date.now(), isLoading: true,
      })),
    ]);

    if (loadingFileIds.length > 0 && !activeFileId) {
      setActiveFileId(loadingFileIds[0].id);
    }

    const processedFilesPromises = logFilesToProcess.map(async (logFile, index) => {
      const fileId = loadingFileIds[index].id;
      let lines: string[] = [];
      if (typeof logFile.content === "string") {
        lines = logFile.content.split("\n");
        setLoadingFiles((prev) => ({ ...prev, [fileId]: 100 }));
      } else {
        const decoder = new TextDecoder("utf-8");
        lines = decoder.decode(logFile.content).split("\n");
        setLoadingFiles((prev) => ({ ...prev, [fileId]: 100 }));
      }

      // (The rest of the logic for date parsing, bucket size, etc. is unchanged)
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
        id: fileId, name: logFile.name, lastOpened: Date.now(), size: lines.length, lines: lines.length,
        startDate: startDate, endDate: endDate, type: 'file',
      };

      const processedFile: LogFile = {
        id: fileId,
        name: logFile.name,
        content: lines,
        startDate,
        endDate,
        bucketSize,
        isLoading: false,
        notes: "",
        tags: [],
        interestingLines: [],
        showOnlyMarked: false,
        filters: [],
        filterLogic: "OR",
        timeRange: undefined,
        type: 'file',
        lastOpened: Date.now(),
      };

      try {
        const stored = localStorage.getItem("logTrawler_recentFiles");
        let recentFilesList: RecentFile[] = stored ? JSON.parse(stored) : [];
        recentFilesList = recentFilesList.filter(f => f.name !== logFile.name);
        recentFilesList.unshift(recentFileEntry);
        localStorage.setItem("logTrawler_recentFiles", JSON.stringify(recentFilesList.slice(0, 20)));
      } catch (error) { console.error("Failed to update recent files", error); }

      try {
          const fileToSaveForDB = {
            type: 'file',
            id: processedFile.id,
            name: processedFile.name,
            content: processedFile.content,
            startDate: processedFile.startDate,
            endDate: processedFile.endDate,
            bucketSize: processedFile.bucketSize,
            lastOpened: Date.now(),
            size: lines.length,
            notes: processedFile.notes || "",
            tags: processedFile.tags || [],
            interestingLines: processedFile.interestingLines || [],
            showOnlyMarked: processedFile.showOnlyMarked || false,
            filters: processedFile.filters || [],
            filterLogic: processedFile.filterLogic || "OR",
            timeRange: { startDate: undefined, endDate: undefined }
          };
          saveLogFile(fileToSaveForDB as FileItem).catch(console.error);
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
    // Dispatch event after a delay to ensure IndexedDB transactions are committed
    setTimeout(() => document.dispatchEvent(new CustomEvent("filesChanged")), 200);
  }, [processFilesInternal]);

  const handleRemoveFile = useCallback(async (fileId: string) => {
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
                  startDate: fileToRemove.timeRange.startDate,
                  endDate: fileToRemove.timeRange.endDate
              };
          }
          if (Object.keys(updatesForDB).length > 0) {
              updateLogFile(fileId, updatesForDB).catch(console.error);
          }
      } catch (error) { console.error("Error saving state before close:", error); }
    }

    // Only delete from IndexedDB if it's a folder (and its children)
    if (fileToRemove?.type === "folder") {
      const idsToRemove = fileToRemove.children?.length
        ? [fileId, ...fileToRemove.children]
        : [fileId];
      for (const id of idsToRemove) {
        await deleteLogFile(id);
      }
    }

    // Remove from UI state
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
    if (activeFileId === fileId) {
      setActiveFileId(files.find((f) => f.id !== fileId)?.id || null);
    }

    // Update localStorage recent files by removing the deleted items
    try {
      const stored = localStorage.getItem("logTrawler_recentFiles");
      if (stored) {
        let recentFilesList: any[] = JSON.parse(stored);
        if (fileToRemove?.type === "folder") {
          const idsToRemove = fileToRemove.children?.length
            ? [fileId, ...fileToRemove.children]
            : [fileId];
          recentFilesList = recentFilesList.filter(f => !idsToRemove.includes(f.id));
        } else {
          recentFilesList = recentFilesList.filter(f => f.id !== fileId);
        }
        localStorage.setItem("logTrawler_recentFiles", JSON.stringify(recentFilesList));
      }
    } catch (error) {
      console.error("Failed to update localStorage recent files:", error);
    }

    // Dispatch event to notify other components of file changes
    document.dispatchEvent(new CustomEvent("filesChanged"));
  }, [files, activeFileId]);

  const handleRecentFileSelect = useCallback(async (recentFile: FileItem, setAsActive: boolean = true) => {
    if (recentFile.id.match(/^0\.[0-9]+$/)) {
      recentFile.id = recentFile.name.replace(/[^a-z0-9]/gi, "_") + "_" + recentFile.lastOpened;
    }
    const existingFile = files.find((f) => f.id === recentFile.id);
    if (existingFile) {
      if (setAsActive) {
        setActiveFileId(existingFile.id);
      }
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
          content: logFile.content || [],
          isLoading: false,
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
        if (setAsActive) {
          setActiveFileId(processedFile.id);
        }
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

  const handleCloseAllFiles = useCallback(() => {
    setFiles([]);
    setActiveFileId(null);
  }, []);

  const renameItem = useCallback(async (itemId: string, newName: string) => {
    if (!newName.trim()) return false;

    try {
      // Update in IndexedDB
      await updateLogFile(itemId, { name: newName.trim() });

      // Update in local state
      setFiles(prevFiles => prevFiles.map(file =>
        file.id === itemId ? { ...file, name: newName.trim() } : file
      ));

      // Update localStorage recent files
      try {
        const stored = localStorage.getItem("logTrawler_recentFiles");
        if (stored) {
          let recentFilesList: any[] = JSON.parse(stored);
          recentFilesList = recentFilesList.map(f =>
            f.id === itemId ? { ...f, name: newName.trim() } : f
          );
          localStorage.setItem("logTrawler_recentFiles", JSON.stringify(recentFilesList));
        }
      } catch (error) {
        console.error("Failed to update localStorage:", error);
      }

      // Dispatch event to notify other components
      document.dispatchEvent(new CustomEvent("filesChanged"));

      return true;
    } catch (error) {
      console.error("Failed to rename item:", error);
      return false;
    }
  }, []);

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
    handleCloseAllFiles,
    renameItem, // Expose the rename function
    processFiles: processFilesInternal // Expose the processing function
  };
}
