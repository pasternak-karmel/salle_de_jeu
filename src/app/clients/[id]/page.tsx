import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { formatMontant, formatDuree } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import Link from "next/link";
import { ChevronLeft, Phone, Mail, Gamepad2, Monitor, Glasses, Joystick, Zap, Star } from "lucide-react";

export const revalidate = 0;

const TYPE_ICONS: Record<string, React.ElementType> = {
  PS5: Gamepad2, PC: Monitor, VR: Glasses, XBOX: Joystick, SWITCH: Zap, AUTRE: Star,
};

const AVATAR_GRADIENT = "linear-gradient(135deg, #7C3AED 0%, #06B6D4 100%)";

export default async function ClientDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      sessions: {
        orderBy: { debut: "desc" },
        include: {
          machine: { select: { nom: true, type: true } },
          paiement: { select: { statut: true, methode: true, montant: true } },
        },
      },
    },
  });

  if (!client) notFound();

  const terminées = client.sessions.filter((s) => s.statut === "TERMINEE");
  const totalDepense = terminées.reduce((s, x) => s + (x.montant ?? 0), 0);
  const dureeTotal = terminées.reduce((s, x) => s + (x.dureeMinutes ?? 0), 0);

  const kpis = [
    { label: "Sessions totales", value: String(client.sessions.length), accent: "#A78BFA" },
    { label: "Total dépensé",    value: formatMontant(totalDepense),     accent: "#10B981" },
    { label: "Temps de jeu",     value: formatDuree(dureeTotal),         accent: "#06B6D4" },
  ];

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Back */}
      <Link
        href="/clients"
        className="inline-flex items-center gap-1.5 text-sm transition-colors cursor-pointer"
        style={{ color: "#6B7280", fontFamily: "'Chakra Petch', sans-serif" }}
      >
        <ChevronLeft size={15} /> Clients
      </Link>

      {/* Profile card */}
      <div className="card flex items-center gap-5">
        <div
          className="w-16 h-16 rounded-xl flex items-center justify-center text-white text-xl font-bold flex-shrink-0"
          style={{
            background: AVATAR_GRADIENT,
            boxShadow: "0 0 20px rgba(124,58,237,0.35)",
            fontFamily: "'Russo One', sans-serif",
          }}
        >
          {client.prenom[0]}{client.nom[0]}
        </div>
        <div className="flex-1">
          <h1 className="text-xl text-white font-display">
            {client.prenom} {client.nom}
          </h1>
          <div className="flex flex-wrap gap-4 mt-2">
            {client.telephone && (
              <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: "#9CA3AF", fontFamily: "'Chakra Petch', sans-serif" }}>
                <Phone size={12} /> {client.telephone}
              </span>
            )}
            {client.email && (
              <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: "#9CA3AF", fontFamily: "'Chakra Petch', sans-serif" }}>
                <Mail size={12} /> {client.email}
              </span>
            )}
            <span className="text-xs" style={{ color: "#6B7280", fontFamily: "'Chakra Petch', sans-serif" }}>
              Inscrit le {format(new Date(client.dateInscription), "dd MMM yyyy", { locale: fr })}
            </span>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        {kpis.map(({ label, value, accent }) => (
          <div
            key={label}
            className="rounded-xl p-4 text-center"
            style={{
              background: "var(--bg-card)",
              border: `1px solid ${accent}25`,
              boxShadow: `0 0 16px ${accent}18`,
            }}
          >
            <p className="text-2xl font-bold font-display" style={{ color: accent }}>{value}</p>
            <p className="text-xs mt-1" style={{ color: "#6B7280", fontFamily: "'Chakra Petch', sans-serif" }}>
              {label}
            </p>
          </div>
        ))}
      </div>

      {/* Sessions history */}
      <div>
        <p className="section-title">Historique des visites</p>
        <div className="card overflow-hidden p-0">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Poste</th>
                <th>Durée</th>
                <th>Montant</th>
                <th>Paiement</th>
              </tr>
            </thead>
            <tbody>
              {client.sessions.map((s) => {
                const Icon = TYPE_ICONS[s.machine.type] ?? Star;
                return (
                  <tr key={s.id}>
                    <td style={{ color: "#9CA3AF", fontFamily: "'Chakra Petch', sans-serif", fontSize: "0.8125rem" }}>
                      {format(new Date(s.debut), "dd MMM yyyy HH:mm", { locale: fr })}
                    </td>
                    <td>
                      <span className="inline-flex items-center gap-1.5" style={{ color: "#9CA3AF", fontFamily: "'Chakra Petch', sans-serif" }}>
                        <Icon size={13} /> {s.machine.nom}
                      </span>
                    </td>
                    <td style={{ color: "#9CA3AF", fontFamily: "'Chakra Petch', sans-serif" }}>
                      {s.dureeMinutes ? formatDuree(s.dureeMinutes) : (
                        <span className="badge badge-purple">En cours</span>
                      )}
                    </td>
                    <td className="font-medium" style={{ color: "#10B981", fontFamily: "'Chakra Petch', sans-serif" }}>
                      {s.montant ? formatMontant(s.montant) : "—"}
                    </td>
                    <td>
                      {s.paiement ? (
                        <span className={`badge ${s.paiement.statut === "PAYE" ? "badge-green" : "badge-yellow"}`}>
                          {s.paiement.methode} · {s.paiement.statut === "PAYE" ? "Payé" : "En attente"}
                        </span>
                      ) : (
                        <span style={{ color: "#4B5563" }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {client.sessions.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-10" style={{ color: "#4B5563", fontFamily: "'Chakra Petch', sans-serif" }}>
                    Aucune session
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
