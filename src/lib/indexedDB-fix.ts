// IndexedDB utility for storing and retrieving log files

import { FileItem, FolderItem } from "@/types/fileSystem";

interface LogFileData extends FileItem {
  // Maintaining backward compatibility with existing data
}

const DB_NAME = "logTrawlerDB";
const DB_VERSION = 2;
const LOG_FILES_STORE = "logFiles";

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

      // Create object store for log files
      if (!db.objectStoreNames.contains(LOG_FILES_STORE)) {
        const store = db.createObjectStore(LOG_FILES_STORE, {
          keyPath: "id",
        });
        store.createIndex("name", "name", { unique: false });
        store.createIndex("lastOpened", "lastOpened", { unique: false });
      }
    };
  });
};

// Save a log file or folder to IndexedDB
export const saveLogFile = async (logItem: FileItem): Promise<string> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([LOG_FILES_STORE], "readwrite");
      const store = transaction.objectStore(LOG_FILES_STORE);

      // First check if an item with this name already exists
      const nameIndex = store.index("name");
      const nameRequest = nameIndex.getAll();

      nameRequest.onsuccess = (e) => {
        const existingItems = (e.target as IDBRequest).result;
        const existingItem = existingItems.find((f) => f.name === logItem.name && f.parentId === logItem.parentId);

        if (existingItem) {
          logItem.id = existingItem.id;
        }

        const itemToStore = {
          ...logItem,
          startDate: logItem.startDate instanceof Date ? logItem.startDate.toISOString() : logItem.startDate,
          endDate: logItem.endDate instanceof Date ? logItem.endDate.toISOString() : logItem.endDate,
          lastOpened: Date.now(),
          timeRange: logItem.timeRange
            ? {
                startDate: logItem.timeRange.startDate instanceof Date ? logItem.timeRange.startDate.toISOString() : logItem.timeRange.startDate,
                endDate: logItem.timeRange.endDate instanceof Date ? logItem.timeRange.endDate.toISOString() : logItem.timeRange.endDate,
              }
            : undefined,
        };

        const request = store.put(itemToStore);

        request.onsuccess = () => {
          // Wait for transaction to complete before resolving
        };

        request.onerror = (event) => {
          reject("Failed to save log item");
        };

        transaction.oncomplete = () => {
          db.close();
          resolve(logItem.id);
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

// Get all log items from IndexedDB
export const getAllLogFiles = async (): Promise<FileItem[]> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([LOG_FILES_STORE], "readonly");
      const store = transaction.objectStore(LOG_FILES_STORE);

      // Use getAll instead of cursor for more reliable results
      const request = store.getAll();

      request.onsuccess = (event) => {
        const results = (event.target as IDBRequest).result || [];
        const logItems: FileItem[] = results.map((item: any) => ({
          ...item,
          startDate: item.startDate ? new Date(item.startDate) : undefined,
          endDate: item.endDate ? new Date(item.endDate) : undefined,
        }));
        logItems.sort((a, b) => b.lastOpened - a.lastOpened);
        resolve(logItems as FileItem[]);
      };

      request.onerror = (event) => {
        reject("Failed to get log items");
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
      const transaction = db.transaction([LOG_FILES_STORE], "readonly");
      const store = transaction.objectStore(LOG_FILES_STORE);

      // Use getAll directly instead of cursor for better performance
      const request = store.getAll();

      request.onsuccess = (event) => {
        const items = (event.target as IDBRequest).result || [];
        // Process all items at once instead of one by one
        const metadataItems: Omit<FileItem, "content">[] = items.map((item: any) => {
          const { content, ...metadata } = item;
          return {
            ...metadata,
            startDate: metadata.startDate ? new Date(metadata.startDate) : undefined,
            endDate: metadata.endDate ? new Date(metadata.endDate) : undefined,
            lines: content?.length || 0,
          };
        });

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
      const transaction = db.transaction([LOG_FILES_STORE], "readonly");
      const store = transaction.objectStore(LOG_FILES_STORE);

      // First try to get all items to see what's in the database
      const allRequest = store.getAll();

      allRequest.onsuccess = (event) => {
        const allItems = (event.target as IDBRequest).result || [];

        // Now try to get the specific item
        const request = store.get(id);

        request.onsuccess = (event) => {
          const result = (event.target as IDBRequest).result;
          if (result) {
            const fileItem: FileItem = {
              ...result,
              startDate: result.startDate ? new Date(result.startDate) : undefined,
              endDate: result.endDate ? new Date(result.endDate) : undefined,
            };
            // Update lastOpened time
            const updateTx = db.transaction([LOG_FILES_STORE], "readwrite");
            const updateStore = updateTx.objectStore(LOG_FILES_STORE);
            result.lastOpened = Date.now();
            updateStore.put(result);
            resolve(fileItem);
          } else {
            // Try with a different ID format (for backward compatibility)
            // Extract the name from the ID
            const nameParts = id.split("_");
            if (nameParts.length > 1) {
              // Try to extract the actual name without the timestamp
              const itemName = nameParts[0]; // Just use the first part as the name

              // Look for any item with a similar name
              const matchingItem = allItems.find((f) => {
                // Try exact name match
                if (f.name === itemName) return true;

                // Try normalized name match
                const normalizedName = itemName
                  .replace(/[^a-z0-9]/gi, "")
                  .toLowerCase();
                const normalizedItemName = f.name
                  .replace(/[^a-z0-9]/gi, "")
                  .toLowerCase();
                if (normalizedName === normalizedItemName) return true;

                // Try substring match
                return (
                  f.name.toLowerCase().includes(itemName.toLowerCase()) ||
                  itemName.toLowerCase().includes(f.name.toLowerCase())
                );
              });

              if (matchingItem) {
                resolve({
                  ...matchingItem,
                  startDate: matchingItem.startDate ? new Date(matchingItem.startDate) : undefined,
                  endDate: matchingItem.endDate ? new Date(matchingItem.endDate) : undefined,
                } as FileItem);
                return;
              }
            }
            resolve(null);
          }
        };

        request.onerror = (event) => {
          reject("Failed to get log item");
        };
      };

      allRequest.onerror = (event) => {
        reject("Failed to get all items");
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
      const transaction = db1.transaction([LOG_FILES_STORE], "readonly");
      const store = transaction.objectStore(LOG_FILES_STORE);
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

    // Now delete the item itself
    const db2 = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db2.transaction([LOG_FILES_STORE], "readwrite");
      const store = transaction.objectStore(LOG_FILES_STORE);
      const deleteRequest = store.delete(id);

      deleteRequest.onsuccess = () => {
        // If the item has a parent, update the parent's children list
        if (item.parentId) {
          const parentRequest = store.get(item.parentId);
          parentRequest.onsuccess = (e) => {
            const parent = (e.target as IDBRequest).result;
            if (parent && parent.children) {
              parent.children = parent.children.filter((childId: string) => childId !== id);
              store.put(parent);
            }
          };
        }
        resolve(true);
      };

      deleteRequest.onerror = (event) => {
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
      const transaction = db.transaction([LOG_FILES_STORE], "readwrite");
      const store = transaction.objectStore(LOG_FILES_STORE);

      // First get the existing item
      const getRequest = store.get(id);

      getRequest.onsuccess = (event) => {
        const existingItem = (event.target as IDBRequest).result;
        if (!existingItem) {
          reject("Log item not found");
          return;
        }

        // Create a clone to avoid side effects and convert dates to strings for storage
        const updatesForDB: any = { ...updates };

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

        const updatedItem = {
          ...existingItem,
          ...updatesForDB,
          lastOpened: Date.now(),
        };

        const putRequest = store.put(updatedItem);

        putRequest.onsuccess = () => {
          // Wait for transaction to complete
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
