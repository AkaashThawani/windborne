import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  PlayIcon,
  PauseIcon,
  StopIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

const TimeScrubber = ({
  currentHour,
  onHourChange,
  isPlaying = false,
  onPlayPause,
  onPrevHour,
  onNextHour,
  onClearSelection,
  viewMode = 'flow' // 'flow' or 'static' (analysis)
}) => {
  // Determine steps based on mode
  // FLOW mode: 230 steps (23 hours × 10 = 0.1 hour precision / 6 min)
  // ANALYSIS mode: 23 steps (23 hours × 1 = 1 hour precision)
  const stepsPerHour = viewMode === 'flow' ? 10 : 1;
  const maxSteps = 23 * stepsPerHour;
  
  // Reverse slider
  const sliderValue = Math.round((23 - currentHour) * stepsPerHour);

  const handleSliderChange = (e) => {
    const newValue = parseInt(e.target.value);
    // Convert back: slider 0 = hour 23.0, slider max = hour 0.0
    const newHour = 23 - (newValue / stepsPerHour);
    onHourChange(newHour);
  };

  const formatTimeLabel = (hour) => {
    if (hour === 0) return 'NOW';
    if (hour === 23) return '23h ago';
    // Show fractional hours with minutes (always 2 digits for consistent width)
    const hours = Math.floor(hour);
    const minutes = Math.round((hour - hours) * 60);
    // Always use 2 digits for minutes to prevent layout shifts
    const minutesStr = minutes.toString().padStart(2, '0');
    return `${hours}h ${minutesStr}m ago`;
  };

  return (
    <div className="flex items-center gap-3 flex-1">
      {/* Time Slider - Reversed */}
      <div className="flex-1 min-w-[200px]">
        <input
          type="range"
          min="0"
          max={maxSteps}
          step="1"
          value={sliderValue}
          onChange={handleSliderChange}
          className="w-full h-2 border rounded-lg appearance-none cursor-pointer"
        />
        <div className="flex justify-between text-xs mt-1">
          <span>23h ago</span>
          <span>NOW</span>
        </div>
      </div>

      {/* Badge - Fixed width to prevent layout shifts */}
      <Badge variant={currentHour === 0 ? 'default' : 'outline'} className="text-xs w-[110px] text-center">
        {formatTimeLabel(currentHour)}
      </Badge>

      {/* Control Buttons */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Previous Hour */}
        <Button
          variant="outline"
          size="sm"
          onClick={onPrevHour}
          disabled={currentHour >= 23}
          title="Previous hour"
          className="px-2 h-8"
        >
          <ChevronLeftIcon className="w-3 h-3" />
        </Button>

        {/* Play/Pause */}
        <Button
          variant="outline"
          size="sm"
          onClick={onPlayPause}
          title={isPlaying ? 'Pause' : 'Play'}
          className="px-2 h-8"
        >
          {isPlaying ? (
            <PauseIcon className="w-3 h-3" />
          ) : (
            <PlayIcon className="w-3 h-3" />
          )}
        </Button>

        {/* Next Hour */}
        <Button
          variant="outline"
          size="sm"
          onClick={onNextHour}
          disabled={currentHour <= 0}
          title="Next hour"
          className="px-2 h-8"
        >
          <ChevronRightIcon className="w-3 h-3" />
        </Button>

        {/* Stop (Pause + Reset to 23h ago) */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (isPlaying) onPlayPause();
            onHourChange(23);
            if (onClearSelection) onClearSelection();
          }}
          title="Stop and reset to 23h ago"
          className="px-2 h-8"
        >
          <StopIcon className="w-3 h-3" />
        </Button>

        {/* Reset to 23h ago */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            onHourChange(23);
            if (onClearSelection) onClearSelection();
          }}
          title="Reset to 23h ago"
          className="px-2 h-8"
        >
          <ArrowPathIcon className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
};

export default TimeScrubber;
