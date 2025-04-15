import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell, ReferenceLine, Label } from 'recharts';
import { Note } from '@shared/schema';
import { formatTimeString, parseTimeString, formatDuration } from '@/lib/time-utils';

interface TimeGanttChartProps {
  notes: Note[];
  projectName: string;
}

export default function TimeGanttChart({ notes, projectName }: TimeGanttChartProps) {
  // Prepare data for the Gantt chart
  const { chartData, chartBounds } = useMemo(() => {
    // Filter notes with time values
    const timedNotes = notes
      .filter(note => note.time && note.time.trim() !== '')
      .sort((a, b) => {
        const timeA = a.time ? parseTimeString(a.time)?.seconds || 0 : 0;
        const timeB = b.time ? parseTimeString(b.time)?.seconds || 0 : 0;
        return timeA - timeB; // Sort by time (ascending)
      });

    if (timedNotes.length === 0) {
      return { chartData: [], chartBounds: { min: 0, max: 3600 } };
    }

    const processedData = [];
    let minTime = Number.MAX_SAFE_INTEGER;
    let maxTime = 0;
    
    // Process each timed note to create data for the chart
    for (let i = 0; i < timedNotes.length; i++) {
      const currentNote = timedNotes[i];
      const nextNote = i < timedNotes.length - 1 ? timedNotes[i + 1] : null;
      
      // Skip notes without proper time
      const timeInfo = currentNote.time ? parseTimeString(currentNote.time) : null;
      if (!timeInfo) continue;
      
      const startTime = timeInfo.seconds;
      
      // Calculate duration based on next note
      let duration = 900; // Default 15 minutes
      if (nextNote && nextNote.time) {
        const nextTimeInfo = parseTimeString(nextNote.time);
        if (nextTimeInfo) {
          let nextTime = nextTimeInfo.seconds;
          if (nextTime < startTime) nextTime += 24 * 60 * 60; // Handle midnight crossing
          duration = nextTime - startTime;
        }
      }
      
      // Track min and max times for chart bounds
      if (startTime < minTime) minTime = startTime;
      const endTime = startTime + duration;
      if (endTime > maxTime) maxTime = endTime;
      
      // Get note title from content
      let noteTitle = '';
      if (currentNote.content) {
        const firstLine = currentNote.content.split('\n')[0];
        noteTitle = firstLine.trim();
      }
      
      // Truncate long titles
      let displayTitle = noteTitle || `Note ${currentNote.id}`;
      if (displayTitle.length > 30) {
        displayTitle = displayTitle.substring(0, 27) + '...';
      }
      
      // Create data point for the chart
      processedData.push({
        name: displayTitle,
        id: currentNote.id,
        startTime: startTime,
        duration: duration,
        displayTime: formatTimeString(currentNote.time || ''),
        title: noteTitle || `Note ${currentNote.id}`
      });
    }
    
    // Force an extremely tight time range window - only showing times where there are notes
    // This makes the chart display just the needed time range
    
    // Find the earliest and latest actual timestamps in use with minimal padding
    const firstNoteTime = minTime; 
    const lastNoteTime = maxTime;
    
    // Minimal padding - just a few minutes on each side
    const padding = 180; // 3 minutes in seconds
    let rangeMin = Math.max(0, firstNoteTime - padding);
    let rangeMax = Math.min(86400, lastNoteTime + padding);
    
    // Ensure we don't have strange cropping if the range is too small
    if (rangeMax - rangeMin < 1200) { // If less than 20 minutes total range
      const midpoint = (rangeMin + rangeMax) / 2;
      rangeMin = Math.max(0, midpoint - 900); // 15 minutes before
      rangeMax = Math.min(86400, midpoint + 900); // 15 minutes after
    }
    
    // Snap the boundary times to cleaner intervals for better tick placement
    // Round down to the nearest 5 minutes for min
    rangeMin = Math.floor(rangeMin / 300) * 300;
    // Round up to the nearest 5 minutes for max
    rangeMax = Math.ceil(rangeMax / 300) * 300;
    
    return { 
      // Reverse the data order to get earliest timed notes at the top (Gantt chart convention)
      chartData: processedData.slice().reverse(), 
      chartBounds: { min: rangeMin, max: rangeMax } 
    };
  }, [notes]);

  // Calculate current time for reference line
  const currentTime = useMemo(() => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    return hours * 3600 + minutes * 60;
  }, []);

  // Format end time
  const formatEndTime = (startTimeStr: string, durationSec: number): string => {
    try {
      const startTimeParts = startTimeStr.split(':').map(Number);
      if (startTimeParts.length < 2) return "Unknown";
      
      // Calculate end time in seconds
      const startSeconds = startTimeParts[0] * 3600 + startTimeParts[1] * 60;
      const endSeconds = startSeconds + durationSec;
      
      // Format as HH:MM
      const endHours = Math.floor(endSeconds / 3600) % 24;
      const endMinutes = Math.floor((endSeconds % 3600) / 60);
      
      return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
    } catch (e) {
      return "Unknown";
    }
  };

  // Custom tooltip to display note information
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const endTime = formatEndTime(data.displayTime, data.duration);
      
      return (
        <div className="p-2 bg-white dark:bg-slate-800 shadow rounded border border-slate-200 dark:border-slate-600">
          <p className="font-semibold">{data.title}</p>
          <p className="text-sm">Start time: {data.displayTime}</p>
          <p className="text-sm">Duration: {formatDuration(data.duration)}</p>
          <p className="text-sm">End time: {endTime}</p>
        </div>
      );
    }
    return null;
  };

  // Format time for ticks
  const formatTimeLabel = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  // If no timed notes available
  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-80 text-slate-500">
        No timed notes available for timeline visualization.
      </div>
    );
  }

  // Calculate appropriate tick values based on the time range
  const generateTicks = () => {
    const range = chartBounds.max - chartBounds.min;
    
    // For short time ranges (< 3 hours), create more precise ticks at regular intervals
    if (range <= 10800) { // 3 hours
      // Create ticks at 15 or 30 minute intervals depending on range
      const interval = range <= 5400 ? 900 : 1800; // 15 or 30 minutes
      const ticks = [];
      
      // Round the min time down to the nearest interval
      const firstTick = Math.floor(chartBounds.min / interval) * interval;
      
      // Add ticks at regular intervals
      for (let time = firstTick; time <= chartBounds.max; time += interval) {
        ticks.push(time);
      }
      
      return ticks;
    } 
    
    // For longer ranges, use fewer ticks
    const tickCount = 6;
    const tickInterval = Math.ceil(range / (tickCount - 1));
    
    const ticks = [];
    for (let i = 0; i < tickCount; i++) {
      const tickValue = chartBounds.min + (i * tickInterval);
      if (tickValue <= chartBounds.max) {
        ticks.push(tickValue);
      }
    }
    
    return ticks;
  };
  
  return (
    <div className="w-full h-[500px] px-2">
      <div className="text-center text-sm text-slate-500 mb-2">
        Timeline shows scheduled notes and their approximate durations
      </div>
      <ResponsiveContainer width="100%" height="90%">
        <BarChart
          layout="vertical"
          data={chartData}
          margin={{ top: 30, right: 30, left: 150, bottom: 30 }}
          barGap={0}
          barCategoryGap={8}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            type="number" 
            domain={[chartBounds.min, chartBounds.max]}
            ticks={generateTicks()}
            tickFormatter={formatTimeLabel}
            padding={{ left: 20, right: 20 }}
          >
            <Label value="Timeline (24-hour format)" position="bottom" offset={10} />
          </XAxis>
          <YAxis 
            type="category" 
            dataKey="name" 
            width={150}
            tick={{ fontSize: 12 }}
          />
          <Tooltip content={<CustomTooltip />} />
          
          {/* Create "start position" bars that set the starting point */}
          <Bar 
            dataKey="startTime" 
            stackId="stack" 
            fill="transparent" 
            barSize={30}
          />
          
          {/* Main duration bars */}
          <Bar 
            dataKey="duration" 
            stackId="stack" 
            barSize={30}
            radius={[4, 4, 4, 4]}
          >
            {chartData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={index % 2 === 0 ? '#4f46e5' : '#6366f1'} 
                stroke="#3730a3"
                strokeWidth={1}
              />
            ))}
          </Bar>
          
          {/* Add current time reference line */}
          {currentTime >= chartBounds.min && currentTime <= chartBounds.max && (
            <ReferenceLine 
              x={currentTime} 
              stroke="red" 
              strokeWidth={2}
              strokeDasharray="3 3"
              label={{ 
                value: 'Current Time', 
                position: 'insideTopRight', 
                fill: 'red',
                fontSize: 12
              }} 
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}