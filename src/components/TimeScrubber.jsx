import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  PlayIcon,
  PauseIcon,
  BackwardIcon,
  ClockIcon
} from '@heroicons/react/24/outline';

const TimeScrubber = ({
  currentHour,
  onHourChange,
  maxHours = 24,
  isPlaying = false,
  onPlayPause
}) => {
  const handleSliderChange = (e) => {
    const newHour = parseInt(e.target.value);
    onHourChange(newHour);
  };

  const formatTimeLabel = (hour) => {
    if (hour === 0) return 'NOW';
    if (hour === 1) return '1h ago';
    return `${hour}h ago`;
  };

  return (
    <div className="flex items-center gap-3 flex-1">
      {/* Time Slider */}
      <div className="flex-1 min-w-[200px]">
        <input
          type="range"
          min="0"
          max={maxHours - 1}
          value={currentHour}
          onChange={handleSliderChange}
          className="w-full h-2 border rounded-lg appearance-none cursor-pointer"
        />
        <div className="flex justify-between text-xs mt-1">
          <span>NOW</span>
          <span>24h ago</span>
        </div>
      </div>

      {/* Badge */}
      <Badge variant={currentHour === 0 ? 'default' : 'outline'} className="shrink-0">
        {formatTimeLabel(currentHour)}
      </Badge>

      {/* Playback Controls */}
      {onPlayPause && (
        <div className="flex gap-2 shrink-0">
          <Button
            variant={isPlaying ? 'default' : 'outline'}
            size="sm"
            onClick={onPlayPause}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <PauseIcon className="w-4 h-4" />
            ) : (
              <PlayIcon className="w-4 h-4" />
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onHourChange(0)}
            title="Reset to Now"
          >
            <BackwardIcon className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default TimeScrubber;
