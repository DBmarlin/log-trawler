// Simple function to open URLs without Tauri dependency
const openUrl = (url: string) => {
  window.open(url, "_blank");
};
import React, { useRef, useEffect, useState, forwardRef, memo } from "react";
import { FixedSizeList as List } from "react-window";
import { getFilterColor, getFilterIndex, parseTimestamp } from "@/lib/utils";
import {
  Plus,
  Minus,
  WrapText,
  ChevronUp,
  ChevronDown,
  ChevronsUp,
  ChevronsDown,
  BookmarkIcon,
  AlignJustify,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";

interface LogEntry {
  lineNumber: number;
  timestamp: string;
  message: string;
}

interface FilterItem {
  id: string;
  type: "include" | "exclude";
  term: string;
  isRegex?: boolean;
}

interface LogDisplayProps {
  entries?: LogEntry[];
  filters?: FilterItem[];
  searchTerm?: string;
  className?: string;
  timeRange?: { startDate?: Date; endDate?: Date };
  onAddInclude?: (term: string) => void;
  onAddExclude?: (term: string) => void;
  fileId?: string;
  onUpdateInterestingLines?: (fileId: string, lines: number[]) => void;
  initialInterestingLines?: number[];
  initialShowOnlyMarked?: boolean;
  onUpdateShowOnlyMarked?: (fileId: string, showOnly: boolean) => void;
}

const DEFAULT_ENTRIES: LogEntry[] = [
  {
    lineNumber: 1,
    timestamp: "25-Dec-2024 00:00:06.596",
    message: "[INFO] Application started successfully",
  },
  {
    lineNumber: 2,
    timestamp: "25-Dec-2024 00:00:06.596",
    message: "[DEBUG] Initializing core components",
  },
];

const MIN_ROW_HEIGHT = 48;
const LINE_HEIGHT = 28;
const BASE_PADDING = 16;
const EXTRA_PADDING = 8;
const CHAR_PER_LINE = 120;
const TIMESTAMP_WIDTH = 200;
const PAGE_SIZE = 100;

const ButtonWithRef = forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof Button>
>((props, ref) => <Button ref={ref} {...props} />);

interface LogEntryRowProps {
  entry: LogEntry;
  index: number;
  wrapText: boolean;
  highlightText: (text: string) => React.ReactNode;
  onContextMenu: (e: React.MouseEvent) => void;
  isInteresting?: boolean;
  onMarkInteresting?: (lineNumber: number) => void;
  compact: boolean;
}

// Memoized log entry component for better performance
const LogEntryRow = memo<any>(({ index, style, data }) => {
  const {
    filteredEntries,
    wrapText,
    highlightText,
    handleContextMenu,
    interestingLines,
    compact,
    setInterestingLines,
  } = data;
  const entry = filteredEntries[index];
  const isInteresting = interestingLines.has(entry.lineNumber);

  const onMarkInteresting = (lineNumber: number) => {
    setInterestingLines((prev: any) => {
      const newSet = new Set(prev);
      if (newSet.has(lineNumber)) {
        newSet.delete(lineNumber);
      } else {
        newSet.add(lineNumber);
      }
      return newSet;
    });
  };

  return (
    <div
      style={style}
      className={`flex gap-4 px-4 ${compact ? "py-1" : "py-3"} ${index % 2 === 0 ? "bg-muted/50" : "bg-background"}`}
      onContextMenu={(e) => handleContextMenu(e, entry)}
    >
      <div className="w-12 text-right text-muted-foreground shrink-0 flex items-center justify-end gap-1 relative">
        {isInteresting && (
          <span className="absolute left-0 flex items-center justify-center">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500"></span>
          </span>
        )}
        <span
          className="cursor-pointer hover:text-primary transition-colors"
          onClick={() => onMarkInteresting?.(entry.lineNumber)}
          title="Click to mark as interesting"
        >
          {entry.lineNumber}
        </span>
      </div>
      <span className="w-[200px] text-muted-foreground shrink-0 font-mono whitespace-nowrap overflow-hidden text-ellipsis">
        {entry.timestamp}
      </span>
      <span
        className={`flex-1 font-mono select-text ${wrapText ? "whitespace-pre-wrap break-words" : "whitespace-pre"}`}
      >
        {highlightText(entry.message)}
      </span>
    </div>
  );
});

const LogDisplay = ({
  entries = DEFAULT_ENTRIES,
  filters = [],
  searchTerm = "",
  className = "",
  onAddInclude = () => {},
  onAddExclude = () => {},
  fileId = "",
  onUpdateInterestingLines = () => {},
  initialInterestingLines = [],
  initialShowOnlyMarked = false,
  onUpdateShowOnlyMarked = () => {},
}: LogDisplayProps) => {
  const [wrapText, setWrapText] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    selection: string;
  } | null>(null);
  const [interestingLines, setInterestingLines] = useState<Set<number>>(
    new Set(initialInterestingLines),
  );
  const [showOnlyMarked, setShowOnlyMarked] = useState(initialShowOnlyMarked);
  const [compact, setCompact] = useState(false);

  // Handle context menu closing
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenu) {
        setContextMenu(null);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [contextMenu]);

  const getHighlights = (message: string) => {
    // Skip processing if no filters
    if (filters.length === 0) return [];

    const matches = [];
    const messageLower = message.toLowerCase();

    for (let i = 0; i < filters.length; i++) {
      const filter = filters[i];
      // Handle regex filters
      if (filter.isRegex) {
        try {
          const regex = new RegExp(filter.term, "g");
          let match;
          while ((match = regex.exec(message)) !== null) {
            const colorIndex = getFilterIndex(filters, filter.id);
            const colors = getFilterColor(filter.type, colorIndex);

            matches.push({
              start: match.index,
              end: match.index + match[0].length,
              term: match[0],
              colors,
            });
          }
          continue;
        } catch (error) {
          console.error("Invalid regex pattern:", error);
          continue;
        }
      }

      // Standard text search
      const term = filter.term.toLowerCase();

      // Skip empty terms
      if (!term) continue;

      // Use a more efficient approach for finding all occurrences
      let index = messageLower.indexOf(term);
      if (index === -1) continue; // Skip if no match at all

      const colorIndex = getFilterIndex(filters, filter.id);
      const colors = getFilterColor(filter.type, colorIndex);

      while (index !== -1) {
        matches.push({
          start: index,
          end: index + term.length,
          term: message.slice(index, index + term.length),
          colors,
        });
        index = messageLower.indexOf(term, index + term.length);
      }
    }

    // Only sort if we have multiple matches
    return matches.length > 1
      ? matches.sort((a, b) => a.start - b.start)
      : matches;
  };

  // Memoize the highlight function for better performance
  const highlightText = React.useMemo(() => {
    // Return a function that does the actual highlighting
    return (text: string) => {
      // Quick return for empty text
      if (!text) return text;

      // Skip processing if no filters and no search term
      if (filters.length === 0 && !searchTerm) return text;

      const highlights = getHighlights(text);
      if (highlights.length === 0) {
        if (!searchTerm) return text;

        // Optimize search term highlighting
        if (searchTerm.length < 2) return text; // Skip very short search terms

        try {
          // Check if searchTerm is a valid regex
          let searchRegex;
          try {
            // Try to create a regex from the search term directly
            searchRegex = new RegExp(searchTerm, "gi");
          } catch (e) {
            // If that fails, escape the search term and use it as a literal string
            searchRegex = new RegExp(
              `(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
              "gi",
            );
          }

          // Use match instead of split for regex to properly handle groups
          const matches = Array.from(text.matchAll(searchRegex));
          if (matches.length === 0) return text;

          // Build the highlighted text
          let lastIndex = 0;
          const result = [];

          for (let i = 0; i < matches.length; i++) {
            const match = matches[i];
            const matchIndex = match.index;
            const matchText = match[0];

            // Add text before the match
            if (matchIndex > lastIndex) {
              result.push(text.substring(lastIndex, matchIndex));
            }

            // Add the highlighted match
            result.push(
              <span
                key={i}
                className="bg-yellow-100 text-yellow-700 font-medium"
              >
                {matchText}
              </span>,
            );

            lastIndex = matchIndex + matchText.length;
          }

          // Add any remaining text
          if (lastIndex < text.length) {
            result.push(text.substring(lastIndex));
          }

          return result;
        } catch (e) {
          // Fallback if regex fails
          return text;
        }
      }

      // Optimize highlight rendering for large text
      let lastIndex = 0;
      const result = [];
      const maxHighlights = 50; // Limit number of highlights for very long messages
      const highlightsToProcess =
        highlights.length > maxHighlights
          ? highlights.slice(0, maxHighlights)
          : highlights;

      for (let i = 0; i < highlightsToProcess.length; i++) {
        const highlight = highlightsToProcess[i];
        if (highlight.start > lastIndex) {
          result.push(text.slice(lastIndex, highlight.start));
        }
        result.push(
          <span key={i} className={`${highlight.colors.highlight} font-medium`}>
            {highlight.term}
          </span>,
        );
        lastIndex = highlight.end;
      }

      if (lastIndex < text.length) {
        // For very long text, truncate the end if needed
        const remainingText = text.slice(lastIndex);
        result.push(
          remainingText.length > 10000
            ? remainingText.substring(0, 10000) + "..."
            : remainingText,
        );
      }

      return result;
    };
  }, [filters, searchTerm]);

  const handleContextMenu = (e: React.MouseEvent, entry: LogEntry) => {
    e.preventDefault();
    const selection = window.getSelection()?.toString();
    if (selection) {
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        selection,
      });
    }
  };

  const listRef = useRef<List>(null);

  const scrollToTop = () => {
    if (listRef.current) {
      listRef.current.scrollTo(0);
    }
  };

  const scrollToBottom = () => {
    if (listRef.current) {
      listRef.current.scrollToItem(filteredEntries.length - 1, "end");
    }
  };

  const scrollPageUp = () => {
    if (scrollContainerRef.current) {
      const currentScroll = scrollContainerRef.current.scrollTop;
      const pageHeight = scrollContainerRef.current.clientHeight;
      const itemHeight = compact ? 28 : 40;
      const visibleItems = Math.ceil(pageHeight / itemHeight);
      const currentIndex = Math.floor(currentScroll / itemHeight);
      const targetIndex = Math.max(0, currentIndex - visibleItems);

      scrollContainerRef.current.scrollTo({
        top: targetIndex * itemHeight,
        behavior: "smooth",
      });
    }
  };

  const scrollPageDown = () => {
    if (scrollContainerRef.current) {
      const currentScroll = scrollContainerRef.current.scrollTop;
      const pageHeight = scrollContainerRef.current.clientHeight;
      const itemHeight = compact ? 28 : 40;
      const visibleItems = Math.ceil(pageHeight / itemHeight);
      const currentIndex = Math.floor(currentScroll / itemHeight);
      const targetIndex = Math.min(
        filteredEntries.length - visibleItems,
        currentIndex + visibleItems,
      );

      scrollContainerRef.current.scrollTo({
        top: targetIndex * itemHeight,
        behavior: "smooth",
      });
    }
  };

  // Update IndexedDB when interesting lines change
  useEffect(() => {
    if (fileId && interestingLines.size > 0) {
      onUpdateInterestingLines(fileId, Array.from(interestingLines));
    }
  }, [interestingLines, fileId, onUpdateInterestingLines]);

  // Update IndexedDB when showOnlyMarked changes
  useEffect(() => {
    if (fileId) {
      onUpdateShowOnlyMarked(fileId, showOnlyMarked);
    }
  }, [showOnlyMarked, fileId, onUpdateShowOnlyMarked]);

  // Apply filters from parent component - entries should already be filtered
  // Just apply the marked lines filter here
  const filteredEntries = showOnlyMarked
    ? entries.filter((entry) => interestingLines.has(entry.lineNumber))
    : entries;

  const itemHeight = compact ? 28 : 40;

  return (
    <div
      ref={containerRef}
      className={`bg-background h-[830px] w-full border rounded-md ${className}`}
      tabIndex={0}
    >
      <div className="h-full w-full font-mono text-sm flex flex-col">
        <div className="flex gap-4 py-2 px-4 border-b bg-muted/50 font-semibold sticky top-0 z-20">
          <span className="w-12 text-right text-muted-foreground shrink-0 flex items-center justify-end">
            <span title="Click line numbers to mark as interesting">
              Line #
            </span>
          </span>
          <span className="w-[200px] text-muted-foreground shrink-0 whitespace-nowrap">
            Timestamp
          </span>
          <div className="flex-1 flex justify-between items-center">
            <span className="text-muted-foreground">Event Detail</span>
            <div className="flex items-center gap-2">
              {/* Scroll Controls */}
              <div className="flex items-center gap-1">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <ButtonWithRef
                        variant="ghost"
                        size="icon"
                        onClick={scrollToTop}
                        className="h-8 w-8"
                      >
                        <ChevronsUp className="h-4 w-4" />
                      </ButtonWithRef>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Jump to top</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <ButtonWithRef
                        variant="ghost"
                        size="icon"
                        onClick={scrollToBottom}
                        className="h-8 w-8"
                      >
                        <ChevronsDown className="h-4 w-4" />
                      </ButtonWithRef>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Jump to bottom</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              <Separator orientation="vertical" className="h-4" />

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <ButtonWithRef
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowOnlyMarked(!showOnlyMarked)}
                      className="text-muted-foreground"
                    >
                      <BookmarkIcon
                        className={`h-4 w-4 ${showOnlyMarked ? "text-red-500" : ""}`}
                      />
                    </ButtonWithRef>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Show only marked lines</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <ButtonWithRef
                      variant="ghost"
                      size="icon"
                      onClick={() => setWrapText(!wrapText)}
                      className={
                        wrapText ? "text-primary" : "text-muted-foreground"
                      }
                    >
                      <WrapText className="h-4 w-4" />
                    </ButtonWithRef>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Toggle text wrapping (Alt+W)</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <ButtonWithRef
                      variant="ghost"
                      size="icon"
                      onClick={() => setCompact(!compact)}
                      className={
                        compact ? "text-primary" : "text-muted-foreground"
                      }
                    >
                      <AlignJustify className="h-4 w-4" />
                    </ButtonWithRef>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Toggle compact view</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>
        <div className="h-[calc(100%-48px)] overflow-auto">
          <List
            ref={listRef}
            height={782}
            itemCount={filteredEntries.length}
            itemSize={itemHeight}
            width="100%"
            itemData={{
              filteredEntries,
              wrapText,
              highlightText,
              handleContextMenu,
              interestingLines,
              compact,
              setInterestingLines,
            }}
          >
            {LogEntryRow}
          </List>
        </div>
      </div>

      {contextMenu && (
        <div
          className="fixed z-50"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <div className="bg-popover text-popover-foreground rounded-md border shadow-md p-1 min-w-[8rem] flex flex-col">
            <button
              className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground gap-2"
              onClick={() => {
                onAddInclude(contextMenu.selection);
                setContextMenu(null);
              }}
            >
              <Plus className="h-4 w-4" />
              Add Include Filter
            </button>
            <button
              className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground gap-2"
              onClick={() => {
                onAddExclude(contextMenu.selection);
                setContextMenu(null);
              }}
            >
              <Minus className="h-4 w-4" />
              Add Exclude Filter
            </button>
            <div className="border-t my-1"></div>
            <button
              className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground gap-2"
              onClick={() => {
                // Create a custom event to open the chat panel with a prompt
                const event = new CustomEvent("openChatWithPrompt", {
                  detail: {
                    prompt: `My log file contains log message "${contextMenu.selection}" - what does it mean and what can I do about it?`,
                    autoSubmit: true,
                  },
                });
                document.dispatchEvent(event);
                setContextMenu(null);
              }}
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
                className="lucide lucide-bot"
              >
                <path d="M12 8V4H8"></path>
                <rect width="16" height="12" x="4" y="8" rx="2"></rect>
                <path d="M2 14h2"></path>
                <path d="M20 14h2"></path>
                <path d="M15 13v2"></path>
                <path d="M9 13v2"></path>
              </svg>
              Ask AI
            </button>
            <button
              className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground gap-2"
              onClick={() => {
                const url = `https://www.google.com/search?q=${encodeURIComponent(contextMenu.selection)}`;
                // Use the simple URL opener function
                openUrl(url);
                setContextMenu(null);
              }}
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
                className="lucide lucide-search"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              Search on Google
            </button>
            <button
              className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground gap-2"
              onClick={() => {
                window.open(
                  `https://www.bing.com/search?q=${encodeURIComponent(contextMenu.selection)}`,
                  "_blank",
                );
                setContextMenu(null);
              }}
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
                className="lucide lucide-search"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              Search in Bing
            </button>
            <button
              className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground gap-2"
              onClick={() => {
                window.open(
                  `https://www.ecosia.org/search?q=${encodeURIComponent(contextMenu.selection)}`,
                  "_blank",
                );
                setContextMenu(null);
              }}
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
                className="lucide lucide-leaf"
              >
                <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
                <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
              </svg>
              Search in Ecosia
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LogDisplay;
