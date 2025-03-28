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
  title = "Red Snapper",
  onFileInputClick = () => {},
  onLogoClick = () => {},
  showDateControls = false,
  startDate,
  endDate,
  onRangeChange = () => {},
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
      <div className="flex items-center gap-4">
        {showDateControls && (
          <TimeRangeFilter
            startDate={startDate}
            endDate={endDate}
            onRangeChange={onRangeChange}
          />
        )}
        {/* Open Log File button moved to home component */}
      </div>
    </header>
  );
}
