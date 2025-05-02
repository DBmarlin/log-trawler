import { Button } from "../ui/button";
import { ThemeToggle } from "../theme-toggle";
import { Upload, Download } from "lucide-react";
import TimeRangeFilter from "../log-viewer/TimeRangeFilter";
import { isElectron } from "@/lib/utils";
import { useEffect, useState } from "react";

interface HeaderProps {
  title?: string;
  onFileInputClick?: () => void;
  onLogoClick?: () => void;
  showDateControls?: boolean;
  startDate?: Date;
  endDate?: Date;
  onRangeChange?: (start?: Date, end?: Date) => void;
}

export default function Header({
  title = "Log Trawler",
  onFileInputClick = () => {},
  onLogoClick = () => {},
  showDateControls = false,
  startDate,
  endDate,
  onRangeChange = () => {},
}: HeaderProps) {
  const [isRunningInElectron, setIsRunningInElectron] = useState(true);
  
  // Check if running in Electron on component mount
  useEffect(() => {
    setIsRunningInElectron(isElectron());
  }, []);
  
  // Ensure dates are valid before passing to TimeRangeFilter
  const validStartDate =
    startDate instanceof Date && !isNaN(startDate.getTime())
      ? startDate
      : undefined;
  const validEndDate =
    endDate instanceof Date && !isNaN(endDate.getTime()) ? endDate : undefined;
  return (
    <header
      className="sticky top-0 w-full text-white px-6 flex justify-between items-center h-[79px] z-50"
      style={{ backgroundColor: "#02203E", color: "white" }}
    >
      {/* Two drag regions: full width at top and space between controls */}
      <div className="drag-region absolute left-0 right-0 top-0 h-[30px]" />
      <div className="drag-region absolute left-[200px] right-[500px] top-[30px] bottom-0" />
      <div className="flex items-center gap-4 z-10">
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={onLogoClick}
          title="Return to home screen"
        >
          {/* <img
            src="/fish-icon2-white.svg"
            alt="LogTrawler logo"
            className="w-6 h-6"
          /> */}
          <img
            src="/log-trawler-badge.svg"
            alt="LogTrawler badge"
            className="w-24 h-10"
          />
        </div>
        <ThemeToggle />
      </div>
      <div className="flex items-center gap-4 z-10">
        {showDateControls && (
          <TimeRangeFilter
            startDate={validStartDate}
            endDate={validEndDate}
            onRangeChange={onRangeChange}
          />
        )}
        {/* Show download button only when running in browser (not in Electron) */}
        {!isRunningInElectron && (
          <Button 
            variant="default" 
            size="sm" 
            className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-1"
            onClick={() => window.open("https://github.com/DBmarlin/log-trawler/releases", "_blank")}
          >
            <Download className="h-4 w-4" />
            Download for macOS
          </Button>
        )}
        {/* Open Log File button moved to home component */}
      </div>
    </header>
  );
}
