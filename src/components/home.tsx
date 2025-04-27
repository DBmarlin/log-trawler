import React, { useState, useCallback, useMemo, useEffect } from "react"; // Added useEffect back
import { Bot } from "lucide-react";
import Header from "./header/Header";
import { Button } from "@/components/ui/button";
import { parseLogLine, parseTimestamp } from "@/lib/utils"; // Keep utils
import { type FilterPreset } from "./log-viewer/FilterPresets"; // Keep type
import ExportButton from "./log-viewer/ExportButton";
import ChatPanel from "./chat-panel/ChatPanel";
import InitialView from "./home/InitialView";
import FileView from "./home/FileView";
import { useFileManagement } from "@/hooks/useFileManagement"; // Import file management hook
import { useLogProcessing } from "@/hooks/useLogProcessing"; // Import log processing hook

// Export the interface so hooks can use it
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
  
  // --- Hooks ---
  const {
    isDragging,
    files,
    activeFileId,
    activeFile, // Get activeFile directly from the hook
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
    updateFileState, // Get state updater from hook
    handleCloseOtherTabs,
    handleCloseTabsToLeft,
    handleCloseTabsToRight,
    processFiles // Get processFiles from hook
  } = useFileManagement();

  const { processedEntries, visibleEntries } = useLogProcessing(activeFile);

  // --- UI State (Remains in Home) ---
  const [searchTerm, setSearchTerm] = useState(""); // Search state might move later
  const [isRegexSearch, setIsRegexSearch] = useState(false); // Search state might move later
  const [presets, setPresets] = useState<FilterPreset[]>([]); // Preset state might move later
  const [statsVisible, setStatsVisible] = useState(() => window.innerWidth >= 768);
  const [chatPanelOpen, setChatPanelOpen] = useState(false);
  const [chartVisible, setChartVisible] = useState(true);

  // --- Memoized Values ---
  // activeFile is now provided by useFileManagement hook
  // Chart entries calculation depends on activeFile content
  const chartEntries = useMemo(() => {
    if (!activeFile?.content) return []; // Use activeFile from hook
    const content = activeFile.content;
    const sampleSize = Math.min(2000, content.length);
    const step = Math.max(1, Math.floor(content.length / sampleSize));
    const sample = [];
    for (let i = 0; i < content.length; i += step) {
      sample.push(content[i]);
    }
    return sample;
  }, [activeFile]); // Depend on activeFile from hook


  // --- Effect Hooks ---
  // Effect for chat panel event listener remains in Home
  useEffect(() => {
    const handleSetChatPanelOpen = (event: CustomEvent<{ open: boolean }>) => {
      console.log("Home: handleSetChatPanelOpen received event:", event.detail); // Diagnostic log
      if (event.detail.open) {
        setChatPanelOpen(true);
      }
    };
    document.addEventListener("setChatPanelOpen", handleSetChatPanelOpen as EventListener);
    return () => {
      document.removeEventListener("setChatPanelOpen", handleSetChatPanelOpen as EventListener);
    };
  }, []);

  // Effects for processing/filtering logs are now in useLogProcessing hook

  // --- Handlers ---
  // Drag/drop, file processing, recent file selection, URL fetching, remove file,
  // context menu handlers are now provided by useFileManagement hook.

  // Handlers related to active file state modification (will be passed down)
  const handleAddFilter = useCallback((term: string, type: "include" | "exclude", isRegex = false) => {
    if (!term || !activeFile) return;
    const newFilter = { id: Math.random().toString(), type, term, isRegex };
    const currentFilters = activeFile.filters || [];
    updateFileState(activeFile.id, { filters: [...currentFilters, newFilter] });
  }, [activeFile, updateFileState]); // Depends on activeFile and updateFileState from hook

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

  const handleToggleFilterType = useCallback((id: string) => {
    if (!activeFile?.filters) return;
    const updatedFilters = activeFile.filters.map((f) => {
      if (f.id === id) {
        // Explicitly cast the toggled type
        const newType = (f.type === "include" ? "exclude" : "include") as "include" | "exclude";
        return { ...f, type: newType };
      }
      return f;
    });
    updateFileState(activeFile.id, { filters: updatedFilters });
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

  // Search handlers remain here for now, might move to FileView later
  const handleSearch = useCallback((term: string, isRegex: boolean = false) => {
    setSearchTerm(term);
    setIsRegexSearch(isRegex);
  }, []);

  // Notes/Tags/Interesting Lines handlers use updateFileState
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

  // Preset handler uses updateFileState
   const handleLoadPreset = useCallback((preset: FilterPreset) => {
      if (!activeFile) return;
      // Presets only define filters based on the interface
      const updates: Partial<LogFile> = { filters: preset.filters };
      // Do not attempt to set filterLogic from preset
      updateFileState(activeFile.id, updates);
   }, [activeFile, updateFileState]);

  // Summarize handler remains here as it uses visibleEntries
  const handleSummarizeClick = useCallback(() => {
    if (!activeFile?.content || !visibleEntries.length) return; // Check activeFile.content
    const MAX_LINES_FOR_SUMMARY = 500;
    const linesToSummarize = visibleEntries.length > MAX_LINES_FOR_SUMMARY
      ? visibleEntries.slice(0, MAX_LINES_FOR_SUMMARY)
      : visibleEntries;

    // Ensure we access content safely
    const content = activeFile.content;
    const visibleLinesText = linesToSummarize
      .map((entry) => content[entry.lineNumber - 1]) // Access content safely
      .join("\n");

    let prompt = `Summarize the following log lines:\n\n\`\`\`\n${visibleLinesText}\n\`\`\``;
    if (visibleEntries.length > MAX_LINES_FOR_SUMMARY) {
        prompt += `\n\n(Note: Summarizing the first ${MAX_LINES_FOR_SUMMARY} of ${visibleEntries.length} visible lines.)`;
    }
    const event = new CustomEvent("openChatWithPrompt", { detail: { prompt, autoSubmit: true } });
    document.dispatchEvent(event);
  }, [activeFile, visibleEntries]); // Depend on activeFile from hook


  return (
    <div
      className="min-h-screen bg-background flex flex-col relative"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragLeave={handleDragLeave}
    >
      <Header
        onFileInputClick={() => document.getElementById("fileInput")?.click()}
        onLogoClick={() => setActiveFileId(null)} // Use setActiveFileId from hook
        showDateControls={!!activeFileId}
        startDate={activeFile?.timeRange?.startDate || activeFile?.startDate} // Use activeFile from hook
        endDate={activeFile?.timeRange?.endDate || activeFile?.endDate} // Use activeFile from hook
        onRangeChange={handleTimeRangeSelect} // Pass handler directly
      />
      {/* Moved file input here so it's always available */}
      <input
        id="fileInput"
        type="file"
        multiple
        className="hidden"
        onChange={async (e) => {
          if (e.target.files) {
            await processFiles(Array.from(e.target.files)); // Use processFiles from hook
          }
        }}
      />
      <div className="p-4 flex flex-col gap-4 flex-grow">
        <ChatPanel
          isOpen={chatPanelOpen}
          onClose={() => setChatPanelOpen(false)}
          onOpenRequest={() => setChatPanelOpen(true)} // Pass the state setter directly
        />
        {/* Chat button remains */}
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
          {/* Top info bar - Use activeFile from hook */}
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
                 {/* Use activeFile.content safely */}
                <div className="hidden lg:block text-sm text-muted-foreground whitespace-nowrap">
                  Total Lines:{" "}
                  <span className="font-medium">
                    {(activeFile.content?.length ?? 0).toLocaleString()}
                  </span>
                  <span className="mx-2">•</span>
                  Visible Lines:{" "}
                  <span className="font-medium">
                    {visibleEntries.length.toLocaleString()}
                  </span>
                  <span className="mx-2">•</span>(
                  {(
                    (visibleEntries.length / (activeFile.content?.length || 1)) *
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
                      disabled={!visibleEntries.length} // Disable if no visible entries
                    >
                      <Bot className="h-3 w-3" />
                      Summarize with AI
                    </Button>
                  </div>
                  <ExportButton
                    fileName={activeFile.name}
                    // Use activeFile.content safely
                    content={visibleEntries.map(
                      (entry) => activeFile.content?.[entry.lineNumber - 1] ?? ''
                    )}
                    disabled={!visibleEntries.length}
                  />
                </div>
              </div>
              {/* Input moved outside this conditional block */}
            </div>
          )}

          {/* Conditional Rendering - Pass hook values/handlers */}
          {!activeFileId ? (
            <InitialView
              isDragging={isDragging} // From hook
              files={files} // From hook
              onFileInputClick={() => document.getElementById("fileInput")?.click()}
              onUrlInputClick={() => setShowUrlDialog(true)} // From hook state setter
              fetchLogFromUrl={fetchLogFromUrl} // From hook
              handleRecentFileSelect={handleRecentFileSelect} // From hook
              onMultipleFilesSelect={async (selectedFiles) => { // Keep multi-select logic here
                for (const file of selectedFiles) {
                  await handleRecentFileSelect(file); // Use hook handler
                }
              }}
              setActiveFileId={setActiveFileId} // From hook
            />
          ) : (
            // Ensure activeFile is not undefined before rendering FileView
            activeFile && (
              <FileView
                // File Management Props (from useFileManagement)
                files={files}
                activeFile={activeFile}
                activeFileId={activeFileId}
                setActiveFileId={setActiveFileId}
                handleRemoveFile={handleRemoveFile}
                loadingFiles={loadingFiles}
                updateFileState={updateFileState} // Pass down the state updater
                // Context menu handlers are managed by useFileManagement hook in Home, no need to pass down

                // Log Processing Props (from useLogProcessing)
                processedEntries={processedEntries}
                visibleEntries={visibleEntries}
                chartEntries={chartEntries} // Pass calculated chart entries

                // UI State Props (managed in Home)
                chartVisible={chartVisible}
                setChartVisible={setChartVisible}
                statsVisible={statsVisible}
                setStatsVisible={setStatsVisible}
                searchTerm={searchTerm}
                isRegexSearch={isRegexSearch}
                presets={presets}
                setPresets={setPresets} // Pass preset state setter

                // Handler Props (defined in Home, passed down)
                handleTimeRangeSelect={handleTimeRangeSelect}
                handleBucketSizeChange={handleBucketSizeChange}
                handleAddFilter={handleAddFilter}
                handleFilterLogicChange={handleFilterLogicChange}
                handleRemoveFilter={handleRemoveFilter}
                handleToggleFilterType={handleToggleFilterType} // Add the new handler here
                handleClearFilters={handleClearFilters}
                handleSearch={handleSearch}
                handleSummarizeClick={handleSummarizeClick} // Keep summarize handler here
                onUpdateInterestingLines={handleUpdateInterestingLines}
                onUpdateShowOnlyMarked={handleUpdateShowOnlyMarked}
                onSaveNotes={handleSaveNotes}
                onSaveTags={handleSaveTags}
                handleLoadPreset={handleLoadPreset} // Pass down preset load handler
                // Pass down context menu handlers from the hook
                handleCloseOtherFiles={handleCloseOtherTabs}
                handleCloseFilesToLeft={handleCloseTabsToLeft}
                handleCloseFilesToRight={handleCloseTabsToRight}
              />
            )
          )}
        </div>
      </div>

      {/* Footer remains the same */}
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
            <span>v0.4.0</span>
          </a>
        </div>
      </footer>

      {/* URL Dialog - Uses state/handlers from useFileManagement */}
      {showUrlDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 w-full max-w-md shadow-lg"> {/* Corrected typo and added shadow */}
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
                  value={urlInputValue} // From hook
                  onChange={(e) => setUrlInputValue(e.target.value)} // From hook
                  placeholder="https://example.com/logfile.log"
                  className="w-full px-3 py-2 border rounded-md text-sm bg-background text-foreground"
                  autoFocus
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowUrlDialog(false); // From hook
                    setUrlInputValue(""); // From hook
                  }}
                >
                  Cancel
                </Button>
                <Button
                  disabled={!urlInputValue || isUrlLoading} // From hook
                  onClick={() => fetchLogFromUrl(urlInputValue)} // From hook
                >
                  {isUrlLoading ? ( // From hook
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
