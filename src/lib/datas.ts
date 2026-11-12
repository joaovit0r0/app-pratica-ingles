export function hoje(d: Date = new Date()): string {
  const z = (n: number) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + z(d.getMonth() + 1) + "-" + z(d.getDate());
}
export function somarDias(base: string, n: number): string {
  const d = new Date(base + "T12:00:00");
  d.setDate(d.getDate() + n);
  return hoje(d);
}
export function dataBR(iso: string): string { return iso.split("-").reverse().join("/"); }
