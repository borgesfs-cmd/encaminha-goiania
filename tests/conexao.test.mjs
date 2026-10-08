// Conexão direta com a planilha (site fora do Claude): o Apps Script é simulado pelo Playwright.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

const API = "https://script.google.com/macros/s/TESTE_encaminha/exec";
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const tmp = mkdtempSync(join(tmpdir(), "conexao-"));
const COM_API = join(tmp, "com-api.html");
writeFileSync(COM_API, html.replace('<meta name="encaminha-api" content="">', `<meta name="encaminha-api" content="${API}">`));
const SEM_API = new URL("../index.html", import.meta.url).href;
const CHAVE = "chave-teste-123";
const CAB_S = ["ID (não altere)", "Nome", "Tipo", "Município", "Região de Goiânia", "Endereço", "Telefones (separe com /)", "E-mail", "Horário", "Site", "Observação", "Fonte", "Situação", "Conferido em", "Conferido por (setor)", "Precisa conferir?"];

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => browser && browser.close());

/* Planilha simulada: a aba Serviços com o CEVAM corrigido; Políticas e Temas só com cabeçalho. */
function planilhaSimulada(obs) {
  return {
    ok: true, lidoEm: "2026-10-09T13:30:00.000Z",
    servicos: [CAB_S, ["cevam", "CEVAM, Centro de Valorização da Mulher Consuelo Nasser", "Rede comunitária e gratuita", "Goiânia", "", "", "(62) 99144-5948", "", "", "", obs, "", "Ativo", "09/10/2026", "CRAS Norte", "Não"]],
    politicas: [["ID (não altere)", "Nome"]],
    temas: [["Chave (não altere)", "Título"]],
  };
}

/* Abre o site com a API simulada. `api` guarda o estado do servidor e o que ele recebeu. */
async function abrir({ url = "file://" + COM_API, api = {} } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const erros = [];
  page.on("pageerror", (e) => erros.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  Object.assign(api, { pedidos: [], posts: [], obs: api.obs || "Atualizado pela planilha.", offline: false, registros: api.registros || [] });
  await page.route("https://script.google.com/**", async (route) => {
    const req = route.request(), u = new URL(req.url());
    api.pedidos.push(req.method() + " " + (u.searchParams.get("acao") || ""));
    if (api.offline) return route.abort("internetdisconnected");
    const responder = (obj) => route.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(obj) });
    if (req.method() === "POST") {
      const corpo = JSON.parse(req.postData());
      api.posts.push(corpo);
      return responder({ ok: true, gravados: corpo.registros.map((r) => r.id) });
    }
    if (u.searchParams.get("acao") === "registros") {
      api.chaves = (api.chaves || []).concat(u.searchParams.get("chave"));
      return responder(u.searchParams.get("chave") === CHAVE ? { ok: true, registros: api.registros } : { ok: false, erro: "chave" });
    }
    return responder(planilhaSimulada(api.obs));
  });
  await page.goto(url, { waitUntil: "load" });
  return { ctx, page, api, erros };
}

async function irAoPlano(page) {
  await page.click('.tile[data-need="renda"]');
  await page.click("#start");
  await page.click("#qSkip");
  await page.waitForSelector("#vPlano:not([hidden])");
}

test("sem URL configurada o app não chama o Apps Script", async () => {
  const { ctx, page, api, erros } = await abrir({ url: SEM_API });
  await page.waitForTimeout(300);
  assert.deepEqual(api.pedidos, []);
  assert.equal(await page.evaluate(() => window.EncaminhaMotor.API), "");
  assert.equal(await page.textContent("#conexao"), "");
  assert.deepEqual(erros, []);
  await ctx.close();
});

test("abre, lê a planilha e aplica na hora quando o atendimento ainda não começou", async () => {
  const { ctx, page, api, erros } = await abrir();
  await page.waitForFunction(() => /lidos em/.test(document.getElementById("conexao").textContent));
  assert.ok(api.pedidos.includes("GET dados"));
  await page.click("#tab-serv");
  await page.fill("#fq", "CEVAM");
  assert.match(await page.textContent("#p-serv"), /Atualizado pela planilha\./);
  assert.match(await page.textContent("#p-serv"), /Conferido em 09\/10\/2026/);
  assert.equal(await page.isVisible("#avisoDados"), false);
  assert.deepEqual(erros, []);
  await ctx.close();
});

test("dados novos durante um atendimento: aviso para atualizar, sem recarregar sozinho", async () => {
  const { ctx, page, api } = await abrir();
  await page.waitForFunction(() => /lidos em/.test(document.getElementById("conexao").textContent));
  await page.click('.tile[data-need="saude"]');
  api.obs = "Outra mudança feita pela equipe.";
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await page.waitForSelector("#avisoDados");
  assert.equal(await page.getAttribute('.tile[data-need="saude"]', "aria-pressed"), "true", "o atendimento continua na tela");
  await page.click("#avisoFechar");
  assert.equal(await page.isVisible("#avisoDados"), false, "dá para fechar o aviso e seguir o atendimento");
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await page.waitForSelector("#avisoDados");
  await Promise.all([page.waitForEvent("load"), page.click("#avisoAtualizar")]);
  await page.click("#tab-serv");
  await page.fill("#fq", "CEVAM");
  assert.match(await page.textContent("#p-serv"), /Outra mudança feita pela equipe\./);
  await ctx.close();
});

