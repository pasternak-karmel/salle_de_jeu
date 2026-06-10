"use client";

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

interface Props {
  chartData: { jour: string; revenus: number }[];
  topMachines: { nom: string; count: number }[];
}

const ACCENT_COLORS = ["#7C3AED", "#A78BFA", "#06B6D4", "#10B981", "#F59E0B"];

export default function DashboardCharts({ chartData, topMachines }: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Bar chart */}
      <div className="card lg:col-span-2">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-white font-display text-sm">Revenus — 7 derniers jours</p>
            <p className="text-xs mt-0.5" style={{ color: "#6B7280", fontFamily: "'Chakra Petch', sans-serif" }}>
              En FCFA
            </p>
          </div>
          <div
            className="px-2.5 py-1 rounded-full text-xs"
            style={{
              background: "rgba(124,58,237,0.1)",
              border: "1px solid rgba(124,58,237,0.25)",
              color: "#A78BFA",
              fontFamily: "'Chakra Petch', sans-serif",
            }}
          >
            7 jours
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 0, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="rgba(124,58,237,0.1)" vertical={false} />
            <XAxis
              dataKey="jour"
              tick={{ fill: "#6B7280", fontSize: 11, fontFamily: "'Chakra Petch', sans-serif" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#6B7280", fontSize: 11, fontFamily: "'Chakra Petch', sans-serif" }}
              axisLine={false}
              tickLine={false}
              width={55}
              tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
            />
            <Tooltip
              contentStyle={{
                background: "var(--bg-raised)",
                border: "1px solid rgba(124,58,237,0.28)",
                borderRadius: 10,
                fontFamily: "'Chakra Petch', sans-serif",
                fontSize: 12,
              }}
              labelStyle={{ color: "#E2E8F0", fontWeight: 600 }}
              itemStyle={{ color: "#A78BFA" }}
              formatter={(v: number) => [`${v.toLocaleString()} FCFA`, "Revenus"]}
              cursor={{ fill: "rgba(124,58,237,0.06)" }}
            />
            <Bar
              dataKey="revenus"
              fill="#7C3AED"
              radius={[6, 6, 0, 0]}
              maxBarSize={44}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Top machines */}
      <div className="card">
        <div className="mb-5">
          <p className="text-white font-display text-sm">Top postes ce mois</p>
          <p className="text-xs mt-0.5" style={{ color: "#6B7280", fontFamily: "'Chakra Petch', sans-serif" }}>
            Par nombre de sessions
          </p>
        </div>
        <div className="space-y-4">
          {topMachines.length === 0 && (
            <p className="text-sm" style={{ color: "#4B5563", fontFamily: "'Chakra Petch', sans-serif" }}>
              Pas encore de sessions.
            </p>
          )}
          {topMachines.map((m, i) => {
            const max = topMachines[0]?.count ?? 1;
            const pct = Math.round((m.count / max) * 100);
            const color = ACCENT_COLORS[i] ?? "#7C3AED";
            return (
              <div key={m.nom}>
                <div className="flex justify-between items-center mb-1.5">
                  <span
                    className="text-xs truncate flex-1"
                    style={{ color: "#9CA3AF", fontFamily: "'Chakra Petch', sans-serif" }}
                  >
                    <span className="font-semibold mr-1.5" style={{ color }}>{i + 1}.</span>
                    {m.nom}
                  </span>
                  <span
                    className="ml-3 text-xs font-semibold"
                    style={{ color: "#E2E8F0", fontFamily: "'Chakra Petch', sans-serif" }}
                  >
                    {m.count}
                  </span>
                </div>
                <div className="h-1.5 rounded-full" style={{ background: "rgba(124,58,237,0.1)" }}>
                  <div
                    className="h-1.5 rounded-full transition-all duration-500"
                    style={{
                      width: `${pct}%`,
                      background: `linear-gradient(90deg, ${color} 0%, ${color}99 100%)`,
                      boxShadow: `0 0 6px ${color}60`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
