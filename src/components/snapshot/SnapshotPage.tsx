import Header from "../header/Header";
import Dropzone from "../dropzone/Dropzone";

export default function SnapshotPage() {
  const handleFileSelect = (files: FileList) => {
    console.log("Files selected:", files);
    // Handle file processing here
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-1 container mx-auto py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <Dropzone onFileSelect={handleFileSelect} />
        </div>
      </main>
    </div>
  );
}
