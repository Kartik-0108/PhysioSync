import React from 'react';
import { LineChart, Line, ResponsiveContainer, Tooltip, YAxis } from 'recharts';

interface PerformanceGraphProps {
  data: any[];
}

export const PerformanceGraph: React.FC<PerformanceGraphProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center text-slate-400 text-sm">
        Not enough data
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <YAxis domain={[0, 100]} hide />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'rgba(15, 23, 42, 0.9)', 
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '12px'
            }}
            itemStyle={{ color: '#10b981' }}
            formatter={(value: number) => [`${value}%`, 'Accuracy']}
            labelFormatter={() => ''}
          />
          <Line 
            type="monotone" 
            dataKey="accuracy" 
            stroke="#10b981" 
            strokeWidth={3}
            dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
            activeDot={{ r: 6, fill: '#10b981', strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
