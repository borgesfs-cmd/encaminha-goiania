// Rotina de testes detalhada do Encaminha Goiânia.
// Complementa motor.test.mjs: integridade dos dados, perfis aleatórios, cobertura de todas as
// políticas, limites de renda, todos os fluxos de tela, layout no celular, acessibilidade,
// tema escuro, privacidade, estatísticas e desempenho.
// Rodar: npm test
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";

const PAGE = new URL("../index.html", import.meta.url).href;
let browser, page;
const erros = [];

before(async () => {
  browser = await chromium.launch();
  page = await browser.newPage();
  page.on("pageerror", (e) => erros.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/fonts|ERR_FAILED/.test(m.text())) erros.push(m.text()); });
  await page.route(/fonts\.(googleapis|gstatic)\.com|script\.google\.com/, (r) => r.abort());
  await page.goto(PAGE, { waitUntil: "domcontentloaded" });
});
after(async () => browser && browser.close());

// ---------- A. Integridade dos dados ----------
test("A1. Toda política tem nome, critério, passo a passo e esfera válida", async () => {
  const falhas = await page.evaluate(() => {
    const { P } = window.EncaminhaMotor._dados, out = [];
    const ids = new Set();
    for (const p of P) {
      if (ids.has(p.id)) out.push("id repetido: " + p.id);
      ids.add(p.id);
      if (!p.nome || typeof p.test !== "function" || !Array.isArray(p.flow) || !p.flow.length) out.push("incompleta: " + p.id);
      if (!["nac", "est", "mun", "rede"].includes(p.esf)) out.push("esfera: " + p.id);
    }
    return out;
  });
  assert.deepEqual(falhas, []);
});

test("A2. Todo contato citado (onde ir, extras, temas, lugares) existe na lista de serviços", async () => {
  const falhas = await page.evaluate(() => {
    const { P, S, TEMAS } = window.EncaminhaMotor._dados, ids = new Set(S.map((s) => s.id)), out = [];
    P.forEach((p) => (p.extra || []).forEach((e) => ids.has(e) || out.push(`${p.id} → ${e}`)));
    TEMAS.forEach((t) => (t.servicos || []).forEach((e) => ids.has(e) || out.push(`tema ${t.k} → ${e}`)));
    const repet = S.map((s) => s.id).filter((id, i, a) => a.indexOf(id) !== i);
    repet.forEach((id) => out.push("serviço repetido: " + id));
    return out;
  });
  assert.deepEqual(falhas, []);
});

test("A3. Todo passo do roteiro aponta para uma política e um lugar que existem", async () => {
  const falhas = await page.evaluate(() => {
    const { P, ROTA, STOPS, QUANDO } = window.EncaminhaMotor._dados, ids = new Set(P.map((p) => p.id)), out = [];
    for (const k in ROTA) if (!ids.has(k)) out.push("ROTA sem política: " + k);
    for (const k in STOPS) if (!(STOPS[k].q >= 0 && STOPS[k].q < QUANDO.length)) out.push("grupo inválido: " + k);
    // passos estáticos; os que dependem do perfil são conferidos na rotina de perfis aleatórios
    for (const k in ROTA) if (Array.isArray(ROTA[k])) ROTA[k].forEach(([l]) => STOPS[l] || out.push(`${k} → lugar ${l}`));
    return out;
  });
  assert.deepEqual(falhas, []);
});

test("A4. Toda opção que a tela oferece é usada por alguma regra ou tema (nada de opção morta)", async () => {
  const mortas = await page.evaluate(() => {
    const { P, PERGUNTAS, PERFIL_ROWS, TEMAS } = window.EncaminhaMotor._dados;
    const fonte = P.map((p) => p.test.toString()).join("\n") + "\n" + document.querySelector("script:not([src])").textContent;
    const ops = [...PERGUNTAS.flatMap((q) => q.opcoes || []), ...PERFIL_ROWS.filter((r) => r.f === "on").flatMap((r) => r.op)].map(([k]) => k);
    const temasOn = TEMAS.flatMap((t) => t.on || []);
    return [...new Set(ops)].filter((k) => !fonte.includes(`has("${k}")`) && !temasOn.includes(k));
  });
  assert.deepEqual(mortas, []);
});

