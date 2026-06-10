"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatMontant } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Search, Plus, ChevronRight, X } from "lucide-react";

type Client = {
  id: string; nom: string; prenom: string;
  telephone?: string | null; email?: string | null;
  dateInscription: string | Date;
  nbSessions: number; totalDepense: number;
};

export default function ClientsClient({ clients }: { clients: Client[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ nom: "", prenom: "", telephone: "", email: "" });

  const filtered = clients.filter(
    (c) => `${c.prenom} ${c.nom} ${c.telephone ?? ""} ${c.email ?? ""}`.toLowerCase().includes(search.toLowerCase())
  );

  async function creerClient(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setLoading(false);
    setShowForm(false);
    setForm({ nom: "", prenom: "", telephone: "", email: "" });
    router.refresh();
  }

  function initials(prenom: string, nom: string) {
    return `${prenom[0] ?? ""}${nom[0] ?? ""}`.toUpperCase();
  }

  const AVATAR_COLORS = ["#7C3AED", "#06B6D4", "#10B981", "#F59E0B", "#F43F5E", "#A78BFA"];

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl text-white font-display">Clients</h1>
          <p className="text-sm mt-1" style={{ color: "#6B7280", fontFamily: "'Chakra Petch', sans-serif" }}>
            {clients.length} clients inscrits
          </p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          <Plus size={15} />
          Nouveau client
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#6B7280" }} />
        <input
          className="input pl-9"
          placeholder="Rechercher par nom, téléphone, email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        <table className="data-table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Contact</th>
              <th>Inscrit le</th>
              <th>Sessions</th>
              <th>Total dépensé</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c, i) => {
              const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
              return (
                <tr key={c.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{
                          background: `${color}28`,
                          border: `1px solid ${color}40`,
                          color,
                          fontFamily: "'Russo One', sans-serif",
                        }}
                      >
                        {initials(c.prenom, c.nom)}
                      </div>
                      <span className="text-white font-medium" style={{ fontFamily: "'Chakra Petch', sans-serif" }}>
                        {c.prenom} {c.nom}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontFamily: "'Chakra Petch', sans-serif" }}>
                      <p className="text-sm" style={{ color: "#9CA3AF" }}>{c.telephone ?? "—"}</p>
                      {c.email && <p className="text-xs" style={{ color: "#6B7280" }}>{c.email}</p>}
                    </div>
                  </td>
                  <td style={{ color: "#6B7280", fontFamily: "'Chakra Petch', sans-serif", fontSize: "0.8125rem" }}>
                    {format(new Date(c.dateInscription), "dd MMM yyyy", { locale: fr })}
                  </td>
                  <td>
                    <span
                      className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-sm font-semibold"
                      style={{
                        background: "rgba(124,58,237,0.12)",
                        color: "#A78BFA",
                        fontFamily: "'Chakra Petch', sans-serif",
                      }}
                    >
                      {c.nbSessions}
                    </span>
                  </td>
                  <td className="font-semibold" style={{ color: "#10B981", fontFamily: "'Chakra Petch', sans-serif" }}>
                    {formatMontant(c.totalDepense)}
                  </td>
                  <td>
                    <Link
                      href={`/clients/${c.id}`}
                      className="inline-flex items-center gap-1 text-xs transition-colors cursor-pointer"
                      style={{ color: "#A78BFA" }}
                    >
                      Voir <ChevronRight size={12} />
                    </Link>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-10" style={{ color: "#4B5563", fontFamily: "'Chakra Petch', sans-serif" }}>
                  Aucun client trouvé
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
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
              <h2 className="text-base text-white font-display">Nouveau client</h2>
              <button
                onClick={() => setShowForm(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer"
                style={{ background: "rgba(124,58,237,0.1)", color: "#6B7280" }}
              >
                <X size={14} />
              </button>
            </div>

            <form onSubmit={creerClient} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: "#6B7280", fontFamily: "'Chakra Petch', sans-serif" }}>Prénom</label>
                  <input className="input" value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} required placeholder="Koffi" />
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: "#6B7280", fontFamily: "'Chakra Petch', sans-serif" }}>Nom</label>
                  <input className="input" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} required placeholder="Agossou" />
                </div>
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "#6B7280", fontFamily: "'Chakra Petch', sans-serif" }}>Téléphone</label>
                <input className="input" value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} placeholder="+229 97 00 00 00" />
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "#6B7280", fontFamily: "'Chakra Petch', sans-serif" }}>Email (optionnel)</label>
                <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">Annuler</button>
                <button type="submit" disabled={loading} className="btn-primary flex-1">
                  <Plus size={14} />
                  {loading ? "..." : "Créer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
