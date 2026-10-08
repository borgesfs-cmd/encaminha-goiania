// Gera a planilha (dados/banco-de-dados-encaminha.xlsx) a partir dos dados atuais do app.
// Uso: node scripts/exportar-planilha.mjs   (precisa de Python 3 com openpyxl)
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const raiz = fileURLToPath(new URL("..", import.meta.url));
const b = await chromium.launch();
const p = await b.newPage();
await p.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
await p.goto("file://" + raiz + "index.html", { waitUntil: "domcontentloaded" });
const dados = await p.evaluate(() => {
  const D = window.EncaminhaMotor._dados;
  return {
    S: D.S.map((s) => ({ ...s })),
    P: D.P.map((p) => ({ id: p.id, nome: p.nome, esf: p.esf, val: p.val, flow: p.flow, docs: p.docs || [], where: p.where || "", extra: p.extra || [], curto: D.CURTO[p.id] || "" })),
    T: D.TEMAS.map((t) => ({ k: t.k, t: t.t, palavras: t.palavras, passos: t.passos || [], servicos: t.servicos || [], on: t.on || [], urg: t.urg || "" })),
  };
});
await b.close();
const json = raiz + "dados/dados-app.json";
writeFileSync(json, JSON.stringify(dados, null, 1));
execFileSync("python3", [raiz + "scripts/montar_planilha.py", json, raiz + "dados/banco-de-dados-encaminha.xlsx"], { stdio: "inherit" });
