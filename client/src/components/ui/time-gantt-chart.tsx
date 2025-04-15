import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell, ReferenceLine, Label } from 'recharts';
import { Note } from '@shared/schema';
import { formatTimeString, parseTimeString, formatDuration } from '@/lib/time-utils';

interface TimeGanttChartProps {
  notes: Note[];
  projectName: string;
}

type TimeChartData = {
  name: string;
  id: number;
  startTime: number; // Start time in seconds
  duration: number;  // Duration in seconds
  displayTime: string; // Formatted time string
  title: string;
};

export default function TimeGanttChart({ notes, projectName }: TimeGanttChartProps) {
  // Prepare data for the Gantt chart
  const chartData = useMemo(() => {
    // Filter notes with time values
    const timedNotes = notes
      .filter(note => note.time && note.time.trim() !== '')
      .sort((a, b) => {
        const timeA = a.time ? formatTimeString(a.time) : '';
        const timeB = b.time ? formatTimeString(b.time) : '';
        return timeA.localeCompare(timeB);
      });

    if (timedNotes.length === 0) return [];

    // Process the timed notes into chart data
    const data: TimeChartData[] = [];
    
    // Build chart data for each timed note
    for (let i = 0; i < timedNotes.length; i++) {
      const currentNote = timedNotes[i];
      const nextNote = i < timedNotes.length - 1 ? timedNotes[i + 1] : null;
      
      // Get start time for current note
      const currentTimeInfo = currentNote.time ? parseTimeString(currentNote.time) : null;
      if (!currentTimeInfo) continue;
      
      const startTimeSeconds = currentTimeInfo.seconds;
      
      // Calculate end time (duration) based on next note's time
      let durationSeconds = 900; // Default 15 minutes if no next note
      
      if (nextNote && nextNote.time) {
        const nextTimeInfo = parseTimeString(nextNote.time);
        if (nextTimeInfo) {
          let nextSeconds = nextTimeInfo.seconds;
          
          // Handle midnight crossover
          if (nextSeconds < startTimeSeconds) {
            nextSeconds += 24 * 60 * 60; // Add a day
          }
          
          durationSeconds = nextSeconds - startTimeSeconds;
        }
      }

      // Get the note title from content (first line)
      let noteTitle = '';
      if (currentNote.content) {
        // Extract first line of content as title
        const firstLine = currentNote.content.split('\n')[0];
        noteTitle = firstLine.trim();
      }
      
      // Truncate long titles
      let displayTitle = noteTitle || `Note ${currentNote.id}`;
      if (displayTitle.length > 30) {
        displayTitle = displayTitle.substring(0, 27) + '...';
      }
      
      // Create data point
      data.push({
        name: displayTitle, // Use actual titles
        id: currentNote.id,
        startTime: startTimeSeconds,
        duration: durationSeconds,
        displayTime: formatTimeString(currentNote.time || ''),
        title: noteTitle || `Note ${currentNote.id}`
      });
    }
    
    return data;
  }, [notes]);

  // Calculate current time for reference line
  const currentTime = useMemo(() => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    return hours * 3600 + minutes * 60;
  }, []);

  // Calculate chart bounds
  const chartBounds = useMemo(() => {
    if (chartData.length === 0) return { min: 0, max: 86400 }; // Default to full day
    
    // Find earliest and latest time
    let minTime = Number.MAX_SAFE_INTEGER;
    let maxTime = 0;
    
    chartData.forEach(item => {
      const startTime = item.startTime;
      const endTime = startTime + item.duration;
      
      if (startTime < minTime) minTime = startTime;
      if (endTime > maxTime) maxTime = endTime;
    });
    
    // Add padding (10% on each side)
    const range = maxTime - minTime;
    const padding = Math.max(1800, range * 0.1); // At least 30 min padding
    
    minTime = Math.max(0, minTime - padding);
    maxTime = maxTime + padding;
    
    return { min: minTime, max: maxTime };
  }, [chartData]);

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

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-80 text-slate-500">
        No timed notes available for timeline visualization.
      </div>
    );
  }

  // Format time for ticks
  const formatTimeLabel = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  // Transform data for proper Gantt chart rendering
  // Each entry needs start time (x) and duration properties
  const transformedData = chartData.map(item => ({
    ...item,
    x: item.startTime,             // X position is the start time
    y: item.duration,              // Width/length is the duration
    fill: '#4f46e5',               // Bar color
  }));

  return (
    <div className="w-full h-[500px] px-2">
      <div className="text-center text-sm text-slate-500 mb-2">
        Timeline shows your presentation schedule with each timed note
      </div>
      <ResponsiveContainer width="100%" height="90%">
        <BarChart
          layout="vertical"
          data={transformedData}
          margin={{ top: 30, right: 30, left: 150, bottom: 30 }}
          barGap={0}
          barCategoryGap={10}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            type="number" 
            domain={[chartBounds.min, chartBounds.max]} 
            tickFormatter={formatTimeLabel}
            padding={{ left: 20, right: 20 }}
            allowDataOverflow={true}
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
          
          {/* This is the key change: use startTime for X position */}
          <Bar 
            dataKey="duration"
            background={{ fill: '#eee' }} 
            barSize={28}
            radius={[4, 4, 4, 4]}
            // This makes the bar position at the startTime
            stackId="stack"
            fill="#4f46e5"
            // The x position is the critical part for a Gantt chart
            data={transformedData.map(item => ({
              ...item,
              // These properties ensure the bar starts at the right time
              x: item.startTime,
              width: item.duration,
              // The base property is set to 0 (bottom)
              y: 0
            }))}
          >
            {transformedData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={index % 2 === 0 ? '#4f46e5' : '#6366f1'} 
                stroke="#3730a3"
                strokeWidth={1}
              />
            ))}
          </Bar>
          
          {/* Add current time reference line if it's within chart bounds */}
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