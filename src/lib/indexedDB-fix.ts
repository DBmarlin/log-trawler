// IndexedDB utility for storing and retrieving log files

import { FileItem, FolderItem } from "@/types/fileSystem";

interface LogFileData extends FileItem {
  // Maintaining backward compatibility with existing data
}

// Helper function to safely parse dates from IndexedDB
const parseDate = (dateValue: any): Date | undefined => {
  if (!dateValue) return undefined;
  if (dateValue instanceof Date) return dateValue;
  if (typeof dateValue === 'string') {
    const d = new Date(dateValue);
    return isNaN(d.getTime()) ? undefined : d;
  }
  return undefined;
};

const DB_NAME = "logTrawlerDB";
const DB_VERSION = 5;
const METADATA_STORE = "metadata";
const CONTENT_STORE = "content";

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      let errorMsg = "Failed to open database";
      if (event && (event as any).target && (event as any).target.error) {
        errorMsg += ": " + ((event as any).target.error?.message || (event as any).target.error?.name || "");
      }
      console.error("IndexedDB open error:", event, (event as any).target?.error);
      reject(errorMsg);
    };

    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const oldVersion = (event as any).oldVersion || 0;

      // Migration from version 1 or 2 to version 3
      if (oldVersion < 3) {
        // Create metadata store
        if (!db.objectStoreNames.contains(METADATA_STORE)) {
          const metadataStore = db.createObjectStore(METADATA_STORE, {
            keyPath: "id",
          });
          metadataStore.createIndex("name", "name", { unique: false });
          metadataStore.createIndex("lastOpened", "lastOpened", { unique: false });
        }

        // Create content store
        if (!db.objectStoreNames.contains(CONTENT_STORE)) {
          const contentStore = db.createObjectStore(CONTENT_STORE, {
            keyPath: "id",
          });
        }

        // Migrate data from old single table if it exists
        if (db.objectStoreNames.contains("logFiles")) {
          const oldStore = (event.target as any).transaction.objectStore("logFiles");
          const getAllRequest = oldStore.getAll();

          getAllRequest.onsuccess = (e) => {
            const items = (e.target as IDBRequest).result;
            items.forEach(item => {
              // Extract content and store separately
              const { content, ...metadata } = item;

              // Store metadata (add lines count)
              const metadataWithLines = {
                ...metadata,
                lines: content ? content.length : 0,
              };

              // Use the upgrade transaction to store data
              const metadataStore = (event.target as any).transaction.objectStore(METADATA_STORE);
              metadataStore.put(metadataWithLines);

              // Store content if it exists
              if (content) {
                const contentStore = (event.target as any).transaction.objectStore(CONTENT_STORE);
                contentStore.put({ id: item.id, content });
              }
            });
          };
        }
      }

      // Clean up old table in version 5
      if (oldVersion < 5 && db.objectStoreNames.contains("logFiles")) {
        db.deleteObjectStore("logFiles");
        console.log("Old logFiles table deleted - migration to optimized schema complete");
      }
    };
  });
};

// Save a log file or folder to IndexedDB
export const saveLogFile = async (logItem: FileItem): Promise<string> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([METADATA_STORE, CONTENT_STORE], "readwrite");
      const metadataStore = transaction.objectStore(METADATA_STORE);

      // First check if an item with this name already exists
      const nameIndex = metadataStore.index("name");
      const nameRequest = nameIndex.getAll();

      nameRequest.onsuccess = (e) => {
        const existingItems = (e.target as IDBRequest).result;
        const existingItem = existingItems.find((f) => f.name === logItem.name && f.parentId === logItem.parentId);

        if (existingItem) {
          logItem.id = existingItem.id;
        }

        // Separate content from metadata
        const { content, ...metadata } = logItem;

        const metadataToStore = {
          ...metadata,
          lines: content ? content.length : 0, // Store lines count in metadata
          startDate: metadata.startDate instanceof Date ? metadata.startDate.toISOString() : metadata.startDate,
          endDate: metadata.endDate instanceof Date ? metadata.endDate.toISOString() : metadata.endDate,
          lastOpened: Date.now(),
          timeRange: metadata.timeRange
            ? {
                startDate: metadata.timeRange.startDate instanceof Date ? metadata.timeRange.startDate.toISOString() : metadata.timeRange.startDate,
                endDate: metadata.timeRange.endDate instanceof Date ? metadata.timeRange.endDate.toISOString() : metadata.timeRange.endDate,
              }
            : undefined,
        };

        const metadataRequest = metadataStore.put(metadataToStore);

        metadataRequest.onsuccess = () => {
          // If there's content, store it separately
          if (content && content.length > 0) {
            const contentStore = transaction.objectStore(CONTENT_STORE);
            const contentToStore = { id: logItem.id, content };
            const contentRequest = contentStore.put(contentToStore);

            contentRequest.onerror = (event) => {
              reject("Failed to save content");
            };
          }
        };

        metadataRequest.onerror = (event) => {
          reject("Failed to save metadata");
        };

        transaction.oncomplete = () => {
          db.close();
          resolve(logItem.id);
        };

        transaction.onerror = (event) => {
          reject("Transaction failed");
        };
      };

      nameRequest.onerror = (event) => {
        reject("Failed to check for existing items");
      };
    });
  } catch (error) {
    throw error;
  }
};

