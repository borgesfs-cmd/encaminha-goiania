// Planilha → app. Lê as abas Serviços, Políticas e Temas (exportadas do Google Planilhas como JSON)
// e grava no index.html só o que difere dos dados de base do código, no bloco <script id="dados-planilha">.
// Entrada: um JSON {servicos: [[cabeçalho...], [linha...]], politicas: [...], temas: [...]},
// no formato devolvido pela leitura de valores do Google Planilhas.
// Uso: node scripts/planilha-para-app.mjs caminho/planilha.json [saida.html]   (sem saída, atualiza o index.html)
import { chromium } from "playwright";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = fileURLToPath(new URL("..", import.meta.url));
const entrada = JSON.parse(readFileSync(process.argv[2], "utf8"));
const html = readFileSync(raiz + "index.html", "utf8");
const BLOCO = /(<script type="application\/json" id="dados-planilha">)([\s\S]*?)(<\/script>)/;
if (!BLOCO.test(html)) throw new Error("Bloco dados-planilha não encontrado no index.html");

// Dados de base: o app com o bloco vazio
const tmp = mkdtempSync(join(tmpdir(), "encaminha-"));
writeFileSync(join(tmp, "index.html"), html.replace(BLOCO, "$1{}$3"));
const b = await chromium.launch();
const p = await b.newPage();
await p.route(/fonts\.(googleapis|gstatic)\.com|script\.google\.com/, (r) => r.abort());
await p.goto("file://" + join(tmp, "index.html"), { waitUntil: "domcontentloaded" });
// As abas viram objetos com a mesma função que o site usa ao ler a planilha ao vivo
const { servicos, politicas, temas } = await p.evaluate((e) => window.EncaminhaMotor.tabelasParaPlanilha(e), entrada);
const base = await p.evaluate(() => {
  const D = window.EncaminhaMotor._dados;
  return { S: D.S, P: D.P.map((x) => ({ id: x.id, nome: x.nome, val: x.val, flow: x.flow, docs: x.docs || [], extra: x.extra || [], curto: D.CURTO[x.id] || "" })), T: D.TEMAS };
});
await b.close();

const norm = (v) => String(v ?? "").replace(/\s+/g, " ").trim();
const lst = (v, sep) => String(v || "").split(sep).map((x) => x.trim()).filter(Boolean).join("|");
const avisos = [];
const bS = new Map(base.S.map((s) => [s.id, s]));
const difS = servicos.filter((r) => {
  const o = bS.get(r.id);
  if (!o) return true;
  if (r.situacao === "Inativo") return true;
  if (r.conferido || r.situacao === "A conferir") return true;
  return ["nome", "tipo", "mun", "end", "email", "hor", "site", "obs"].some((k) => norm(r[k]) !== norm(o[k])) || norm(r.reg) !== norm(o.reg) || lst(r.tel, "/") !== (o.tel || []).join("|");
});
const bP = new Map(base.P.map((x) => [x.id, x]));
const difP = politicas.filter((r) => {
  const o = bP.get(r.id);
  if (!o) { avisos.push(`Política "${r.id}" não existe no app (políticas novas precisam de critério no código).`); return false; }
  return norm(r.nome) !== norm(o.nome) || norm(r.val) !== norm(o.val) || lst(r.flow, "\n") !== o.flow.join("|") || lst(r.docs, "\n") !== o.docs.join("|") || lst(r.extra, ",") !== o.extra.join("|") || norm(r.curto) !== norm(o.curto);
});
const bT = new Map(base.T.map((t) => [t.k, t]));
const difT = temas.filter((r) => {
  const o = bT.get(r.k);
  if (!o) return true;
  return norm(r.t) !== norm(o.t) || lst(r.palavras, ",") !== o.palavras.join("|") || lst(r.passos, "\n") !== (o.passos || []).join("|") || lst(r.servicos, ",") !== (o.servicos || []).join("|") || lst(r.on, ",") !== (o.on || []).join("|") || norm(r.urg) !== norm(String(o.urg || "").replace(/<[^>]+>/g, ""));
});

// Conferências: contatos citados precisam existir
const ids = new Set([...base.S.map((s) => s.id), ...servicos.map((s) => s.id)]);
servicos.filter((s) => s.situacao === "Inativo").forEach((s) => ids.delete(s.id));
politicas.forEach((r) => lst(r.extra, ",").split("|").filter(Boolean).forEach((e) => ids.has(e) || avisos.push(`Política ${r.id} cita contato inexistente ou inativo: ${e}`)));
temas.forEach((r) => lst(r.servicos, ",").split("|").filter(Boolean).forEach((e) => ids.has(e) || avisos.push(`Tema ${r.k} cita contato inexistente ou inativo: ${e}`)));
temas.forEach((r) => { if (!lst(r.palavras, ",")) avisos.push(`Tema ${r.k} sem palavras-chave`); });

const bloco = { geradoEm: new Date().toISOString().slice(0, 10), servicos: difS, politicas: difP, temas: difT };
const json = JSON.stringify(bloco).replace(/</g, "\\u003c");
writeFileSync(process.argv[3] || raiz + "index.html", html.replace(BLOCO, (_, a, __, c) => a + json + c));
console.log(`Serviços alterados, novos ou desativados: ${difS.length} · Políticas com texto alterado: ${difP.length} · Temas alterados ou novos: ${difT.length}`);
avisos.forEach((a) => console.log("AVISO: " + a));
