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

test("pensamento de suicídio: manejo da crise primeiro, CVV agora e CAPS hoje ou amanhã", async () => {
  const r = await avaliar({ idade: 19, pessoas: 3, renda: 1800, on: ["suic"] });
  assert.equal(r.ordem[0], "crise");
  assert.equal(r.hits["r-mental"], undefined, "o manejo da crise substitui o card genérico de saúde mental");
  assert.deepEqual(r.roteiro.slice(0, 2).map((s) => [s.k, s.q]), [["cvv", 0], ["caps", 1]]);
  const urg = await page.evaluate(() => window.EncaminhaMotor.avaliar(window.EncaminhaMotor.perfil({ on: ["suic"] })).urg.join(" "));
  assert.match(urg, /188/);
  assert.match(urg, /192/);
});

test("tentativa de suicídio: pronto atendimento agora, com embalagem e CIATox", async () => {
  const r = await avaliar({ on: ["tentativa"] });
  assert.equal(r.hits.crise, "enc");
  assert.equal(r.roteiro[0].k, "urgencia");
  assert.ok(r.roteiro[0].docs.some((d) => /embalagem/i.test(d)));
  assert.deepEqual(r.roteiro.map((s) => s.k), ["urgencia", "cvv", "caps"]);
});

test("educação: Prouni integral, Fies Social, ProBem e isenção do Enem para quem quer a faculdade", async () => {
  const r = await avaliar({ idade: 18, pessoas: 4, renda: 2400, on: ["superior", "cad"] });
  assert.equal(r.hits.prouni, "ver");
  assert.equal(r.hits.fies, "ver");
  assert.equal(r.hits.probem, "ver");
  assert.equal(r.hits.enem, "prov");
  const online = r.roteiro.find((s) => s.k === "online").acoes.map((a) => a.id);
  for (const id of ["enem", "prouni", "fies", "cotas", "probem"]) assert.ok(online.includes(id), id);
  const rico = await avaliar({ pessoas: 1, renda: 6000, on: ["superior"] });
  assert.ok(rico.nao.prouni && rico.nao.fies && rico.nao.probem);
});

test("EJA e Encceja para adulto que não terminou a escola", async () => {
  const r = await avaliar({ idade: 40, on: ["eja"] });
  assert.equal(r.hits.eja, "prov");
  assert.deepEqual(r.roteiro.map((s) => s.k).sort(), ["escola", "online"]);
});

// ---------- tela ----------
const inicio = async () => {
  if (await page.isVisible("#pNew")) await page.click("#pNew");
  if (await page.isVisible("#qBack")) { await page.goto(PAGE, { waitUntil: "domcontentloaded" }); }
};
const opcao = (texto) => page.click(`#qBody .opt:has-text("${texto}")`);

test("tela: só pergunta o que o assunto precisa", async () => {
  await inicio();
  await page.click('.tile[data-need="documentos"]');
  await page.click("#start");
  assert.equal(await page.textContent("#qProg"), "Pergunta 1 de 2");
  await opcao("Goiânia");
  await page.click("[data-next]");
  assert.ok(await page.isVisible("#vPlano"));
  assert.ok((await page.textContent("#results")).includes("2ª via"));
});

test("tela: fluxo de renda, 'Não sei' na idade e 'Responder' volta ao plano", async () => {
  await inicio();
  await page.click('.tile[data-need="renda"]');
  await page.click("#start");
  await opcao("Goiânia");
  await opcao("Desempregada");
  await page.fill("#qRenda", "400");
  await page.fill("#qPessoas", "4");
  assert.match(await page.textContent("#qCalc"), /R\$ 100/);
  await page.click("[data-next]");
  await page.click("[data-naosei]");            // idade
  await opcao("Criança de 0 a 6 anos");          // família
  await page.click("[data-next]");
  await page.click("[data-next]");               // cadastro: nenhum
  await page.click("[data-next]");               // notas
  assert.ok(await page.isVisible("#vPlano .route"));
  assert.match(await page.textContent("#results"), /Mães de Goiás/);
  await page.click('.falta [data-q="idade"]');
  await page.fill("#qNum", "66");
  await page.click("[data-next]");
  assert.ok(await page.isVisible("#vPlano"));
  assert.ok(!(await page.isVisible(".falta")));
  assert.match(await page.textContent("#results"), /BPC/);
});

test("tela: atalho de urgência vai direto ao plano com o manejo; depois completa as perguntas", async () => {
  await inicio();
  await page.click('.tile[data-urg="suic"]');
  assert.ok(await page.isVisible(".urgent"));
  assert.ok(await page.isVisible("#card-crise .body"));
  await page.click("#pMais");
  await opcao("Goiânia");
  assert.match(await page.textContent("#qBody h2"), /região/);
  await opcao("Norte");
  assert.equal(await page.getAttribute('#qBody .opt[data-v="suic"]', "aria-pressed"), "true");
});

test("tela: caso Crise suicida abre o manejo e o link da faixa leva até ele", async () => {
  await inicio();
  await page.click('.case[data-case="crise"]');
  assert.ok(await page.isVisible("#card-crise .body"));
  await page.evaluate(() => { document.getElementById("card-crise").open = false; });
  await page.click('.urgent [data-abre="crise"]');
  assert.ok(await page.isVisible("#card-crise .body"));
});

test("tela: todos os exemplos mostram roteiro sem erros", async () => {
  for (const k of ["familia", "altocusto", "hiv", "farmacia", "crise", "faculdade"]) {
    await inicio();
    await page.click(`.case[data-case="${k}"]`);
    assert.ok(await page.isVisible("#vPlano .route"), k);
  }
  assert.deepEqual(erros, []);
});
