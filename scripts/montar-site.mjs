// Monta o site do GitHub Pages em _site/: o index.html do app dentro do esqueleto HTML
// (charset, viewport do celular) que o Claude acrescenta sozinho quando publica o artefato.
// Uso: node scripts/montar-site.mjs
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync } from "node:fs";

const raiz = new URL("..", import.meta.url);
const app = readFileSync(new URL("index.html", raiz), "utf8");
if (/^\s*<!doctype/i.test(app)) throw new Error("index.html já tem <!doctype>: o esqueleto é acrescentado aqui.");
const api = (app.match(/<meta name="encaminha-api" content="([^"]*)">/) || [])[1];
if (api === undefined) throw new Error("Falta a meta encaminha-api no index.html.");

// Endereço público do site: as prévias de link (WhatsApp, Telegram, e-mail) exigem a imagem com endereço completo.
const URL_SITE = process.env.URL_SITE || "https://borgesfs-cmd.github.io/encaminha-goiania/";
const TITULO = "Encaminha Goiânia";
const DESCRICAO = "Onde ir, o que levar e a que a pessoa tem direito. Orientação de encaminhamentos para a rede de proteção social de Goiânia e região metropolitana.";

const site = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="description" content="${DESCRICAO}">
<meta name="theme-color" content="#16261F">
<link rel="icon" href="icone.svg" type="image/svg+xml">
<link rel="icon" href="favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<link rel="manifest" href="manifest.webmanifest">
<meta name="apple-mobile-web-app-title" content="${TITULO}">
<meta property="og:type" content="website">
<meta property="og:locale" content="pt_BR">
<meta property="og:site_name" content="${TITULO}">
<meta property="og:title" content="${TITULO}">
<meta property="og:description" content="${DESCRICAO}">
<meta property="og:url" content="${URL_SITE}">
<meta property="og:image" content="${URL_SITE}compartilhar.png">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Logo do Encaminha Goiânia: um caminho amarelo que leva a um marcador de destino">
<meta name="twitter:card" content="summary_large_image">
<meta name="robots" content="noindex">
<style>html,body{margin:0}</style></head><body>
${app}
</body></html>
`;
const saida = new URL("_site/", raiz);
mkdirSync(saida, { recursive: true });
writeFileSync(new URL("index.html", saida), site);
writeFileSync(new URL(".nojekyll", saida), "");
// Logo, ícones e imagem de prévia do link (pasta site/).
for (const n of readdirSync(new URL("site/", raiz))) copyFileSync(new URL("site/" + n, raiz), new URL(n, saida));
writeFileSync(new URL("manifest.webmanifest", saida), JSON.stringify({
  name: TITULO, short_name: "Encaminha", description: DESCRICAO, lang: "pt-BR",
  start_url: "./", scope: "./", display: "standalone", background_color: "#F5F6F1", theme_color: "#16261F",
  icons: [
    { src: "icone-192.png", sizes: "192x192", type: "image/png" },
    { src: "icone-512.png", sizes: "512x512", type: "image/png" },
    { src: "icone.svg", sizes: "any", type: "image/svg+xml" },
  ],
}, null, 2));
console.log(`_site/index.html montado (${Math.round(site.length / 1024)} KB). Planilha: ${api || "sem URL do Apps Script (usa os dados do app)"}`);