test("sem internet usa a última leitura guardada e avisa no rodapé", async () => {
  const { ctx, page, api } = await abrir();
  await page.waitForFunction(() => /lidos em/.test(document.getElementById("conexao").textContent));
  api.offline = true;
  await page.reload({ waitUntil: "load" });
  await page.waitForFunction(() => /Sem conexão com a planilha: usando a leitura de/.test(document.getElementById("conexao").textContent));
  await page.click("#tab-serv");
  await page.fill("#fq", "CEVAM");
  assert.match(await page.textContent("#p-serv"), /Atualizado pela planilha\./);
  await ctx.close();
});

test("registrar atendimento grava na aba Registros só dados anônimos, nas 20 colunas", async () => {
  const { ctx, page, api } = await abrir();
  await page.waitForFunction(() => /lidos em/.test(document.getElementById("conexao").textContent));
  await page.fill("#hDem", "Maria, CPF 123.456.789-00, precisa de fisioterapia");
  await irAoPlano(page);
  await page.click("#regBtn");
  await page.waitForFunction(() => document.getElementById("regBtn").textContent === "Registrado ✓");
  assert.equal(api.posts.length, 1);
  const [r] = api.posts[0].registros;
  assert.equal(api.posts[0].acao, "registrar");
  assert.equal(r.linha.length, 20);
  assert.equal(r.linha[0], r.id);
  assert.equal(r.dados.id, r.id);
  assert.match(r.id, /^[a-z0-9]{6,24}$/, "formato aceito pelo Apps Script");
  const tudo = JSON.stringify(r);
  assert.doesNotMatch(tudo, /Maria|123\.456|precisa de/, "texto livre não sai do aparelho");
  assert.ok(!("dem" in r.dados) && !("ini" in r.dados));
  assert.ok(r.dados.temas.includes("reabilitacao"), "só a categoria do pedido livre");
  assert.equal(await page.evaluate(() => localStorage.getItem("enc-fila")), "[]");
  await ctx.close();
});

test("sem internet o registro fica na fila do aparelho e sai quando a conexão volta", async () => {
  const { ctx, page, api } = await abrir();
  await page.waitForFunction(() => /lidos em/.test(document.getElementById("conexao").textContent));
  await page.fill("#hDem", "precisa de fisioterapia");
  await irAoPlano(page);
  api.offline = true;
  await page.click("#regBtn");
  await page.waitForFunction(() => /guardado no aparelho/.test(document.getElementById("regBtn").textContent));
  assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem("enc-fila"))).length, 1);
  assert.match(await page.textContent("#conexao"), /1 atendimento aguardando internet/);
  api.offline = false;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await page.waitForFunction(() => localStorage.getItem("enc-fila") === "[]");
  assert.equal(api.posts.length, 1);
  assert.equal(api.posts[0].registros.length, 1);
  await ctx.close();
});

test("relatórios: só com a chave de gestor; chave errada avisa; chave certa mostra os painéis", async () => {
  const api = {};
  const { ctx, page } = await abrir({ api });
  await page.waitForFunction(() => /lidos em/.test(document.getElementById("conexao").textContent));
  api.registros = await page.evaluate(() => window.EncaminhaMotor.gerarExemplo(12).map((r, i) => ({ ...r, id: "teste" + i, dia: new Date().toISOString().slice(0, 10) })));
  await page.click("#tab-rel");
  await page.waitForSelector("#relChaveForm");
  assert.equal(await page.isVisible(".kpis"), false);
  await page.fill("#relChave", "errada");
  await page.click('#relChaveForm [type="submit"]');
  await page.waitForFunction(() => /A chave não confere/.test(document.getElementById("relRoot").textContent));
  await page.fill("#relChave", CHAVE);
  await page.click('#relChaveForm [type="submit"]');
  await page.waitForSelector(".kpis");
  assert.match(await page.textContent(".kpis"), /12/);
  assert.deepEqual(api.chaves, ["errada", CHAVE]);
  // a chave fica no aparelho do gestor até ele sair
  await page.reload({ waitUntil: "load" });
  await page.click("#tab-rel");
  await page.waitForSelector(".kpis");
  await page.click("#relSair");
  await page.waitForSelector("#relChaveForm");
  assert.equal(await page.evaluate(() => localStorage.getItem("enc-chave")), null);
  await ctx.close();
});

test("dentro do Claude a URL é ignorada (o artefato não acessa outros endereços)", async () => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const pedidos = [];
  await page.route("https://script.google.com/**", (r) => { pedidos.push(r.request().url()); r.abort(); });
  await page.addInitScript(() => { window.claude = { use: async () => null }; });
  await page.goto("file://" + COM_API, { waitUntil: "load" });
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => window.EncaminhaMotor.API), "");
  assert.deepEqual(pedidos, []);
  await ctx.close();
});
