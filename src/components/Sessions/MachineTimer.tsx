"use client";

import { useEffect, useState } from "react";
import { formatDuree, dureeDepuisDebut } from "@/lib/utils";
import { Timer } from "lucide-react";

export default function MachineTimer({ debut }: { debut: string | Date }) {
  const [minutes, setMinutes] = useState(() => dureeDepuisDebut(debut));

  useEffect(() => {
    const id = setInterval(() => setMinutes(dureeDepuisDebut(debut)), 30000);
    return () => clearInterval(id);
  }, [debut]);

  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: "#A78BFA", fontFamily: "'Chakra Petch', sans-serif" }}>
      <Timer size={13} />
      {formatDuree(minutes)}
    </span>
  );
}
