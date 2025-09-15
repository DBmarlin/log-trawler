// Types for file and folder structure in Log Trawler
export interface FileItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  lastOpened: number; // timestamp
  size?: number; // in bytes
  lines?: number;
  startDate?: string; // ISO string
  endDate?: string; // ISO string
  tags?: string[];
  notes?: string;
  parentId?: string; // ID of the parent folder, if any
  content?: string[]; // Only for files, not folders
  filters?: Array<{
    id: string;
    type: "include" | "exclude";
    term: string;
    isRegex?: boolean;
  }>;
  filterLogic?: "AND" | "OR";
  bucketSize?: string;
  timeRange?: { startDate?: string; endDate?: string };
  interestingLines?: number[];
  showOnlyMarked?: boolean;
  children?: string[]; // Array of child item IDs (files or subfolders), only for folders
}

export interface FolderItem extends Omit<FileItem, 'content' | 'filters' | 'filterLogic' | 'bucketSize' | 'timeRange' | 'interestingLines' | 'showOnlyMarked'> {
  type: 'folder';
  children: string[]; // Array of child item IDs (files or subfolders)
}
