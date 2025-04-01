import React from "react";
import { X, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import SearchBar from "../log-viewer/SearchBar";
import ActiveFilters from "../log-viewer/ActiveFilters";
import LogDisplay from "../log-viewer/LogDisplay";
import LogStats from "../log-viewer/LogStats";
import TimeSeriesChart from "../log-viewer/TimeSeriesChart";
import { FilterPresets, type FilterPreset } from "../log-viewer/FilterPresets";
import ExportButton from "../log-viewer/ExportButton";
import NotesPanel from "../log-viewer/NotesPanel";
import TagsPanel from "../log-viewer/TagsPanel";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LogFile } from "../home"; // Import the exported interface

interface FileViewProps {
  files: LogFile[];
  activeFile: LogFile | undefined;
  activeFileId: string | null;
  setActiveFileId: (id: string | null) => void;
  handleRemoveFile: (id: string) => void;
  loadingFiles: { [key: string]: number };
  chartVisible: boolean;
  setChartVisible: (visible: boolean) => void;
  chartEntries: any[]; // Consider a more specific type if possible
  visibleEntries: any[]; // Consider a more specific type if possible
  processedEntries: any[]; // Consider a more specific type if possible
  handleTimeRangeSelect: (startDate?: Date, endDate?: Date) => void;
  handleBucketSizeChange: (size: string) => void;
  statsVisible: boolean;
  setStatsVisible: (visible: boolean) => void;
  handleAddFilter: (
    term: string,
    type: "include" | "exclude",
    isRegex?: boolean,
  ) => void;
  handleFilterLogicChange: (logic: "AND" | "OR") => void;
  handleRemoveFilter: (id: string) => void;
  handleClearFilters: () => void;
  handleSearch: (term: string, isRegex?: boolean) => void;
  searchTerm: string;
  isRegexSearch: boolean;
  presets: FilterPreset[];
  setPresets: (presets: FilterPreset[]) => void;
  handleSummarizeClick: () => void;
  onUpdateInterestingLines: (fileId: string, lines: number[]) => void;
  onUpdateShowOnlyMarked: (fileId: string, showOnly: boolean) => void;
  onSaveNotes: (fileId: string, notes: string) => void; // Added for NotesPanel
  onSaveTags: (fileId: string, tags: string[]) => void; // Added for TagsPanel
}

