import { Button } from "../ui/button";
import { ThemeToggle } from "../theme-toggle";
import { Upload } from "lucide-react";

interface HeaderProps {
  title?: string;
  onFileInputClick?: () => void;
  onLogoClick?: () => void;
}

export default function Header({
  title = "Red Snapper",
  onFileInputClick = () => {},
  onLogoClick = () => {},
}: HeaderProps) {
  return (
    <header
      className="w-full text-white px-6 flex justify-between items-center h-[79px]"
      style={{ backgroundColor: "#02203E", color: "white" }}
    >
      <div className="flex items-center gap-4">
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={onLogoClick}
          title="Return to home screen"
        >
          <img
            src="/fish-icon2-white.svg"
            alt="LogTrawler logo"
            className="w-6 h-6"
          />
          <img
            src="/log-trawler-badge.svg"
            alt="LogTrawler badge"
            className="w-24 h-10"
          />
        </div>
        <ThemeToggle />
      </div>
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
    </header>
  );
}