test("A5. Temas do pedido livre: palavras sem repetição entre temas e chips ligados existem", async () => {
  const falhas = await page.evaluate(() => {
    const { TEMAS, P } = window.EncaminhaMotor._dados, out = [], visto = new Map();
    const fonte = P.map((p) => p.test.toString()).join("\n");
    TEMAS.forEach((t) => {
      if (!t.on && !(t.passos && t.passos.length)) out.push("tema vazio: " + t.k);
      (t.on || []).forEach((c) => fonte.includes(`has("${c}")`) || out.push(`tema ${t.k} liga chip sem regra: ${c}`));
      t.palavras.forEach((w) => { if (visto.has(w)) out.push(`palavra "${w}" em ${visto.get(w)} e ${t.k}`); visto.set(w, t.k); });
    });
    return out;
  });
  assert.deepEqual(falhas, []);
});

// ---------- B. Perfis aleatórios ----------
test("B1. 800 perfis aleatórios: sem erro, motivo sempre preenchido, roteiro coerente", async () => {
  const r = await page.evaluate(() => {
    const M = window.EncaminhaMotor, { PERGUNTAS, PERFIL_ROWS, STOPS, TEMAS } = M._dados;
    let x = 7; const rnd = () => (x = (x * 1103515245 + 12345) % 2147483648) / 2147483648;
    const chips = [...new Set([...PERGUNTAS.flatMap((q) => q.opcoes || []), ...PERFIL_ROWS.filter((r) => r.f === "on").flatMap((r) => r.op)].map(([k]) => k))];
    const muns = ["Goiânia", "Aparecida de Goiânia", "Senador Canedo", "Trindade", "Inhumas", "Caturaí"];
    const textos = ["", "", ...TEMAS.map((t) => t.palavras[0])];
    const falhas = [], vistos = {};
    for (let i = 0; i < 800; i++) {
      const d = {
        mun: muns[Math.floor(rnd() * muns.length)], reg: ["", "norte", "leste", "noroeste"][Math.floor(rnd() * 4)],
        idade: rnd() < 0.15 ? null : Math.floor(rnd() * 95), pessoas: rnd() < 0.1 ? null : 1 + Math.floor(rnd() * 8),
        renda: rnd() < 0.1 ? null : Math.floor(rnd() * rnd() * 9000), moradia: ["", "propria", "alugada", "rua", "cedida"][Math.floor(rnd() * 5)],
        trab: ["", "desempregado", "formal", "informal"][Math.floor(rnd() * 4)], escol: ["", "fund-inc", "medio", "sup"][Math.floor(rnd() * 4)],
        dem: textos[Math.floor(rnd() * textos.length)], on: chips.filter(() => rnd() < 0.12),
      };
      try {
        const p = M.perfil(d), a = M.avaliar(p);
        a.hits.forEach((h) => {
          vistos[h.pol.id] = (vistos[h.pol.id] || 0) + 1;
          if (!["enc", "prov", "ver"].includes(h.st)) falhas.push(`status ${h.st} em ${h.pol.id}`);
          if (!h.why || /undefined|NaN|null/.test(h.why)) falhas.push(`motivo ruim em ${h.pol.id}: ${h.why}`);
        });
        a.nao.forEach((n) => { if (!n.why || /undefined|NaN/.test(n.why)) falhas.push(`"não" ruim em ${n.pol.id}`); });
        const ks = a.roteiro.map((s) => s.k);
        if (new Set(ks).size !== ks.length) falhas.push("lugar repetido no roteiro");
        a.roteiro.forEach((s, j) => {
          if (!STOPS[s.k]) falhas.push("lugar desconhecido " + s.k);
          if (j && s.q < a.roteiro[j - 1].q) falhas.push("roteiro fora de ordem");
          const n = s.docs.map((t) => t.toLowerCase()); if (new Set(n).size !== n.length) falhas.push("documento repetido em " + s.k);
          if (!s.acoes.length) falhas.push("lugar sem ação " + s.k);
        });
        M.registroDeDados(d, new Set(["renda"]), new Date());
      } catch (e) { falhas.push(`perfil ${i}: ${e.message}`); }
    }
    return { falhas: [...new Set(falhas)].slice(0, 20), vistos };
  });
  assert.deepEqual(r.falhas, []);
  globalThis.__vistos = r.vistos;
});

