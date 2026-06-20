import { prisma } from "@/lib/prisma";
import { formatMontant, formatDuree } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { startOfMonth, startOfDay } from "date-fns";
import { Banknote, Smartphone, TrendingUp } from "lucide-react";

export const revalidate = 0;

export default async function PaiementsPage() {
  const now = new Date();
  const [paiements, revAujourdhui, revMois] = await Promise.all([
    prisma.paiement.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        session: { select: { machine: { select: { nom: true } }, dureeMinutes: true } },
      },
    }),
    prisma.paiement.aggregate({ where: { statut: "PAYE", createdAt: { gte: startOfDay(now) } }, _sum: { montant: true } }),
    prisma.paiement.aggregate({ where: { statut: "PAYE", createdAt: { gte: startOfMonth(now) } }, _sum: { montant: true } }),
  ]);

  const cashTotal  = paiements.filter((p: {methode: string; statut: string}) => p.methode === "CASH" && p.statut === "PAYE").reduce((s: number, p: {montant: number}) => s + p.montant, 0);
  const momoTotal  = paiements.filter((p: {methode: string; statut: string}) => p.methode === "MOMO" && p.statut === "PAYE").reduce((s: number, p: {montant: number}) => s + p.montant, 0);

  const kpis = [
    { label: "Aujourd'hui",    value: formatMontant(revAujourdhui._sum.montant ?? 0), icon: TrendingUp,  accent: "#10B981", glow: "rgba(16,185,129,0.18)" },
    { label: "Ce mois",        value: formatMontant(revMois._sum.montant ?? 0),        icon: Banknote,    accent: "#7C3AED", glow: "rgba(124,58,237,0.2)"  },
    { label: "Cash",           value: formatMontant(cashTotal),                        icon: Banknote,    accent: "#F59E0B", glow: "rgba(245,158,11,0.18)" },
    { label: "Mobile Money",   value: formatMontant(momoTotal),                        icon: Smartphone,  accent: "#06B6D4", glow: "rgba(6,182,212,0.18)"  },
  ];

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl text-white font-display">Paiements</h1>
        <p className="text-sm mt-1" style={{ color: "#6B7280", fontFamily: "'Chakra Petch', sans-serif" }}>Suivi des encaissements</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(({ label, value, icon: Icon, accent, glow }) => (
          <div key={label} className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: `1px solid ${accent}28`, boxShadow: `0 0 18px ${glow}` }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs uppercase tracking-widest" style={{ color: "#6B7280", fontFamily: "'Chakra Petch', sans-serif" }}>{label}</p>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${accent}18`, border: `1px solid ${accent}28` }}>
                <Icon size={14} style={{ color: accent }} />
              </div>
            </div>
            <p className="text-xl font-bold font-display text-white">{value}</p>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden p-0">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Poste</th>
              <th>Durée</th>
              <th>Téléphone</th>
              <th>Montant</th>
              <th>Méthode</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {paiements.map((p: {
              id: string; createdAt: Date|string; montant: number;
              methode: string; statut: string; telephone?: string|null;
              session: { machine: { nom: string }; dureeMinutes?: number|null };
            }) => (
              <tr key={p.id}>
                <td style={{ color: "#6B7280", fontFamily: "'Chakra Petch', sans-serif", fontSize: "0.8125rem" }}>
                  {format(new Date(p.createdAt), "dd MMM HH:mm", { locale: fr })}
                </td>
                <td style={{ color: "#9CA3AF", fontFamily: "'Chakra Petch', sans-serif" }}>{p.session.machine.nom}</td>
                <td style={{ color: "#9CA3AF", fontFamily: "'Chakra Petch', sans-serif" }}>
                  {p.session.dureeMinutes ? formatDuree(p.session.dureeMinutes) : "—"}
                </td>
                <td style={{ color: "#9CA3AF", fontFamily: "'Chakra Petch', sans-serif", fontSize: "0.8125rem" }}>
                  {p.telephone ?? "—"}
                </td>
                <td className="font-semibold" style={{ color: "#10B981", fontFamily: "'Chakra Petch', sans-serif" }}>
                  {formatMontant(p.montant)}
                </td>
                <td>
                  <span className={`badge ${p.methode === "CASH" ? "badge-yellow" : "badge-blue"}`}>
                    {p.methode === "CASH" ? <Banknote size={10} /> : <Smartphone size={10} />}
                    {p.methode === "CASH" ? "Cash" : "MoMo"}
                  </span>
                </td>
                <td>
                  <span className={`badge ${p.statut === "PAYE" ? "badge-green" : p.statut === "EN_ATTENTE" ? "badge-yellow" : "badge-red"}`}>
                    {p.statut === "PAYE" ? "Payé" : p.statut === "EN_ATTENTE" ? "En attente" : "Échoué"}
                  </span>
                </td>
              </tr>
            ))}
            {paiements.length === 0 && (
              <tr><td colSpan={7} className="text-center py-10" style={{ color: "#4B5563", fontFamily: "'Chakra Petch', sans-serif" }}>Aucun paiement</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
