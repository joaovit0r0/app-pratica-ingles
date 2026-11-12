// Preferências deste aparelho (não vão para o banco).
export type Config = {
  velocidade: number;
  sotaque: "en-US" | "en-GB";
  pronuncia: "local" | "rapido";
  modeloBaixado: boolean;
  perfilAtual: string | null;
};
const CHAVE = "tf:aparelho";
const PADRAO: Config = { velocidade: 0.9, sotaque: "en-US", pronuncia: "local", modeloBaixado: false, perfilAtual: null };

export function lerConfig(): Config {
  try { return { ...PADRAO, ...JSON.parse(localStorage.getItem(CHAVE) || "{}") }; } catch { return { ...PADRAO }; }
}
export function salvarConfig(parcial: Partial<Config>): Config {
  const c = { ...lerConfig(), ...parcial };
  try { localStorage.setItem(CHAVE, JSON.stringify(c)); } catch { /* sem armazenamento */ }
  return c;
}
