// localStorage persistence + JSON backup.

const KEY = '4runner.v1';

// Price: rough Tucson premium (91) default — TRD recommends premium for the supercharger.
// Replaced automatically by the real price from each fill-up receipt.
export const fresh = () => ({
  v: 1,
  drivers: [],
  trips: [],
  fills: [],
  payments: [],
  settings: { price: 4.19, mpg: 14 },
  onboarded: false,
});

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    return { ...fresh(), ...JSON.parse(raw) };
  } catch {
    return fresh();
  }
}

export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage full or blocked; the in-memory state still works for this session.
  }
}

export function exportFile(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const name = `4runner-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([blob], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) return navigator.share({ files: [file] }).catch(() => {});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export async function importFile(file) {
  const data = JSON.parse(await file.text());
  if (!Array.isArray(data.drivers) || !Array.isArray(data.fills)) throw new Error('Not a 4Runner backup');
  return { ...fresh(), ...data };
}
