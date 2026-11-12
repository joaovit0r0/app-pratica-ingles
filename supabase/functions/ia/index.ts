// Edge Function "ia": repassa pedidos ao Google Gemini guardando a chave no servidor.
// A chave fica no secret GEMINI_API_KEY (supabase secrets set GEMINI_API_KEY=...).
// Só usuários logados chamam esta função (verificação de JWT padrão do Supabase).
// Recebe: { sistema: string, mensagens: [{ papel: "eu" | "ia", texto: string }], temperatura?: number, max?: number }
// Devolve: o JSON que o modelo gerou (o prompt sempre pede JSON).

const BASE = "https://generativelanguage.googleapis.com/v1beta/";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

type Mensagem = { papel: "eu" | "ia"; texto: string };
let modelos: string[] | null = null;

function json(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

// Escolhe um modelo "flash" disponível para a chave, sem depender de um nome fixo que pode mudar.
async function descobrirModelos(chave: string): Promise<string[]> {
  if (modelos) return modelos;
  const r = await fetch(BASE + "models?pageSize=200", { headers: { "x-goog-api-key": chave } });
  if (!r.ok) throw new Error("Gemini recusou a chave (" + r.status + ")");
  const j = await r.json();
  const lista = (j.models || [])
    .filter((m: { name: string; supportedGenerationMethods?: string[] }) =>
      (m.supportedGenerationMethods || []).includes("generateContent") && /flash/.test(m.name) &&
      !/(image|tts|audio|live|embedding|exp|thinking|vision|native)/.test(m.name))
    .map((m: { name: string }) => {
      const nome = m.name.replace(/^models\//, "");
      const versao = parseFloat((nome.match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || "0");
      return { nome, versao, lite: /lite/.test(nome), preview: /preview/.test(nome) };
    })
    .sort((a: any, b: any) => (a.preview !== b.preview ? (a.preview ? 1 : -1) : a.versao !== b.versao ? b.versao - a.versao : a.lite !== b.lite ? (a.lite ? 1 : -1) : a.nome.length - b.nome.length));
  if (!lista.length) throw new Error("Nenhum modelo de texto disponível para esta chave");
  const principal = lista[0].nome;
  const reserva = (lista.find((c: any) => c.lite && !c.preview) || lista[1] || lista[0]).nome;
  modelos = [...new Set([principal, reserva])];
  return modelos;
}

function extrairJSON(texto: string) {
  const limpo = texto.replace(/^```(?:json)?/i, "").replace(/```\s*$/, "").trim();
  try { return JSON.parse(limpo); } catch {
    const a = limpo.indexOf("{"), b = limpo.lastIndexOf("}");
    if (a >= 0 && b > a) return JSON.parse(limpo.slice(a, b + 1));
    throw new Error("Resposta fora do formato JSON");
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ erro: "Use POST" }, 405);
  const chave = Deno.env.get("GEMINI_API_KEY");
  if (!chave) return json({ erro: "A chave do Gemini não foi configurada no Supabase (secret GEMINI_API_KEY)." }, 500);

  let pedido: { sistema: string; mensagens: Mensagem[]; temperatura?: number; max?: number };
  try { pedido = await req.json(); } catch { return json({ erro: "Pedido inválido" }, 400); }
  if (!pedido?.sistema || !Array.isArray(pedido.mensagens) || !pedido.mensagens.length) return json({ erro: "Pedido incompleto" }, 400);
  if (pedido.mensagens.length > 60 || JSON.stringify(pedido).length > 60000) return json({ erro: "Conversa longa demais" }, 413);

  const corpo = {
    systemInstruction: { parts: [{ text: pedido.sistema }] },
    contents: pedido.mensagens.map((m) => ({ role: m.papel === "ia" ? "model" : "user", parts: [{ text: String(m.texto) }] })),
    generationConfig: { temperature: pedido.temperatura ?? 0.7, responseMimeType: "application/json", maxOutputTokens: Math.min(pedido.max ?? 1024, 4096) }
  };

  let lista: string[];
  try { lista = await descobrirModelos(chave); } catch (e) { return json({ erro: (e as Error).message }, 502); }

  let ultimo = "A IA não respondeu";
  for (const modelo of lista) {
    const r = await fetch(BASE + "models/" + modelo + ":generateContent", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": chave },
      body: JSON.stringify(corpo)
    });
    if (r.status === 429) { ultimo = "limite"; continue; }
    if (r.status === 404) { modelos = null; ultimo = "Modelo indisponível, tente de novo"; continue; }
    if (!r.ok) { ultimo = "Gemini respondeu " + r.status; continue; }
    const j = await r.json();
    const partes = j?.candidates?.[0]?.content?.parts || [];
    const texto = partes.filter((p: { thought?: boolean }) => !p.thought).map((p: { text?: string }) => p.text || "").join("");
    try { return json(extrairJSON(texto)); } catch (e) { ultimo = (e as Error).message; }
  }
  if (ultimo === "limite") return json({ erro: "Vocês usaram o limite gratuito da IA por agora. Espere um minuto e tente de novo.", codigo: "limite" }, 429);
  return json({ erro: ultimo }, 502);
});
