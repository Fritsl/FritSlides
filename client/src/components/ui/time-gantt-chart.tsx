import React, { useEffect, useState } from 'react';
import { 
  BarChart as RechartsBarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { Note } from '@shared/schema';
import { parseTimeString, formatDuration } from '@/lib/time-utils';

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
  const [chartData, setChartData] = useState<TimeChartData[]>([]);
  const [minStartTime, setMinStartTime] = useState<number>(0);
  const [maxEndTime, setMaxEndTime] = useState<number>(0);

  useEffect(() => {
    // Filter notes with time values
    const timedNotes = notes.filter(note => note.time);
    
    // Process notes to create chart data
    const processedData: TimeChartData[] = [];
    let minStart = Number.MAX_SAFE_INTEGER;
    let maxEnd = 0;
    
    timedNotes.forEach(note => {
      if (!note.time) return;
      
      const timeValue = parseTimeString(note.time);
      if (!timeValue || timeValue.seconds === undefined) return;
      
      // Get the start time in seconds
      const startTimeInSeconds = timeValue.seconds;
      
      // Determine the duration by looking for the next timed note in sequence
      const noteId = note.id;
      const parentId = note.parentId;
      
      // Find siblings (notes with the same parentId) or children if this is a parent
      const relatedNotes = notes.filter(n => 
        n.parentId === parentId || // siblings
        (noteId === n.parentId) // children
      );
      
      // Sort by order
      const sortedNotes = [...relatedNotes].sort((a, b) => {
        // Use string comparison for order, as it can be a string or number
        const orderA = String(a.order);
        const orderB = String(b.order);
        return orderA.localeCompare(orderB);
      });
      
      // Find the index of the current note
      const currentIndex = sortedNotes.findIndex(n => n.id === noteId);
      
      // Find the next note with time after the current note
      let nextTimeInSeconds = null;
      for (let i = currentIndex + 1; i < sortedNotes.length; i++) {
        if (sortedNotes[i].time) {
          const nextTimeValue = parseTimeString(sortedNotes[i].time!);
          if (nextTimeValue && nextTimeValue.seconds !== undefined) {
            nextTimeInSeconds = nextTimeValue.seconds;
            break;
          }
        }
      }
      
      // Calculate duration
      let duration = 60; // Default duration (1 minute) if no next note with time
      if (nextTimeInSeconds !== null) {
        duration = Math.max(nextTimeInSeconds - startTimeInSeconds, 10); // Minimum 10 seconds
      }
      
      // Create chart data entry
      processedData.push({
        name: note.content.substring(0, 30) + (note.content.length > 30 ? '...' : ''),
        id: note.id,
        duration: duration,
        startTime: startTimeInSeconds,
        displayTime: note.time
      });
      
      // Update min and max times
      minStart = Math.min(minStart, startTimeInSeconds);
      maxEnd = Math.max(maxEnd, startTimeInSeconds + duration);
    });
    
    // Sort by start time
    const sortedData = processedData.sort((a, b) => a.startTime - b.startTime);
    
    setChartData(sortedData);
    setMinStartTime(minStart === Number.MAX_SAFE_INTEGER ? 0 : minStart);
    setMaxEndTime(maxEnd);
  }, [notes]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-800 p-3 rounded shadow-lg border border-slate-700 text-white">
          <p className="font-semibold">{data.name}</p>
          <p>Time: {data.displayTime}</p>
          <p>Duration: {formatDuration(data.duration)}</p>
          <p className="text-xs text-slate-400">Note ID: {data.id}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-full min-h-[400px]">
      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <RechartsBarChart
            data={chartData}
            layout="vertical"
            margin={{
              top: 20,
              right: 30,
              left: 120,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              type="number"
              domain={[minStartTime, maxEndTime]}
              tickFormatter={(value) => formatDuration(value - minStartTime)}
              label={{ value: 'Timeline (relative)', position: 'insideBottom', offset: -5 }}
            />
            <YAxis
              dataKey="name"
              type="category"
              width={120}
              tick={{ fontSize: 12 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar
              dataKey="duration"
              name="Duration"
              fill="#8884d8"
              background={{ fill: '#eee' }}
              barSize={20}
              // Position each bar at its start time
              // @ts-ignore - recharts allows this prop even though it's not in the types
              stackId="a"
              // @ts-ignore - recharts allows this prop even though it's not in the types
              barGap={0}
              // @ts-ignore - recharts allows this prop even though it's not in the types
              barCategoryGap={10}
              // Used for positioning
              // @ts-ignore - recharts allows this custom prop
              startTime={chartData.map(d => d.startTime - minStartTime)}
            />
          </RechartsBarChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-full w-full">
          <p className="text-slate-500">No timed notes found to display in the chart.</p>
        </div>
      )}
    </div>
  );
}