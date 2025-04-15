import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell, ReferenceLine, Label, ReferenceArea } from 'recharts';
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

    // Debug output of note times
    if (timedNotes.length > 0) {
      console.log('First timed note:', timedNotes[0].time);
      console.log('Last timed note:', timedNotes[timedNotes.length - 1].time);
    }

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
    
    // Debug logs: show the first and last times in seconds
    console.log('First note time (seconds):', minTime);
    console.log('Last note time (seconds):', maxTime);
    
    // Get all unique time values to determine which time slots actually have data
    // This helps us eliminate empty spaces in the timeline
    const distinctTimes = new Set<number>();
    processedData.forEach(item => {
      distinctTimes.add(item.startTime);
      distinctTimes.add(item.startTime + item.duration);
    });
    
    // Create a sorted array of distinct times
    const timePoints = Array.from(distinctTimes).sort((a, b) => a - b);
    
    // Only include the main time ranges where we have data, plus minimal padding
    // Start with the first time (9:00 AM)
    const rangeMin = 32400; // 9:00 AM
    // End with the last note end time plus a little padding
    const rangeMax = Math.min(86400, maxTime + 600); // 10 min padding at end only
    
    // Define a helper function to format time for debug logs
    const formatForLog = (seconds: number) => {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };
    
    console.log('Chart bounds:', formatForLog(rangeMin), 'to', formatForLog(rangeMax));
    
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

  // Custom tooltip to display note information with high-contrast colors
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const endTime = formatEndTime(data.displayTime, data.duration);
      
      return (
        <div className="p-3 bg-slate-800 shadow rounded border border-indigo-500 text-white">
          <p className="font-semibold text-white mb-1">{data.title}</p>
          <p className="text-sm text-white">Start time: {data.displayTime}</p>
          <p className="text-sm text-white">Duration: {formatDuration(data.duration)}</p>
          <p className="text-sm text-white">End time: {endTime}</p>
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

  // Calculate appropriate tick values based on the time range and actual data distribution
  const generateTicks = () => {
    // Find all the key times from the data (note start and end times)
    const keyTimes = new Set<number>();
    
    // Add chart boundary times
    keyTimes.add(chartBounds.min);
    keyTimes.add(chartBounds.max);
    
    // Add times from actual data points
    chartData.forEach(entry => {
      // Add start time
      keyTimes.add(entry.startTime);
      // Add end time
      keyTimes.add(entry.startTime + entry.duration);
    });
    
    // Get array of sorted times
    const sortedTimes = Array.from(keyTimes).sort((a, b) => a - b);
    
    // Create evenly distributed ticks, but ensure we always include
    // the earliest and latest data points
    const desiredTickCount = 6; // Aim for about 6 ticks
    
    if (sortedTimes.length <= desiredTickCount) {
      // If we have few enough time points, use them all
      return sortedTimes;
    }
    
    // Create evenly distributed ticks including min and max
    const ticks = [];
    const step = Math.ceil((sortedTimes.length - 1) / (desiredTickCount - 1));
    
    for (let i = 0; i < sortedTimes.length; i += step) {
      ticks.push(sortedTimes[i]);
    }
    
    // Always make sure to include the max time
    if (!ticks.includes(sortedTimes[sortedTimes.length - 1])) {
      ticks.push(sortedTimes[sortedTimes.length - 1]);
    }
    
    return ticks;
  };
  
  // Find active time regions for highlighting
  const activeTimeRanges = useMemo(() => {
    const ranges = [];
    // Collect all start and end times from chart data
    const timePoints = chartData.flatMap(entry => [
      entry.startTime, 
      entry.startTime + entry.duration
    ]);
    
    // Sort time points
    const sortedPoints = [...new Set(timePoints)].sort((a, b) => a - b);
    
    // Group time points into ranges
    // We'll use a threshold to determine if adjacent points should be connected
    const THRESHOLD = 900; // 15 minutes in seconds
    
    let rangeStart = sortedPoints[0];
    let rangeEnd = rangeStart;
    
    for (let i = 1; i < sortedPoints.length; i++) {
      const currentPoint = sortedPoints[i];
      
      // If this point is close to the previous one, extend the range
      if (currentPoint - rangeEnd < THRESHOLD) {
        rangeEnd = currentPoint;
      } else {
        // Otherwise, save the current range and start a new one
        ranges.push({ start: rangeStart, end: rangeEnd });
        rangeStart = currentPoint;
        rangeEnd = currentPoint;
      }
    }
    
    // Add the last range
    if (rangeStart <= rangeEnd) {
      ranges.push({ start: rangeStart, end: rangeEnd });
    }
    
    return ranges;
  }, [chartData]);
  
  return (
    <div className="w-full h-[500px] px-2">
      <div className="text-center text-sm text-slate-500 mb-2">
        Timeline shows scheduled notes and their approximate durations
      </div>
      <ResponsiveContainer width="100%" height="90%">
        <BarChart
          layout="vertical"
          data={chartData}
          margin={{ top: 20, right: 20, left: 120, bottom: 30 }}
          barGap={0}
          barCategoryGap={8}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            type="number" 
            domain={[chartBounds.min, chartBounds.max]}
            ticks={generateTicks()}
            tickFormatter={formatTimeLabel}
            // Use padding of 0 to maximize space usage
            padding={{ left: 0, right: 0 }}
            // Add allowDataOverflow to prevent automatic expansion of domain
            allowDataOverflow={true}
            // Force scale bounds to match our domain exactly
            scale="linear"
            // Make sure we only show the significant ticks we've calculated
            interval="preserveEnd"
            minTickGap={30}
          >
            <Label value="Timeline (24-hour format)" position="bottom" offset={10} />
          </XAxis>
          <YAxis 
            type="category" 
            dataKey="name" 
            width={120}
            tick={{ fontSize: 11 }}
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
          
          {/* Add highlight areas for active time regions */}
          {activeTimeRanges.map((range, index) => (
            <ReferenceArea
              key={`active-range-${index}`}
              x1={range.start}
              x2={range.end}
              fill="#4f46e5"
              fillOpacity={0.05}
              stroke="#4f46e5"
              strokeOpacity={0.2}
              strokeWidth={1}
            />
          ))}
          
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