// Get all log items from IndexedDB (with content)
export const getAllLogFiles = async (): Promise<FileItem[]> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([METADATA_STORE, CONTENT_STORE], "readonly");
      const metadataStore = transaction.objectStore(METADATA_STORE);
      const contentStore = transaction.objectStore(CONTENT_STORE);

      // Get all metadata
      const metadataRequest = metadataStore.getAll();

      metadataRequest.onsuccess = (event) => {
        const metadataResults = (event.target as IDBRequest).result || [];
        const logItems: FileItem[] = [];

        // Get content for each item
        let processedCount = 0;
        const totalItems = metadataResults.length;

        if (totalItems === 0) {
          resolve([]);
          return;
        }

        metadataResults.forEach((metadata: any) => {
          const contentRequest = contentStore.get(metadata.id);

          contentRequest.onsuccess = () => {
            const contentResult = contentRequest.result;
            const logItem: FileItem = {
              ...metadata,
              startDate: parseDate(metadata.startDate),
              endDate: parseDate(metadata.endDate),
              timeRange: metadata.timeRange ? {
                startDate: parseDate(metadata.timeRange.startDate),
                endDate: parseDate(metadata.timeRange.endDate),
              } : undefined,
              content: contentResult ? contentResult.content : undefined,
            };
            logItems.push(logItem);

            processedCount++;
            if (processedCount === totalItems) {
              logItems.sort((a, b) => b.lastOpened - a.lastOpened);
              resolve(logItems);
            }
          };

          contentRequest.onerror = () => {
            // Content not found, add item without content
            const logItem: FileItem = {
              ...metadata,
              startDate: parseDate(metadata.startDate),
              endDate: parseDate(metadata.endDate),
              timeRange: metadata.timeRange ? {
                startDate: parseDate(metadata.timeRange.startDate),
                endDate: parseDate(metadata.timeRange.endDate),
              } : undefined,
            };
            logItems.push(logItem);

            processedCount++;
            if (processedCount === totalItems) {
              logItems.sort((a, b) => b.lastOpened - a.lastOpened);
              resolve(logItems);
            }
          };
        });
      };

      metadataRequest.onerror = (event) => {
        reject("Failed to get metadata items");
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    return [];
  }
};

// Get only metadata for all log items (without content) for faster loading
export const getLogFilesMetadata = async (): Promise<
  (Omit<FileItem, "content"> & { lines?: number })[]
> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([METADATA_STORE], "readonly");
      const store = transaction.objectStore(METADATA_STORE);

      // Use getAll directly instead of cursor for better performance
      const request = store.getAll();

      request.onsuccess = (event) => {
        const items = (event.target as IDBRequest).result || [];
        // Process all items at once instead of one by one
        const metadataItems: (Omit<FileItem, "content"> & { lines?: number })[] = items.map((item: any) => ({
          ...item,
          startDate: parseDate(item.startDate),
          endDate: parseDate(item.endDate),
          timeRange: item.timeRange ? {
            startDate: parseDate(item.timeRange.startDate),
            endDate: parseDate(item.timeRange.endDate),
          } : undefined,
          lines: item.lines || 0, // lines is now stored in metadata
        }));

        // Sort by lastOpened in descending order
        metadataItems.sort((a, b) => b.lastOpened - a.lastOpened);
        resolve(metadataItems);
      };

      request.onerror = (event) => {
        reject("Failed to get log items metadata");
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    return [];
  }
};