test("B2. Cobertura: toda política aparece em algum perfil (aleatório ou dirigido)", async () => {
  const faltam = await page.evaluate((vistos) => {
    const M = window.EncaminhaMotor, { P } = M._dados;
    // perfis dirigidos para o que o acaso não alcança
    const extra = [
      { idade: 62, pessoas: 1, renda: 100 }, { idade: 15, pessoas: 4, renda: 1000, on: ["estud"] },
      { idade: 30, pessoas: 3, renda: 100, on: ["empreender"] }, { on: ["semDoc"] }, { on: ["violMulher", "mpu", "cad"], pessoas: 2, renda: 200 },
      { idade: 70, pessoas: 2, renda: 1000 }, { on: ["tea"] }, { on: ["pcd"], pessoas: 1, renda: 300 }, { on: ["estMedio"], pessoas: 4, renda: 800 },
      { on: ["aluguel"], pessoas: 2, renda: 800 }, { on: ["pcd17", "c06"], pessoas: 4, renda: 200 },
      { on: ["fome"] }, // vem do assunto "Comida", não de uma opção
      { on: ["pcr"] }, { on: ["dorPeito"] }, { on: ["resgate"] }, { on: ["socorros"] }, // vêm só dos atalhos de urgência
      { on: ["aposentar", "incapaz", "sequela", "morte", "preso", "maternidade", "contribuir"], trab: "nao", pessoas: 2, renda: 1000 },
      { trab: "formal", pessoas: 3, renda: 1800, on: ["c714"] },
    ];
    extra.forEach((d) => M.avaliar(M.perfil(d)).hits.forEach((h) => (vistos[h.pol.id] = (vistos[h.pol.id] || 0) + 1)));
    return P.map((p) => p.id).filter((id) => !vistos[id]);
  }, globalThis.__vistos || {});
  assert.deepEqual(faltam, []);
});

// ---------- C. Limites de renda ----------
test("C1. Limites exatos: R$ 218, R$ 109, 1/4 e 1/2 salário", async () => {
  const r = await page.evaluate(() => {
    const M = window.EncaminhaMotor, sm = M.SM_PADRAO, av = (d) => M.avaliar(M.perfil(d));
    const st = (d, id) => (av(d).hits.find((h) => h.pol.id === id) || {}).st || (av(d).nao.find((n) => n.pol.id === id) ? "nao" : "-");
    return {
      pbf218: st({ pessoas: 1, renda: 218 }, "pbf"), pbf219: st({ pessoas: 1, renda: 219 }, "pbf"),
      maes109: st({ pessoas: 1, renda: 109, on: ["c06"] }, "maes"), maes110: st({ pessoas: 1, renda: 110, on: ["c06"] }, "maes"),
      bpcQ: st({ idade: 70, pessoas: 4, renda: sm }, "bpc"), bpcQ1: st({ idade: 70, pessoas: 4, renda: sm + 4 }, "bpc"),
      bpcM: st({ idade: 70, pessoas: 2, renda: sm }, "bpc"), bpcM1: st({ idade: 70, pessoas: 2, renda: sm + 2 }, "bpc"),
      cadM: st({ pessoas: 2, renda: sm }, "cad"), cad3: st({ pessoas: 1, renda: sm * 3 + 1 }, "cad"),
    };
  });
  assert.deepEqual(r, { pbf218: "prov", pbf219: "nao", maes109: "prov", maes110: "nao", bpcQ: "prov", bpcQ1: "ver", bpcM: "ver", bpcM1: "nao", cadM: "prov", cad3: "nao" });
});

