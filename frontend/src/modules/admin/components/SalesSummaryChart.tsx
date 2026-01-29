import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

interface SalesSummaryChartProps {
  data: Array<{
    day: string;
    date: string;
    sales: number;
    orders: number;
  }>;
}

const SalesSummaryChart = ({ data }: SalesSummaryChartProps) => {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={data}
        margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#0d9488" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          vertical={false}
          stroke="#f1f5f9"
        />
        <XAxis
          dataKey="date"
          axisLine={false}
          tickLine={false}
          tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }}
          dy={10}
          tickFormatter={(value) => {
            const d = new Date(value);
            return `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`;
          }}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fill: '#64748b', fontSize: 12 }}
          tickFormatter={(value) => `₹${value >= 1000 ? (value/1000) + 'k' : value}`}
        />
        <Tooltip
          content={<CustomTooltip />}
          cursor={{ stroke: '#0d9488', strokeWidth: 2, strokeDasharray: '5 5' }}
        />
        <Area
          type="monotone"
          dataKey="sales"
          stroke="#0d9488"
          strokeWidth={3}
          fillOpacity={1}
          fill="url(#colorSales)"
          animationBegin={200}
          animationDuration={1500}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    // Format the date label for better readability in tooltip
    const dateObj = new Date(label);
    const formattedDate = dateObj.toLocaleDateString('en-IN', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });

    return (
      <div className="bg-white p-4 shadow-2xl rounded-xl border border-gray-100 animate-slideUp">
        <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 border-b border-gray-50 pb-2">
            {formattedDate}
        </p>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-8">
            <span className="text-sm text-gray-500 font-medium">Revenue</span>
            <span className="text-sm font-black text-teal-600">₹{payload[0].value.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between gap-8">
            <span className="text-sm text-gray-500 font-medium">Orders</span>
            <span className="text-sm font-black text-gray-800">{payload[0].payload.orders}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export default SalesSummaryChart;