// Get a log item by ID
export const getLogFileById = async (
  id: string,
): Promise<FileItem | null> => {
  // Validate the ID is not empty
  if (!id || id.trim() === "") {
    return null;
  }
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([METADATA_STORE, CONTENT_STORE], "readwrite");
      const metadataStore = transaction.objectStore(METADATA_STORE);
      const contentStore = transaction.objectStore(CONTENT_STORE);

      // First try to get the metadata
      const metadataRequest = metadataStore.get(id);

      metadataRequest.onsuccess = (event) => {
        const metadata = (event.target as IDBRequest).result;
        if (metadata) {
          // Get the content
          const contentRequest = contentStore.get(id);

          contentRequest.onsuccess = () => {
            const contentResult = contentRequest.result;
            const fileItem: FileItem = {
              ...metadata,
              startDate: parseDate(metadata.startDate),
              endDate: parseDate(metadata.endDate),
              timeRange: metadata.timeRange ? {
                startDate: parseDate(metadata.timeRange.startDate),
                endDate: parseDate(metadata.timeRange.endDate),
              } : undefined,
              content: contentResult ? contentResult.content : undefined,
            };

            // Update lastOpened time in metadata
            metadata.lastOpened = Date.now();
            metadataStore.put(metadata);

            resolve(fileItem);
          };

          contentRequest.onerror = () => {
            // Content not found, return item without content
            const fileItem: FileItem = {
              ...metadata,
              startDate: parseDate(metadata.startDate),
              endDate: parseDate(metadata.endDate),
              timeRange: metadata.timeRange ? {
                startDate: parseDate(metadata.timeRange.startDate),
                endDate: parseDate(metadata.timeRange.endDate),
              } : undefined,
            };

            // Update lastOpened time in metadata
            metadata.lastOpened = Date.now();
            metadataStore.put(metadata);

            resolve(fileItem);
          };
        } else {
          // Try fallback search for backward compatibility
          const allMetadataRequest = metadataStore.getAll();

          allMetadataRequest.onsuccess = () => {
            const allItems = allMetadataRequest.result || [];

            // Extract the name from the ID
            const nameParts = id.split("_");
            if (nameParts.length > 1) {
              const itemName = nameParts[0];

              // Look for any item with a similar name
              const matchingItem = allItems.find((f) => {
                if (f.name === itemName) return true;

                const normalizedName = itemName
                  .replace(/[^a-z0-9]/gi, "")
                  .toLowerCase();
                const normalizedItemName = f.name
                  .replace(/[^a-z0-9]/gi, "")
                  .toLowerCase();
                if (normalizedName === normalizedItemName) return true;

                return (
                  f.name.toLowerCase().includes(itemName.toLowerCase()) ||
                  itemName.toLowerCase().includes(f.name.toLowerCase())
                );
              });

              if (matchingItem) {
                // Get content for the matching item
                const contentRequest = contentStore.get(matchingItem.id);

                contentRequest.onsuccess = () => {
                  const contentResult = contentRequest.result;
                  const fileItem: FileItem = {
                    ...matchingItem,
                    startDate: parseDate(matchingItem.startDate),
                    endDate: parseDate(matchingItem.endDate),
                    timeRange: matchingItem.timeRange ? {
                      startDate: parseDate(matchingItem.timeRange.startDate),
                      endDate: parseDate(matchingItem.timeRange.endDate),
                    } : undefined,
                    content: contentResult ? contentResult.content : undefined,
                  };

                  // Update lastOpened time
                  matchingItem.lastOpened = Date.now();
                  metadataStore.put(matchingItem);

                  resolve(fileItem);
                };

                contentRequest.onerror = () => {
                  const fileItem: FileItem = {
                    ...matchingItem,
                    startDate: parseDate(matchingItem.startDate),
                    endDate: parseDate(matchingItem.endDate),
                    timeRange: matchingItem.timeRange ? {
                      startDate: parseDate(matchingItem.timeRange.startDate),
                      endDate: parseDate(matchingItem.timeRange.endDate),
                    } : undefined,
                  };

                  // Update lastOpened time
                  matchingItem.lastOpened = Date.now();
                  metadataStore.put(matchingItem);

                  resolve(fileItem);
                };
                return;
              }
            }
            resolve(null);
          };

          allMetadataRequest.onerror = () => {
            resolve(null);
          };
        }
      };

      metadataRequest.onerror = (event) => {
        reject("Failed to get log item");
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    return null;
  }
};

