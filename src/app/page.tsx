import { prisma } from "@/lib/prisma";
import { formatMontant, formatDuree } from "@/lib/utils";
import DashboardCharts from "@/components/Dashboard/DashboardCharts";
import { startOfDay, subDays, startOfMonth } from "date-fns";
import { Banknote, BarChart3, Timer, Zap, TrendingUp, TrendingDown, Minus } from "lucide-react";

export const revalidate = 30;

async function getStats() {
  const now = new Date();
  const today = startOfDay(now);
  const hier = startOfDay(subDays(now, 1));
  const moisDebut = startOfMonth(now);
  const semDebut = startOfDay(subDays(now, 7));

  const [
    sessionsEnCours,
    sessionsAujourdhui,
    sessionsHier,
    sessionsMois,
    sessionsSemaine,
    machinesTotal,
    topMachines,
  ] = await Promise.all([
    prisma.session.count({ where: { statut: "EN_COURS" } }),
    prisma.session.findMany({ where: { debut: { gte: today }, statut: "TERMINEE" }, select: { montant: true } }),
    prisma.session.findMany({ where: { debut: { gte: hier, lt: today }, statut: "TERMINEE" }, select: { montant: true } }),
    prisma.session.findMany({ where: { debut: { gte: moisDebut }, statut: "TERMINEE" }, select: { montant: true } }),
    prisma.session.findMany({
      where: { debut: { gte: semDebut }, statut: "TERMINEE" },
      select: { montant: true, debut: true, dureeMinutes: true },
    }),
    prisma.machine.count(),
    prisma.session.groupBy({
      by: ["machineId"],
      where: { debut: { gte: moisDebut } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 5,
    }),
  ]);

  const revAujourdhui = sessionsAujourdhui.reduce((s: number, x: {montant: number|null}) => s + (x.montant ?? 0), 0);
  const revHier       = sessionsHier.reduce((s: number, x: {montant: number|null}) => s + (x.montant ?? 0), 0);
  const revMois       = sessionsMois.reduce((s: number, x: {montant: number|null}) => s + (x.montant ?? 0), 0);

  const dureesMoyenne =
    sessionsSemaine.filter((s: {dureeMinutes: number|null}) => s.dureeMinutes).reduce((acc: number, s: {dureeMinutes: number|null}) => acc + (s.dureeMinutes ?? 0), 0) /
    (sessionsSemaine.filter((s: {dureeMinutes: number|null}) => s.dureeMinutes).length || 1);

  const machineIds = topMachines.map((m: {machineId: string}) => m.machineId);
  const machines = await prisma.machine.findMany({ where: { id: { in: machineIds } }, select: { id: true, nom: true } });
  const machineNom = Object.fromEntries(machines.map((m: {id: string; nom: string}) => [m.id, m.nom]));

  const chartData: { jour: string; revenus: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = startOfDay(subDays(now, i));
    const next = startOfDay(subDays(now, i - 1));
    const s = sessionsSemaine.filter((x: {debut: Date|string}) => new Date(x.debut) >= d && new Date(x.debut) < next);
    chartData.push({
      jour: d.toLocaleDateString("fr-FR", { weekday: "short" }),
      revenus: s.reduce((acc: number, x: {montant: number|null}) => acc + (x.montant ?? 0), 0),
    });
  }

  return {
    sessionsEnCours,
    revAujourdhui,
    revHier,
    revMois,
    dureesMoyenne,
    machinesTotal,
    topMachines: topMachines.map((m: {machineId: string; _count: {id: number}}) => ({ nom: machineNom[m.machineId] ?? "?", count: m._count.id })),
    chartData,
  };
}

export default async function Dashboard() {
  const stats = await getStats();
  const delta = stats.revHier > 0 ? ((stats.revAujourdhui - stats.revHier) / stats.revHier) * 100 : 0;

  return (
    <div className="space-y-8 max-w-7xl">
      <div>
        <h1 className="text-2xl text-white font-display">Tableau de bord</h1>
        <p className="text-sm mt-1" style={{ color: "#6B7280", fontFamily: "'Chakra Petch', sans-serif" }}>
          Vue d&apos;ensemble de votre salle de jeu
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Revenus aujourd'hui" value={formatMontant(stats.revAujourdhui)} sub={`${delta >= 0 ? "+" : ""}${delta.toFixed(0)}% vs hier`} trend={delta > 0 ? "up" : delta < 0 ? "down" : "flat"} icon={Banknote} accent="#10B981" glowColor="rgba(16,185,129,0.18)" />
        <StatCard title="Revenus ce mois" value={formatMontant(stats.revMois)} sub="mois en cours" trend="flat" icon={BarChart3} accent="#7C3AED" glowColor="rgba(124,58,237,0.22)" />
        <StatCard title="Sessions en cours" value={String(stats.sessionsEnCours)} sub={`${stats.machinesTotal} postes au total`} trend="flat" icon={Timer} accent="#06B6D4" glowColor="rgba(6,182,212,0.18)" />
        <StatCard title="Durée moy. session" value={formatDuree(Math.round(stats.dureesMoyenne))} sub="7 derniers jours" trend="flat" icon={Zap} accent="#A78BFA" glowColor="rgba(124,58,237,0.18)" />
      </div>

      <DashboardCharts chartData={stats.chartData} topMachines={stats.topMachines} />
    </div>
  );
}

function StatCard({ title, value, sub, trend, icon: Icon, accent, glowColor }: {
  title: string; value: string; sub: string; trend: "up" | "down" | "flat";
  icon: React.ElementType; accent: string; glowColor: string;
}) {
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor = trend === "up" ? "#10B981" : trend === "down" ? "#F43F5E" : "#6B7280";
  return (
    <div className="rounded-xl p-5 flex flex-col gap-4" style={{ background: "var(--bg-card)", border: `1px solid ${accent}28`, boxShadow: `0 0 20px ${glowColor}` }}>
      <div className="flex items-start justify-between">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${accent}18`, border: `1px solid ${accent}30` }}>
          <Icon size={18} style={{ color: accent }} />
        </div>
        <div className="flex items-center gap-1.5" style={{ color: trendColor }}>
          <TrendIcon size={13} />
          <span className="text-xs font-medium" style={{ fontFamily: "'Chakra Petch', sans-serif" }}>{sub}</span>
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold text-white font-display leading-tight">{value}</p>
        <p className="text-xs mt-1" style={{ color: "#6B7280", fontFamily: "'Chakra Petch', sans-serif" }}>{title}</p>
      </div>
    </div>
  );
}
