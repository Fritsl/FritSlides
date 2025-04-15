import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { Note } from '@shared/schema';
import { formatTimeString, parseTimeString, formatDuration } from '@/lib/time-utils';

interface TimeGanttChartProps {
  notes: Note[];
  projectName: string;
}

type TimeChartData = {
  name: string;
  id: number;
  duration: number;
  startTime: number;
  displayTime: string;
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
    
    let earliestTime = Number.MAX_SAFE_INTEGER;
    let latestTime = 0;
    
    // First pass: determine the time range
    timedNotes.forEach(note => {
      if (!note.time) return;
      
      const timeInfo = parseTimeString(note.time);
      if (!timeInfo) return;
      
      // Convert to total seconds for easier math
      const totalSeconds = timeInfo.seconds;
      
      if (totalSeconds < earliestTime) {
        earliestTime = totalSeconds;
      }
      
      if (totalSeconds > latestTime) {
        latestTime = totalSeconds;
      }
    });
    
    // Ensure we have valid time bounds
    if (earliestTime === Number.MAX_SAFE_INTEGER || latestTime === 0) {
      return [];
    }
    
    // Second pass: calculate durations and create chart data points
    for (let i = 0; i < timedNotes.length; i++) {
      const currentNote = timedNotes[i];
      const nextNote = i < timedNotes.length - 1 ? timedNotes[i + 1] : null;
      
      const currentTimeInfo = currentNote.time ? parseTimeString(currentNote.time) : null;
      if (!currentTimeInfo) continue;
      
      const currentSeconds = currentTimeInfo.seconds;
      
      // Calculate duration to next timed note or use a default if this is the last note
      let durationSeconds = 900; // Default 15 minutes
      
      if (nextNote) {
        const nextTimeInfo = nextNote.time ? parseTimeString(nextNote.time) : null;
        if (nextTimeInfo) {
          let nextSeconds = nextTimeInfo.seconds;
          
          // Handle midnight crossover
          if (nextSeconds < currentSeconds) {
            nextSeconds += 24 * 60 * 60; // Add a day
          }
          
          durationSeconds = nextSeconds - currentSeconds;
        }
      }
      
      // Create data point
      data.push({
        name: currentNote.title || `Note ${currentNote.id}`,
        id: currentNote.id,
        duration: durationSeconds,
        startTime: currentSeconds,
        displayTime: formatTimeString(currentNote.time || '')
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

  // Custom tooltip to display note information
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="p-2 bg-white dark:bg-slate-800 shadow rounded border border-slate-200 dark:border-slate-600">
          <p className="font-semibold">{data.name}</p>
          <p className="text-sm">Start: {data.displayTime}</p>
          <p className="text-sm">Duration: {formatDuration(data.duration)}</p>
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

  return (
    <div className="w-full h-[500px] px-2">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={chartData}
          margin={{ top: 20, right: 30, left: 150, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            type="number" 
            domain={['dataMin', 'dataMax']} 
            tickFormatter={(seconds) => {
              const hours = Math.floor(seconds / 3600);
              const minutes = Math.floor((seconds % 3600) / 60);
              return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
            }}
          />
          <YAxis type="category" dataKey="name" width={140} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="duration" background={{ fill: '#eee' }} barSize={24}>
            {chartData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={index % 2 === 0 ? '#4f46e5' : '#6366f1'} 
              />
            ))}
          </Bar>
          
          {/* Add current time reference line */}
          <ReferenceLine 
            x={currentTime} 
            stroke="red" 
            strokeWidth={2} 
            label={{ value: 'Now', position: 'insideTopRight', fill: 'red' }} 
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}