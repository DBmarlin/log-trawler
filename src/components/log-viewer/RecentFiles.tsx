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
  Eye,
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
import TagsDialog from "./TagsDialog";


interface RecentFilesProps {
  onFileSelect: (file: FileItem) => void;
  onMultipleFilesSelect?: (files: FileItem[]) => void;
  renameItem: (itemId: string, newName: string) => Promise<boolean>;
  onSaveTags?: (itemId: string, tags: string[]) => void;
  loadedFileIds?: string[];
  onFileClose?: (fileId: string) => void;
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
  renameItem,
  onSaveTags,
  loadedFileIds,
  onFileClose,
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
  const [renamingItemId, setRenamingItemId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [tagsDialogItem, setTagsDialogItem] = useState<FileItem | null>(null);


  // Load recent files from IndexedDB on mount and when files change
  const loadRecentFiles = async () => {
    try {
      const { getLogFilesMetadata } = await import("@/lib/indexedDB-fix");
      const recentFiles = await getLogFilesMetadata();
      setRecentItems(recentFiles);

      // Clean up expanded folders - remove any that no longer exist
      setExpandedFolders((prev) => {
        const existingFolderIds = new Set(
          recentFiles.filter(item => item.type === 'folder').map(item => item.id)
        );
        const cleaned = new Set([...prev].filter(id => existingFolderIds.has(id)));
        return cleaned;
      });

      setIsLoading(false);
    } catch (error) {
      console.error("Failed to load recent files:", error);
      setLoadError("Failed to load recent files");
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRecentFiles();
  }, []);

  // Listen for file changes
  useEffect(() => {
    const handleFilesChanged = () => {
      loadRecentFiles();
    };

    document.addEventListener("filesChanged", handleFilesChanged);

    return () => {
      document.removeEventListener("filesChanged", handleFilesChanged);
    };
  }, []);

  // Load expanded folders from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("logTrawler_expandedFolders");
      if (stored) {
        const expandedArray = JSON.parse(stored);
        setExpandedFolders(new Set(expandedArray));
      }
    } catch (error) {
      console.error("Failed to load expanded folders from localStorage:", error);
    }
  }, []);

  // Save expanded folders to localStorage whenever it changes
  useEffect(() => {
    try {
      const expandedArray = Array.from(expandedFolders);
      localStorage.setItem("logTrawler_expandedFolders", JSON.stringify(expandedArray));
    } catch (error) {
      console.error("Failed to save expanded folders to localStorage:", error);
    }
  }, [expandedFolders]);

  // Load sort preferences from localStorage on mount
  useEffect(() => {
    try {
      const storedSortField = localStorage.getItem("logTrawler_sortField");
      const storedSortDirection = localStorage.getItem("logTrawler_sortDirection");
      if (storedSortField) {
        setSortField(storedSortField as SortField);
      }
      if (storedSortDirection) {
        setSortDirection(storedSortDirection as SortDirection);
      }
    } catch (error) {
      console.error("Failed to load sort preferences from localStorage:", error);
    }
  }, []);

  // Save sortField to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem("logTrawler_sortField", sortField);
    } catch (error) {
      console.error("Failed to save sortField to localStorage:", error);
    }
  }, [sortField]);

  // Save sortDirection to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem("logTrawler_sortDirection", sortDirection);
    } catch (error) {
      console.error("Failed to save sortDirection to localStorage:", error);
    }
  }, [sortDirection]);

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

    // Initialize map with all items, clearing children arrays to rebuild from parentId
    items.forEach((item) => {
      itemMap.set(item.id, { ...item, children: item.type === 'folder' ? [] : undefined });
    });

    // Connect children to parents based on parentId relationships
    items.forEach((item) => {
      if (item.parentId && itemMap.has(item.parentId)) {
        const parent = itemMap.get(item.parentId);
        if (parent && parent.type === 'folder') {
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
    let items = recentItems;
    if (!searchTerm) return items;

    const searchLower = searchTerm.toLowerCase();
    return items.filter((item) => {
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

  // Comparator function for sorting items
  const getComparator = (field: SortField, direction: SortDirection) => {
    return (a: FileItem, b: FileItem) => {
      let comparison = 0;
      switch (field) {
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
          if (!a.startDate && !b.startDate) comparison = 0;
          else if (!a.startDate) comparison = 1; // undefined dates sort to end
          else if (!b.startDate) comparison = -1;
          else comparison = new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
          break;
        case "endDate":
          if (!a.endDate && !b.endDate) comparison = 0;
          else if (!a.endDate) comparison = 1; // undefined dates sort to end
          else if (!b.endDate) comparison = -1;
          else comparison = new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
          break;
      }
      return direction === "asc" ? comparison : -comparison;
    };
  };

  // Memoize sorted items to avoid recalculating on every render
  const sortedItems = React.useMemo(
    () => [...filteredItems].sort(getComparator(sortField, sortDirection)),
    [filteredItems, sortField, sortDirection],
  );

  // Build tree structure for rendering
  const { itemMap, rootItems } = React.useMemo(() => {
    const { itemMap: map, rootItems: roots } = buildTree(sortedItems);
    // Sort children of each folder based on current sort criteria
    map.forEach((item) => {
      if (item.type === 'folder' && item.children) {
        item.children.sort((idA, idB) => {
          const a = map.get(idA);
          const b = map.get(idB);
          if (!a || !b) return 0;
          return getComparator(sortField, sortDirection)(a, b);
        });
      }
    });
    return { itemMap: map, rootItems: roots };
  }, [sortedItems, sortField, sortDirection]);

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

      // Dispatch event to refresh the list
      document.dispatchEvent(new CustomEvent("filesChanged"));
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

  const handleDrop = async (e: React.DragEvent, folderId?: string) => {
    e.preventDefault();
    setDragOverId(null);
    const itemId = e.dataTransfer.getData("itemId");
    if (!itemId || itemId === folderId) return;

    const item = recentItems.find(i => i.id === itemId);
    if (!item) return;

    // If dropping to root and item is already at root, do nothing
    if (!folderId && !item.parentId) return;

    // If dropping to same folder, do nothing
    if (folderId && item.parentId === folderId) return;

    let targetFolder: FileItem | undefined;
    if (folderId) {
      targetFolder = recentItems.find(i => i.id === folderId);
      if (!targetFolder || targetFolder.type !== 'folder') return;
    }

    // Prevent moving a folder into itself or its children (to avoid circular references)
    if (item.type === 'folder' && folderId) {
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
      const { updateLogFile } = await import("@/lib/indexedDB-fix");

      // Update the item's parentId
      await updateLogFile(itemId, { parentId: folderId || undefined });

      // Update the target folder's children if dropping into a folder
      if (folderId && targetFolder) {
        const currentChildren = targetFolder.children || [];
        if (!currentChildren.includes(itemId)) {
          const updatedChildren = [...currentChildren, itemId];
          await updateLogFile(folderId, { children: updatedChildren });
        }
      }

      // If the item had a previous parent, remove it from that parent's children
      if (item.parentId && item.parentId !== folderId) {
        const previousParent = recentItems.find(i => i.id === item.parentId);
        if (previousParent && previousParent.type === 'folder' && previousParent.children) {
          const updatedParentChildren = previousParent.children.filter(id => id !== itemId);
          await updateLogFile(item.parentId, { children: updatedParentChildren });
        }
      }

      // Dispatch event to refresh the list
      document.dispatchEvent(new CustomEvent("filesChanged"));
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
    // Use 24px to align with the folder button space
    const indentStyle = isFolder
      ? { paddingLeft: `${level * 16}px` }
      : { paddingLeft: `${level * 16 + 24}px` };

    // Highlight drop target for folders
    const dropHighlight =
      isFolder && dragOverId === item.id
        ? "bg-blue-500/20 border-blue-500"
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

            // Rename option
            contextMenu.appendChild(
              createMenuItem("Rename", () => {
                setRenamingItemId(item.id);
                setRenameValue(item.name);
                document.body.removeChild(contextMenu);
              }),
            );

            // Manage Tags option
            contextMenu.appendChild(
              createMenuItem("Manage Tags", () => {
                setTagsDialogItem(item);
                document.body.removeChild(contextMenu);
              }),
            );

            // Delete option
            contextMenu.appendChild(
              createMenuItem("Delete", () => {
                handleRemoveItem(item.id);
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
              {renamingItemId === item.id ? (
                <div className="flex items-center gap-2">
                  {isFolder ? <Folder className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key === "Enter") {
                        if (renameValue.trim() && renameValue.trim() !== item.name) {
                          await renameItem(item.id, renameValue.trim());
                        }
                        setRenamingItemId(null);
                        setRenameValue("");
                      } else if (e.key === "Escape") {
                        setRenamingItemId(null);
                        setRenameValue("");
                      }
                    }}
                    onBlur={async () => {
                      if (renameValue.trim() && renameValue.trim() !== item.name) {
                        await renameItem(item.id, renameValue.trim());
                      }
                      setRenamingItemId(null);
                      setRenameValue("");
                    }}
                    className="flex-1 px-1 py-0.5 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-primary bg-background text-foreground"
                    autoFocus
                  />
                </div>
              ) : (
                <>
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
                    {!isFolder && loadedFileIds && loadedFileIds.includes(item.id) && (
                      <Eye className="h-3 w-3 ml-1 text-green-500" />
                    )}
                    {item.name}
                  </button>
                  {item.tags && item.tags.length > 0 && (() => {
                    const displayTags = item.tags.slice(0, 5);
                    const hasMore = item.tags.length > 5;
                    return hasMore ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="flex items-center gap-1 ml-2">
                              {displayTags.map((tag, index) => (
                                <span
                                  key={index}
                                  className="inline-flex text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded-sm"
                                >
                                  {tag}
                                </span>
                              ))}
                              <span className="text-xs text-muted-foreground">..</span>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {item.tags.map((tag, index) => (
                                <span
                                  key={index}
                                  className="inline-flex text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded-sm"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <span className="flex items-center gap-1 ml-2">
                        {displayTags.map((tag, index) => (
                          <span
                            key={index}
                            className="inline-flex text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded-sm"
                          >
                            {tag}
                          </span>
                        ))}
                      </span>
                    );
                  })()}
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
                </>
              )}
              
              {/* "+" button for creating subfolder removed as per user request */}

            </div>
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
    localStorage.removeItem("logTrawler_recentFiles");
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

  // Helper function to get all descendant IDs recursively
  const getAllDescendantIds = (itemId: string, items: FileItem[]): string[] => {
    const item = items.find(i => i.id === itemId);
    if (!item) return [];
    const ids = [itemId];
    if (item.type === 'folder' && item.children) {
      for (const childId of item.children) {
        ids.push(...getAllDescendantIds(childId, items));
      }
    }
    return ids;
  };

  const handleRemoveItem = (id: string) => {
    setDeletingItemId(id);
  };

  const performDelete = (id: string) => {
    // Check if the item exists before removing
    const itemToRemove = recentItems.find((item) => item.id === id);
    if (!itemToRemove) return;

    console.log("Removing item:", itemToRemove.name, "with ID:", id);

    // Close the file if it's open
    if (itemToRemove.type === 'file' && loadedFileIds?.includes(id) && onFileClose) {
      onFileClose(id);
    }

    // Get all IDs to remove (item and descendants)
    const idsToRemove = getAllDescendantIds(id, recentItems);

    // Remove from IndexedDB
    try {
      import("@/lib/indexedDB-fix").then(async ({ deleteLogFile }) => {
        // Wait for all deletions to complete
        await Promise.all(
          idsToRemove.map(idToDelete =>
            deleteLogFile(idToDelete).catch((err) =>
              console.error(`Failed to delete ${idToDelete} from IndexedDB:`, err),
            )
          )
        );
        // Dispatch event to refresh the list after all deletions are complete
        document.dispatchEvent(new CustomEvent("filesChanged"));
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

  const formatDate = (date?: Date) => {
    if (!date) return "Unknown";
    try {
      return format(date, "dd MMM yyyy HH:mm:ss");
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
                      const itemsToOpen = recentItems.filter((item) => {
                        const isSelected = selectedItems.has(item.id);
                        const isFile = item.type === 'file' || (!item.type && item.name); // Treat items without type as files if they have a name
                        return isSelected && isFile;
                      });
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
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleCreateFolder();
                    }
                  }}
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
                <th className="text-left py-2 font-medium cursor-pointer hover:text-primary" onClick={() => handleSort("name")}>
                  <div className="flex items-center gap-1">
                    Name
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="text-left py-2 font-medium cursor-pointer hover:text-primary" onClick={() => handleSort("lastOpened")}>
                  <div className="flex items-center gap-1">
                    Last Opened
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="text-left py-2 font-medium cursor-pointer hover:text-primary" onClick={() => handleSort("size")}>
                  <div className="flex items-center gap-1">
                    Size
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="text-left py-2 font-medium cursor-pointer hover:text-primary" onClick={() => handleSort("lines")}>
                  <div className="flex items-center gap-1">
                    Lines
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="text-left py-2 font-medium cursor-pointer hover:text-primary" onClick={() => handleSort("startDate")}>
                  <div className="flex items-center gap-1">
                    Start Date
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="text-left py-2 font-medium cursor-pointer hover:text-primary" onClick={() => handleSort("endDate")}>
                  <div className="flex items-center gap-1">
                    End Date
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="text-right py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody
              onDrop={(e) => handleDrop(e)}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverId('root');
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setDragOverId((prev) => (prev === 'root' ? null : prev));
              }}
              className={dragOverId === 'root' ? "bg-blue-500/20" : ""}
            >
              {rootItems.map((item) => renderTreeItem(item.id))}
            </tbody>
          </table>
        </div>
      </CardContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingItemId} onOpenChange={() => setDeletingItemId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{recentItems.find(item => item.id === deletingItemId)?.name}"?
              {recentItems.find(item => item.id === deletingItemId)?.type === 'folder' ? ' This will also delete all files and subfolders inside it.' : ''}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingItemId) {
                  performDelete(deletingItemId);
                  setDeletingItemId(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Tags Dialog */}
      {tagsDialogItem && onSaveTags && (
        <TagsDialog
          isOpen={!!tagsDialogItem}
          onClose={() => setTagsDialogItem(null)}
          itemId={tagsDialogItem.id}
          itemName={tagsDialogItem.name}
          initialTags={tagsDialogItem.tags || []}
          onSaveTags={onSaveTags}
        />
      )}
    </Card>
  );
};

export default RecentFiles;
