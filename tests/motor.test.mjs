// Testes do motor de regras e da tela de resultado.
// Abre o index.html no Chromium e usa window.EncaminhaMotor (perfil + avaliar).
// Rodar: npm test
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const PAGE = new URL("../index.html", import.meta.url).href;
let browser, page;
const erros = [];

before(async () => {
  browser = await chromium.launch();
  page = await browser.newPage();
  page.on("pageerror", (e) => erros.push(e.message));
  // Fontes externas não importam para o teste e podem não carregar sem rede.
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.goto(PAGE, { waitUntil: "domcontentloaded" });
});
after(async () => browser && browser.close());

// Avalia um perfil dentro da página e devolve um resumo serializável.
async function avaliar(dados) {
  return page.evaluate((d) => {
    const M = window.EncaminhaMotor;
    const p = M.perfil(d);
    const r = M.avaliar(p);
    return {
      sm: p.sm,
      dem: p.dem,
      hits: Object.fromEntries(r.hits.map((x) => [x.pol.id, x.st])),
      ordem: r.hits.map((x) => x.pol.id),
      nao: Object.fromEntries(r.nao.map((x) => [x.pol.id, x.why])),
      falta: Object.fromEntries(Object.entries(r.falta).map(([k, v]) => [k, v.map((pol) => pol.id)])),
      urg: r.urg.length,
      roteiro: r.roteiro.map((s) => ({
        k: s.k,
        q: s.q,
        acoes: s.acoes.map((a) => ({ id: a.pol.id, abre: a.abre || null })),
        docs: s.docs,
      })),
    };
  }, dados);
}
const caso = (k) => page.evaluate((k) => window.EncaminhaMotor.CASES[k], k);

test("a página carrega sem erros de script", () => {
  assert.deepEqual(erros, []);
});

test("salário mínimo padrão é o de 2026 (R$ 1.621)", async () => {
  const r = await avaliar({ mun: "Goiânia" });
  assert.equal(r.sm, 1621);
});

test("texto livre: apaga CPF, telefone, RG, CEP e e-mail; mantém valores e datas", async () => {
  const r = await avaliar({
    dem: "Paga R$ 1.300 de aluguel desde 12/03/2025. CPF 123.456.789-00, tel (62) 99203-9564, RG 1234567, CEP 74610-010, mail a.b@x.com.br, tem 34 anos",
  });
  assert.match(r.dem, /R\$ 1\.300/);
  assert.match(r.dem, /12\/03\/2025/);
  assert.match(r.dem, /34 anos/);
  for (const s of ["123.456", "99203", "1234567", "74610", "a.b@x"]) assert.ok(!r.dem.includes(s), s);
});

test("caso Família com violência: proteção primeiro e benefícios por renda", async () => {
  const r = await avaliar(await caso("familia"));
  assert.equal(r.ordem[0], "r-mulher");
  assert.ok(r.urg > 0);
  for (const id of ["pbf", "maes", "inclusivo", "porelas"]) assert.equal(r.hits[id], "prov", id);
  assert.equal(r.hits.aluguel, "ver");
  assert.equal(r.roteiro[0].k, "deaem", "o primeiro lugar do roteiro é a delegacia");
});

test("caso Alto custo: Cemac e Farmácia Popular; Bolsa Família não indicado com motivo", async () => {
  const r = await avaliar(await caso("altocusto"));
  assert.equal(r.hits.ceaf, "enc");
  assert.equal(r.hits.fpop, "prov");
  assert.match(r.nao.pbf, /R\$ 218/);
  const passos = r.roteiro.flatMap((s) => s.acoes.map((a) => `${s.k}:${a.id}`));
  assert.deepEqual(passos.filter((x) => x.endsWith(":ceaf")), ["medico:ceaf", "online:ceaf", "dpe:ceaf"]);
});

test("Carteira da Pessoa Idosa usa a renda própria: casa até 2 SM é provável; acima, verificar", async () => {
  const a = await avaliar({ idade: 67, pessoas: 2, renda: 2800 });
  assert.equal(a.hits.cpi, "prov");
  // idoso que ganha 3 SM e mora com 2 pessoas sem renda: antes o app dava direito pela renda por pessoa
  const b = await avaliar({ idade: 70, pessoas: 3, renda: 1621 * 3 });
  assert.equal(b.hits.cpi, "ver");
});