const FileView: React.FC<FileViewProps> = ({
  files,
  activeFile,
  activeFileId,
  setActiveFileId,
  handleRemoveFile,
  loadingFiles,
  chartVisible,
  setChartVisible,
  chartEntries,
  visibleEntries,
  processedEntries,
  handleTimeRangeSelect,
  handleBucketSizeChange,
  statsVisible,
  setStatsVisible,
  handleAddFilter,
  handleFilterLogicChange,
  handleRemoveFilter,
  handleClearFilters,
  handleSearch,
  searchTerm,
  isRegexSearch,
  presets,
  setPresets,
  handleSummarizeClick,
  onUpdateInterestingLines,
  onUpdateShowOnlyMarked,
  onSaveNotes,
  onSaveTags,
}) => {
  if (!activeFile) {
    // Should ideally not happen if FileView is rendered correctly, but good practice
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <h3 className="text-lg font-medium">No file selected</h3>
          <p className="text-sm text-muted-foreground">
            Select a file from the tabs above or open a new log file.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => setActiveFileId(null)}
          >
            Go to Home Screen
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* File icon and name display moved to the top row in home.tsx */}
      <Tabs value={activeFileId || undefined} onValueChange={setActiveFileId}>
        <TabsList className="w-full justify-start h-auto p-0 bg-transparent overflow-x-auto flex-wrap">
          {files.map((file) => (
            <TabsTrigger
              key={file.id}
              value={file.id}
              className="data-[state=active]:bg-muted relative group overflow-hidden max-w-[200px]"
              onContextMenu={(e) => {
                e.preventDefault();
                const contextMenu = document.createElement("div");
                contextMenu.className =
                  "fixed z-50 bg-popover text-popover-foreground rounded-md border shadow-md p-1 min-w-[12rem]";
                contextMenu.style.left = `${e.clientX}px`;
                contextMenu.style.top = `${e.clientY}px`;

                const createMenuItem = (text: string, onClick: () => void) => {
                  const item = document.createElement("button");
                  item.className =
                    "relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground";
                  item.textContent = text;
                  item.onclick = onClick;
                  return item;
                };

                // Close tab
                contextMenu.appendChild(
                  createMenuItem("Close tab", () => {
                    handleRemoveFile(file.id);
                    document.body.removeChild(contextMenu);
                  }),
                );

                // Close other tabs
                contextMenu.appendChild(
                  createMenuItem("Close other tabs", () => {
                    // Need access to setFiles here, or pass a specific handler
                    // For now, this action might need to stay in home.tsx or be handled via callback
                    console.warn("Close other tabs needs implementation via callback");
                    document.body.removeChild(contextMenu);
                  }),
                );

                // Close tabs to the left
                contextMenu.appendChild(
                  createMenuItem("Close tabs to the left", () => {
                    // Need access to setFiles here, or pass a specific handler
                    console.warn("Close tabs to the left needs implementation via callback");
                    document.body.removeChild(contextMenu);
                  }),
                );

                // Close tabs to the right
                contextMenu.appendChild(
                  createMenuItem("Close tabs to the right", () => {
                    // Need access to setFiles here, or pass a specific handler
                    console.warn("Close tabs to the right needs implementation via callback");
                    document.body.removeChild(contextMenu);
                  }),
                );

                document.body.appendChild(contextMenu);

                // Remove the context menu when clicking outside
                const removeContextMenu = () => {
                  if (document.body.contains(contextMenu)) {
                    document.body.removeChild(contextMenu);
                  }
                  document.removeEventListener("click", removeContextMenu);
                };

                document.addEventListener("click", removeContextMenu);
              }}
            >
              <div className="relative z-10 flex items-center">
                <span
                  className="truncate"
                  title={file.name.length > 20 ? file.name : undefined}
                >
                  {file.name.length > 20
                    ? `${file.name.substring(0, 20)}...`
                    : file.name}
                </span>
                <div
                  role="button"
                  tabIndex={0}
                  className="inline-flex h-4 w-4 ml-2 items-center justify-center rounded-sm opacity-60 hover:opacity-100 hover:bg-muted/50 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveFile(file.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      handleRemoveFile(file.id);
                    }
                  }}
                >
                  <X className="h-3 w-3" />
                </div>
              </div>
              {loadingFiles[file.id] !== undefined && (
                <div
                  className="absolute inset-0 bg-blue-500/20 dark:bg-blue-500/30 z-0 transition-all duration-300"
                  style={{ width: `${loadingFiles[file.id]}%` }}
                />
              )}
            </TabsTrigger>
          ))}
          {/* Add new tab button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-none hover:bg-muted/50"
                  onClick={() => setActiveFileId(null)} // Go back to initial view
                >
                  <span className="text-lg font-medium">+</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Open new file</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </TabsList>
      </Tabs>

      <div className="flex flex-col h-full">
        {activeFile.isLoading && (
          <div className="bg-muted/20 border rounded-md p-4 mb-4 text-center">
            <div className="text-sm font-medium mb-2">
              Loading {activeFile.name}
            </div>
            <div className="w-full bg-muted rounded-full h-2.5 mb-2">
              <div
                className="bg-blue-500 h-2.5 rounded-full transition-all duration-300"
                style={{
                  width: `${loadingFiles[activeFile.id] || 0}%`,
                }}
              />
            </div>
            <div className="text-xs text-muted-foreground">
              {loadingFiles[activeFile.id] || 0}% complete
            </div>
          </div>
        )}
        <div className="mb-2 relative">
          {chartVisible ? (
            <div className="relative">
              <TimeSeriesChart
                entries={chartEntries} // Use memoized entries passed as prop
                filteredEntries={visibleEntries.map(
                  (entry) => activeFile.content[entry.lineNumber - 1],
                )}
                onTimeRangeSelect={handleTimeRangeSelect}
                bucketSize={activeFile.bucketSize || "5m"}
                onBucketSizeChange={handleBucketSizeChange}
                fileStartDate={activeFile.startDate}
                fileEndDate={activeFile.endDate}
                timeRange={activeFile.timeRange}
              />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className="absolute bottom-0 left-0 right-0 h-4 flex items-center justify-center cursor-pointer hover:bg-muted/50"
                      onClick={() => setChartVisible(false)}
                    >
                      <div className="w-8 h-1.5 bg-primary rounded-sm" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Click to hide chart</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className="h-4 flex items-center justify-center bg-muted/30 hover:bg-muted/50 cursor-pointer rounded-md"
                    onClick={() => setChartVisible(true)}
                  >
                    <div className="w-8 h-1.5 bg-primary rounded-sm" />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Click to show chart</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <ResizablePanelGroup
          direction="horizontal"
          onLayout={(sizes) => {
            // When panel is dragged to be visible, update the statsVisible state
            if (sizes[0] > 0 && !statsVisible) {
              setStatsVisible(true);
            } else if (sizes[0] === 0 && statsVisible) {
              setStatsVisible(false);
            }
          }}
        >
          <ResizablePanel
            defaultSize={25}
            collapsible
            minSize={0}
            maxSize={40}
            className={"hidden md:block"}
            style={{ display: statsVisible ? undefined : "none" }}
            onCollapse={() => setStatsVisible(false)}
            onExpand={() => setStatsVisible(true)}
          >
            <div className="flex flex-col h-full">
              <ScrollArea className="h-[830px]"> {/* Consider dynamic height */}
                <div className="p-3 space-y-3">
                  <LogStats
                    entries={visibleEntries}
                    allEntries={processedEntries}
                    showHourlyActivity={false}
                    onToggle={() => {
                      setStatsVisible(false);
                    }}
                    showStats={statsVisible}
                    onAddFilter={(term, type = "include") =>
                      handleAddFilter(term, type)
                    }
                  />

                  {/* Notes Panel */}
                  <NotesPanel
                    fileId={activeFile.id}
                    initialNotes={activeFile.notes || ""}
                    onSaveNotes={(notes) => onSaveNotes(activeFile.id, notes)}
                  />

                  {/* Tags Panel */}
                  <TagsPanel
                    fileId={activeFile.id}
                    initialTags={activeFile.tags || []}
                    onSaveTags={(tags) => onSaveTags(activeFile.id, tags)}
                  />
                </div>
              </ScrollArea>
            </div>
          </ResizablePanel>

          {statsVisible && <ResizableHandle withHandle />}
          {!statsVisible && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className="absolute left-0 top-1/2 transform -translate-y-1/2 w-4 h-8 flex items-center justify-center cursor-pointer z-10"
                    onClick={() => setStatsVisible(true)}
                  >
                    <div className="w-1.5 h-8 bg-primary rounded-sm" />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Click to show stats panel</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          <ResizablePanel defaultSize={75}>
            <div className="flex flex-col h-full relative">
              <SearchBar
                onSearch={handleSearch}
                onAddInclude={(term, isRegex) =>
                  handleAddFilter(term, "include", isRegex)
                }
                onAddExclude={(term, isRegex) =>
                  handleAddFilter(term, "exclude", isRegex)
                }
                searchTerm={searchTerm}
                isRegex={isRegexSearch}
              />

              <ActiveFilters
                filters={activeFile?.filters}
                entries={activeFile?.content} // Pass original content for context if needed
                onRemoveFilter={handleRemoveFilter}
                onToggleFilterType={(id) => {
                  if (!activeFile?.filters) return;
                  const filter = activeFile.filters.find((f) => f.id === id);
                  if (!filter) return;

                  handleAddFilter(
                    filter.term,
                    filter.type === "include" ? "exclude" : "include",
                    filter.isRegex,
                  );
                  handleRemoveFilter(id);
                }}
                onClearAll={handleClearFilters}
                filterLogic={activeFile?.filterLogic || "OR"}
                onFilterLogicChange={handleFilterLogicChange}
                rightContent={
                  <FilterPresets
                    currentFilters={activeFile?.filters || []}
                    presets={presets}
                    onSavePreset={(name) => {
                      if (!activeFile?.filters) return;
                      const newPreset = {
                        id: Math.random().toString(),
                        name,
                           filters: activeFile.filters,
                         };
                         // Pass the new complete array instead of using functional update
                         setPresets([...presets, newPreset]);
                       }}
                       onLoadPreset={(preset) => {
                      if (!activeFile) return;
                      // This needs to update the file state in the parent component
                      // Maybe pass a specific handler like `handleLoadPreset`
                      console.warn("Load preset needs implementation via callback");
                       }}
                       onDeletePreset={(presetId) => {
                         // Pass the new complete array instead of using functional update
                         setPresets(presets.filter((p) => p.id !== presetId));
                       }}
                  />
                }
              />

              <LogDisplay
                entries={visibleEntries}
                filters={activeFile?.filters}
                searchTerm={searchTerm}
                onAddInclude={(term) => handleAddFilter(term, "include")}
                onAddExclude={(term) => handleAddFilter(term, "exclude")}
                fileId={activeFile?.id}
                onUpdateInterestingLines={onUpdateInterestingLines}
                initialInterestingLines={activeFile?.interestingLines}
                initialShowOnlyMarked={activeFile?.showOnlyMarked}
                onUpdateShowOnlyMarked={onUpdateShowOnlyMarked}
              />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
};

export default FileView;