test("C2. Minha Casa, Minha Vida só com necessidade de moradia; painel de demanda só com serviços presenciais", async () => {
  const r = await page.evaluate(() => {
    const M = window.EncaminhaMotor, id = (d) => M.avaliar(M.perfil(d)).hits.map((h) => h.pol.id);
    const a = M.agregar([M.registroDeDados({ on: ["superior"], pessoas: 2, renda: 800 }, new Set(["educacao"]), new Date())], "30", "Todos");
    return { alugada: id({ moradia: "alugada", pessoas: 2, renda: 500 }).includes("mcmv"), pesado: id({ moradia: "alugada", on: ["aluguel"], pessoas: 2, renda: 500 }).includes("mcmv"),
      paradas: a.paradas.map(([k]) => k) };
  });
  assert.equal(r.alugada, false);
  assert.equal(r.pesado, true);
  assert.ok(!r.paradas.includes("online") && !r.paradas.includes("auto"));
});

// ---------- D. Fluxos de tela ----------
const inicio = () => page.goto(PAGE, { waitUntil: "domcontentloaded" });

test("D1. Cada assunto sozinho: responder tudo com a primeira opção chega ao plano sem erro", async () => {
  const necs = await page.evaluate(() => window.EncaminhaMotor._dados.NECESSIDADES.map((n) => n.k));
  for (const k of necs) {
    await inicio();
    await page.click(`.tile[data-need="${k}"]`);
    await page.click("#start");
    for (let i = 0; i < 12 && (await page.isVisible("#vPergunta")); i++) {
      const opt = await page.$("#qBody .opt");
      if (opt) await opt.click();
      await page.click("#qBody [data-next]");
    }
    assert.ok(await page.isVisible("#vPlano"), k);
    assert.ok(await page.isVisible("#vPlano .planhead"), k);
  }
  assert.deepEqual(erros, []);
});

test("D2. Cada atalho de urgência mostra a faixa de segurança", async () => {
  const urg = await page.evaluate(() => window.EncaminhaMotor._dados.URGENCIAS.map((u) => u.k));
  for (const k of urg) {
    await inicio();
    await page.click(`.tile[data-urg="${k}"]`);
    assert.ok(await page.isVisible(".urgent"), k);
  }
});

test("D3. Voltar, editar respostas e novo atendimento preservam e limpam o estado certo", async () => {
  await inicio();
  await page.click('.tile[data-need="renda"]');
  await page.click("#start");
  await page.click('#qBody .seg[data-f="pessoas"][data-v="3"]');
  await page.click("#qBody [data-next]");
  await page.click("#qBack");
  assert.equal(await page.getAttribute('#qBody .seg[data-f="pessoas"][data-v="3"]', "aria-pressed"), "true", "voltar mantém a resposta");
  await page.click("#qSkip");
  await page.click("#pEdit");
  assert.equal(await page.getAttribute('#qBody .seg[data-f="pessoas"][data-v="3"]', "aria-pressed"), "true", "editar mantém a resposta");
  await page.click("#qSkip");
  await page.click("#pNew");
  assert.equal(await page.getAttribute('.tile[data-need="renda"]', "aria-pressed"), "false", "novo atendimento limpa");
});

test("D4. Copiar resumo gera texto com roteiro e sem números longos do texto livre", async () => {
  await inicio();
  await page.fill("#hDem", "liga no 62 99999-8888, cpf 123.456.789-00, precisa de fisioterapia");
  await page.click("#start");
  await page.click("#qBody [data-next]");
  await page.click("#qBody [data-next]");
  const txt = await page.evaluate(() => {
    let out = ""; const orig = navigator.clipboard && navigator.clipboard.writeText;
    document.getElementById("copyAll").click();
    return document.querySelector("#results").innerText;
  });
  assert.match(txt, /Reabilitação/);
  const resumo = await page.evaluate(() => { const s = window.EncaminhaMotor.perfil({ dem: "liga no 62 99999-8888, cpf 123.456.789-00" }).dem; return s; });
  assert.ok(!/99999|123\.456/.test(resumo));
});

