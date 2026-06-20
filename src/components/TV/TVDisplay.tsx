"use client";

import { useEffect, useRef, useState } from "react";
import type { TVMachineEvent } from "@/lib/tv-events";

const TYPE_ICONS: Record<string, string> = {
  PS5: "🎮", PC: "🖥️", VR: "🥽", XBOX: "🕹️", SWITCH: "🎲", AUTRE: "🎯",
};

function formatTimer(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatHeure(isoDate: string): string {
  return new Date(isoDate).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export default function TVDisplay({
  machineId,
  initialEvent,
}: {
  machineId: string;
  initialEvent: TVMachineEvent;
}) {
  const [state, setState] = useState<TVMachineEvent>(initialEvent);
  const [remaining, setRemaining] = useState<number | null>(null); // secondes restantes
  const [elapsed, setElapsed] = useState(0);                        // secondes écoulées (si pas de durée prévue)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showEnd, setShowEnd] = useState(false);

  // Connexion SSE
  useEffect(() => {
    const es = new EventSource(`/api/tv/${machineId}/sse`);
    es.onmessage = (e) => {
      const event: TVMachineEvent = JSON.parse(e.data);
      setState((prev) => {
        if (prev.statut === "OCCUPEE" && event.statut !== "OCCUPEE") {
          setShowEnd(true);
          setTimeout(() => setShowEnd(false), 6000);
        }
        return event;
      });
    };
    return () => es.close();
  }, [machineId]);

  // Timer : compte à rebours si dureePrevu, sinon chrono montant
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (state.session?.debut) {
      const start = new Date(state.session.debut).getTime();
      const dureePrevu = state.session.dureePrevu; // en minutes

      const tick = () => {
        const elapsedSec = Math.floor((Date.now() - start) / 1000);
        if (dureePrevu) {
          const totalSec = dureePrevu * 60;
          const rem = Math.max(0, totalSec - elapsedSec);
          setRemaining(rem);
        } else {
          setElapsed(elapsedSec);
          setRemaining(null);
        }
      };

      tick();
      timerRef.current = setInterval(tick, 1000);
    } else {
      setElapsed(0);
      setRemaining(null);
    }

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [state.session?.debut, state.session?.dureePrevu]);

  // Écran de fin de session
  if (showEnd) {
    return (
      <div className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center">
        <div className="text-center">
          <p className="text-7xl mb-6">🎮</p>
          <h1 className="text-5xl font-bold text-white mb-4">Session terminée</h1>
          <p className="text-2xl text-gray-400">Merci et à bientôt !</p>
        </div>
      </div>
    );
  }

  const icon = TYPE_ICONS[state.machineType] ?? "🎯";

  // Écran de veille — poste disponible
  if (state.statut !== "OCCUPEE" || !state.session) {
    return (
      <div className="fixed inset-0 z-[9999] bg-[#0a0a14] flex flex-col items-center justify-center">
        <div className="text-center opacity-30">
          <p className="text-9xl mb-6">{icon}</p>
          <h2 className="text-3xl font-semibold text-white">{state.machineName}</h2>
          <p className="text-xl text-gray-500 mt-3">En attente d&apos;une session…</p>
        </div>
      </div>
    );
  }

  // Couleur du compte à rebours selon le temps restant
  const { session } = state;
  const hasCountdown = remaining !== null;
  const isUrgent = hasCountdown && remaining! <= 60;       // dernière minute → rouge
  const isWarning = hasCountdown && remaining! <= 5 * 60;  // 5 dernières minutes → orange

  const timerColor = isUrgent
    ? "#EF4444"
    : isWarning
    ? "#F59E0B"
    : "#A78BFA"; // violet par défaut

  const displayTime = hasCountdown ? formatTimer(remaining!) : formatTimer(elapsed);

  return (
    <div className="fixed inset-0 z-[9999] bg-[#0f0f1a] flex flex-col items-center justify-center select-none">
      {/* Badge en cours */}
      <div className="absolute top-8 right-8">
        <span className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-purple-900/60 border border-purple-600 text-purple-300 text-xl font-semibold">
          <span className="w-3 h-3 rounded-full bg-purple-400 animate-pulse" />
          En cours
        </span>
      </div>

      {/* Icône + nom poste */}
      <div className="text-center mb-10">
        <p className="text-7xl mb-3">{icon}</p>
        <h2 className="text-2xl font-semibold text-gray-400">{state.machineName}</h2>
      </div>

      {/* Nom machine */}
      <h1 className="text-6xl font-bold text-white mb-10">
        {state.machineName}
      </h1>

      {/* Timer */}
      <div
        className="font-mono text-9xl font-extrabold tracking-widest mb-4 transition-colors duration-500"
        style={{ color: timerColor }}
      >
        {displayTime}
      </div>

      {/* Label sous le timer */}
      <p className="text-xl mb-6" style={{ color: "#6B7280" }}>
        {hasCountdown
          ? isUrgent
            ? "⚠️ Temps presque écoulé !"
            : "Temps restant"
          : "Temps écoulé"}
      </p>

      {/* Heure de début + durée prévue */}
      <p className="text-2xl text-gray-500">
        Démarré à {formatHeure(session.debut)}
        {session.dureePrevu ? ` · ${session.dureePrevu} min prévues` : ""}
      </p>
    </div>
  );
}
