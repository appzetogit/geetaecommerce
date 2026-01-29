import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface SalesLineChartProps {
  thisMonthData: { date: string; value: number }[];
  lastMonthData: { date: string; value: number }[];
  height?: number;
}

export default function SalesLineChart({ thisMonthData, lastMonthData, height = 250 }: SalesLineChartProps) {
  // Merge data for simpler consumption by Recharts
  // Assuming data matches by index for "Day 1 vs Day 1" comparison
  const data = thisMonthData.map((item, index) => ({
    date: item.date,
    thisMonth: item.value,
    lastMonth: lastMonthData[index]?.value || 0,
  }));

  return (
    <div className="w-full" style={{ height: height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{
            top: 5,
            right: 0,
            left: 0,
            bottom: 0,
          }}
        >
          <defs>
            <linearGradient id="colorThisMonth" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="colorLastMonth" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#eab308" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#eab308" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#6b7280', fontSize: 10 }}
            dy={10}
            interval="preserveStartEnd"
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#6b7280', fontSize: 10 }}
            tickFormatter={(value) => `₹${value.toLocaleString()}`}
            width={60}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              fontSize: '12px'
            }}
            formatter={(value: number) => [`₹${value.toLocaleString()}`, '']}
            labelStyle={{ color: '#374151', marginBottom: '0.25rem' }}
          />
          <Legend
            verticalAlign="top"
            height={36}
            iconType="circle"
            wrapperStyle={{
              fontSize: '12px',
              paddingBottom: '10px'
            }}
          />
          <Area
            name="This Month"
            type="monotone"
            dataKey="thisMonth"
            stroke="#3b82f6"
            fillOpacity={1}
            fill="url(#colorThisMonth)"
            strokeWidth={2}
          />
          <Area
            name="Last Month"
            type="monotone"
            dataKey="lastMonth"
            stroke="#eab308"
            fillOpacity={1}
            fill="url(#colorLastMonth)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
