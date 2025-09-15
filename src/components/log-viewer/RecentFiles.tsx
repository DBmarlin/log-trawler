import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowUpDown,
  Trash2,
  Clock,
  FileText,
  StickyNote,
  Search,
  FolderOpen,
  Check,
  Folder,
  Plus,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { FileItem } from "@/types/fileSystem";

export interface RecentFile extends FileItem {
  // Maintaining compatibility with existing code
}

interface RecentFilesProps {
  onFileSelect: (file: FileItem) => void;
  onMultipleFilesSelect?: (files: FileItem[]) => void;
}

type SortField =
  | "name"
  | "lastOpened"
  | "size"
  | "lines"
  | "startDate"
  | "endDate";
type SortDirection = "asc" | "desc";

const RecentFiles: React.FC<RecentFilesProps> = ({
  onFileSelect,
  onMultipleFilesSelect,
}) => {
  const [recentItems, setRecentItems] = useState<FileItem[]>([]);
  const [sortField, setSortField] = useState<SortField>("lastOpened");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [newFolderName, setNewFolderName] = useState("");
  const [createFolderMode, setCreateFolderMode] = useState(false);
  const [parentFolderId, setParentFolderId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    // First try to load from localStorage for immediate display
    const storedItems = localStorage.getItem("logTrawler_recentItems");
    if (storedItems) {
      try {
        // Immediately show localStorage items
        const parsedItems = JSON.parse(storedItems);
        // Only show the 20 most recent items for faster initial render
        if (isMounted) {
          setRecentItems(parsedItems.slice(0, 20));
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Failed to parse recent items from localStorage", error);
        if (isMounted) {
          setRecentItems([]);
          setIsLoading(false);
        }
      }
    } else {
      if (isMounted) {
        setIsLoading(false);
      }
    }

    // Preload the IndexedDB module to avoid delay when actually using it
    const preloadModule = import("@/lib/indexedDB-fix");

    // Load IndexedDB data immediately without delay
    (async () => {
      try {
        // Wait for the module to be loaded
        const { initDB, getLogFilesMetadata } = await preloadModule;
        await initDB();

        // Use a more efficient query that only fetches metadata
        const indexedDBItems = await getLogFilesMetadata();

        if (isMounted) {
          if (indexedDBItems && indexedDBItems.length > 0) {
            // Use a more efficient merge algorithm
            setRecentItems((prev) => {
              // Create a map of existing items by ID for quick lookup
              const itemMap = new Map(prev.map((item) => [item.id, item]));

              // Add or update items from IndexedDB
              indexedDBItems.forEach((item) => {
                itemMap.set(item.id, item);
              });

              // Convert map back to array and sort by lastOpened
              return Array.from(itemMap.values()).sort(
                (a, b) => b.lastOpened - a.lastOpened,
              );
            });
          } else {
            setRecentItems([]);
          }
        }
      } catch (error) {
        setLoadError("Failed to load items from IndexedDB. " + (error?.toString() || ""));
        setRecentItems([]);
        setIsLoading(false);
        console.error("Failed to load items from IndexedDB", error);
      }
    })();

    // Clean up function
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Build a tree structure from flat list of items
  const buildTree = (items: FileItem[]) => {
    const itemMap = new Map<string, FileItem>();
    const rootItems: FileItem[] = [];

    // Initialize map with all items
    items.forEach((item) => {
      itemMap.set(item.id, { ...item, children: item.type === 'folder' ? (item.children || []) : undefined });
    });

    // Connect children to parents
    items.forEach((item) => {
      if (item.parentId && itemMap.has(item.parentId)) {
        const parent = itemMap.get(item.parentId);
        if (parent && parent.type === 'folder') {
          if (!parent.children) {
            parent.children = [];
          }
          if (!parent.children.includes(item.id)) {
            parent.children.push(item.id);
          }
        }
      } else {
        rootItems.push(item);
      }
    });

    return { itemMap, rootItems };
  };

  // Memoize filtered items to avoid recalculating on every render
  const filteredItems = React.useMemo(() => {
    if (!searchTerm) return recentItems;

    const searchLower = searchTerm.toLowerCase();
    return recentItems.filter((item) => {
      // Match on name
      if (item.name.toLowerCase().includes(searchLower)) return true;

      // Match on tags
      if (
        item.tags &&
        item.tags.some((tag) => tag.toLowerCase().includes(searchLower))
      )
        return true;

      return false;
    });
  }, [recentItems, searchTerm]);

  // Memoize sorted items to avoid recalculating on every render
  const sortedItems = React.useMemo(
    () =>
      [...filteredItems].sort((a, b) => {
        let comparison = 0;
        switch (sortField) {
          case "name":
            comparison = a.name.localeCompare(b.name);
            break;
          case "lastOpened":
            comparison = a.lastOpened - b.lastOpened;
            break;
          case "size":
            comparison = (a.size || 0) - (b.size || 0);
            break;
          case "lines":
            comparison = (a.lines || 0) - (b.lines || 0);
            break;
          case "startDate":
            comparison =
              a.startDate && b.startDate
                ? new Date(a.startDate).getTime() -
                  new Date(b.startDate).getTime()
                : 0;
            break;
          case "endDate":
            comparison =
              a.endDate && b.endDate
                ? new Date(a.endDate).getTime() - new Date(b.endDate).getTime()
                : 0;
            break;
        }
        return sortDirection === "asc" ? comparison : -comparison;
      }),
    [filteredItems, sortField, sortDirection],
  );

  // Build tree structure for rendering
  const { itemMap, rootItems } = React.useMemo(() => buildTree(sortedItems), [sortedItems]);

  // Handle folder expansion
  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  };

  // Handle creating a new folder
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    
    try {
      const { saveLogFile } = await import("@/lib/indexedDB-fix");
      const newFolder: FileItem = {
        id: `folder_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: newFolderName.trim(),
        type: 'folder',
        lastOpened: Date.now(),
        parentId: parentFolderId || undefined,
        children: [],
      };
      
      await saveLogFile(newFolder);
      
      // Update the parent folder's children if applicable
      if (parentFolderId) {
        const parent = recentItems.find(item => item.id === parentFolderId);
        if (parent && parent.type === 'folder') {
          const updatedParent = {
            ...parent,
            children: [...(parent.children || []), newFolder.id]
          };
          const { updateLogFile } = await import("@/lib/indexedDB-fix");
          await updateLogFile(parentFolderId, updatedParent);
        }
      }
      
      // Refresh the list
      setRecentItems((prev) => {
        const updatedItems = [...prev, newFolder];
        localStorage.setItem("logTrawler_recentItems", JSON.stringify(updatedItems));
        return updatedItems;
      });
      setNewFolderName("");
      setCreateFolderMode(false);
      setParentFolderId(null);
    } catch (error) {
      console.error("Failed to create folder:", error);
    }
  };

  // Drag and drop state for drop target highlighting
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Handle drag and drop
  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    e.dataTransfer.setData("itemId", itemId);
  };

  const handleDrop = async (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    setDragOverId(null);
    const itemId = e.dataTransfer.getData("itemId");
    if (!itemId || itemId === folderId) return;

    const item = recentItems.find(i => i.id === itemId);
    const targetFolder = recentItems.find(i => i.id === folderId);

    if (!item || !targetFolder || targetFolder.type !== 'folder') return;

    // Prevent moving a folder into itself or its children (to avoid circular references)
    if (item.type === 'folder') {
      const checkCircular = (currentId: string, targetId: string): boolean => {
        if (currentId === targetId) return true;
        const currentFolder = recentItems.find(i => i.id === currentId);
        if (currentFolder && currentFolder.type === 'folder' && currentFolder.children) {
          return currentFolder.children.some(childId => checkCircular(childId, targetId));
        }
        return false;
      };

      if (checkCircular(itemId, folderId)) {
        console.log("Cannot move folder into itself or its children");
        return;
      }
    }

    try {
      // Update the item's parentId
      const { updateLogFile } = await import("@/lib/indexedDB-fix");
      await updateLogFile(itemId, { parentId: folderId });

      // Update the target folder's children
      const updatedChildren = [...(targetFolder.children || []), itemId];
      await updateLogFile(folderId, { children: updatedChildren });

      // If the item had a previous parent, remove it from that parent's children
      if (item.parentId && item.parentId !== folderId) {
        const previousParent = recentItems.find(i => i.id === item.parentId);
        if (previousParent && previousParent.type === 'folder' && previousParent.children) {
          const updatedParentChildren = previousParent.children.filter(id => id !== itemId);
          await updateLogFile(item.parentId, { children: updatedParentChildren });
        }
      }

      // Refresh the list
      setRecentItems((prev) => {
        const updatedItems = prev.map(i => {
          if (i.id === itemId) {
            return { ...i, parentId: folderId };
          } else if (i.id === folderId && i.type === 'folder') {
            return { ...i, children: [...(i.children || []), itemId] };
          } else if (item.parentId && i.id === item.parentId && i.type === 'folder') {
            return { ...i, children: (i.children || []).filter(id => id !== itemId) };
          }
          return i;
        });
        localStorage.setItem("logTrawler_recentItems", JSON.stringify(updatedItems));
        return updatedItems;
      });
    } catch (error) {
      console.error("Failed to move item:", error);
    }
  };

  const handleDragOver = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    setDragOverId(folderId);
  };

  const handleDragLeave = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    setDragOverId((prev) => (prev === folderId ? null : prev));
  };

  // Render tree structure recursively
  const renderTreeItem = (itemId: string, level: number = 0) => {
    const item = itemMap.get(itemId);
    if (!item) return null;

    const isFolder = item.type === 'folder';
    const isExpanded = isFolder && expandedFolders.has(item.id);
    // Add extra indent for files so their icon lines up with folder icon
    // Use 8px for a slightly greater indent as requested
    const indentStyle = isFolder
      ? { paddingLeft: `${level * 16}px` }
      : { paddingLeft: `${level * 16 + 8}px` };

    // Highlight drop target for folders
    const dropHighlight =
      isFolder && dragOverId === item.id
        ? "ring-2 ring-blue-500 ring-offset-2"
        : "";

    return (
      <React.Fragment key={item.id}>
        <tr
          className={`border-b border-muted hover:bg-muted/50 ${selectedItems.has(item.id) ? "bg-primary/10" : ""} ${dropHighlight}`}
          draggable
          onDragStart={(e) => handleDragStart(e, item.id)}
          onDrop={(e) => isFolder && handleDrop(e, item.id)}
          onDragOver={(e) => isFolder && handleDragOver(e, item.id)}
          onDragLeave={(e) => isFolder && handleDragLeave(e, item.id)}
        >
          <td className="py-2" style={indentStyle}>
            <div className="flex items-center">
              {/* Expand/Collapse button for folders */}
              {isFolder && (
                <button
                  aria-label={isExpanded ? "Collapse folder" : "Expand folder"}
                  className="mr-1 flex items-center justify-center h-5 w-5 rounded hover:bg-muted transition"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFolder(item.id);
                  }}
                >
                  {isExpanded ? (
                    // Use a minus or chevron-down icon
                    <span style={{ fontSize: 16, fontWeight: "bold" }}>−</span>
                  ) : (
                    // Use a plus or chevron-right icon
                    <span style={{ fontSize: 16, fontWeight: "bold" }}>+</span>
                  )}
                </button>
              )}
              {selectionMode && (
                <input
                  type="checkbox"
                  checked={selectedItems.has(item.id)}
                  onChange={(e) => {
                    e.stopPropagation();
                    setSelectedItems((prev) => {
                      const newSet = new Set(prev);
                      if (e.target.checked) {
                        newSet.add(item.id);
                      } else {
                        newSet.delete(item.id);
                      }
                      return newSet;
                    });
                  }}
                  className="mr-2"
                />
              )}
              <button
                className="flex items-center gap-2 text-primary hover:underline"
                onClick={(e) => {
                  if (!selectionMode) {
                    if (isFolder) {
                      toggleFolder(item.id);
                    } else {
                      onFileSelect(item);
                    }
                  }
                  e.stopPropagation();
                }}
                tabIndex={0}
              >
                {isFolder ? <Folder className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                {item.name}
                {item.notes && item.notes.trim() !== "" && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <StickyNote
                          className="h-3 w-3 text-blue-500 ml-1 cursor-help"
                          aria-label="Has notes"
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="max-w-xs">
                          <p className="font-semibold text-xs mb-1">
                            Notes:
                          </p>
                          <p className="text-xs">
                            {item.notes.length > 200
                              ? `${item.notes.substring(0, 200)}...`
                              : item.notes}
                          </p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </button>
              
              {/* "+" button for creating subfolder removed as per user request */}
              
            </div>
            {item.tags && item.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {item.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="inline-flex text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded-sm"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </td>
          <td className="py-2">
            {format(new Date(item.lastOpened), "dd MMM yyyy HH:mm")}
          </td>
          <td className="py-2">{isFolder ? "-" : formatFileSize(item.size)}</td>
          <td className="py-2">
            {isFolder ? "-" : (item.lines?.toLocaleString() || "Unknown")}
          </td>
          <td className="py-2">{isFolder ? "-" : formatDate(item.startDate)}</td>
          <td className="py-2">{isFolder ? "-" : formatDate(item.endDate)}</td>
          <td className="py-2 text-right">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => handleRemoveItem(item.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </td>
        </tr>
        {isFolder && isExpanded && item.children && item.children.length > 0
          ? item.children.map((childId) => renderTreeItem(childId, level + 1))
          : null}
      </React.Fragment>
    );
  };

  const clearAllHistory = () => {
    // Clear localStorage
    localStorage.removeItem("logTrawler_recentItems");
    setRecentItems([]);

    // Also clear IndexedDB
    try {
      import("@/lib/indexedDB-fix").then(
        ({ getAllLogFiles, deleteLogFile }) => {
          // Get all items first
          getAllLogFiles().then((items) => {
            // Delete each item from IndexedDB
            items.forEach((item) => {
              deleteLogFile(item.id).catch((err) =>
                console.error(
                  `Failed to delete item ${item.id} from IndexedDB:`,
                  err,
                ),
              );
            });
            console.log(
              "Cleared all items from both localStorage and IndexedDB",
            );
          });
        },
      );
    } catch (error) {
      console.error("Error importing IndexedDB module:", error);
    }
  };

  const handleRemoveItem = (id: string) => {
    // Check if the item exists before removing
    const itemToRemove = recentItems.find((item) => item.id === id);
    if (!itemToRemove) return;

    console.log("Removing item:", itemToRemove.name, "with ID:", id);

    const updatedItems = recentItems.filter((item) => item.id !== id);
    setRecentItems(updatedItems);
    localStorage.setItem(
      "logTrawler_recentItems",
      JSON.stringify(updatedItems),
    );

    // Also remove from IndexedDB if it exists there
    try {
      import("@/lib/indexedDB-fix").then(({ deleteLogFile }) => {
        deleteLogFile(id).catch((err) =>
          console.error("Failed to delete from IndexedDB:", err),
        );
      });
    } catch (error) {
      console.error("Error importing IndexedDB module:", error);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (bytes === undefined) return "Unknown";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024)
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "Unknown";
    try {
      return format(new Date(dateStr), "dd MMM yyyy HH:mm:ss");
    } catch (e) {
      return "Invalid date";
    }
  };

  if (loadError) {
    return (
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Recent Files
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-red-500 font-semibold py-4">
            {loadError}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (recentItems.length === 0 && !isLoading) {
    return (
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Recent Files
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground py-4">
            No recent files or folders found.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-4">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Recent Files
          </CardTitle>
          <div className="flex items-center gap-2">
            {selectionMode ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (selectedItems.size > 0 && onMultipleFilesSelect) {
                      const itemsToOpen = recentItems.filter((item) =>
                        selectedItems.has(item.id) && item.type === 'file',
                      );
                      onMultipleFilesSelect(itemsToOpen);
                      setSelectionMode(false);
                      setSelectedItems(new Set());
                    }
                  }}
                  disabled={selectedItems.size === 0}
                >
                  <Check className="h-4 w-4 mr-1" />
                  Open Selected ({selectedItems.size})
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectionMode(false);
                    setSelectedItems(new Set());
                  }}
                >
                  Cancel
                </Button>
              </>
            ) : createFolderMode ? (
              <>
                <Input
                  placeholder="Folder name..."
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="h-8 w-40"
                  autoFocus
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCreateFolder}
                  disabled={!newFolderName.trim()}
                >
                  Create
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCreateFolderMode(false);
                    setNewFolderName("");
                    setParentFolderId(null);
                  }}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectionMode(true)}
                >
                  <FolderOpen className="h-4 w-4 mr-1" />
                  Select Multiple
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCreateFolderMode(true)}
                >
                  <Folder className="h-4 w-4 mr-1" />
                  New Folder
                </Button>
              </>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Clear History
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Clear Recent Files History
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove all recent files and folders from your history and
                    delete all log files from storage. This action cannot be
                    undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={clearAllHistory}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Clear All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
        <div className="mt-2 relative">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by filename or tag..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="flex justify-center items-center py-4">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="ml-2 text-sm text-muted-foreground">
              Loading items...
            </span>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 font-medium">
                  <button
                    className="flex items-center gap-1 hover:text-primary"
                    onClick={() => handleSort("name")}
                  >
                    Name
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="text-left py-2 font-medium">
                  <button
                    className="flex items-center gap-1 hover:text-primary"
                    onClick={() => handleSort("lastOpened")}
                  >
                    Last Opened
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="text-left py-2 font-medium">
                  <button
                    className="flex items-center gap-1 hover:text-primary"
                    onClick={() => handleSort("size")}
                  >
                    Size
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="text-left py-2 font-medium">
                  <button
                    className="flex items-center gap-1 hover:text-primary"
                    onClick={() => handleSort("lines")}
                  >
                    Lines
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="text-left py-2 font-medium">
                  <button
                    className="flex items-center gap-1 hover:text-primary"
                    onClick={() => handleSort("startDate")}
                  >
                    Start Date
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="text-left py-2 font-medium">
                  <button
                    className="flex items-center gap-1 hover:text-primary"
                    onClick={() => handleSort("endDate")}
                  >
                    End Date
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="text-right py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rootItems.map((item) => renderTreeItem(item.id))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

export default RecentFiles;
