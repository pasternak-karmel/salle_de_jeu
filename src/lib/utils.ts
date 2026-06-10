export function formatMontant(montant: number): string {
  return new Intl.NumberFormat("fr-BJ", {
    style: "currency",
    currency: "XOF",
    minimumFractionDigits: 0,
  }).format(montant);
}

export function formatDuree(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${m.toString().padStart(2, "0")}`;
}

export function calculerMontant(prixHeure: number, minutes: number): number {
  return Math.ceil((prixHeure * minutes) / 60);
}

export function dureeDepuisDebut(debut: Date | string): number {
  return Math.floor((Date.now() - new Date(debut).getTime()) / 60000);
}
