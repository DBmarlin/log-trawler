import { FileIcon } from "lucide-react";
import { Button } from "../ui/button";

interface DropzoneProps {
  onFileSelect?: (files: FileList) => void;
  acceptedFileTypes?: string;
}

export default function Dropzone({
  onFileSelect = () => {},
  acceptedFileTypes = ".zip,.tar.gz",
}: DropzoneProps) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files);
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