// ---------- E. Layout, acessibilidade e tema ----------
async function semRolagemLateral(p, rotulo) {
  const r = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: window.innerWidth }));
  assert.ok(r.sw <= r.w + 1, `${rotulo}: largura ${r.sw} > ${r.w}`);
}

test("E1. Celular de 360px: nenhuma tela rola para o lado", async () => {
  const p = await browser.newPage({ viewport: { width: 360, height: 780 } });
  await p.route(/fonts\.(googleapis|gstatic)\.com|script\.google\.com/, (r) => r.abort());
  await p.goto(PAGE, { waitUntil: "domcontentloaded" });
  await semRolagemLateral(p, "início");
  await p.click('.tile[data-need="renda"]');
  await p.click("#start");
  await semRolagemLateral(p, "sobre a pessoa");
  for (const k of ["familia", "crise", "faculdade", "reabilitacao"]) {
    await p.goto(PAGE, { waitUntil: "domcontentloaded" });
    await p.click(`.case[data-case="${k}"]`);
    await p.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));
    await semRolagemLateral(p, "plano " + k);
  }
  for (const k of await p.evaluate(() => window.EncaminhaMotor._dados.URGENCIAS.map((u) => u.k))) {
    await p.goto(PAGE, { waitUntil: "domcontentloaded" });
    await p.click(`.tile[data-urg="${k}"]`);
    await p.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));
    await semRolagemLateral(p, "urgência " + k);
  }
  await p.click("#tab-rel");
  await p.click("#relDemoBtn");
  await semRolagemLateral(p, "relatórios");
  for (const t of ["tab-rede", "tab-serv", "tab-sobre"]) { await p.click("#" + t); await semRolagemLateral(p, t); }
  await p.close();
});

test("E2. Acessibilidade: todo campo tem rótulo e todo botão tem texto", async () => {
  await inicio();
  const telas = [
    async () => {},
    async () => { await page.click('.tile[data-need="renda"]'); await page.click("#start"); },
    async () => { await inicio(); await page.click('.case[data-case="familia"]'); },
    async () => { await page.click("#tab-rel"); await page.click("#relDemoBtn"); },
  ];
  const falhas = [];
  for (const t of telas) {
    await t();
    falhas.push(...(await page.evaluate(() => {
      const out = [];
      document.querySelectorAll("input,select,textarea").forEach((el) => {
        if (el.offsetParent === null) return;
        const ok = el.getAttribute("aria-label") || (el.id && document.querySelector(`label[for="${el.id}"]`));
        if (!ok) out.push("campo sem rótulo: " + (el.id || el.name || el.type));
      });
      document.querySelectorAll("button").forEach((b) => { if (b.offsetParent !== null && !b.textContent.trim() && !b.getAttribute("aria-label")) out.push("botão sem texto"); });
      return out;
    })));
  }
  assert.deepEqual([...new Set(falhas)], []);
});

