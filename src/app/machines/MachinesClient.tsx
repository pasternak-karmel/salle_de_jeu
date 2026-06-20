"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatMontant } from "@/lib/utils";
import MachineTimer from "@/components/Sessions/MachineTimer";
import {
  Plus, Pencil, Wrench, CheckCircle, Gamepad2, Monitor, Glasses,
  Joystick, Zap, Star, Tv2, X,
} from "lucide-react";

type Machine = {
  id: string;
  nom: string;
  type: string;
  prixHeure: number;
  statut: string;
  tvMac: string | null;
  tvIp: string | null;
  tvToken?: string | null;
  sessions: {
    id: string;
    debut: string | Date;
  }[];
};

const TYPE_ICONS: Record<string, React.ElementType> = {
  PS5: Gamepad2, PC: Monitor, VR: Glasses, XBOX: Joystick, SWITCH: Zap, AUTRE: Star,
};

const TYPE_LABELS: Record<string, string> = {
  PS5: "PS5", PC: "PC", VR: "VR", XBOX: "Xbox", SWITCH: "Switch", AUTRE: "Autre",
};

const STATUT_CONFIG: Record<string, { label: string; badge: string; accent: string; glow: string; cardClass: string }> = {
  DISPONIBLE: { label: "Libre",       badge: "badge-blue",   accent: "#06B6D4", glow: "rgba(6,182,212,0.2)",   cardClass: "card-cyan"   },
  OCCUPEE:    { label: "Occupé",      badge: "badge-purple", accent: "#7C3AED", glow: "rgba(124,58,237,0.2)",  cardClass: "card-purple" },
  MAINTENANCE:{ label: "Maintenance", badge: "badge-yellow", accent: "#F59E0B", glow: "rgba(245,158,11,0.18)", cardClass: "card-amber"  },
};

