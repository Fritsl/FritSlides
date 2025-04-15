import React, { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";
import { Note } from "@shared/schema";
import { timeToMinutes } from "@/lib/time-utils";

interface TimeGanttChartProps {
  notes: Note[];
}

// Color palette for bars
const COLORS = [
  "#8884d8", "#83a6ed", "#8dd1e1", "#82ca9d", 
  "#a4de6c", "#d0ed57", "#ffc658", "#ff8042", 
  "#ff6361", "#bc5090", "#58508d", "#003f5c",
  "#444e86", "#955196", "#dd5182", "#ff6e54", 
  "#ffa600", "#ffc658", "#f95d6a", "#00cc96"
];

interface GanttBarData {
  id: number;
  name: string;
  startTime: number;
  endTime: number;
  duration: number;
  color: string;
}

export const TimeGanttChart: React.FC<TimeGanttChartProps> = ({ notes }) => {
  const [ganttData, setGanttData] = useState<GanttBarData[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<{min: number, max: number}>({ min: 0, max: 0 });
  
  useEffect(() => {
    if (!notes || notes.length === 0) {
      setLoading(false);
      return;
    }

    // Get all notes with time markers
    const timedNotes = notes
      .filter(note => note.time && note.time.trim() !== '')
      .sort((a, b) => {
        const timeA = timeToMinutes(a.time || '');
        const timeB = timeToMinutes(b.time || '');
        return timeA - timeB;
      });

    if (timedNotes.length < 2) {
      setLoading(false);
      setGanttData([]);
      return;
    }

    // Calculate time segments between markers for the Gantt chart
    const ganttBars: GanttBarData[] = [];
    let minTime = Number.MAX_SAFE_INTEGER;
    let maxTime = 0;
    
    for (let i = 0; i < timedNotes.length - 1; i++) {
      const currentNote = timedNotes[i];
      const nextNote = timedNotes[i + 1];
      
      const startTimeMinutes = timeToMinutes(currentNote.time || '');
      const endTimeMinutes = timeToMinutes(nextNote.time || '');
      
      // Handle overnight segments
      let adjustedEndTime = endTimeMinutes;
      if (endTimeMinutes < startTimeMinutes) {
        adjustedEndTime += 24 * 60; // Add a day if end time is before start time
      }
      
      // Track min and max times for axis scaling
      minTime = Math.min(minTime, startTimeMinutes);
      maxTime = Math.max(maxTime, adjustedEndTime);
      
      // Only add segments with actual duration
      if (adjustedEndTime > startTimeMinutes) {
        const segmentName = currentNote.content?.split('\n')[0].trim() || `Segment ${i+1}`;
        
        ganttBars.push({
          id: currentNote.id,
          name: segmentName.length > 25 ? segmentName.substring(0, 25) + '...' : segmentName,
          startTime: startTimeMinutes,
          endTime: adjustedEndTime,
          duration: adjustedEndTime - startTimeMinutes,
          color: COLORS[i % COLORS.length]
        });
      }
    }
    
    setGanttData(ganttBars);
    setTimeRange({ min: minTime, max: maxTime });
    setLoading(false);
  }, [notes]);

  // Format minutes for display
  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  // Custom tooltip for Gantt bars
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const duration = Math.floor(data.duration);
      const hours = Math.floor(duration / 60);
      const mins = duration % 60;
      
      return (
        <div className="bg-background p-4 rounded border shadow-sm">
          <p className="font-medium">{data.name}</p>
          <p>Start: {formatMinutes(data.startTime)}</p>
          <p>End: {formatMinutes(data.endTime)}</p>
          <p>Duration: {hours > 0 ? `${hours}h ${mins}m` : `${mins} min`}</p>
        </div>
      );
    }
    return null;
  };

  // Render loading state or empty state
  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading chart...</div>;
  }

  if (ganttData.length === 0) {
    return (
      <div className="flex flex-col justify-center items-center h-64 p-4 text-center">
        <p className="text-lg font-semibold mb-2">No time data available</p>
        <p className="text-muted-foreground">Add time markers to at least two notes to see the timeline.</p>
      </div>
    );
  }

  // Calculate total time for context
  const totalMinutes = timeRange.max - timeRange.min;
  const totalHours = (totalMinutes / 60).toFixed(1);

  return (
    <div className="w-full h-[500px] mt-4">
      <h3 className="text-center text-lg font-semibold mb-2">Timeline View</h3>
      <p className="text-center text-sm text-muted-foreground mb-4">
        Total presentation time: {totalHours} hours
      </p>
      <ResponsiveContainer width="100%" height="80%">
        <BarChart
          data={ganttData}
          layout="vertical"
          margin={{ top: 20, right: 30, left: 120, bottom: 20 }}
        >
          <XAxis 
            type="number" 
            domain={[timeRange.min, timeRange.max]} 
            tickFormatter={formatMinutes} 
          />
          <YAxis 
            type="category" 
            dataKey="name" 
            width={120} 
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar 
            dataKey="endTime" 
            stackId="a" 
            fill="#8884d8" 
            background={{ fill: 'transparent' }}
            barSize={20}
          >
            {ganttData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.color} 
              />
            ))}
          </Bar>
          <ReferenceLine x={timeRange.min} stroke="#666" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};