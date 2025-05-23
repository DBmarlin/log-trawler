import React, { useMemo, useCallback, useRef } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  TimeScale,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import "chart.js/auto";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { parseLogLine, parseTimestamp } from "@/lib/utils";
import { format, parse } from "date-fns";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

// Disable animations globally for all charts
ChartJS.defaults.animation = false as const;

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  ChartTooltip,
  Legend,
  TimeScale,
);

// Moved interface definition above the component

interface TimeSeriesChartProps {
  entries?: string[];
  filteredEntries?: string[];
  onTimeRangeSelect?: (start?: Date, end?: Date) => void;
  bucketSize?: string;
  onBucketSizeChange?: (size: string) => void;
  fileStartDate?: Date;
  fileEndDate?: Date;
  timeRange?: { startDate?: Date; endDate?: Date };
  // Internal props for caching
  _cachedChartData?: any;
  _cachedTimestampData?: any;
  _cachedOriginalLabels?: any;
  _updateGlobalCache?: (key: string, data: any) => void;
  _cacheKey?: string;
}

function TimeSeriesChart(props: TimeSeriesChartProps) {
  const entries = props.entries || [];
  const filteredEntries = props.filteredEntries || [];
  const onTimeRangeSelect = props.onTimeRangeSelect || (() => {});
  const bucketSize = props.bucketSize || "5m";
  const onBucketSizeChange = props.onBucketSizeChange || (() => {});
  const fileStartDate = props.fileStartDate;
  const fileEndDate = props.fileEndDate;
  const [isLoading, setIsLoading] = React.useState(false);

  // Initialize with cached data if available
  const [chartData, setChartData] = React.useState(
    props._cachedChartData || {
      datasets: [],
      labels: [],
    },
  );
  const [timestampData, setTimestampData] = React.useState(
    props._cachedTimestampData || [],
  );
  const [originalLabels, setOriginalLabels] = React.useState(
    props._cachedOriginalLabels || [],
  );
  const [isSelecting, setIsSelecting] = React.useState(false);
  const [selectionStart, setSelectionStart] = React.useState(null);
  const [selectionEnd, setSelectionEnd] = React.useState(null);
  const [selectedRange, setSelectedRange] = React.useState(null);
  const chartRef = React.useRef(null);
  const chartContainerRef = React.useRef(null);

  // Cache for processed data to avoid recalculating on tab switches
  const processedDataCache = React.useRef(null);

  // Process log entries into time series data with optimizations
  React.useEffect(() => {
    // If we have cached data from props, use it and skip processing
    if (
      props._cachedChartData &&
      props._cachedTimestampData &&
      props._cachedOriginalLabels
    ) {
      setChartData(props._cachedChartData);
      setTimestampData(props._cachedTimestampData);
      setOriginalLabels(props._cachedOriginalLabels);
      setIsLoading(false);
      return;
    }

    // Check if we can use cached data
    const cacheKey = JSON.stringify({
      entriesLength: entries.length,
      filteredEntriesLength: filteredEntries.length,
      bucketSize,
      timeRangeStart: selectedRange?.startDate?.getTime(),
      timeRangeEnd: selectedRange?.endDate?.getTime(),
      fileStartDate: fileStartDate?.getTime(),
      fileEndDate: fileEndDate?.getTime(),
    });

    // If we have cached data and nothing has changed, use it
    if (
      processedDataCache.current?.key === cacheKey &&
      processedDataCache.current?.data
    ) {
      setChartData(processedDataCache.current.data.chartData);
      setTimestampData(processedDataCache.current.data.timestampData);
      setOriginalLabels(processedDataCache.current.data.originalLabels);
      setIsLoading(false);
      return;
    }
    // Skip loading state completely to avoid flickering
    // Use requestAnimationFrame for better performance
    const rafId = requestAnimationFrame(() => {
      try {
        // Use filtered entries if available and filters are applied, otherwise use all entries
        const dataToProcess =
          filteredEntries.length > 0 ? filteredEntries : entries;
        if (!dataToProcess.length) return;

        // If we have a selected range, use that instead of the full file range
        const useSelectedRange =
          selectedRange && selectedRange.startDate && selectedRange.endDate;

        // Process all entries to ensure we capture the full time range
        // Use more aggressive sampling for very large files
        let processEntries;
        if (dataToProcess.length > 500000) {
          // For extremely large datasets, use very aggressive sampling
          const sampleSize = 25000;
          const step = Math.ceil(dataToProcess.length / sampleSize);
          processEntries = [];
          for (let i = 0; i < dataToProcess.length; i += step) {
            processEntries.push(dataToProcess[i]);
          }
        } else if (dataToProcess.length > 100000) {
          // For large datasets, use moderate sampling
          const sampleSize = 50000;
          const step = Math.ceil(dataToProcess.length / sampleSize);
          processEntries = [];
          for (let i = 0; i < dataToProcess.length; i += step) {
            processEntries.push(dataToProcess[i]);
          }
        } else {
          processEntries = dataToProcess;
        }

        // Parse all timestamps and extract log levels
        const newTimestampData = [];
        for (let i = 0; i < processEntries.length; i++) {
          const line = processEntries[i];
          if (line === undefined || line === null) continue;

          const parsed = parseLogLine(line);
          const date = parseTimestamp(parsed.timestamp);
          if (!date) continue;

          // Extract log level
          const levelMatch =
            parsed.message.match(
              /\[(INFO|ERROR|WARN|WARNING|DEBUG|SEVERE|CRITICAL|FATAL|ALERT|EMERG|EMERGENCY)\]/i,
            ) ||
            parsed.message.match(
              /\s(INFO|ERROR|WARN|WARNING|DEBUG|SEVERE|CRITICAL|FATAL|ALERT|EMERG|EMERGENCY)\s/i,
            ) ||
            parsed.message.match(
              /\s(INFO|ERROR|WARN|WARNING|DEBUG|SEVERE|CRITICAL|FATAL|ALERT|EMERG|EMERGENCY):/i,
            );

          const level = levelMatch
            ? levelMatch[1].toUpperCase()
            : parsed.message.match(
                  /^(INFO|ERROR|WARN|WARNING|DEBUG|SEVERE|CRITICAL|FATAL|ALERT|EMERG|EMERGENCY)\s/i,
                )
              ? parsed.message
                  .match(
                    /^(INFO|ERROR|WARN|WARNING|DEBUG|SEVERE|CRITICAL|FATAL|ALERT|EMERG|EMERGENCY)\s/i,
                  )[1]
                  .toUpperCase()
              : parsed.message.match(
                    /^(INFO|ERROR|WARN|WARNING|DEBUG|SEVERE|CRITICAL|FATAL|ALERT|EMERG|EMERGENCY):/i,
                  )
                ? parsed.message
                    .match(
                      /^(INFO|ERROR|WARN|WARNING|DEBUG|SEVERE|CRITICAL|FATAL|ALERT|EMERG|EMERGENCY):/i,
                    )[1]
                    .toUpperCase()
                : "OTHER";

          newTimestampData.push({ date, level });
        }

        if (newTimestampData.length === 0) return;

        // Sort by date
        newTimestampData.sort((a, b) => a.date.getTime() - b.date.getTime());
        setTimestampData(newTimestampData);

        // Determine time range - prioritize selected range, then file dates
        let startTime, endTime;

        if (useSelectedRange) {
          // Use the selected time range for zooming
          startTime = new Date(selectedRange.startDate);
          endTime = new Date(selectedRange.endDate);
        } else if (fileStartDate && fileEndDate) {
          startTime = new Date(fileStartDate);
          endTime = new Date(fileEndDate);

          // Check if the time range is very small (less than 5 minutes)
          const diffMs = endTime.getTime() - startTime.getTime();
          const diffMinutes = diffMs / (1000 * 60);

          if (diffMinutes < 5) {
            // For very small ranges, add padding of 1 minute on each side
            startTime = new Date(startTime.getTime() - 60 * 1000);
            endTime = new Date(endTime.getTime() + 60 * 1000);
          } else if (startTime.toDateString() === endTime.toDateString()) {
            // For same-day logs that are more than 5 minutes, use a more appropriate range
            // instead of defaulting to full day
            if (diffMinutes < 60) {
              // For less than an hour, add 5 minutes padding on each side
              startTime = new Date(startTime.getTime() - 5 * 60 * 1000);
              endTime = new Date(endTime.getTime() + 5 * 60 * 1000);
            } else if (diffMinutes < 180) {
              // For 1-3 hours, add 15 minutes padding on each side
              startTime = new Date(startTime.getTime() - 15 * 60 * 1000);
              endTime = new Date(endTime.getTime() + 15 * 60 * 1000);
            } else if (diffMinutes < 720) {
              // For 3-12 hours, add 30 minutes padding on each side
              startTime = new Date(startTime.getTime() - 30 * 60 * 1000);
              endTime = new Date(endTime.getTime() + 30 * 60 * 1000);
            } else {
              // For 12+ hours but still same day, use full day
              startTime.setHours(0, 0, 0, 0);
              const nextDay = new Date(endTime);
              nextDay.setDate(nextDay.getDate() + 1);
              nextDay.setHours(0, 0, 0, 0);
              endTime = nextDay;
            }
          }
        } else if (newTimestampData.length > 0) {
          // If no file dates, use the data's min/max
          const allTimes = newTimestampData.map((item) => item.date.getTime());
          startTime = new Date(Math.min(...allTimes));
          endTime = new Date(Math.max(...allTimes));

          // Round to day boundaries if it's a full day of data
          if (endTime.getTime() - startTime.getTime() > 20 * 60 * 60 * 1000) {
            // > 20 hours
            startTime = new Date(startTime);
            startTime.setHours(0, 0, 0, 0);
            endTime = new Date(endTime);
            endTime.setHours(23, 59, 59, 999);
          }
        } else {
          // Fallback to current day if no data
          startTime = new Date();
          startTime.setHours(0, 0, 0, 0);
          endTime = new Date();
          endTime.setHours(23, 59, 59, 999);
        }

        // Calculate bucket size in milliseconds
        let bucketSizeInMilliseconds;
        if (bucketSize.endsWith("s")) {
          bucketSizeInMilliseconds = parseInt(bucketSize) * 1000;
        } else {
          bucketSizeInMilliseconds = parseInt(bucketSize) * 60 * 1000;
        }

        // Ensure we have a valid time range
        if (startTime > endTime) {
          const temp = startTime;
          startTime = endTime;
          endTime = temp;
        }

        // Add padding to ensure we capture all data
        const paddedStart = new Date(
          startTime.getTime() - bucketSizeInMilliseconds,
        );
        const paddedEnd = new Date(
          endTime.getTime() + bucketSizeInMilliseconds,
        );

        // Create buckets
        const buckets = {};
        const levels = new Set();

        // Initialize all buckets in the time range
        const normalizedStart = new Date(
          Math.floor(paddedStart.getTime() / bucketSizeInMilliseconds) *
            bucketSizeInMilliseconds,
        );

        // Ensure we have at least 10 buckets for very small time ranges
        // This prevents the chart from looking empty with just 1-2 bars
        let currentTime = new Date(normalizedStart);
        let bucketCount = 0;
        const minBuckets = 10;

        // Calculate how many buckets we'll have with current settings
        const expectedBuckets = Math.ceil(
          (paddedEnd.getTime() - normalizedStart.getTime()) /
            bucketSizeInMilliseconds,
        );

        // If we'll have fewer than minBuckets, adjust the bucket size
        let adjustedBucketSize = bucketSizeInMilliseconds;
        if (expectedBuckets < minBuckets) {
          adjustedBucketSize = Math.floor(
            (paddedEnd.getTime() - normalizedStart.getTime()) / minBuckets,
          );
          // Ensure bucket size is at least 1 second
          adjustedBucketSize = Math.max(adjustedBucketSize, 1000);
        }

        // Create the buckets
        currentTime = new Date(normalizedStart);
        while (currentTime <= paddedEnd) {
          const bucketKey = format(currentTime, "yyyy-MM-dd HH:mm:ss");
          buckets[bucketKey] = {};
          currentTime = new Date(currentTime.getTime() + adjustedBucketSize);
          bucketCount++;
        }

        // Filter data to the selected time range if zooming
        const dataToUse = useSelectedRange
          ? newTimestampData.filter(
              ({ date }) => date >= startTime && date <= endTime,
            )
          : newTimestampData;

        // Fill buckets with data
        for (const { date, level } of dataToUse) {
          const bucketTime = new Date(
            Math.floor(date.getTime() / adjustedBucketSize) *
              adjustedBucketSize,
          );
          const bucketKey = format(bucketTime, "yyyy-MM-dd HH:mm:ss");

          if (!buckets[bucketKey]) {
            buckets[bucketKey] = {};
          }

          buckets[bucketKey][level] = (buckets[bucketKey][level] || 0) + 1;
          levels.add(level);
        }

        // Prepare chart data
        const sortedBucketKeys = Object.keys(buckets).sort();
        setOriginalLabels(sortedBucketKeys);

        // Format labels for display
        const formattedLabels = [];
        const firstDate =
          sortedBucketKeys.length > 0 ? sortedBucketKeys[0].split(" ")[0] : "";
        const lastDate =
          sortedBucketKeys.length > 0
            ? sortedBucketKeys[sortedBucketKeys.length - 1].split(" ")[0]
            : "";
        const isMultiDay = firstDate !== lastDate;

        for (const key of sortedBucketKeys) {
          const parts = key.split(" ");
          formattedLabels.push(
            isMultiDay ? `${parts[0].slice(5)} ${parts[1]}` : parts[1],
          );
        }

        // Define colors for each log level
        const levelColors = {
          INFO: {
            backgroundColor: "rgba(59, 130, 246, 0.6)",
            borderColor: "rgb(59, 130, 246)",
          },
          ERROR: {
            backgroundColor: "rgba(239, 68, 68, 0.6)",
            borderColor: "rgb(239, 68, 68)",
          },
          SEVERE: {
            backgroundColor: "rgba(220, 38, 38, 0.6)",
            borderColor: "rgb(220, 38, 38)",
          },
          CRITICAL: {
            backgroundColor: "rgba(185, 28, 28, 0.6)",
            borderColor: "rgb(185, 28, 28)",
          },
          FATAL: {
            backgroundColor: "rgba(153, 27, 27, 0.6)",
            borderColor: "rgb(153, 27, 27)",
          },
          ALERT: {
            backgroundColor: "rgba(127, 29, 29, 0.6)",
            borderColor: "rgb(127, 29, 29)",
          },
          EMERG: {
            backgroundColor: "rgba(120, 27, 98, 0.6)",
            borderColor: "rgb(120, 27, 98)",
          },
          EMERGENCY: {
            backgroundColor: "rgba(120, 27, 98, 0.6)",
            borderColor: "rgb(120, 27, 98)",
          },
          WARN: {
            backgroundColor: "rgba(245, 158, 11, 0.6)",
            borderColor: "rgb(245, 158, 11)",
          },
          WARNING: {
            backgroundColor: "rgba(245, 158, 11, 0.6)",
            borderColor: "rgb(245, 158, 11)",
          },
          DEBUG: {
            backgroundColor: "rgba(16, 185, 129, 0.6)",
            borderColor: "rgb(16, 185, 129)",
          },
          TRACE: {
            backgroundColor: "rgba(5, 150, 105, 0.6)",
            borderColor: "rgb(5, 150, 105)",
          },
          NOTICE: {
            backgroundColor: "rgba(79, 70, 229, 0.6)",
            borderColor: "rgb(79, 70, 229)",
          },
          OTHER: {
            backgroundColor: "rgba(156, 163, 175, 0.6)",
            borderColor: "rgb(156, 163, 175)",
          },
        };

        // Create datasets for each log level
        const datasets = [];
        const levelArray = Array.from(levels);

        for (const level of levelArray) {
          const data = [];
          for (const key of sortedBucketKeys) {
            // Ensure we're pushing a number, not undefined or null
            const value = buckets[key][level] || 0;
            data.push(typeof value === "number" ? value : 0);
          }

          const levelKey = level as keyof typeof levelColors;
          datasets.push({
            label: level,
            data,
            backgroundColor:
              levelColors[levelKey]?.backgroundColor ||
              levelColors.OTHER.backgroundColor,
            borderColor:
              levelColors[levelKey]?.borderColor ||
              levelColors.OTHER.borderColor,
            borderWidth: 1,
            stack: "0", // Use a simple stack identifier
          });
        }

        // Create the chart data object
        const newChartData = {
          labels: formattedLabels,
          datasets:
            datasets.length > 0
              ? datasets
              : [
                  {
                    label: "No Data",
                    data: new Array(formattedLabels.length).fill(0),
                    backgroundColor: "rgba(156, 163, 175, 0.6)",
                    borderColor: "rgb(156, 163, 175)",
                    borderWidth: 1,
                    stack: "0",
                  },
                ],
        };

        // Update chart data
        setChartData(newChartData);

        // Cache the processed data locally
        processedDataCache.current = {
          key: cacheKey,
          data: {
            chartData: newChartData,
            timestampData: newTimestampData,
            originalLabels: sortedBucketKeys,
          },
        };

        // Update global cache if function is provided
        if (props._updateGlobalCache && props._cacheKey) {
          props._updateGlobalCache(props._cacheKey, {
            chartData: newChartData,
            timestampData: newTimestampData,
            originalLabels: sortedBucketKeys,
          });
        }
      } catch (error) {
        console.error("Error processing chart data:", error);
      } finally {
        // Don't show loading indicator at all
        setIsLoading(false);
      }
    });

    return () => cancelAnimationFrame(rafId);
  }, [
    entries,
    filteredEntries,
    bucketSize,
    fileStartDate,
    fileEndDate,
    selectedRange,
  ]);

  const handleBucketChange = (value: string) => {
    onBucketSizeChange(value);
    // Don't reset the selected range when changing bucket size
  };

  // Calculate optimal bucket size for a given time range
  const calculateOptimalBucketSize = (startDate?: Date, endDate?: Date) => {
    if (!startDate || !endDate) return bucketSize;

    const diffMs = endDate.getTime() - startDate.getTime();
    const diffMinutes = diffMs / (1000 * 60);
    const targetBuckets = 120; // Aim for more granular bars

    // Special cases for small time ranges
    if (diffMinutes <= 1) {
      return "5s";
    } else if (diffMinutes <= 60) {
      return "30s";
    } else {
      const idealBucketSizeMinutes = Math.max(
        1,
        Math.ceil(diffMinutes / targetBuckets),
      );

      // Round to standard bucket sizes
      if (idealBucketSizeMinutes <= 0.08) return "5s";
      else if (idealBucketSizeMinutes <= 0.17) return "10s";
      else if (idealBucketSizeMinutes <= 0.5) return "30s";
      else if (idealBucketSizeMinutes <= 1) return "1m";
      else if (idealBucketSizeMinutes <= 5) return "5m";
      else if (idealBucketSizeMinutes <= 10) return "10m";
      else if (idealBucketSizeMinutes <= 30) return "30m";
      else if (idealBucketSizeMinutes <= 60) return "60m";
      else if (idealBucketSizeMinutes <= 360) return "360m";
      else if (idealBucketSizeMinutes <= 720) return "720m";
      else if (idealBucketSizeMinutes <= 1440) return "1440m";
      else return "10080m";
    }
  };

  const getMouseXPosition = (e: React.MouseEvent) => {
    if (!chartRef.current) return -1;
    const chart = chartRef.current;
    const rect = chart.canvas.getBoundingClientRect();
    return e.clientX - rect.left;
  };

  const getIndexFromPosition = (x: number) => {
    if (!chartRef.current) return -1;
    const chart = chartRef.current;
    const chartArea = chart.chartArea;
    const chartWidth = chartArea.right - chartArea.left;

    // Calculate position relative to chart area, not the container
    const relativeX = Math.max(0, Math.min(chartWidth, x - chartArea.left));
    const percentPosition = relativeX / chartWidth;

    // Use exact decimal position to get precise index
    const exactIndex = percentPosition * (chartData.labels.length - 1);

    // Round to nearest index for more accurate selection
    const index = Math.round(exactIndex);
    return Math.max(0, Math.min(chartData.labels.length - 1, index));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!chartRef.current) return;

    // Get the exact position within the chart area
    const chart = chartRef.current;
    const rect = chart.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;

    // Only proceed if click is within chart area
    if (x >= chart.chartArea.left && x <= chart.chartArea.right) {
      const index = getIndexFromPosition(x);
      if (index >= 0) {
        setIsSelecting(true);
        setSelectionStart(index);
        setSelectionEnd(index);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isSelecting || !chartRef.current) return;

    const chart = chartRef.current;
    const rect = chart.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;

    // Constrain to chart area
    if (x >= chart.chartArea.left && x <= chart.chartArea.right) {
      const index = getIndexFromPosition(x);
      if (index >= 0) {
        setSelectionEnd(index);
      }
    }
  };

  const handleMouseUp = () => {
    if (isSelecting && selectionStart !== null && selectionEnd !== null) {
      const startIndex = Math.min(selectionStart, selectionEnd);
      const endIndex = Math.max(selectionStart, selectionEnd);

      if (startIndex !== endIndex && originalLabels.length > 0) {
        const startLabel = originalLabels[startIndex];
        const endLabel = originalLabels[endIndex];

        if (startLabel && endLabel) {
          const startDate = parse(
            startLabel,
            "yyyy-MM-dd HH:mm:ss",
            new Date(),
          );
          const endDate = parse(endLabel, "yyyy-MM-dd HH:mm:ss", new Date());

          // Calculate optimal bucket size for the selected range
          const optimalBucketSize = calculateOptimalBucketSize(
            startDate,
            endDate,
          );

          setSelectedRange({ startDate, endDate });
          onTimeRangeSelect(startDate, endDate);

          // Update bucket size if it's different from current
          if (optimalBucketSize !== bucketSize) {
            onBucketSizeChange(optimalBucketSize);
          }
        }
      }
    }
    setIsSelecting(false);
  };

  const clearSelection = () => {
    setSelectedRange(null);
    onTimeRangeSelect(undefined, undefined);

    // Recalculate optimal bucket size for the full range
    if (fileStartDate && fileEndDate) {
      const optimalBucketSize = calculateOptimalBucketSize(
        fileStartDate,
        fileEndDate,
      );
      if (optimalBucketSize !== bucketSize) {
        onBucketSizeChange(optimalBucketSize);
      }
    }
  };

  // Update local selection state when props change
  React.useEffect(() => {
    if (fileStartDate && fileEndDate) {
      // If there's a time range filter applied from outside
      if (props.timeRange?.startDate && props.timeRange?.endDate) {
        setSelectedRange({
          startDate: props.timeRange.startDate,
          endDate: props.timeRange.endDate,
        });
      } else {
        // If time range filter was cleared
        setSelectedRange(null);
      }
    }
  }, [props.timeRange, fileStartDate, fileEndDate]);

  // Memoize chart options with more aggressive caching
  const options = useMemo(
    () => ({
      animation: false as const,
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top" as const,
        },
        title: {
          display: false,
        },
        tooltip: {
          enabled: true,
          mode: "index" as const,
          intersect: false,
          animation: false as const,
          backgroundColor: "rgba(0, 0, 0, 0.8)",
          titleFont: { size: 12 },
          bodyFont: { size: 11 },
          footerFont: { size: 10 },
          displayColors: true,
          callbacks: {
            title: (context) => {
              if (!context || !context[0]) return "";
              const index = context[0].dataIndex;
              return originalLabels[index] || "";
            },
          },
        },
      },
      scales: {
        x: {
          title: {
            display: true,
            text: "Time",
          },
          stacked: true,
          ticks: {
            maxRotation: 0, // Prevent label rotation for better performance
            autoSkip: true,
            maxTicksLimit: 20, // Limit the number of ticks displayed
          },
        },
        y: {
          title: {
            display: true,
            text: "Count",
          },
          beginAtZero: true,
          stacked: true,
          ticks: {
            precision: 0, // Ensure y-axis values are integers
          },
        },
      },
      interaction: {
        mode: "nearest" as const,
        intersect: false,
      },
      devicePixelRatio: window.devicePixelRatio || 1,
    }),
    [originalLabels],
  );

  return (
    <Card className="shadow-none mb-4">
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-medium">
            Activity Over Time
            {filteredEntries.length > 0 &&
              filteredEntries.length !== entries.length && (
                <span className="ml-2 text-xs text-muted-foreground">
                  (Showing {filteredEntries.length.toLocaleString()} visible
                  entries)
                </span>
              )}
          </div>
          <div className="flex items-center gap-2">
            {selectedRange && (
              <div className="flex items-center gap-2">
                <div className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-md flex items-center">
                  <span>
                    Selected:{" "}
                    {format(selectedRange.startDate, "yyyy-MM-dd") !==
                    format(selectedRange.endDate, "yyyy-MM-dd")
                      ? `${format(selectedRange.startDate, "MM-dd HH:mm")} - ${format(selectedRange.endDate, "MM-dd HH:mm")}`
                      : `${format(selectedRange.startDate, "HH:mm")} - ${format(selectedRange.endDate, "HH:mm")}`}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 ml-1"
                    onClick={clearSelection}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}
            <span className="text-sm text-muted-foreground">Bucket Size:</span>
            <Select value={bucketSize} onValueChange={handleBucketChange}>
              <SelectTrigger className="w-[100px]">
                <SelectValue placeholder="5m" />
              </SelectTrigger>
              <SelectContent>
                {(() => {
                  // Calculate time range in milliseconds
                  const timeRange =
                    timestampData && timestampData.length > 0
                      ? timestampData[timestampData.length - 1].date.getTime() -
                        timestampData[0].date.getTime()
                      : 0;

                  // Special case for 1-hour range - allow 30s buckets
                  const isOneHourRange =
                    timeRange <= 60 * 60 * 1000 && timeRange > 0;

                  // Calculate minimum bucket size to stay under 500 bars
                  // For a 24-hour period (86400000ms), 10min buckets (600000ms) should be enabled
                  // 86400000 / 600000 = 144 bars, which is well under our limit
                  const minBucketSizeMs = isOneHourRange
                    ? 0
                    : Math.min(timeRange / 500, 599000);

                  // Define all bucket sizes in milliseconds
                  const bucketSizes = [
                    { value: "5s", label: "5 sec", ms: 5 * 1000 },
                    { value: "10s", label: "10 sec", ms: 10 * 1000 },
                    { value: "30s", label: "30 sec", ms: 30 * 1000 },
                    { value: "1m", label: "1 min", ms: 60 * 1000 },
                    { value: "5m", label: "5 min", ms: 5 * 60 * 1000 },
                    { value: "10m", label: "10 min", ms: 10 * 60 * 1000 },
                    { value: "30m", label: "30 min", ms: 30 * 60 * 1000 },
                    { value: "60m", label: "1 hour", ms: 60 * 60 * 1000 },
                    { value: "360m", label: "6 hours", ms: 6 * 60 * 60 * 1000 },
                    {
                      value: "720m",
                      label: "12 hours",
                      ms: 12 * 60 * 60 * 1000,
                    },
                    { value: "1440m", label: "1 day", ms: 24 * 60 * 60 * 1000 },
                    {
                      value: "10080m",
                      label: "7 days",
                      ms: 7 * 24 * 60 * 60 * 1000,
                    },
                  ];

                  return bucketSizes.map(
                    (bucket: { value: string; label: string; ms: number }) => (
                      <SelectItem
                        key={bucket.value}
                        value={bucket.value}
                        disabled={bucket.ms < minBucketSizeMs}
                      >
                        {bucket.label}
                      </SelectItem>
                    ),
                  );
                })()}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div
          className="h-[200px] relative cursor-crosshair"
          ref={chartContainerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
              <div
                className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
                role="status"
              >
                <span className="sr-only">Loading...</span>
              </div>
            </div>
          )}
          {chartData.labels.length > 0 && (
            <Bar
              data={chartData}
              options={options}
              ref={chartRef}
              redraw={false} // Prevent full redraw when data changes slightly
              updateMode="resize" // Only update on resize for better performance
              fallbackContent={
                <div className="flex items-center justify-center h-full">
                  Chart could not be rendered
                </div>
              }
            />
          )}
          {isSelecting &&
            selectionStart !== null &&
            selectionEnd !== null &&
            chartData.labels.length > 0 && (
              <div
                className="absolute top-0 bottom-0 bg-blue-200 opacity-30 pointer-events-none"
                style={{
                  left: `${(Math.min(selectionStart, selectionEnd) / (chartData.labels.length - 1)) * 100}%`,
                  width: `${((Math.abs(selectionEnd - selectionStart) + 1) / (chartData.labels.length - 1)) * 100}%`,
                }}
              />
            )}
        </div>
      </CardContent>
    </Card>
  );
}

