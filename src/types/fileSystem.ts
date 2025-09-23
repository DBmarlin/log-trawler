// Types for file and folder structure in Log Trawler
export interface FileItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  lastOpened: number; // timestamp
  size?: number; // in bytes
  lines?: number;
  startDate?: Date;
  endDate?: Date;
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
  timeRange?: { startDate?: Date; endDate?: Date };
  interestingLines?: number[];
  showOnlyMarked?: boolean;
  children?: string[]; // Array of child item IDs (files or subfolders), only for folders
  isLoading?: boolean;
}

export interface FolderItem extends Omit<FileItem, 'content' | 'filters' | 'filterLogic' | 'bucketSize' | 'timeRange' | 'interestingLines' | 'showOnlyMarked'> {
  type: 'folder';
  children: string[]; // Array of child item IDs (files or subfolders)
}
