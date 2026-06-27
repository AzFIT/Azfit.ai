import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

interface MacroData {
  name: string;
  value: number;
  color: string;
}

export default function MacroDistributionPieChart({
  data,
}: {
  data: MacroData[];
}) {
  return (
    <div className="flex flex-col items-center">
      <h3 className="text-lg font-semibold mb-4">Macro Distribution</h3>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            outerRadius={80}
            innerRadius={40}
            paddingAngle={5}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
      {/* Legend */}
      <div className="flex gap-4 mt-2">
        {data.map((entry) => (
          <div key={entry.name} className="flex items-center gap-1">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-xs">
              {entry.name}: {entry.value}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