test("Aluguel Social: limite de meio salário mínimo por pessoa", async () => {
  const sim = await avaliar({ pessoas: 2, renda: 1200, on: ["aluguel"] });
  assert.equal(sim.hits.aluguel, "ver");
  const nao = await avaliar({ pessoas: 2, renda: 2000, on: ["aluguel"] });
  assert.equal(nao.hits.aluguel, undefined);
  assert.match(nao.nao.aluguel, /meio salário/);
});

test("BPC: 1/4 SM provável, até 1/2 verificar, acima não indicado", async () => {
  assert.equal((await avaliar({ idade: 66, pessoas: 2, renda: 800 })).hits.bpc, "prov");
  assert.equal((await avaliar({ idade: 66, pessoas: 2, renda: 1500 })).hits.bpc, "ver");
  assert.ok((await avaliar({ idade: 66, pessoas: 2, renda: 2000 })).nao.bpc);
  assert.equal((await avaliar({ idade: 40, pessoas: 2, renda: 800 })).hits.bpc, undefined);
});

test("Dignidade não é indicado para quem recebe Bolsa Família", async () => {
  const r = await avaliar({ idade: 62, pessoas: 1, renda: 100, on: ["cad", "pbf"] });
  assert.equal(r.hits.dignidade, undefined);
  assert.match(r.nao.dignidade, /Bolsa Família/);
});

test("sem renda e sem idade, o app diz o que falta e para quê", async () => {
  const r = await avaliar({ mun: "Goiânia" });
  for (const id of ["cad", "pbf", "tse"]) assert.ok(r.falta.renda.includes(id), id);
  for (const id of ["bpc", "dignidade", "passaporte", "cpi"]) assert.ok(r.falta.idade.includes(id), id);
  assert.equal(Object.keys(r.hits).length, 0);
});

test("roteiro junta no mesmo CRAS o CadÚnico e o que ele abre, sem repetir documentos", async () => {
  const r = await avaliar({ idade: 30, pessoas: 4, renda: 300, on: ["c06", "pcd17", "fome"] });
  const cras = r.roteiro.filter((s) => s.k === "cras");
  assert.equal(cras.length, 1);
  const cad = cras[0].acoes.find((a) => a.id === "cad");
  for (const nome of ["Bolsa Família", "Mães de Goiás", "Goiás + Inclusivo"]) assert.ok(cad.abre.includes(nome), nome);
  const norm = cras[0].docs.map((d) => d.toLowerCase());
  assert.equal(new Set(norm).size, norm.length);
});

test("pessoa em situação de rua faz o CadÚnico pelo Centro POP", async () => {
  const r = await avaliar({ moradia: "rua", pessoas: 1, renda: 0 });
  const pop = r.roteiro.find((s) => s.k === "pop");
  assert.ok(pop.acoes.some((a) => a.id === "cad"));
  assert.ok(!r.roteiro.some((s) => s.k === "cras" && s.acoes.some((a) => a.id === "cad")));
});

test("PEP vem antes de tudo no roteiro", async () => {
  const r = await avaliar({ pessoas: 1, renda: 100, on: ["pep", "fome"] });
  assert.equal(r.roteiro[0].k, "pep");
  assert.equal(r.roteiro[0].q, 0);
});

test("tela: casos de exemplo mostram roteiro; Novo atendimento mostra o que falta e o botão leva ao campo", async () => {
  for (const k of ["familia", "altocusto", "hiv", "farmacia"]) {
    await page.click(`.case[data-case="${k}"]`);
    assert.ok(await page.isVisible("#st3 .route"), k);
  }
  await page.click("#clear");
  await page.click("#sb3");
  assert.ok(await page.isVisible(".falta"));
  await page.click('.falta [data-campo="renda"]');
  assert.ok(await page.isVisible("#st1"));
  const foco = await page.evaluate(() => document.activeElement.id);
  assert.ok(["renda", "pessoas"].includes(foco), foco);
  assert.deepEqual(erros, []);
});
