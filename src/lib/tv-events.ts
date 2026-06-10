import { EventEmitter } from 'events';

declare global {
  // eslint-disable-next-line no-var
  var _tvEmitter: EventEmitter | undefined;
}

export const tvEmitter: EventEmitter = globalThis._tvEmitter ?? new EventEmitter();
globalThis._tvEmitter = tvEmitter;
tvEmitter.setMaxListeners(200);

export type TVMachineEvent = {
  machineId: string;
  statut: string;
  machineName: string;
  machineType: string;
  session: {
    id: string;
    debut: string;
    dureePrevu: number | null;
    client: { nom: string; prenom: string };
  } | null;
};

export function emitMachineUpdate(event: TVMachineEvent): void {
  tvEmitter.emit(`machine:${event.machineId}`, event);
}
