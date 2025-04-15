import React, { useState, useEffect } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Note } from "@shared/schema";
import { timeToMinutes } from "@/lib/time-utils";

export type TimeSegment = {
  id: number;
  name: string;
  minutes: number;
  color: string;
};

interface TimeDistributionChartProps {
  notes: Note[];
}

// Color palette for sections
const COLORS = [
  "#8884d8", "#83a6ed", "#8dd1e1", "#82ca9d", 
  "#a4de6c", "#d0ed57", "#ffc658", "#ff8042", 
  "#ff6361", "#bc5090", "#58508d", "#003f5c",
  "#444e86", "#955196", "#dd5182", "#ff6e54", 
  "#ffa600", "#ffc658", "#f95d6a", "#00cc96"
];

export const TimeDistributionChart: React.FC<TimeDistributionChartProps> = ({ notes }) => {
  const [timeSegments, setTimeSegments] = useState<TimeSegment[]>([]);
  const [loading, setLoading] = useState(true);
  
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
      setTimeSegments([]);
      return;
    }

    // Calculate time segments between markers
    const segments: TimeSegment[] = [];
    
    for (let i = 0; i < timedNotes.length - 1; i++) {
      const currentNote = timedNotes[i];
      const nextNote = timedNotes[i + 1];
      
      const startTimeMinutes = timeToMinutes(currentNote.time || '');
      const endTimeMinutes = timeToMinutes(nextNote.time || '');
      
      // Calculate duration, handling overnight segments
      let durationMinutes = endTimeMinutes - startTimeMinutes;
      if (durationMinutes < 0) {
        durationMinutes += 24 * 60; // Add a day
      }
      
      // Only add segments with actual duration
      if (durationMinutes > 0) {
        const segmentName = currentNote.content?.split('\n')[0].trim() || `Segment ${i+1}`;
        
        segments.push({
          id: currentNote.id,
          name: segmentName.length > 30 ? segmentName.substring(0, 30) + '...' : segmentName,
          minutes: durationMinutes,
          color: COLORS[i % COLORS.length]
        });
      }
    }
    
    setTimeSegments(segments);
    setLoading(false);
  }, [notes]);

  // Format minutes for tooltip display
  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    } else {
      return `${mins} min`;
    }
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const totalMinutes = timeSegments.reduce((sum, segment) => sum + segment.minutes, 0);
      const percent = totalMinutes > 0 ? (data.minutes / totalMinutes * 100).toFixed(0) : 0;
      
      return (
        <div className="bg-background p-4 rounded border shadow-sm">
          <p className="font-medium">{data.name}</p>
          <p>Duration: {formatMinutes(data.minutes)}</p>
          <p>Percentage: {percent}%</p>
        </div>
      );
    }
    return null;
  };

  // Render loading state or empty state
  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading chart...</div>;
  }

  if (timeSegments.length === 0) {
    return (
      <div className="flex flex-col justify-center items-center h-64 p-4 text-center">
        <p className="text-lg font-semibold mb-2">No time data available</p>
        <p className="text-muted-foreground">Add time markers to at least two notes to see time distribution.</p>
      </div>
    );
  }

  // Calculate total time for context
  const totalMinutes = timeSegments.reduce((sum, segment) => sum + segment.minutes, 0);
  const totalHours = (totalMinutes / 60).toFixed(1);

  return (
    <div className="w-full h-[500px] mt-4">
      <h3 className="text-center text-lg font-semibold mb-2">Time Distribution</h3>
      <p className="text-center text-sm text-muted-foreground mb-4">
        Total presentation time: {totalHours} hours
      </p>
      <ResponsiveContainer width="100%" height="80%">
        <PieChart>
          <Pie
            data={timeSegments}
            cx="50%"
            cy="50%"
            outerRadius={120}
            innerRadius={60}
            dataKey="minutes"
            nameKey="name"
            label={(entry) => {
              const percentage = (entry.value / totalMinutes * 100).toFixed(0);
              return `${entry.name} (${percentage}%)`;
            }}
            labelLine={false}
          >
            {timeSegments.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend layout="vertical" align="right" verticalAlign="middle" />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};