// Create a wrapper component that caches chart data by fileId
const MemoizedTimeSeriesChart = React.memo(
  TimeSeriesChart,
  (prevProps, nextProps) => {
    // If we have cached data in the new props, always use it
    if (nextProps._cachedChartData) {
      return false; // Force render with cached data
    }

    // Only re-render if these specific props change
    return (
      prevProps.entries === nextProps.entries &&
      prevProps.filteredEntries === nextProps.filteredEntries &&
      prevProps.bucketSize === nextProps.bucketSize &&
      prevProps.fileStartDate === nextProps.fileStartDate &&
      prevProps.fileEndDate === nextProps.fileEndDate &&
      JSON.stringify(prevProps.timeRange) ===
        JSON.stringify(nextProps.timeRange) &&
      prevProps._cacheKey === nextProps._cacheKey
    );
  },
);

// Global cache for chart data across all instances
const globalChartCache = new Map();

// Cache component instances by fileId
const TimeSeriesChartWithCache = (props) => {
  // Get a unique key for the current file/data combination
  const cacheKey = React.useMemo(() => {
    // Create a cache key based on relevant props
    return JSON.stringify({
      bucketSize: props.bucketSize,
      timeRange: props.timeRange,
      entriesLength: props.entries?.length,
      filteredEntriesLength: props.filteredEntries?.length,
      fileStartDate: props.fileStartDate?.getTime(),
      fileEndDate: props.fileEndDate?.getTime(),
    });
  }, [
    props.bucketSize,
    props.timeRange,
    props.entries?.length,
    props.filteredEntries?.length,
    props.fileStartDate,
    props.fileEndDate,
  ]);

  // Check if we have this chart data in the global cache
  const cachedData = globalChartCache.get(cacheKey);

  // If we have cached data, use it to avoid unnecessary processing
  const optimizedProps = useMemo(() => {
    if (cachedData) {
      return {
        ...props,
        _cachedChartData: cachedData.chartData,
        _cachedTimestampData: cachedData.timestampData,
        _cachedOriginalLabels: cachedData.originalLabels,
      };
    }
    return props;
  }, [props, cachedData, cacheKey]);

  // Use a callback to update the global cache
  const updateGlobalCache = useCallback((key, data) => {
    globalChartCache.set(key, data);

    // Limit cache size to prevent memory issues
    if (globalChartCache.size > 20) {
      // Remove oldest entry
      const firstKey = globalChartCache.keys().next().value;
      globalChartCache.delete(firstKey);
    }
  }, []);

  // Return the memoized component with cache update function
  return (
    <MemoizedTimeSeriesChart
      {...optimizedProps}
      _updateGlobalCache={updateGlobalCache}
      _cacheKey={cacheKey}
    />
  );
};

export default TimeSeriesChartWithCache;
