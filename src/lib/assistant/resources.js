// Before loading the local model (several GB), check the Mac can spare it:
// memory pressure from the kernel and the battery level. If either says no,
// Ask offers Claude for that question instead of loading the model.
import { execFile } from 'node:child_process';

function run(cmd, args) {
  return new Promise((resolve) => execFile(cmd, args, { timeout: 2000 }, (err, out) => resolve(err ? '' : String(out))));
}

// kern.memorystatus_vm_pressure_level: 1 normal, 2 warning, 4 critical.
export function parsePressure(out) {
  const n = Number(String(out).trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

// `pmset -g batt` → { onBattery, percent } (percent null on desktops).
export function parseBattery(out) {
  const s = String(out);
  const m = /(\d{1,3})%/.exec(s);
  return { onBattery: /'Battery Power'/.test(s), percent: m ? Number(m[1]) : null };
}

export const LOW_BATTERY = 20;

/** → { ok: true } or { ok: false, reason } */
export async function canLoadLocalModel() {
  if (process.env.MAGNUS_SKIP_RESOURCE_CHECK) return { ok: true };
  const [pressure, batt] = await Promise.all([run('sysctl', ['-n', 'kern.memorystatus_vm_pressure_level']), run('pmset', ['-g', 'batt'])]);
  const level = parsePressure(pressure);
  if (level && level >= 2) return { ok: false, reason: `memory is ${level >= 4 ? 'critically ' : ''}tight right now` };
  const b = parseBattery(batt);
  if (b.onBattery && b.percent != null && b.percent < LOW_BATTERY) return { ok: false, reason: `the battery is at ${b.percent}%` };
  return { ok: true };
}