export default function MachinesClient({ machines }: { machines: Machine[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [editMachine, setEditMachine] = useState<Machine | null>(null);
  const [form, setForm] = useState({ nom: "", type: "PS5", prixHeure: "1500", tvMac: "", tvIp: "" });

  const dispo    = machines.filter((m) => m.statut === "DISPONIBLE").length;
  const occupees = machines.filter((m) => m.statut === "OCCUPEE").length;

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setLoading("create");
    const url    = editMachine ? `/api/machines/${editMachine.id}` : "/api/machines";
    const method = editMachine ? "PATCH" : "POST";
    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        prixHeure: Number(form.prixHeure),
        tvMac: form.tvMac.trim() || null,
        tvIp:  form.tvIp.trim()  || null,
      }),
    });
    setLoading(null);
    setShowForm(false);
    setEditMachine(null);
    setForm({ nom: "", type: "PS5", prixHeure: "1500", tvMac: "", tvIp: "" });
    router.refresh();
  }

  async function changerStatut(id: string, statut: string) {
    setLoading(id);
    await fetch(`/api/machines/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statut }),
    });
    setLoading(null);
    router.refresh();
  }

  async function appairer(id: string) {
    setLoading(`pair-${id}`);
    try {
      const res  = await fetch(`/api/tv/${id}/pair`, { method: "POST" });
      const data = await res.json();
      if (res.ok) { alert("✅ TV appairée !"); router.refresh(); }
      else         { alert(`❌ ${data.error}`); }
    } catch {
      alert("❌ Impossible de contacter la TV.");
    }
    setLoading(null);
  }

  function openEdit(m: Machine) {
    setEditMachine(m);
    setForm({ nom: m.nom, type: m.type, prixHeure: String(m.prixHeure), tvMac: m.tvMac ?? "", tvIp: m.tvIp ?? "" });
    setShowForm(true);
  }

  function openCreate() {
    setEditMachine(null);
    setForm({ nom: "", type: "PS5", prixHeure: "1500", tvMac: "", tvIp: "" });
    setShowForm(true);
  }

  return (
    <div className="space-y-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl text-white font-display">Postes de jeu</h1>
          <p className="text-sm mt-1" style={{ color: "#6B7280", fontFamily: "'Chakra Petch', sans-serif" }}>
            <span style={{ color: "#06B6D4" }}>{dispo} libres</span>
            <span style={{ color: "#4B5563" }}> · </span>
            <span style={{ color: "#A78BFA" }}>{occupees} occupés</span>
            <span style={{ color: "#4B5563" }}> · {machines.length} au total</span>
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus size={15} />
          Ajouter poste
        </button>
      </div>

      {/* Machine grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {machines.map((m) => {
          const session = m.sessions[0];
          const cfg  = STATUT_CONFIG[m.statut] ?? STATUT_CONFIG.DISPONIBLE;
          const Icon = TYPE_ICONS[m.type] ?? Star;

          return (
            <div key={m.id} className={cfg.cardClass} style={{ position: "relative", overflow: "hidden" }}>
              <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: `linear-gradient(90deg, ${cfg.accent}, ${cfg.accent}44)` }} />

              <div className="flex items-start justify-between mb-4 pt-1">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${cfg.accent}18`, border: `1px solid ${cfg.accent}30` }}>
                  <Icon size={18} style={{ color: cfg.accent }} />
                </div>
                <span className={`badge ${cfg.badge}`}>{cfg.label}</span>
              </div>

              <div className="mb-1">
                <h3 className="font-semibold text-white text-sm leading-tight" style={{ fontFamily: "'Chakra Petch', sans-serif" }}>
                  {m.nom}
                </h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs" style={{ color: "#6B7280", fontFamily: "'Chakra Petch', sans-serif" }}>
                    {TYPE_LABELS[m.type]} · {formatMontant(m.prixHeure)}/h
                  </span>
                  {(m.tvMac || m.tvIp) && (
                    <div className="ml-auto flex items-center gap-2">
                      {m.tvIp && (
                        <button
                          onClick={() => appairer(m.id)}
                          disabled={loading === `pair-${m.id}`}
                          className="text-xs px-2 py-0.5 rounded cursor-pointer transition-colors"
                          style={{
                            background: m.tvToken ? "rgba(16,185,129,0.1)" : "rgba(124,58,237,0.15)",
                            color:      m.tvToken ? "#10B981"               : "#A78BFA",
                            border:     `1px solid ${m.tvToken ? "rgba(16,185,129,0.3)" : "rgba(124,58,237,0.3)"}`,
                          }}
                          title={m.tvToken ? "TV appairée — cliquer pour ré-appairer" : "Appairer la TV"}
                        >
                          {loading === `pair-${m.id}` ? "Accepte sur la TV…" : m.tvToken ? "✓ Appairée" : "Appairer"}
                        </button>
                      )}
                      <a href={`/tv/${m.id}`} target="_blank" rel="noreferrer" className="cursor-pointer transition-colors" style={{ color: "#A78BFA" }} title="Ouvrir la page TV">
                        <Tv2 size={13} />
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Session en cours : juste le chrono, plus de nom client */}
              {session && (
                <div className="mt-3 pt-3" style={{ borderTop: "1px solid rgba(124,58,237,0.12)" }}>
                  <MachineTimer debut={session.debut} />
                </div>
              )}

              <div className="mt-4 flex gap-2">
                <button onClick={() => openEdit(m)} className="btn-secondary text-xs py-1.5 px-2.5 flex-1">
                  <Pencil size={12} />
                  Modifier
                </button>
                {m.statut !== "MAINTENANCE" ? (
                  <button
                    onClick={() => changerStatut(m.id, "MAINTENANCE")}
                    disabled={loading === m.id || m.statut === "OCCUPEE"}
                    className="btn-secondary text-xs py-1.5 px-2.5 flex-1"
                  >
                    <Wrench size={12} />
                    {loading === m.id ? "..." : "Maint."}
                  </button>
                ) : (
                  <button
                    onClick={() => changerStatut(m.id, "DISPONIBLE")}
                    disabled={loading === m.id}
                    className="btn-primary text-xs py-1.5 px-2.5 flex-1"
                  >
                    <CheckCircle size={12} />
                    {loading === m.id ? "..." : "Remettre"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal ajout/édition */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ background: "var(--bg-raised)", border: "1px solid rgba(124,58,237,0.3)", boxShadow: "0 0 40px rgba(124,58,237,0.2)" }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base text-white font-display">{editMachine ? "Modifier le poste" : "Ajouter un poste"}</h2>
              <button onClick={() => { setShowForm(false); setEditMachine(null); }} className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer" style={{ background: "rgba(124,58,237,0.1)", color: "#6B7280" }}>
                <X size={14} />
              </button>
            </div>

            <form onSubmit={soumettre} className="space-y-4">
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "#6B7280", fontFamily: "'Chakra Petch', sans-serif" }}>Nom du poste</label>
                <input className="input" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} required placeholder="PS5 — Station 1" />
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "#6B7280", fontFamily: "'Chakra Petch', sans-serif" }}>Type</label>
                <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  {["PS5", "PC", "VR", "XBOX", "SWITCH", "AUTRE"].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "#6B7280", fontFamily: "'Chakra Petch', sans-serif" }}>Prix par heure (FCFA)</label>
                <input className="input" type="number" value={form.prixHeure} onChange={(e) => setForm({ ...form, prixHeure: e.target.value })} required min="100" />
              </div>

              <div className="pt-1" style={{ borderTop: "1px solid rgba(124,58,237,0.12)" }}>
                <div className="flex items-center gap-2 mb-3 mt-1">
                  <Tv2 size={13} style={{ color: "#A78BFA" }} />
                  <p className="text-xs" style={{ color: "#A78BFA", fontFamily: "'Chakra Petch', sans-serif" }}>Smart TV associée (optionnel)</p>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs mb-1.5" style={{ color: "#6B7280", fontFamily: "'Chakra Petch', sans-serif" }}>Adresse MAC (Wake-on-LAN)</label>
                    <input className="input font-mono" value={form.tvMac} onChange={(e) => setForm({ ...form, tvMac: e.target.value })} placeholder="AA:BB:CC:DD:EE:FF" />
                  </div>
                  <div>
                    <label className="block text-xs mb-1.5" style={{ color: "#6B7280", fontFamily: "'Chakra Petch', sans-serif" }}>Adresse IP (extinction Samsung)</label>
                    <input className="input font-mono" value={form.tvIp} onChange={(e) => setForm({ ...form, tvIp: e.target.value })} placeholder="192.168.1.50" />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowForm(false); setEditMachine(null); }} className="btn-secondary flex-1">Annuler</button>
                <button type="submit" disabled={loading === "create"} className="btn-primary flex-1">
                  {loading === "create" ? "..." : editMachine ? "Mettre à jour" : "Ajouter"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
