import { FileIcon } from "lucide-react";
import { Button } from "../ui/button";
import JSZip from "jszip";
import { gunzipSync, strFromU8 } from "fflate";
import { untar } from "untar.js";

interface DropzoneProps {
  onFileSelect?: (files: FileList) => void;
  acceptedFileTypes?: string;
}

export default function Dropzone({
  onFileSelect = () => {},
  acceptedFileTypes = ".zip,.tar.gz,.log",
}: DropzoneProps) {
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.debug("[Dropzone] handleFileChange triggered", e);
    if (e.target.files && e.target.files.length > 0) {
      const files = e.target.files;

      // Only call onFileSelect for direct .log files, not for .zip or .tar.gz
      const logFiles = Array.from(files).filter(f => f.name.endsWith('.log'));
      if (logFiles.length > 0) {
        console.debug("[Dropzone] Detected direct .log files:", logFiles.map(f => f.name));
        onFileSelect(logFiles as any);
      }

      // Check for zip files and handle them
      for (const file of files) {
        console.debug("[Dropzone] Processing file:", file.name);

        // Handle .zip files
        if (file.name.endsWith('.zip')) {
          console.debug("[Dropzone] Detected .zip file:", file.name);
          try {
            const { saveLogFile, updateLogFile } = await import("@/lib/indexedDB-fix");
            // Create a folder for the zip file
            const folderName = file.name.replace('.zip', '');
            const folderId = `folder_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            const newFolder = {
              id: folderId,
              name: folderName,
              type: 'folder' as const,
              lastOpened: Date.now(),
              children: [],
            };
            await saveLogFile(newFolder);

            // Real zip extraction using jszip
            const arrayBuffer = await file.arrayBuffer();
            console.debug("[Dropzone] Loaded .zip file as ArrayBuffer, size:", arrayBuffer.byteLength);
            const zip = await JSZip.loadAsync(arrayBuffer);
            const fileIds: string[] = [];

            for (const [zipEntryName, zipEntry] of Object.entries(zip.files)) {
              console.debug("[Dropzone] Found zip entry:", zipEntryName, "isDir:", zipEntry.dir);
              // Only process files (not directories) and only .log files
              if (!zipEntry.dir && zipEntryName.endsWith('.log')) {
                const content = await zipEntry.async("uint8array");
                const decoder = new TextDecoder("utf-8");
                const decodedString = decoder.decode(content);
                console.debug("[Dropzone] Extracted .log from zip:", zipEntryName, "content preview:", decodedString.slice(0, 100));
                const logFileId = `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
                const logFile = {
                  id: logFileId,
                  name: zipEntryName,
                  type: 'file' as const,
                  lastOpened: Date.now(),
                  parentId: folderId,
                  content: [decodedString], // Store as array of strings
                };
                await saveLogFile(logFile);
                fileIds.push(logFileId);
              }
            }

            // Update folder with children
            await updateLogFile(folderId, { children: fileIds });
            console.debug("[Dropzone] Finished extracting and saving .log files from zip:", fileIds);
          } catch (error) {
            console.error("[Dropzone] Failed to handle zip file:", error);
          }
        }
        // Handle .tar.gz files
        else if (file.name.endsWith('.tar.gz')) {
          console.debug("[Dropzone] Detected .tar.gz file:", file.name);
          try {
            const { saveLogFile, updateLogFile } = await import("@/lib/indexedDB-fix");
            // Create a folder for the tar.gz file
            const folderName = file.name.replace('.tar.gz', '');
            const folderId = `folder_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            const newFolder = {
              id: folderId,
              name: folderName,
              type: 'folder' as const,
              lastOpened: Date.now(),
              children: [],
            };
            await saveLogFile(newFolder);

            // Read file as Uint8Array
            const arrayBuffer = await file.arrayBuffer();
            console.debug("[Dropzone] Loaded .tar.gz file as ArrayBuffer, size:", arrayBuffer.byteLength);
            const uint8 = new Uint8Array(arrayBuffer);

            // Decompress gzip to get tar archive
            const tarData = gunzipSync(uint8);
            console.debug("[Dropzone] Decompressed gzip, tar size:", tarData.byteLength);

            // Extract files from tar using untar.js (async iterator)
            const fileIds: string[] = [];
            for await (const entry of untar(tarData.buffer)) {
              console.debug("[Dropzone] Found tar entry:", entry.name, "size:", entry.buffer.byteLength);
              // Only process .log files
              if (entry.name.endsWith('.log')) {
                const decodedString = strFromU8(new Uint8Array(entry.buffer));
                console.debug("[Dropzone] Extracted .log from tar.gz:", entry.name, "content preview:", decodedString.slice(0, 100));
                const logFileId = `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
                const logFile = {
                  id: logFileId,
                  name: entry.name,
                  type: 'file' as const,
                  lastOpened: Date.now(),
                  parentId: folderId,
                  content: [decodedString], // Store as array of strings
                };
                await saveLogFile(logFile);
                fileIds.push(logFileId);
              }
            }

            // Update folder with children
            await updateLogFile(folderId, { children: fileIds });
            console.debug("[Dropzone] Finished extracting and saving .log files from tar.gz:", fileIds);
          } catch (error) {
            console.error("[Dropzone] Failed to handle tar.gz file:", error);
          }
        }
      }
    }
  };

  return (
    <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 flex flex-col items-center justify-center text-center gap-4">
      <div className="text-gray-400">
        <FileIcon size={48} />
      </div>
      <h2 className="text-xl font-medium">Drag & drop snapshot files here</h2>
      <p className="text-gray-500">
        or click the button below to browse multiple files (.zip, .tar.gz)
      </p>
      <div className="mt-2">
        <input
          type="file"
          id="file-upload"
          className="hidden"
          multiple
          accept={acceptedFileTypes}
          onChange={handleFileChange}
        />
        <Button
          variant="default"
          className="bg-[#02203E] hover:bg-[#02203E]/90 text-white"
          onClick={() => document.getElementById("file-upload")?.click()}
        >
          <svg
            className="mr-2"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M7 10L12 15L17 10"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M12 15V3"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Select snapshot file
        </Button>
      </div>
    </div>
  );
}