// Delete a log item by ID (with cascading delete for folders)
export const deleteLogFile = async (id: string): Promise<boolean> => {
  try {
    // First, get the item to check if it's a folder
    const db1 = await initDB();
    const item = await new Promise<any>((resolve, reject) => {
      const transaction = db1.transaction([METADATA_STORE], "readonly");
      const store = transaction.objectStore(METADATA_STORE);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject("Failed to get item");
      transaction.oncomplete = () => db1.close();
    });

    if (!item) {
      return false;
    }

    // If it's a folder, delete all children recursively
    if (item.type === 'folder' && item.children && item.children.length > 0) {
      await Promise.all(item.children.map((childId: string) => deleteLogFile(childId)));
    }

    // Now delete the item from both stores
    const db2 = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db2.transaction([METADATA_STORE, CONTENT_STORE], "readwrite");
      const metadataStore = transaction.objectStore(METADATA_STORE);
      const contentStore = transaction.objectStore(CONTENT_STORE);

      // Delete from metadata store
      const deleteMetadataRequest = metadataStore.delete(id);

      deleteMetadataRequest.onsuccess = () => {
        // Delete from content store (ignore if not found)
        contentStore.delete(id);

        // If the item has a parent, update the parent's children list
        if (item.parentId) {
          const parentRequest = metadataStore.get(item.parentId);
          parentRequest.onsuccess = (e) => {
            const parent = (e.target as IDBRequest).result;
            if (parent && parent.children) {
              parent.children = parent.children.filter((childId: string) => childId !== id);
              metadataStore.put(parent);
            }
          };
        }
        resolve(true);
      };

      deleteMetadataRequest.onerror = (event) => {
        reject("Failed to delete log item");
      };

      transaction.oncomplete = () => {
        db2.close();
      };
    });
  } catch (error) {
    return false;
  }
};

// Update a log item's metadata
export const updateLogFile = async (
  id: string,
  updates: Partial<FileItem>,
): Promise<boolean> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([METADATA_STORE, CONTENT_STORE], "readwrite");
      const metadataStore = transaction.objectStore(METADATA_STORE);

      // First get the existing metadata
      const getRequest = metadataStore.get(id);

      getRequest.onsuccess = (event) => {
        const existingItem = (event.target as IDBRequest).result;
        if (!existingItem) {
          reject("Log item not found");
          return;
        }

        // Separate content from metadata updates
        const { content, ...metadataUpdates } = updates;

        // Create a clone to avoid side effects and convert dates to strings for storage
        const updatesForDB: any = { ...metadataUpdates };

        // Convert dates to strings for storage
        if (updatesForDB.startDate instanceof Date) {
          updatesForDB.startDate = updatesForDB.startDate.toISOString();
        }
        if (updatesForDB.endDate instanceof Date) {
          updatesForDB.endDate = updatesForDB.endDate.toISOString();
        }
        if (updatesForDB.timeRange) {
          if (updatesForDB.timeRange.startDate instanceof Date) {
            updatesForDB.timeRange.startDate = updatesForDB.timeRange.startDate.toISOString();
          }
          if (updatesForDB.timeRange.endDate instanceof Date) {
            updatesForDB.timeRange.endDate = updatesForDB.timeRange.endDate.toISOString();
          }
        }

        // Update lines count if content is being updated
        if (content) {
          updatesForDB.lines = content.length;
        }

        const updatedItem = {
          ...existingItem,
          ...updatesForDB,
          lastOpened: Date.now(),
        };

        const putRequest = metadataStore.put(updatedItem);

        putRequest.onsuccess = () => {
          // If content is being updated, store it separately
          if (content !== undefined) {
            const contentStore = transaction.objectStore(CONTENT_STORE);
            if (content && content.length > 0) {
              contentStore.put({ id, content });
            } else {
              // Delete content if it's being set to empty
              contentStore.delete(id);
            }
          }
        };

        putRequest.onerror = (event) => {
          reject("Failed to update log item");
        };
      };

      getRequest.onerror = (event) => {
        reject("Failed to get log item for update");
      };

      transaction.oncomplete = () => {
        db.close();
        resolve(true);
      };
    });
  } catch (error) {
    return false;
  }
};

// Clear all data from the database (for "Clear History" functionality)
export const clearAllData = async (): Promise<boolean> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([METADATA_STORE, CONTENT_STORE], "readwrite");

      // Clear both stores
      const metadataStore = transaction.objectStore(METADATA_STORE);
      const contentStore = transaction.objectStore(CONTENT_STORE);

      metadataStore.clear();
      contentStore.clear();

      transaction.oncomplete = () => {
        db.close();
        resolve(true);
      };

      transaction.onerror = (event) => {
        reject("Failed to clear database");
      };
    });
  } catch (error) {
    return false;
  }
};

// Reset the database (for troubleshooting)
export const resetDatabase = async (): Promise<boolean> => {
  // Instead of deleting the database, just initialize it if it doesn't exist
  try {
    await initDB();
    return true;
  } catch (error) {
    return false;
  }
};
