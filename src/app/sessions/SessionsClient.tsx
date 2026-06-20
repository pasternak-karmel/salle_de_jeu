"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { formatMontant, formatDuree, calculerMontant } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Play, X, Gamepad2, Monitor, Glasses, Joystick, Zap, Star,
  Smartphone, Banknote, Timer, Loader2, CheckCircle2, AlertCircle,
  Tv, CreditCard,
} from "lucide-react";

type Machine = { id: string; nom: string; type: string; prixHeure: number; statut: string };
type Session = {
  id: string; debut: string | Date; fin?: string | Date | null;
  dureePrevu: number | null; dureeMinutes?: number | null; montant?: number | null; statut: string;
  machine: Machine;
  paiement?: { statut: string; methode: string } | null;
};

const TYPE_ICONS: Record<string, React.ElementType> = {
  PS5: Gamepad2, PC: Monitor, VR: Glasses, XBOX: Joystick, SWITCH: Zap, AUTRE: Star,
};

// ─── UTILS TEMPS ─────────────────────────────────────────────────────────────

function minutesEcoulees(debut: string | Date): number {
  return Math.floor((Date.now() - new Date(debut).getTime()) / 60000);
}

function secondesEcoulees(debut: string | Date): number {
  return Math.floor((Date.now() - new Date(debut).getTime()) / 1000);
}

function formatChrono(totalSecondes: number): string {
  const h = Math.floor(totalSecondes / 3600);
  const m = Math.floor((totalSecondes % 3600) / 60);
  const s = totalSecondes % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ─── COMPOSANT TIMER TEMPS RÉEL ────────────────────────────────────────────────

function LiveTimer({ debut, dureePrevu, prixHeure }: { debut: string | Date; dureePrevu: number | null; prixHeure: number }) {
  const [secondes, setSecondes] = useState(() => secondesEcoulees(debut));

  useEffect(() => {
    const t = setInterval(() => setSecondes(secondesEcoulees(debut)), 1000);
    return () => clearInterval(t);
  }, [debut]);

  const pct  = dureePrevu ? Math.min(100, Math.round((secondes / 60 / dureePrevu) * 100)) : null;
  const urgent = pct !== null && pct >= 80;
  const montant = calculerMontant(prixHeure, Math.floor(secondes / 60));

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-mono text-sm font-bold" style={{ color: urgent ? "#F87171" : "#A78BFA", fontFamily: "'Chakra Petch', sans-serif" }}>
          {formatChrono(secondes)}
        </span>
        <span className="text-sm font-semibold" style={{ color: "#10B981", fontFamily: "'Chakra Petch', sans-serif" }}>
          {formatMontant(montant)}
        </span>
      </div>
      {pct !== null && (
        <>
          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                width: `${pct}%`,
                background: urgent
                  ? "linear-gradient(90deg, #F59E0B, #EF4444)"
                  : "linear-gradient(90deg, #7C3AED, #06B6D4)",
              }}
            />
          </div>
          <p className="text-xs mt-1" style={{ color: urgent ? "#F87171" : "#4B5563", fontFamily: "'Chakra Petch', sans-serif" }}>
            {pct}% · {dureePrevu ? formatDuree(Math.max(0, dureePrevu - Math.floor(secondes / 60))) : ""} restant
          </p>
        </>
      )}
    </div>
  );
}

// ─── PAGE PRINCIPALE ──────────────────────────────────────────────────────────