test("E3. Tema escuro: fundo escuro, texto claro, sem erros", async () => {
  const p = await browser.newPage({ colorScheme: "dark" });
  await p.route(/fonts\.(googleapis|gstatic)\.com|script\.google\.com/, (r) => r.abort());
  await p.goto(PAGE, { waitUntil: "domcontentloaded" });
  await p.click('.case[data-case="familia"]');
  const c = await p.evaluate(() => { const s = getComputedStyle(document.body); return [s.backgroundColor, s.color]; });
  const lum = (rgb) => { const [r, g, b] = rgb.match(/\d+/g).map(Number); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  assert.ok(lum(c[0]) < 60, "fundo " + c[0]);
  assert.ok(lum(c[1]) > 180, "texto " + c[1]);
  await p.close();
});

// ---------- F. Privacidade ----------
test("F1. O registro para estatísticas não leva iniciais, texto livre, renda nem idade exatas", async () => {
  const rec = await page.evaluate(() => window.EncaminhaMotor.registroDeDados(
    { ini: "M.S.A.", dem: "meu pai teve AVC, telefone 62 99999-8888", idade: 37, pessoas: 3, renda: 1234, mun: "Goiânia", on: ["violMulher"] },
    new Set(["protecao"]), new Date()));
  const json = JSON.stringify(rec);
  for (const proibido of ["M.S.A", "AVC", "99999", "1234", "37"]) assert.ok(!json.includes(proibido), proibido);
  assert.equal(rec.renda, "ate_m");
  assert.equal(rec.faixa, "30-59");
  assert.deepEqual(rec.temas, ["avc"]);
  for (const campo of ["ini", "dem", "idade", "pc"]) assert.ok(!(campo in rec), campo);
});

// ---------- G. Estatísticas ----------
test("G1. Agregação, alertas, ocultação de números pequenos e CSV", async () => {
  const r = await page.evaluate(() => {
    const M = window.EncaminhaMotor, hoje = new Date();
    const regs = M.gerarExemplo(120);
    const a = M.agregar(regs, "tudo", "Todos");
    const soma = a.semanas.reduce((s, w) => s + w.n, 0);
    const um = [M.registroDeDados({ on: ["hiv"], mun: "Goiânia" }, new Set(["saude"]), hoje)];
    const csv = M.relCsv(M.agregar(um, "30", "Todos"));
    return { n: a.n, soma, alertas: M.alertas(a).length, poucos: M.alertas(M.agregar(um, "30", "Todos"))[0], csvHiv: csv.split("\n").find((l) => l.includes("HIV")),
      filtroMun: M.agregar(regs, "tudo", "Trindade").rs.every((x) => x.mun === "Trindade"), periodo7: M.agregar(regs, "7", "Todos").rs.every((x) => x.dia >= new Date(hoje.getTime() - 6 * 864e5).toISOString().slice(0, 10)) };
  });
  assert.equal(r.n, 120);
  assert.equal(r.soma, 120, "toda semana somada bate com o total");
  assert.ok(r.alertas >= 4, "alertas estratégicos gerados");
  assert.match(r.poucos, /poucos atendimentos/);
  assert.match(r.csvHiv, /<3/, "situação sensível com 1 caso aparece como <3");
  assert.ok(r.filtroMun && r.periodo7);
});

test("G2. Aba Relatórios: sem armazenamento avisa e mostra os painéis com dados de exemplo", async () => {
  await inicio();
  await page.click("#tab-rel");
  assert.match(await page.textContent("#relRoot"), /dados de exemplo/);
  await page.click("#relDemoBtn");
  assert.ok(await page.isVisible(".kpis"));
  assert.ok(await page.isVisible(".insights li"));
  assert.ok(await page.isVisible("svg.chart .bar"));
  await page.click('.seg[data-per="7"]');
  const n7 = Number(await page.textContent(".kpi b"));
  await page.click('.seg[data-per="tudo"]');
  const nT = Number(await page.textContent(".kpi b"));
  assert.ok(n7 < nT, `7 dias (${n7}) < tudo (${nT})`);
  await page.selectOption("#relMun", "Trindade");
  assert.ok(Number(await page.textContent(".kpi b")) < nT);
  assert.deepEqual(erros, []);
});

test("G3. Exemplo pronto não oferece registro nas estatísticas", async () => {
  await inicio();
  await page.click('.case[data-case="familia"]');
  assert.match(await page.textContent("#results"), /não entra nas estatísticas/);
  assert.equal(await page.$("#regBtn"), null);
});

// ---------- H. Desempenho ----------
test("H1. Desempenho: avaliar um perfil leva menos de 2 ms em média", async () => {
  const ms = await page.evaluate(() => {
    const M = window.EncaminhaMotor, d = { idade: 40, pessoas: 4, renda: 600, on: ["c06", "violMulher", "mpu", "aluguel", "drogas"], dem: "bets e AVC" };
    const t0 = performance.now(); for (let i = 0; i < 500; i++) M.avaliar(M.perfil(d)); return (performance.now() - t0) / 500;
  });
  assert.ok(ms < 2, `${ms.toFixed(3)} ms`);
});
