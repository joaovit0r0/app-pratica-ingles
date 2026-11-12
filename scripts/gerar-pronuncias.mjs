// Gera src/pronuncia/pronuncias.json com as pronúncias (IPA) das palavras das aulas.
// Palavras que não estiverem aqui são buscadas no dicionário completo, carregado sob demanda.
import fs from "node:fs";
import { dictionary } from "cmu-pronouncing-dictionary";
import { deArpa } from "../src/pronuncia/arpa.js";
const aulas = JSON.parse(fs.readFileSync(new URL("../src/conteudo/aulas.json", import.meta.url), "utf8"));
const textos = [];
for (const a of aulas) {
  for (const b of a.blocos || []) textos.push(b.en);
  for (const d of a.dialogos || []) for (const l of d.linhas) textos.push(l.en);
  for (const p of a.diario || []) textos.push(p);
}
const palavras = new Set();
for (const t of textos) for (let w of t.toLowerCase().replace(/[’]/g, "'").replace(/_{2,}/g, " ").split(/[^a-z']+/)) { w = w.replace(/^'+|'+$/g, ""); if (w) palavras.add(w); }
const out = {}; const faltando = [];
for (const w of [...palavras].sort()) {
  const v = [];
  for (const k of [w, w + "(2)", w + "(3)", w + "(4)"]) if (dictionary[k]) v.push(deArpa(dictionary[k]));
  if (v.length) out[w] = [...new Set(v)]; else faltando.push(w);
}
fs.writeFileSync(new URL("../src/pronuncia/pronuncias.json", import.meta.url), JSON.stringify(out));
console.log(Object.keys(out).length + " palavras; sem pronúncia: " + (faltando.join(", ") || "nenhuma"));
