import React from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import RecentFiles from "../log-viewer/RecentFiles";
import { LogFile } from "../home"; // Assuming LogFile type is exported from home.tsx or moved
import { FileItem } from "@/types/fileSystem";

interface InitialViewProps {
  isDragging: boolean;
  files: LogFile[]; // To check if any files are open for the message
  onFileInputClick: () => void;
  onUrlInputClick: () => void;
  fetchLogFromUrl: (url: string) => Promise<void>;
  handleRecentFileSelect: (file: FileItem) => Promise<void>;
  onMultipleFilesSelect: (files: FileItem[]) => Promise<void>;
  setActiveFileId: (id: string | null) => void; // To return to files if some are open
  handleCloseAllFiles: () => void;
  renameItem: (itemId: string, newName: string) => Promise<boolean>;
}

const InitialView: React.FC<InitialViewProps> = ({
  isDragging,
  files,
  onFileInputClick,
  onUrlInputClick,
  fetchLogFromUrl,
  handleRecentFileSelect,
  onMultipleFilesSelect,
  setActiveFileId,
  handleCloseAllFiles,
  renameItem,
}) => {
  return (
    <div className="flex flex-col gap-4">
      {files.length > 0 && (
        <div className="bg-muted/20 border rounded-md p-4 mb-2">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-lg">
              You have {files.length} file{files.length !== 1 ? "s" : ""} open
            </h3>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  // Return to the first file in the list
                  if (files.length > 0) {
                    setActiveFileId(files[0].id);
                  }
                }}
              >
                Return to Files
              </Button>
              <Button
                variant="outline"
                onClick={handleCloseAllFiles}
              >
                Close open files
              </Button>
            </div>
          </div>
        </div>
      )}
      <div
        className={`border-2 border-dashed rounded-lg p-12 text-center ${
          isDragging ? "border-primary bg-primary/10" : "border-muted"
        }`}
      >
        <div className="flex flex-col items-center gap-2">
          <Upload className="h-8 w-8 text-muted-foreground" />
          <h3 className="font-semibold text-lg">Drop your log files here</h3>
          <p className="text-sm text-muted-foreground">
            Drag and drop your log files to start analyzing. Files are processed
            100% locally within your browser and not uploaded to the internet.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              onClick={onFileInputClick}
              className="whitespace-nowrap bg-green-600 text-white hover:bg-green-700 hover:text-white border-green-600 hover:border-green-700"
            >
              <div className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Open Log File
              </div>
            </Button>
            <Button
              variant="outline"
              onClick={onUrlInputClick}
              className="whitespace-nowrap bg-blue-600 text-white hover:bg-blue-700 hover:text-white border-blue-600 hover:border-blue-700"
            >
              <div className="flex items-center gap-2">
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
                  className="h-4 w-4"
                >
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                Open URL
              </div>
            </Button>
            {/* Hidden input remains in home.tsx */}
          </div>
          {files.length === 0 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <p className="text-sm text-muted-foreground">
                Or try example:
              </p>
              <Select
                onValueChange={(url) => {
                  if (url) {
                    fetchLogFromUrl(url);
                  }
                }}
              >
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Select a sample file" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="https://raw.githubusercontent.com/DBmarlin/log-trawler/refs/heads/main/log_examples/tomcat_log_example.log">
                    tomcat_log_example.log
                  </SelectItem>
                  <SelectItem value="https://raw.githubusercontent.com/DBmarlin/log-trawler/refs/heads/main/log_examples/mysql_error_log.log">
                    mysql_error_log.log
                  </SelectItem>
                  <SelectItem value="https://raw.githubusercontent.com/DBmarlin/log-trawler/refs/heads/main/log_examples/postgresql_log_example.log">
                    postgresql_log_example.log
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>
      <RecentFiles
        onFileSelect={handleRecentFileSelect}
        onMultipleFilesSelect={onMultipleFilesSelect}
        renameItem={renameItem}
      />
    </div>
  );
};

export default InitialView;
