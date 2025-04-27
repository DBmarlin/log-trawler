import { Button } from "../ui/button";
import { ThemeToggle } from "../theme-toggle";
import { Upload } from "lucide-react";
import TimeRangeFilter from "../log-viewer/TimeRangeFilter";

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
      {/* Split drag regions to allow interaction with header elements */}
      {/* Three drag regions: left side, middle empty space, and right side */}
      <div className="drag-region absolute left-0 top-0 w-[180px] h-full" />
      <div className="drag-region absolute left-[250px] w-[600px] h-full" />
      <div className="drag-region absolute right-[400px] w-[200px] h-full" />
      <div className="flex items-center gap-4 z-10">
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
      <div className="flex items-center gap-4 z-10">
        {showDateControls && (
          <TimeRangeFilter
            startDate={validStartDate}
            endDate={validEndDate}
            onRangeChange={onRangeChange}
          />
        )}
        {/* Open Log File button moved to home component */}
      </div>
    </header>
  );
}
