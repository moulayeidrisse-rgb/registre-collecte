"use client";

import { useT } from "@/i18n/client";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

// Palette catégorielle validée (ordre fixe, jamais recyclé) — voir README, section Graphiques
export const SERIES = ["#00874a", "#d99a00", "#2a78d6", "#c8102e"] as const;
const GRID = "#e6e9ef";
const AXIS = "#5b6475";

const frDay = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
};

export function TimelineChart({ data }: { data: { date: string; soumises: number; validees: number }[] }) {
  const t = useT();
  return (
    <div dir="ltr" className="h-72 w-full" role="img" aria-label={t("Évolution quotidienne des réponses soumises et validées sur la période")}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="date" tickFormatter={frDay} tick={{ fill: AXIS, fontSize: 12 }} tickLine={false} axisLine={{ stroke: GRID }} minTickGap={24} />
          <YAxis allowDecimals={false} tick={{ fill: AXIS, fontSize: 12 }} tickLine={false} axisLine={false} width={40} />
          <Tooltip
            labelFormatter={(l) => t("Le {date}", { date: frDay(String(l)) })}
            contentStyle={{ borderRadius: 8, borderColor: GRID, fontSize: 13 }}
            cursor={{ stroke: AXIS, strokeDasharray: "3 3" }}
          />
          <Legend wrapperStyle={{ fontSize: 13, color: AXIS }} iconType="plainline" itemSorter={null} />
          <Area type="linear" dataKey="soumises" name={t("Soumises")} stroke={SERIES[0]} strokeWidth={2} fill={SERIES[0]} fillOpacity={0.08} dot={false} activeDot={{ r: 4 }} />
          <Area type="linear" dataKey="validees" name={t("dont validées")} stroke={SERIES[1]} strokeWidth={2} fill={SERIES[1]} fillOpacity={0.06} dot={false} activeDot={{ r: 4 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PerFormChart({ data }: { data: { code: string; title: string; validees: number; enAttente: number; aCorriger: number; rejetees: number }[] }) {
  const t = useT();
  const height = Math.max(160, data.length * 44 + 60);
  return (
    <div dir="ltr" style={{ height }} className="w-full" role="img" aria-label={t("Répartition des réponses par formulaire et par statut (détail dans le tableau)")}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 0 }} barCategoryGap={10}>
          <CartesianGrid stroke={GRID} horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fill: AXIS, fontSize: 12 }} tickLine={false} axisLine={{ stroke: GRID }} />
          <YAxis type="category" dataKey="code" width={92} tick={{ fill: AXIS, fontSize: 12 }} tickLine={false} axisLine={false} />
          <Tooltip
            labelFormatter={(_, p) => (p?.[0]?.payload as { title?: string } | undefined)?.title ?? ""}
            contentStyle={{ borderRadius: 8, borderColor: GRID, fontSize: 13 }}
            cursor={{ fill: "rgba(0,111,60,0.06)" }}
          />
          <Legend wrapperStyle={{ fontSize: 13 }} itemSorter={null} />
          {/* liseré blanc de 2 px entre segments empilés */}
          <Bar dataKey="validees" name={t("Validées")} stackId="s" fill={SERIES[0]} stroke="#fff" strokeWidth={2} />
          <Bar dataKey="enAttente" name={t("En attente")} stackId="s" fill={SERIES[1]} stroke="#fff" strokeWidth={2} />
          <Bar dataKey="aCorriger" name={t("À corriger")} stackId="s" fill={SERIES[2]} stroke="#fff" strokeWidth={2} />
          <Bar dataKey="rejetees" name={t("Rejetées")} stackId="s" fill={SERIES[3]} stroke="#fff" strokeWidth={2} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
