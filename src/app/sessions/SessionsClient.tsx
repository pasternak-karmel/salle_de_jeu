"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatMontant, formatDuree, calculerMontant, dureeDepuisDebut } from "@/lib/utils";
import MachineTimer from "@/components/Sessions/MachineTimer";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Play, Square, X, Gamepad2, Monitor, Glasses, Joystick, Zap, Star,
  Smartphone, Banknote, CreditCard, Check, Timer,
} from "lucide-react";

type Client = { id: string; nom: string; prenom: string };
type Machine = { id: string; nom: string; type: string; prixHeure: number; statut: string };
type Session = {
  id: string; debut: string | Date; fin?: string | Date | null;
  dureeMinutes?: number | null; montant?: number | null; statut: string;
  client: Client; machine: Machine;
  paiement?: { statut: string; methode: string } | null;
};

const TYPE_ICONS: Record<string, React.ElementType> = {
  PS5: Gamepad2, PC: Monitor, VR: Glasses, XBOX: Joystick, SWITCH: Zap, AUTRE: Star,
};

export default function SessionsClient({
  sessions, clients, machines,
}: {
  sessions: Session[]; clients: Client[]; machines: Machine[];
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [terminerModal, setTerminerModal] = useState<Session | null>(null);
  const [form, setForm] = useState({ clientId: "", machineId: "", dureePrevu: "" });
  const [filtre, setFiltre] = useState<"TOUTES" | "EN_COURS" | "TERMINEE">("TOUTES");

  const disponibles = machines.filter((m) => m.statut === "DISPONIBLE");
  const enCours = sessions.filter((s) => s.statut === "EN_COURS");

  async function demarrer(e: React.FormEvent) {
    e.preventDefault();
    setLoading("create");
    await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: form.clientId,
        machineId: form.machineId,
        dureePrevu: form.dureePrevu ? Number(form.dureePrevu) : null,
      }),
    });
    setLoading(null);
    setShowForm(false);
    setForm({ clientId: "", machineId: "", dureePrevu: "" });
    router.refresh();
  }

  async function terminer(session: Session, methode: string) {
    setLoading(session.id);
    await fetch(`/api/sessions/${session.id}/terminer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ methode }),
    });
    setLoading(null);
    setTerminerModal(null);
    router.refresh();
  }

  const filtered = sessions.filter((s) => filtre === "TOUTES" || s.statut === filtre);

  return (
    <div className="space-y-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl text-white font-display">Sessions</h1>
          <p className="text-sm mt-1" style={{ color: "#6B7280", fontFamily: "'Chakra Petch', sans-serif" }}>
            <span style={{ color: "#A78BFA" }}>{enCours.length} en cours</span>
            <span style={{ color: "#4B5563" }}> · {sessions.length} au total</span>
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="btn-primary"
          disabled={disponibles.length === 0}
        >
          <Play size={14} />
          Démarrer session
        </button>
      </div>

      {/* Sessions en cours */}
      {enCours.length > 0 && (
        <div>
          <p className="section-title">En cours</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {enCours.map((s) => {
              const mins = dureeDepuisDebut(s.debut);
              const montantEst = calculerMontant(s.machine.prixHeure, mins);
              const Icon = TYPE_ICONS[s.machine.type] ?? Star;
              return (
                <div key={s.id} className="card-purple" style={{ position: "relative", overflow: "hidden" }}>
                  <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: "linear-gradient(90deg, #7C3AED, #7C3AED44)" }} />
                  <div className="flex items-start justify-between mb-3 pt-1">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "rgba(124,58,237,0.18)", border: "1px solid rgba(124,58,237,0.3)" }}>
                      <Icon size={16} style={{ color: "#A78BFA" }} />
                    </div>
                    <span className="badge badge-purple">En cours</span>
                  </div>
                  <p className="font-semibold text-white text-sm" style={{ fontFamily: "'Chakra Petch', sans-serif" }}>
                    {s.machine.nom}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "#9CA3AF", fontFamily: "'Chakra Petch', sans-serif" }}>
                    {s.client.prenom} {s.client.nom}
                  </p>
                  <div className="mt-3 flex items-center justify-between">
                    <MachineTimer debut={s.debut} />
                    <span className="text-sm font-semibold" style={{ color: "#10B981", fontFamily: "'Chakra Petch', sans-serif" }}>
                      {formatMontant(montantEst)}
                    </span>
                  </div>

                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Historique */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="section-title mb-0">Historique</p>
          <div className="flex gap-1.5">
            {(["TOUTES", "EN_COURS", "TERMINEE"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFiltre(f)}
                className="text-xs px-3 py-1 rounded-full border transition-all duration-150 cursor-pointer"
                style={
                  filtre === f
                    ? { background: "#7C3AED", borderColor: "#7C3AED", color: "#fff" }
                    : { background: "transparent", borderColor: "rgba(124,58,237,0.22)", color: "#6B7280" }
                }
              >
                {f === "TOUTES" ? "Toutes" : f === "EN_COURS" ? "En cours" : "Terminées"}
              </button>
            ))}
          </div>
        </div>

        <div className="card overflow-hidden p-0">
          <table className="data-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Poste</th>
                <th>Début</th>
                <th>Durée</th>
                <th>Montant</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const Icon = TYPE_ICONS[s.machine.type] ?? Star;
                return (
                  <tr key={s.id}>
                    <td className="text-white font-medium" style={{ fontFamily: "'Chakra Petch', sans-serif" }}>
                      {s.client.prenom} {s.client.nom}
                    </td>
                    <td>
                      <span className="inline-flex items-center gap-1.5" style={{ color: "#9CA3AF", fontFamily: "'Chakra Petch', sans-serif" }}>
                        <Icon size={13} />
                        {s.machine.nom}
                      </span>
                    </td>
                    <td style={{ color: "#6B7280", fontFamily: "'Chakra Petch', sans-serif" }}>
                      {format(new Date(s.debut), "dd MMM HH:mm", { locale: fr })}
                    </td>
                    <td style={{ fontFamily: "'Chakra Petch', sans-serif" }}>
                      {s.dureeMinutes
                        ? <span style={{ color: "#9CA3AF" }}>{formatDuree(s.dureeMinutes)}</span>
                        : <MachineTimer debut={s.debut} />
                      }
                    </td>
                    <td className="font-medium" style={{ color: "#10B981", fontFamily: "'Chakra Petch', sans-serif" }}>
                      {s.montant ? formatMontant(s.montant) : "—"}
                    </td>
                    <td>
                      <span className={`badge ${
                        s.statut === "EN_COURS" ? "badge-purple" :
                        s.statut === "TERMINEE" ? "badge-green" : "badge-red"
                      }`}>
                        {s.statut === "EN_COURS" ? "En cours" : s.statut === "TERMINEE" ? "Terminée" : "Annulée"}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-10" style={{ color: "#4B5563", fontFamily: "'Chakra Petch', sans-serif" }}>
                    Aucune session
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal démarrer session */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}>
          <div
            className="w-full max-w-md rounded-2xl p-6"
            style={{
              background: "var(--bg-raised)",
              border: "1px solid rgba(124,58,237,0.3)",
              boxShadow: "0 0 40px rgba(124,58,237,0.2)",
            }}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base text-white font-display">Démarrer une session</h2>
              <button
                onClick={() => setShowForm(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-colors"
                style={{ background: "rgba(124,58,237,0.1)", color: "#6B7280" }}
              >
                <X size={14} />
              </button>
            </div>

            {disponibles.length === 0 ? (
              <>
                <p className="text-sm mb-4" style={{ color: "#F59E0B", fontFamily: "'Chakra Petch', sans-serif" }}>
                  Tous les postes sont occupés ou en maintenance.
                </p>
                <button onClick={() => setShowForm(false)} className="btn-secondary w-full">Fermer</button>
              </>
            ) : (
              <form onSubmit={demarrer} className="space-y-4">
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: "#6B7280", fontFamily: "'Chakra Petch', sans-serif" }}>Client</label>
                  <select
                    className="input"
                    value={form.clientId}
                    onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                    required
                  >
                    <option value="">— Sélectionner un client —</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: "#6B7280", fontFamily: "'Chakra Petch', sans-serif" }}>Poste</label>
                  <select
                    className="input"
                    value={form.machineId}
                    onChange={(e) => setForm({ ...form, machineId: e.target.value })}
                    required
                  >
                    <option value="">— Sélectionner un poste —</option>
                    {disponibles.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nom} — {formatMontant(m.prixHeure)}/h
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: "#6B7280", fontFamily: "'Chakra Petch', sans-serif" }}>Durée prévue (secondes)</label>
                  <input
                    type="number"
                    className="input"
                    placeholder="Ex: 30 (laisser vide = illimitée)"
                    min={1}
                    value={form.dureePrevu}
                    onChange={(e) => setForm({ ...form, dureePrevu: e.target.value })}
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">Annuler</button>
                  <button type="submit" disabled={loading === "create"} className="btn-primary flex-1">
                    <Play size={14} />
                    {loading === "create" ? "..." : "Démarrer"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal terminer */}
      {terminerModal && (
        <TerminerModal
          session={terminerModal}
          onClose={() => setTerminerModal(null)}
          onConfirm={terminer}
          loading={loading === terminerModal.id}
        />
      )}
    </div>
  );
}

function TerminerModal({
  session, onClose, onConfirm, loading,
}: {
  session: Session;
  onClose: () => void;
  onConfirm: (s: Session, methode: string) => void;
  loading: boolean;
}) {
  const [methode, setMethode] = useState<"CASH" | "FEEXPAY" | "CARTE">("CASH");
  const [telephone, setTelephone] = useState("");
  const [feexpayLoading, setFeexpayLoading] = useState(false);
  const [feexpayUrl, setFeexpayUrl] = useState<string | null>(null);

  const mins = dureeDepuisDebut(session.debut);
  const montant = calculerMontant(session.machine.prixHeure, mins);

  async function payerFeexPay() {
    if (!telephone) return;
    setFeexpayLoading(true);
    const res = await fetch("/api/feexpay/initier", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: session.id, telephone, montant }),
    });
    const data = await res.json();
    setFeexpayLoading(false);
    if (data.payment_url) {
      setFeexpayUrl(data.payment_url);
      window.open(data.payment_url, "_blank");
    }
  }

  const METHODES = [
    { id: "CASH",    label: "Cash",    icon: Banknote   },
    { id: "FEEXPAY", label: "FeexPay", icon: Smartphone },
    { id: "CARTE",   label: "Carte",   icon: CreditCard },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}>
      <div
        className="w-full max-w-md rounded-2xl p-6"
        style={{
          background: "var(--bg-raised)",
          border: "1px solid rgba(124,58,237,0.3)",
          boxShadow: "0 0 40px rgba(124,58,237,0.2)",
        }}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base text-white font-display">Terminer la session</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer"
            style={{ background: "rgba(124,58,237,0.1)", color: "#6B7280" }}
          >
            <X size={14} />
          </button>
        </div>
        <p className="text-xs mb-5" style={{ color: "#6B7280", fontFamily: "'Chakra Petch', sans-serif" }}>
          {session.client.prenom} {session.client.nom} · {session.machine.nom}
        </p>

        {/* Résumé */}
        <div
          className="rounded-xl p-4 mb-5 flex justify-between items-center"
          style={{ background: "var(--bg-void)", border: "1px solid rgba(124,58,237,0.15)" }}
        >
          <div>
            <p className="text-xs mb-1" style={{ color: "#6B7280", fontFamily: "'Chakra Petch', sans-serif" }}>Durée</p>
            <div className="inline-flex items-center gap-1.5 text-white text-xl font-bold font-display">
              <Timer size={18} style={{ color: "#A78BFA" }} />
              {formatDuree(mins)}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs mb-1" style={{ color: "#6B7280", fontFamily: "'Chakra Petch', sans-serif" }}>Montant</p>
            <p className="text-xl font-bold font-display" style={{ color: "#10B981" }}>
              {formatMontant(montant)}
            </p>
          </div>
        </div>

        {/* Méthode de paiement */}
        <p className="text-xs mb-2" style={{ color: "#6B7280", fontFamily: "'Chakra Petch', sans-serif" }}>
          Mode de paiement
        </p>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {METHODES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setMethode(id)}
              className="py-2.5 rounded-lg border transition-all duration-150 cursor-pointer text-xs flex flex-col items-center gap-1.5"
              style={
                methode === id
                  ? { background: "rgba(124,58,237,0.2)", borderColor: "#7C3AED", color: "#C4B5FD" }
                  : { background: "transparent", borderColor: "rgba(124,58,237,0.18)", color: "#6B7280" }
              }
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>

        {methode === "FEEXPAY" && (
          <div className="mb-4 space-y-2">
            <input
              className="input"
              placeholder="Numéro téléphone (ex: 97000000)"
              value={telephone}
              onChange={(e) => setTelephone(e.target.value)}
            />
            {!feexpayUrl ? (
              <button
                onClick={payerFeexPay}
                disabled={feexpayLoading || !telephone}
                className="btn-primary w-full text-sm"
              >
                <Smartphone size={14} />
                {feexpayLoading ? "Initialisation..." : "Envoyer la demande"}
              </button>
            ) : (
              <div className="text-center space-y-1">
                <p className="text-sm flex items-center justify-center gap-1.5" style={{ color: "#10B981" }}>
                  <Check size={14} /> Demande envoyée
                </p>
                <a
                  href={feexpayUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs underline"
                  style={{ color: "#A78BFA" }}
                >
                  Ouvrir le lien de paiement
                </a>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Annuler</button>
          <button
            onClick={() => onConfirm(session, methode)}
            disabled={loading}
            className="btn-primary flex-1"
          >
            {loading ? "..." : "Confirmer & Terminer"}
          </button>
        </div>
      </div>
    </div>
  );
}