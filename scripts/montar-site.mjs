// Monta o site do GitHub Pages em _site/: o index.html do app dentro do esqueleto HTML
// (charset, viewport do celular) que o Claude acrescenta sozinho quando publica o artefato.
// Uso: node scripts/montar-site.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const raiz = new URL("..", import.meta.url);
const app = readFileSync(new URL("index.html", raiz), "utf8");
if (/^\s*<!doctype/i.test(app)) throw new Error("index.html já tem <!doctype>: o esqueleto é acrescentado aqui.");
const api = (app.match(/<meta name="encaminha-api" content="([^"]*)">/) || [])[1];
if (api === undefined) throw new Error("Falta a meta encaminha-api no index.html.");

const site = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="description" content="Orientação de encaminhamentos para a rede de proteção social de Goiânia e região metropolitana.">
<meta name="robots" content="noindex">
<style>html,body{margin:0}</style></head><body>
${app}
</body></html>
`;
const saida = new URL("_site/", raiz);
mkdirSync(saida, { recursive: true });
writeFileSync(new URL("index.html", saida), site);
writeFileSync(new URL(".nojekyll", saida), "");
console.log(`_site/index.html montado (${Math.round(site.length / 1024)} KB). Planilha: ${api || "sem URL do Apps Script (usa os dados do app)"}`);
