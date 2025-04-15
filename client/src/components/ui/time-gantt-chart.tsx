import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell, ReferenceLine, Label } from 'recharts';
import { Note } from '@shared/schema';
import { formatTimeString, parseTimeString, formatDuration } from '@/lib/time-utils';

interface TimeGanttChartProps {
  notes: Note[];
  projectName: string;
}

// The core issue with Gantt charts in Recharts is that bars always start at zero
// and the value determines their length. To make it work as a Gantt chart:
// 1. For each time slot, create a "dummy" bar with zero value from 0 to start time
// 2. Stack the actual data on top of that bar, which positions it at the right start time

export default function TimeGanttChart({ notes, projectName }: TimeGanttChartProps) {
  // Prepare data for the Gantt chart
  const { chartData, chartBounds } = useMemo(() => {
    // Filter notes with time values and sort by time
    const timedNotes = notes
      .filter(note => note.time && note.time.trim() !== '')
      .sort((a, b) => {
        const timeA = a.time ? parseTimeString(a.time)?.seconds || 0 : 0;
        const timeB = b.time ? parseTimeString(b.time)?.seconds || 0 : 0;
        return timeA - timeB;
      });

    if (timedNotes.length === 0) return { chartData: [], chartBounds: { min: 0, max: 86400 } };

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
        // These properties are the key for Gantt positioning:
        startTime: startTime,           // When the bar should start
        duration: duration,             // How long the bar should be
        startPos: startTime,            // A separate property to use for positioning 
        displayTime: formatTimeString(currentNote.time),
        content: currentNote.content,
        title: noteTitle || `Note ${currentNote.id}`
      });
    }
    
    // Calculate chart bounds with padding
    const range = maxTime - minTime;
    const padding = Math.max(1800, range * 0.1); // At least 30 min padding
    
    const minBound = Math.max(0, minTime - padding);
    const maxBound = maxTime + padding;
    
    return { 
      chartData: processedData, 
      chartBounds: { min: minBound, max: maxBound } 
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
      const startDate = new Date(`2023-01-01T${startTimeStr}`);
      const endDate = new Date(startDate.getTime() + durationSec * 1000);
      return formatTimeString(endDate.toTimeString().slice(0, 5));
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

  // This is the simpler approach - we don't try to position bars at their startTime
  // Instead, we create a simple horizontal bar chart with time axis
  // This isn't a true Gantt chart, but it's more reliable with Recharts
  
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
                position: 'insideBottomRight', 
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