export default function SessionsClient({
  sessions: initialSessions, machines,
}: {
  sessions: Session[]; machines: Machine[];
}) {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>(initialSessions);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [paiementModal, setPaiementModal] = useState<Session | null>(null);
  const [form, setForm] = useState({ machineId: "", dureePrevu: "" });
  const [filtre, setFiltre] = useState<"TOUTES" | "EN_COURS" | "TERMINEE">("TOUTES");

  const disponibles = machines.filter((m) => m.statut === "DISPONIBLE");
  const enCours     = sessions.filter((s) => s.statut === "EN_COURS");

  // ── Polling pour détecter la fin automatique de session ─────────────────────
  // Toutes les 10s, on récupère les sessions. Si une session EN_COURS dans notre
  // state est maintenant TERMINEE dans l'API → ouvrir la modale de paiement.
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pollSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/sessions");
      if (!res.ok) return;
      const fresh: Session[] = await res.json();

      setSessions((prev) => {
        // Chercher les sessions qui viennent de passer EN_COURS → TERMINEE
        for (const old of prev) {
          if (old.statut === "EN_COURS") {
            const updated = fresh.find((s) => s.id === old.id);
            if (updated && updated.statut === "TERMINEE" && !updated.paiement) {
              // Déclencher la modale (hors du render — setTimeout 0)
              setTimeout(() => setPaiementModal(updated), 0);
            }
          }
        }
        return fresh;
      });
    } catch { /* silencieux */ }
  }, []);

  useEffect(() => {
    pollRef.current = setInterval(pollSessions, 10_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [pollSessions]);

  // ── Démarrer session ────────────────────────────────────────────────────────
  async function demarrer(e: React.FormEvent) {
    e.preventDefault();
    const duree = Number(form.dureePrevu);
    if (!duree || duree <= 0) return;
    setLoading("create");
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ machineId: form.machineId, dureePrevu: duree }),
    });
    setLoading(null);
    if (res.ok) {
      setShowForm(false);
      setForm({ machineId: "", dureePrevu: "" });
      router.refresh();
    }
  }

  // ── Terminer manuellement ───────────────────────────────────────────────────
  async function terminerSession(session: Session) {
    setLoading(session.id);
    const res = await fetch(`/api/sessions/${session.id}/terminer`, { method: "POST" });
    setLoading(null);
    if (res.ok) {
      const data = await res.json();
      const updated: Session = { ...session, montant: data.montant, dureeMinutes: data.dureeMinutes, statut: "TERMINEE" };
      setSessions((prev) => prev.map((s) => s.id === session.id ? updated : s));
      setPaiementModal(updated);
      router.refresh();
    }
  }

  // ── Sessions terminées non payées ───────────────────────────────────────────
  const nonPayees = sessions.filter(
    (s) => s.statut === "TERMINEE" && (!s.paiement || s.paiement.statut !== "PAYE")
  );

  const filtered = sessions.filter((s) => filtre === "TOUTES" || s.statut === filtre);

  return (
    <div className="space-y-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl text-white font-display">Sessions</h1>
          <p className="text-sm mt-1" style={{ color: "#6B7280", fontFamily: "'Chakra Petch', sans-serif" }}>
            <span style={{ color: "#A78BFA" }}>{enCours.length} en cours</span>
            {nonPayees.length > 0 && (
              <span style={{ color: "#F87171" }}> · {nonPayees.length} non payée{nonPayees.length > 1 ? "s" : ""}</span>
            )}
            <span style={{ color: "#4B5563" }}> · {sessions.length} au total</span>
          </p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary" disabled={disponibles.length === 0}>
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
                  <LiveTimer debut={s.debut} dureePrevu={s.dureePrevu} prixHeure={s.machine.prixHeure} />
                  <button
                    onClick={() => terminerSession(s)}
                    disabled={loading === s.id}
                    className="mt-3 w-full text-xs py-1.5 rounded-lg border cursor-pointer transition-all duration-150 flex items-center justify-center gap-1.5"
                    style={{ borderColor: "rgba(239,68,68,0.35)", color: "#F87171", background: "rgba(239,68,68,0.06)" }}
                  >
                    {loading === s.id ? <Loader2 size={12} className="animate-spin" /> : <Tv size={12} />}
                    {loading === s.id ? "Arrêt…" : "Terminer & Éteindre TV"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sessions non payées */}
      {nonPayees.length > 0 && (
        <div>
          <p className="section-title" style={{ color: "#F87171" }}>À encaisser</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {nonPayees.map((s) => {
              const Icon = TYPE_ICONS[s.machine.type] ?? Star;
              return (
                <button
                  key={s.id}
                  onClick={() => setPaiementModal(s)}
                  className="card text-left transition-all duration-150 cursor-pointer w-full"
                  style={{
                    border: "1px solid rgba(239,68,68,0.35)",
                    background: "rgba(239,68,68,0.05)",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: "linear-gradient(90deg, #EF4444, #EF444422)" }} />
                  <div className="flex items-start justify-between mb-3 pt-1">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)" }}>
                      <Icon size={16} style={{ color: "#F87171" }} />
                    </div>
                    <span className="badge badge-red">Non payée</span>
                  </div>
                  <p className="font-semibold text-white text-sm" style={{ fontFamily: "'Chakra Petch', sans-serif" }}>{s.machine.nom}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs" style={{ color: "#6B7280", fontFamily: "'Chakra Petch', sans-serif" }}>
                      {s.dureeMinutes ? formatDuree(s.dureeMinutes) : "—"}
                    </span>
                    <span className="font-bold text-sm" style={{ color: "#10B981", fontFamily: "'Chakra Petch', sans-serif" }}>
                      {s.montant ? formatMontant(s.montant) : "—"}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-center gap-2 py-1.5 rounded-lg"
                    style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#F87171" }}>
                    <CreditCard size={13} />
                    <span className="text-xs font-semibold" style={{ fontFamily: "'Chakra Petch', sans-serif" }}>Encaisser</span>
                  </div>
                </button>
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
              <button key={f} onClick={() => setFiltre(f)}
                className="text-xs px-3 py-1 rounded-full border transition-all duration-150 cursor-pointer"
                style={filtre === f
                  ? { background: "#7C3AED", borderColor: "#7C3AED", color: "#fff" }
                  : { background: "transparent", borderColor: "rgba(124,58,237,0.22)", color: "#6B7280" }
                }>
                {f === "TOUTES" ? "Toutes" : f === "EN_COURS" ? "En cours" : "Terminées"}
              </button>
            ))}
          </div>
        </div>
        <div className="card overflow-hidden p-0">
          <table className="data-table">
            <thead>
              <tr>
                <th>Poste</th>
                <th>Début</th>
                <th>Durée prévue</th>
                <th>Durée réelle</th>
                <th>Montant</th>
                <th>Paiement</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const Icon = TYPE_ICONS[s.machine.type] ?? Star;
                const nonPayee = s.statut === "TERMINEE" && (!s.paiement || s.paiement.statut !== "PAYE");
                return (
                  <tr
                    key={s.id}
                    onClick={nonPayee ? () => setPaiementModal(s) : undefined}
                    style={nonPayee ? { cursor: "pointer" } : {}}
                    className={nonPayee ? "hover:bg-red-500/5 transition-colors" : ""}
                  >
                    <td>
                      <span className="inline-flex items-center gap-1.5 text-white font-medium" style={{ fontFamily: "'Chakra Petch', sans-serif" }}>
                        <Icon size={13} style={{ color: "#A78BFA" }} />
                        {s.machine.nom}
                      </span>
                    </td>
                    <td style={{ color: "#6B7280", fontFamily: "'Chakra Petch', sans-serif", fontSize: "0.8125rem" }}>
                      {format(new Date(s.debut), "dd MMM HH:mm", { locale: fr })}
                    </td>
                    <td style={{ color: "#9CA3AF", fontFamily: "'Chakra Petch', sans-serif" }}>
                      {s.dureePrevu ? formatDuree(s.dureePrevu) : "—"}
                    </td>
                    <td style={{ color: "#9CA3AF", fontFamily: "'Chakra Petch', sans-serif" }}>
                      {s.dureeMinutes ? formatDuree(s.dureeMinutes) : s.statut === "EN_COURS" ? <span style={{ color: "#A78BFA" }}>En cours</span> : "—"}
                    </td>
                    <td className="font-medium" style={{ color: "#10B981", fontFamily: "'Chakra Petch', sans-serif" }}>
                      {s.montant ? formatMontant(s.montant) : "—"}
                    </td>
                    <td>
                      {s.paiement ? (
                        <span className={`badge ${s.paiement.statut === "PAYE" ? "badge-green" : "badge-yellow"}`}>
                          {s.paiement.methode} · {s.paiement.statut === "PAYE" ? "Payé" : "Attente"}
                        </span>
                      ) : s.statut === "TERMINEE" ? (
                        <span className="badge badge-red">Non payé</span>
                      ) : (
                        <span style={{ color: "#4B5563" }}>—</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${s.statut === "EN_COURS" ? "badge-purple" : s.statut === "TERMINEE" ? "badge-green" : "badge-red"}`}>
                        {s.statut === "EN_COURS" ? "En cours" : s.statut === "TERMINEE" ? "Terminée" : "Annulée"}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center py-10" style={{ color: "#4B5563", fontFamily: "'Chakra Petch', sans-serif" }}>Aucune session</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal démarrer session */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}>
          <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: "var(--bg-raised)", border: "1px solid rgba(124,58,237,0.3)", boxShadow: "0 0 40px rgba(124,58,237,0.2)" }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base text-white font-display">Démarrer une session</h2>
              <button onClick={() => setShowForm(false)} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer" style={{ background: "rgba(124,58,237,0.1)", color: "#6B7280" }}>
                <X size={14} />
              </button>
            </div>
            {disponibles.length === 0 ? (
              <>
                <p className="text-sm mb-4" style={{ color: "#F59E0B", fontFamily: "'Chakra Petch', sans-serif" }}>Tous les postes sont occupés ou en maintenance.</p>
                <button onClick={() => setShowForm(false)} className="btn-secondary w-full">Fermer</button>
              </>
            ) : (
              <form onSubmit={demarrer} className="space-y-4">
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: "#6B7280", fontFamily: "'Chakra Petch', sans-serif" }}>Poste</label>
                  <select className="input" value={form.machineId} onChange={(e) => setForm({ ...form, machineId: e.target.value })} required>
                    <option value="">— Sélectionner un poste —</option>
                    {disponibles.map((m) => (
                      <option key={m.id} value={m.id}>{m.nom} — {formatMontant(m.prixHeure)}/h</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: "#6B7280", fontFamily: "'Chakra Petch', sans-serif" }}>
                    Durée (minutes) <span style={{ color: "#F87171" }}>*</span>
                  </label>
                  <div className="grid grid-cols-4 gap-1.5 mb-2">
                    {[30, 60, 90, 120].map((d) => (
                      <button key={d} type="button" onClick={() => setForm({ ...form, dureePrevu: String(d) })}
                        className="py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all"
                        style={form.dureePrevu === String(d)
                          ? { background: "rgba(124,58,237,0.25)", borderColor: "#7C3AED", color: "#C4B5FD" }
                          : { background: "transparent", borderColor: "rgba(124,58,237,0.18)", color: "#6B7280" }
                        }>
                        {d}min
                      </button>
                    ))}
                  </div>
                  <input type="number" className="input" placeholder="Ou saisir manuellement…" min={1} max={480}
                    value={form.dureePrevu} onChange={(e) => setForm({ ...form, dureePrevu: e.target.value })} required />
                  <p className="text-xs mt-1" style={{ color: "#4B5563" }}>La TV s&apos;éteindra automatiquement à la fin.</p>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">Annuler</button>
                  <button type="submit" disabled={loading === "create"} className="btn-primary flex-1">
                    <Play size={14} />
                    {loading === "create" ? "…" : "Démarrer"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal paiement */}
      {paiementModal && (
        <PaiementModal
          session={paiementModal}
          onClose={() => {
            setPaiementModal(null);
            // Mettre à jour localement le paiement
            pollSessions();
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

// ─── MODAL PAIEMENT ───────────────────────────────────────────────────────────

type PaiementStep = "choix" | "momo_saisie" | "momo_attente" | "momo_succes" | "momo_echec" | "cash_succes";

function PaiementModal({ session, onClose }: { session: Session; onClose: () => void }) {
  const [step, setStep] = useState<PaiementStep>("choix");
  const [telephone, setTelephone] = useState("");
  const [network, setNetwork] = useState<"mtn" | "moov">("mtn");
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState("");
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const montant = session.montant ?? 0;
  const duree   = session.dureeMinutes ?? 0;

  function stopPolling() {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
  }
  useEffect(() => () => stopPolling(), []);

  async function payerCash() {
    setLoading(true);
    const res = await fetch(`/api/sessions/${session.id}/payer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ methode: "CASH" }),
    });
    setLoading(false);
    if (res.ok) setStep("cash_succes");
    else setErreur("Erreur lors de l'enregistrement du paiement cash.");
  }

  async function initierMomo() {
    if (!telephone) return;
    setLoading(true);
    setErreur("");
    const res = await fetch(`/api/sessions/${session.id}/payer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ methode: "MOMO", telephone, network }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok || !data.reference) {
      setErreur(data.error ?? "Erreur lors de l'envoi de la demande.");
      return;
    }
    setStep("momo_attente");
    pollingRef.current = setInterval(async () => {
      const r = await fetch(`/api/sessions/${session.id}/payer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ methode: "POLL", reference: data.reference }),
      });
      const d = await r.json();
      if (d.status === "SUCCESSFUL") { stopPolling(); setStep("momo_succes"); }
      else if (["FAILED", "CANCELLED", "EXPIRED"].includes(d.status)) { stopPolling(); setStep("momo_echec"); }
    }, 5000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)" }}>
      <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: "var(--bg-raised)", border: "1px solid rgba(124,58,237,0.35)", boxShadow: "0 0 60px rgba(124,58,237,0.25)" }}>

        {(step === "cash_succes" || step === "momo_succes") && (
          <div className="text-center py-4 space-y-4">
            <CheckCircle2 size={48} className="mx-auto" style={{ color: "#10B981" }} />
            <div>
              <p className="text-white font-display text-lg">Paiement enregistré</p>
              <p className="text-sm mt-1" style={{ color: "#9CA3AF" }}>
                {formatMontant(montant)} · {formatDuree(duree)} · {step === "cash_succes" ? "Cash" : "Mobile Money"}
              </p>
            </div>
            <button onClick={onClose} className="btn-primary w-full">Fermer</button>
          </div>
        )}

        {step === "momo_echec" && (
          <div className="text-center py-4 space-y-4">
            <AlertCircle size={48} className="mx-auto" style={{ color: "#F87171" }} />
            <div>
              <p className="text-white font-display text-lg">Paiement échoué</p>
              <p className="text-sm mt-1" style={{ color: "#9CA3AF" }}>Le paiement Mobile Money n&apos;a pas abouti.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep("choix")} className="btn-secondary flex-1">Réessayer</button>
              <button onClick={payerCash} className="btn-primary flex-1">Payer cash</button>
            </div>
          </div>
        )}

        {step === "momo_attente" && (
          <div className="text-center py-4 space-y-5">
            <div className="relative w-14 h-14 mx-auto">
              <Smartphone size={28} className="absolute inset-0 m-auto" style={{ color: "#A78BFA" }} />
              <svg className="absolute inset-0 animate-spin" viewBox="0 0 56 56" fill="none">
                <circle cx="28" cy="28" r="26" stroke="#7C3AED" strokeWidth="2" strokeDasharray="40 120" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <p className="text-white font-display">En attente de confirmation</p>
              <p className="text-sm mt-1" style={{ color: "#9CA3AF" }}>
                Demande envoyée au <span style={{ color: "#A78BFA" }}>{telephone}</span>
              </p>
              <p className="text-xs mt-1" style={{ color: "#4B5563" }}>Montant : {formatMontant(montant)}</p>
            </div>
            <div className="text-xs rounded-lg px-3 py-2" style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.15)", color: "#6B7280" }}>
              Le client reçoit une notification sur son téléphone.
            </div>
            <button onClick={() => { stopPolling(); setStep("choix"); }} className="text-xs underline" style={{ color: "#6B7280" }}>
              Annuler et choisir un autre mode
            </button>
          </div>
        )}

        {step === "momo_saisie" && (
          <>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base text-white font-display">Mobile Money</h2>
              <button onClick={() => setStep("choix")} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer" style={{ background: "rgba(124,58,237,0.1)", color: "#6B7280" }}>
                <X size={14} />
              </button>
            </div>
            <div className="rounded-xl p-3 mb-4 flex justify-between" style={{ background: "var(--bg-void)", border: "1px solid rgba(124,58,237,0.15)" }}>
              <div>
                <p className="text-xs" style={{ color: "#6B7280" }}>Durée</p>
                <p className="text-white font-semibold text-sm font-display">{formatDuree(duree)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs" style={{ color: "#6B7280" }}>Montant</p>
                <p className="font-bold text-sm font-display" style={{ color: "#10B981" }}>{formatMontant(montant)}</p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "#6B7280", fontFamily: "'Chakra Petch', sans-serif" }}>Réseau</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["mtn", "moov"] as const).map((n) => (
                    <button key={n} onClick={() => setNetwork(n)} className="py-2 rounded-lg border text-xs font-semibold cursor-pointer transition-all"
                      style={network === n
                        ? { background: "rgba(124,58,237,0.2)", borderColor: "#7C3AED", color: "#C4B5FD" }
                        : { background: "transparent", borderColor: "rgba(124,58,237,0.18)", color: "#6B7280" }
                      }>
                      {n.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "#6B7280", fontFamily: "'Chakra Petch', sans-serif" }}>Numéro de téléphone</label>
                <input className="input" placeholder="97 00 00 00" value={telephone} onChange={(e) => setTelephone(e.target.value)} />
              </div>
              {erreur && <p className="text-xs" style={{ color: "#F87171" }}>{erreur}</p>}
              <div className="flex gap-3 pt-1">
                <button onClick={() => setStep("choix")} className="btn-secondary flex-1">Retour</button>
                <button onClick={initierMomo} disabled={loading || !telephone} className="btn-primary flex-1">
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Smartphone size={14} />}
                  {loading ? "Envoi…" : "Envoyer"}
                </button>
              </div>
            </div>
          </>
        )}

        {step === "choix" && (
          <>
            <div className="text-center mb-5">
              <div className="w-12 h-12 rounded-xl mx-auto flex items-center justify-center mb-3" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)" }}>
                <Tv size={22} style={{ color: "#F87171" }} />
              </div>
              <p className="text-white font-display text-base">Session terminée</p>
              <p className="text-xs mt-1" style={{ color: "#9CA3AF" }}>TV éteinte · {session.machine.nom}</p>
            </div>
            <div className="rounded-xl p-4 mb-5 flex justify-between items-center" style={{ background: "var(--bg-void)", border: "1px solid rgba(124,58,237,0.15)" }}>
              <div>
                <p className="text-xs mb-0.5" style={{ color: "#6B7280" }}>Durée</p>
                <div className="inline-flex items-center gap-1.5 text-white font-bold font-display">
                  <Timer size={16} style={{ color: "#A78BFA" }} />
                  {formatDuree(duree)}
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs mb-0.5" style={{ color: "#6B7280" }}>À payer</p>
                <p className="text-xl font-bold font-display" style={{ color: "#10B981" }}>{formatMontant(montant)}</p>
              </div>
            </div>
            <p className="text-xs mb-3 text-center" style={{ color: "#6B7280", fontFamily: "'Chakra Petch', sans-serif" }}>
              Comment le client souhaite-t-il payer ?
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={payerCash} disabled={loading}
                className="flex flex-col items-center gap-2 py-4 rounded-xl border cursor-pointer transition-all duration-150"
                style={{ background: "rgba(16,185,129,0.08)", borderColor: "rgba(16,185,129,0.3)", color: "#10B981" }}>
                {loading ? <Loader2 size={22} className="animate-spin" /> : <Banknote size={22} />}
                <span className="text-sm font-semibold" style={{ fontFamily: "'Chakra Petch', sans-serif" }}>Cash</span>
              </button>
              <button onClick={() => setStep("momo_saisie")}
                className="flex flex-col items-center gap-2 py-4 rounded-xl border cursor-pointer transition-all duration-150"
                style={{ background: "rgba(124,58,237,0.08)", borderColor: "rgba(124,58,237,0.3)", color: "#A78BFA" }}>
                <Smartphone size={22} />
                <span className="text-sm font-semibold" style={{ fontFamily: "'Chakra Petch', sans-serif" }}>Mobile Money</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
