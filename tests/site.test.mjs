// Site do GitHub Pages: prévia do link com a logo (WhatsApp, Telegram, e-mail) e ícones.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

const raiz = new URL("..", import.meta.url);
test("montar-site: prévia do link com a logo, ícones e manifesto", () => {
  execFileSync("node", ["scripts/montar-site.mjs"], { cwd: raiz });
  const html = readFileSync(new URL("_site/index.html", raiz), "utf8");
  const meta = (p) => (html.match(new RegExp(`<meta property="${p}" content="([^"]+)"`)) || [])[1];
  assert.match(meta("og:image"), /^https:\/\/.+\/compartilhar\.png$/, "a imagem precisa de endereço completo");
  assert.equal(meta("og:title"), "Encaminha Goiânia");
  assert.ok(meta("og:description").length > 40);
  for (const f of ["compartilhar.png", "icone.svg", "icone-192.png", "icone-512.png", "apple-touch-icon.png", "favicon-32.png", "manifest.webmanifest"])
    assert.ok(existsSync(new URL("_site/" + f, raiz)), f);
  const man = JSON.parse(readFileSync(new URL("_site/manifest.webmanifest", raiz), "utf8"));
  assert.equal(man.display, "standalone");
  assert.ok(man.icons.some((i) => i.sizes === "512x512"));
  assert.ok(readFileSync(new URL("site/compartilhar.png", raiz)).length < 300 * 1024, "WhatsApp prefere imagem com menos de 300 KB");
});
