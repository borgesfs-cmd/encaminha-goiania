// App → planilha. Converte os registros anônimos guardados no app (coleção "registros",
// salva em pasta pela leitura do banco do artefato) em linhas da aba Registros.
// Pula os IDs que já estão na planilha.
// Uso: node scripts/registros-para-planilha.mjs pasta-dos-registros [ids-ja-na-planilha.txt] > linhas.json
import { chromium } from "playwright";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = fileURLToPath(new URL("..", import.meta.url));
const pasta = process.argv[2];
const jaTem = new Set(process.argv[3] && existsSync(process.argv[3]) ? readFileSync(process.argv[3], "utf8").split(/\s+/).filter(Boolean) : []);
const arquivos = [];
(function varrer(d) { for (const n of readdirSync(d, { withFileTypes: true })) n.isDirectory() ? varrer(join(d, n.name)) : n.name.endsWith(".json") && arquivos.push(join(d, n.name)); })(pasta);
const registros = arquivos.flatMap((f) => {
  const doc = JSON.parse(readFileSync(f, "utf8"));
  const corpo = doc.data || doc;
  return Object.values(corpo.itens || {});
}).filter((r) => r && r.id && !jaTem.has(r.id)).sort((a, b) => (a.dia + String(a.hora).padStart(2, "0")).localeCompare(b.dia + String(b.hora).padStart(2, "0")));

const b = await chromium.launch();
const p = await b.newPage();
await p.route(/fonts\.(googleapis|gstatic)\.com|script\.google\.com/, (r) => r.abort());
await p.goto("file://" + raiz + "index.html", { waitUntil: "domcontentloaded" });
const linhas = await p.evaluate((rs) => rs.map((r) => window.EncaminhaMotor.registroParaLinha(r)), registros);
await b.close();
process.stdout.write(JSON.stringify(linhas));
console.error(`${linhas.length} registro(s) novo(s) para a aba Registros.`);
