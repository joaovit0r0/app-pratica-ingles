// Gera supabase/seed.sql a partir de src/conteudo/aulas.json.
// Uso: npm run seed  →  depois rode o SQL gerado no SQL Editor do Supabase (ou `supabase db reset` localmente).
import fs from "node:fs";
const aulas = JSON.parse(fs.readFileSync(new URL("../src/conteudo/aulas.json", import.meta.url), "utf8"));
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const linhas = aulas.map((a) => {
  const { id, ordem, extra, ...conteudo } = a;
  return `(${q(id)}, ${ordem}, ${extra ? "true" : "false"}, ${q(JSON.stringify(conteudo))}::jsonb)`;
});
const sql = `-- Gerado por scripts/gerar-seed.mjs. Não edite à mão.
insert into public.aulas (id, ordem, extra, conteudo) values
${linhas.join(",\n")}
on conflict (id) do update set ordem = excluded.ordem, extra = excluded.extra, conteudo = excluded.conteudo, atualizado_em = now();
`;
fs.writeFileSync(new URL("../supabase/seed.sql", import.meta.url), sql);
console.log(`seed.sql com ${aulas.length} aulas`);
