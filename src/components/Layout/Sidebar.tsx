"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Monitor, Timer, CreditCard, Zap } from "lucide-react";

const nav = [
  { href: "/",          label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/machines",  label: "Postes",           icon: Monitor         },
  { href: "/sessions",  label: "Sessions",         icon: Timer           },
  { href: "/paiements", label: "Paiements",        icon: CreditCard      },
];

export default function Sidebar() {
  const path = usePathname();
  return (
    <aside className="w-60 flex flex-col flex-shrink-0" style={{ background: "var(--bg-surface)", borderRight: "1px solid rgba(124,58,237,0.14)" }}>
      <div className="p-5" style={{ borderBottom: "1px solid rgba(124,58,237,0.12)" }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)", boxShadow: "0 0 16px rgba(124,58,237,0.5)" }}>
            <Zap size={18} className="text-white" />
          </div>
          <div>
            <p className="text-white text-sm leading-tight" style={{ fontFamily: "'Russo One', sans-serif" }}>GameZone</p>
            <p className="text-xs mt-0.5" style={{ color: "#4B5563", fontFamily: "'Chakra Petch', sans-serif" }}>Salle de jeu</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-0.5">
        <p className="px-3 pt-2 pb-1.5 text-xs uppercase tracking-widest" style={{ color: "#374151", fontFamily: "'Chakra Petch', sans-serif", letterSpacing: "0.12em" }}>Menu</p>
        {nav.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <Link key={href} href={href} className={`nav-item ${active ? "nav-active" : ""}`}>
              <Icon size={17} className="flex-shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4" style={{ borderTop: "1px solid rgba(124,58,237,0.1)" }}>
        <div className="rounded-lg px-3 py-2" style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.15)" }}>
          <p className="text-xs" style={{ color: "#6B7280", fontFamily: "'Chakra Petch', sans-serif" }}>v1.1 · Cotonou, Bénin</p>
        </div>
      </div>
    </aside>
  );
}
