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
  await page.route(/fonts\.(googleapis|gstatic)\.com|script\.google\.com/, (r) => r.abort());
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

test("violência contra pessoa idosa: faixa de urgência com 190, 100 e 197", async () => {
  const urg = await page.evaluate(() => window.EncaminhaMotor.avaliar(window.EncaminhaMotor.perfil({ on: ["violIdoso"], idade: 72 })).urg.join(" "));
  assert.match(urg, /190/);
  assert.match(urg, /100/);
  assert.match(urg, /197/);
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

test("EJA também aparece pela escolaridade de um adulto", async () => {
  const r = await avaliar({ idade: 30, escol: "fund-inc" });
  assert.equal(r.hits.eja, "ver");
  assert.equal((await avaliar({ idade: 30, escol: "medio" })).hits.eja, undefined);
});

test("renda não informada: o CadÚnico vira \"verificar\" no CRAS em vez de ficar sem caminho", async () => {
  const r = await page.evaluate(() => { const M = window.EncaminhaMotor, a = M.avaliar(M.perfil({ ni: ["renda"] })), b = M.avaliar(M.perfil({}));
    return { cad: (a.hits.find((h) => h.pol.id === "cad") || {}).st, rot: a.roteiro.map((s) => s.k), semNi: (b.hits.find((h) => h.pol.id === "cad") || {}).st, faltaSemNi: (b.falta.renda || []).map((p) => p.id) }; });
  assert.equal(r.cad, "ver");
  assert.ok(r.rot.includes("cras"));
  assert.equal(r.semNi, undefined, "sem a marcação, continua pedindo a renda");
  assert.ok(r.faltaSemNi.includes("cad"));
});

test("saúde mental: crise, transtorno grave e psicoterapia levam a lugares diferentes", async () => {
  const ver = (d) => page.evaluate((d) => { const M = window.EncaminhaMotor, a = M.avaliar(M.perfil(d));
    return { hits: a.hits.map((h) => h.pol.id), rot: a.roteiro.map((s) => s.k), lugares: Object.fromEntries(a.roteiro.map((s) => [s.k, s.lugares.map((l) => l.id || l.nome)])), urg: a.urg.join(" ") }; }, d);
  // psicoterapia: UBS e clínicas-escola, nunca CRAS só pela saúde mental
  const psi = await ver({ on: ["mental"] });
  assert.deepEqual(psi.hits, ["r-mental"]);
  assert.deepEqual(psi.rot, ["ubs", "clinica"]);
  assert.ok(psi.lugares.clinica.includes("puc-cepsi") && psi.lugares.clinica.includes("ufg-psi"));
  // transtorno grave: CAPS da região (adulto) ou CAPSi (criança)
  const grave = await ver({ on: ["mentalGrave"], reg: "noroeste" });
  assert.deepEqual(grave.hits, ["r-caps"]);
  assert.deepEqual(grave.lugares.capsReg, ["caps-noroeste", "raps-gyn"]);
  assert.ok((await ver({ on: ["mentalGrave"], idade: 12 })).lugares.capsReg.includes("caps-aguaviva"));
  assert.ok((await ver({ on: ["mentalGrave", "mental"] })).hits.every((h) => h !== "r-mental"), "com transtorno grave o CAPS substitui a psicoterapia avulsa");
  // crise: urgência agora, pronto-socorro psiquiátrico em Goiânia, UPA na região; depois CAPS
  const crise = await ver({ on: ["crisePsiq"] });
  assert.equal(crise.hits[0], "r-psiq");
  assert.deepEqual(crise.rot, ["psiq", "capsReg"]);
  assert.deepEqual(crise.lugares.psiq, ["wassily", "samu"]);
  assert.match(crise.urg, /192/);
  assert.match(crise.urg, /Wassily Chuc/);
  assert.equal((await ver({ on: ["crisePsiq"], mun: "Aparecida de Goiânia" })).lugares.psiq[0], "UPA ou CAIS 24h mais próximo");
  // a crise suicida continua em primeiro lugar
  assert.deepEqual((await ver({ on: ["suic", "crisePsiq"] })).hits.slice(0, 2), ["crise", "r-psiq"]);
});

test("pedido livre: crise, transtorno grave e psicoterapia sem confundir com outros assuntos", async () => {
  const temas = (t) => page.evaluate((t) => window.EncaminhaMotor.temasDe(t).map((x) => x.k), t);
  assert.deepEqual(await temas("minha irmã está em surto, ouvindo vozes"), ["crisepsiq"]);
  assert.deepEqual(await temas("filho com esquizofrenia parou o remédio"), ["transtornograve"]);
  assert.deepEqual(await temas("quer fazer terapia por ansiedade"), ["psicoterapia"]);
  assert.deepEqual(await temas("surto de dengue no bairro"), []);
  assert.deepEqual(await temas("ela tem botão do pânico"), []);
  assert.deepEqual(await temas("sofre violência psicológica do marido"), []);
  assert.deepEqual(await temas("precisa de terapia ocupacional"), ["reabilitacao"]);
});

test("pedido livre: violência contra pessoa idosa liga a urgência, sem pegar casos parecidos", async () => {
  const temas = (t) => page.evaluate((t) => window.EncaminhaMotor.temasDe(t).map((x) => x.k), t);
  assert.deepEqual(await temas("minha avó está apanhando do neto"), ["violidoso"]);
  assert.deepEqual(await temas("idoso sofrendo maus tratos"), ["violidoso"]);
  assert.ok((await temas("o filho fica com a aposentadoria dela")).includes("violidoso"));
  assert.deepEqual(await temas("idoso com dor nas costas"), []);
  assert.deepEqual(await temas("criança sofre maus tratos"), []);
  const tema = await page.evaluate(() => window.EncaminhaMotor._dados.TEMAS.find((t) => t.k === "violidoso").on);
  assert.deepEqual(tema, ["violIdoso"]);
});

test("pedido livre: reconhece AVC e reabilitação sem confundir palavras parecidas", async () => {
  const temas = (t) => page.evaluate((t) => window.EncaminhaMotor.temasDe(t).map((x) => x.k), t);
  assert.deepEqual(await temas("Meu pai está tendo um AVC"), ["avc"]);
  assert.deepEqual(await temas("preciso de fisioterapia depois da cirurgia"), ["reabilitacao"]);
  assert.deepEqual(await temas("sofreu um acidente de moto"), ["emergencia"]);
  assert.deepEqual(await temas("estou absolutamente cansada"), []);
  const sug = await page.evaluate(() => window.EncaminhaMotor.necSugeridas("ela apanha do marido e falta comida", new Set()));
  assert.deepEqual(sug.sort(), ["comida", "protecao"]);
});

test("dependências: álcool e drogas, apostas e jogos eletrônicos têm cuidado próprio", async () => {
  const ad = await avaliar({ on: ["drogas"] });
  assert.equal(ad.hits.ad, "enc");
  assert.equal(ad.hits["r-mental"], undefined);
  assert.equal(ad.roteiro[0].k, "capsad");
  const bet = await avaliar({ on: ["apostas"] });
  assert.equal(bet.hits.apostas, "enc");
  assert.deepEqual(bet.roteiro.map((s) => s.k), ["bloqueio", "capsad", "dividas"]);
  const games = await avaliar({ on: ["games"] });
  assert.equal(games.hits.games, "enc");
});

test("pedido livre: bets, tigrinho, videogame e álcool ligam o cuidado certo", async () => {
  const temas = (t) => page.evaluate((t) => window.EncaminhaMotor.temasDe(t).map((x) => x.k), t);
  assert.deepEqual(await temas("meu marido perdeu o salário no tigrinho"), ["apostas"]);
  assert.deepEqual(await temas("vive apostando nas bets"), ["apostas"]);
  assert.deepEqual(await temas("meu filho joga Free Fire a noite toda e largou a escola"), ["games"]);
  assert.deepEqual(await temas("ele bebe muito todo dia"), ["drogas"]);
  assert.deepEqual(await temas("o alfabeto"), []);
});

test("discriminação: racismo, xenofobia e intolerância religiosa chegam ao mesmo cuidado, sem falso alarme", async () => {
  const temas = (t) => page.evaluate((t) => window.EncaminhaMotor.temasDe(t).map((x) => x.k).sort(), t);
  assert.deepEqual(await temas("sofreu xenofobia no trabalho por ser venezuelana"), ["discriminacao", "migrante"]);
  assert.deepEqual(await temas("mandaram ele voltar pro seu pais, xingaram por ser nordestino"), ["discriminacao"]);
  assert.deepEqual(await temas("atacaram o terreiro de candomblé da nossa rua"), ["discriminacao"]);
  assert.deepEqual(await temas("foi humilhada por causa da religião"), ["discriminacao"]);
  assert.deepEqual(await temas("tenho intolerância à lactose"), []);
  assert.deepEqual(await temas("sou da umbanda e preciso de cesta básica"), []);
  const r = await avaliar({ on: ["discrim"] });
  assert.equal(r.hits.discrim, "enc");
  assert.deepEqual(r.roteiro.map((s) => s.k), ["deacri", "crei", "dpe"]);
});

// ---------- tela ----------
const inicio = async () => {
  await page.goto(PAGE, { waitUntil: "domcontentloaded" });
};
const seg = (f, v) => page.click(`#qBody .seg[data-f="${f}"][data-v="${v}"]`);
const proximo = () => page.click("#qBody [data-next]");

test("tela: só pergunta o que o assunto precisa", async () => {
  await inicio();
  await page.click('.tile[data-need="documentos"]');
  await page.click("#start");
  assert.equal(await page.textContent("#qProg"), "Etapa 1 de 2");
  await proximo();
  await proximo();
  assert.ok(await page.isVisible("#vPlano"));
  assert.ok((await page.textContent("#results")).includes("2ª via"));
});

test("tela: dados da pessoa por toque, 'Responder' volta só ao que falta", async () => {
  await inicio();
  await page.click('.tile[data-need="renda"]');
  await page.click("#start");
  await seg("pessoas", "4");
  await seg("renda", "0");
  await seg("renda", "0");                       // tocar de novo desmarca
  assert.equal(await page.inputValue("#qRenda"), "");
  await page.fill("#qRenda", "400");
  assert.match(await page.textContent("#qCalc"), /R\$ 100/);
  await seg("trab", "desempregado");
  await seg("on", "c06");
  assert.equal(await page.getAttribute('#qBody .seg[data-f="on"][data-v="c06"]', "aria-pressed"), "true");
  await proximo();                               // dados da pessoa
  await proximo();                               // notas
  assert.ok(await page.isVisible("#vPlano .route"));
  assert.match(await page.textContent("#results"), /Mães de Goiás/);
  await page.click('.falta [data-q="perfil"]');
  await seg("faixa", "65+");
  await proximo();
  assert.ok(await page.isVisible("#vPlano"));
  assert.ok(!(await page.isVisible(".falta")));
  assert.match(await page.textContent("#results"), /BPC/);
  assert.match(await page.textContent("#pSum"), /65 ou mais anos/);
});

test("tela: região só aparece para Goiânia; aluguel pesado só com moradia alugada", async () => {
  await inicio();
  await page.click('.tile[data-need="moradia"]');
  await page.click("#start");
  assert.ok(await page.isVisible('[data-row="reg"]'));
  await seg("mun", "Trindade");
  assert.ok(!(await page.isVisible('[data-row="reg"]')));
  assert.ok(!(await page.isVisible("#segAluguel")));
  await seg("moradia", "alugada");
  assert.ok(await page.isVisible("#segAluguel"));
});

test("tela: pedido livre de AVC mostra a orientação e a faixa de emergência", async () => {
  await inicio();
  await page.fill("#hDem", "meu pai está tendo um AVC");
  assert.match(await page.textContent("#hSug"), /AVC \(derrame\)/);
  assert.ok(await page.isEnabled("#start"));
  await page.click("#start");
  await proximo();
  assert.equal(await page.inputValue("#qDem"), "meu pai está tendo um AVC");
  await proximo();
  assert.match(await page.textContent(".urgent"), /192/);
  assert.ok(await page.isVisible('.tema-card:has-text("AVC (derrame)") .body'));
});

test("tela: \"Não sabe ou não quer dizer\" na renda e na região não trava o plano nem cobra a resposta", async () => {
  await page.goto(PAGE, { waitUntil: "domcontentloaded" });
  await page.click('.tile[data-need="renda"]');
  await page.click("#start");
  await page.click('#qBody .seg[data-f="ni"][data-v="renda"]');
  await page.click('#qBody .seg[data-f="ni"][data-v="reg"]');
  assert.equal(await page.getAttribute('#qBody .seg[data-f="ni"][data-v="renda"]', "aria-pressed"), "true");
  await page.click("#qSkip");
  const plano = await page.textContent("#vPlano");
  assert.match(plano, /Não informado\./);
  assert.match(plano, /O CRAS confirma pelo CadÚnico/);
  const falta = (await page.$(".falta")) ? await page.textContent(".falta") : "";
  assert.doesNotMatch(falta, /Renda da casa/, "não pede de novo o que a pessoa não sabe ou não quer dizer");
  // escolher um valor depois desmarca o "não sabe"
  await page.click("#pEdit");
  await page.click('#qBody .seg[data-f="renda"][data-v="600"]');
  assert.equal(await page.getAttribute('#qBody .seg[data-f="ni"][data-v="renda"]', "aria-pressed"), "false");
  assert.equal(await page.getAttribute('#qBody .seg[data-f="ni"][data-v="reg"]', "aria-pressed"), "true");
});

test("tela: atalho de urgência vai direto ao plano com o manejo; depois completa as perguntas", async () => {
  await inicio();
  await page.click('.tile[data-urg="suic"]');
  assert.ok(await page.isVisible(".urgent"));
  assert.ok(await page.isVisible("#card-crise .body"));
  await page.click("#pMais");
  await seg("reg", "norte");
  await proximo();
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

test("tela: pedido livre sobre bets traz autoexclusão e cuidado no SUS", async () => {
  await inicio();
  await page.fill("#hDem", "meu marido está viciado em bets e cheio de dívidas");
  assert.match(await page.textContent("#hSug"), /Apostas e bets/);
  await page.click("#start");
  await proximo();
  await proximo();
  const txt = await page.textContent("#results");
  assert.match(txt, /autoexclusao/i);
  assert.match(txt, /Procon ou Defensoria/);
  assert.ok(!(await page.isVisible(".falta")), "renda e idade não decidem nada sobre apostas");
  assert.doesNotMatch(txt, /só com a urgência/);
});

test("tela: todos os exemplos mostram o plano sem erros", async () => {
  for (const k of ["familia", "altocusto", "hiv", "farmacia", "crise", "faculdade", "reabilitacao"]) {
    await inicio();
    await page.click(`.case[data-case="${k}"]`);
    assert.ok(await page.isVisible("#vPlano .planhead"), k);
  }
  assert.ok(await page.isVisible('.tema-card:has-text("Reabilitação")'));
  assert.deepEqual(erros, []);
});
