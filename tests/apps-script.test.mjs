// Apps Script da planilha (apps-script/Codigo.gs) rodando com serviços do Google simulados.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const codigo = readFileSync(new URL("../apps-script/Codigo.gs", import.meta.url), "utf8");

/* Planilha em memória com o mínimo que o script usa. */
function ambiente(abas) {
  const props = {}, cache = {};
  const aba = (nome) => {
    const linhas = abas[nome];
    if (!linhas) return null;
    const largura = () => Math.max(...linhas.map((l) => l.length));
    const intervalo = (r, c, nr, nc) => ({
      getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => (linhas[r - 1 + i] || [])[c - 1 + j] ?? "")),
      getDisplayValues() { return this.getValues().map((l) => l.map(String)); },
      setValues: (v) => v.forEach((l, i) => { linhas[r - 1 + i] = linhas[r - 1 + i] || []; l.forEach((x, j) => (linhas[r - 1 + i][c - 1 + j] = x)); }),
      setValue: (x) => { linhas[r - 1] = linhas[r - 1] || []; linhas[r - 1][c - 1] = x; },
    });
    return {
      getLastRow: () => linhas.length,
      getRange: (r, c, nr = 1, nc = 1) => intervalo(r, c, nr, nc),
      getDataRange: () => intervalo(1, 1, linhas.length, largura()),
      appendRow: (l) => linhas.push(l),
      hideColumns: () => {},
    };
  };
  const saidas = [];
  const ctx = {
    SpreadsheetApp: { getActive: () => ({ getSheetByName: aba }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] ?? null, setProperty: (k, v) => (props[k] = v), deleteProperty: (k) => delete props[k] }) },
    CacheService: { getScriptCache: () => ({
      get: (k) => cache[k] ?? null, put: (k, v) => (cache[k] = v), remove: (k) => delete cache[k],
      getAll: (ks) => Object.fromEntries(ks.filter((k) => k in cache).map((k) => [k, cache[k]])), putAll: (o) => Object.assign(cache, o),
    }) },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
    Utilities: { getUuid: () => "1234abcd-5678-90ef-aaaa-bbbbccccdddd" },
    ContentService: { MimeType: { JSON: "json" }, createTextOutput: (t) => { saidas.push(t); return { setMimeType: () => JSON.parse(t) }; } },
    console: { log: () => {}, error: () => {} },
  };
  vm.createContext(ctx);
  vm.runInContext(codigo, ctx);
  return { ctx, props, cache, abas };
}

const CAB_REG = ["ID", "Data", "Hora", "Município", "Região", "Gênero", "Faixa", "Pessoas", "Renda", "Trabalho", "Moradia", "Escolaridade", "Assuntos", "Situações", "Direitos", "Lugares", "Temas", "Sem orientação", "Urgência", "Falta"];
const novo = () => ambiente({
  "Serviços": [["ID (não altere)", "Nome", "Telefones"], ["136", "Disque Saúde", "136"], ["", "", ""], ["cevam", "CEVAM", "(62) 99144-5948"]],
  "Políticas": [["ID (não altere)", "Nome"], ["cad", "CadÚnico"]],
  "Temas": [["Chave (não altere)", "Título"], ["avc", "AVC"]],
  "Registros": [CAB_REG.slice()],
});
const reg = (id, extra = {}) => ({ id, linha: [id, ...Array(19).fill("x")], dados: { id, dia: "2026-10-09", ...extra } });
const post = (amb, corpo) => amb.ctx.doPost({ postData: { contents: JSON.stringify(corpo) } });

test("doGet dados: devolve as três abas sem linhas vazias e usa o cache", () => {
  const amb = novo();
  const r = amb.ctx.doGet({ parameter: {} });
  assert.equal(r.ok, true);
  assert.deepEqual(r.servicos.map((l) => l[0]), ["ID (não altere)", "136", "cevam"]);
  assert.equal(r.politicas.length, 2);
  assert.equal(r.temas.length, 2);
  amb.abas["Serviços"].push(["novo", "Novo", ""]);
  assert.equal(amb.ctx.doGet({ parameter: { acao: "dados" } }).servicos.length, 3, "dentro dos 5 minutos vem do cache");
  amb.ctx.onEdit();
  assert.equal(amb.ctx.doGet({ parameter: { acao: "dados" } }).servicos.length, 4, "editar a planilha limpa o cache");
});

test("configurar cria a chave, o cabeçalho da coluna U e devolve a mesma chave depois", () => {
  const amb = novo();
  const k = amb.ctx.configurar();
  assert.match(k, /^[0-9a-f]{12}$/);
  assert.equal(amb.abas.Registros[0][20], "Dados do app (não altere)");
  assert.equal(amb.ctx.configurar(), k);
});

test("doPost grava registros válidos, atualiza pelo ID e recusa os inválidos", () => {
  const amb = novo();
  assert.deepEqual(post(amb, { acao: "registrar", registros: [reg("abc123def"), reg("zzz999yyy")] }), { ok: true, gravados: ["abc123def", "zzz999yyy"] });
  assert.equal(amb.abas.Registros.length, 3);
  assert.equal(JSON.parse(amb.abas.Registros[1][20]).id, "abc123def");
  // o mesmo ID atualiza a linha em vez de duplicar
  post(amb, { acao: "registrar", registros: [reg("abc123def", { urg: true })] });
  assert.equal(amb.abas.Registros.length, 3);
  assert.equal(JSON.parse(amb.abas.Registros[1][20]).urg, true);
  // inválidos
  const ruins = [
    { ...reg("abc123def"), linha: ["abc123def"] },
    reg("ID-COM-MAIUSCULA"),
    { ...reg("qqq111www"), dados: { id: "outro" } },
    { ...reg("qqq111www"), linha: ["qqq111www", ...Array(19).fill("x".repeat(900))] },
  ];
  assert.equal(post(amb, { acao: "registrar", registros: ruins }).ok, false);
  assert.equal(amb.ctx.doPost({ postData: { contents: "não é json" } }).erro, "formato");
  assert.equal(post(amb, { acao: "apagar" }).erro, "acao");
  assert.equal(amb.abas.Registros.length, 3);
});

test("doPost: texto que viraria fórmula entra como texto; no máximo 20 por envio", () => {
  const amb = novo();
  const r = reg("form0001");
  r.linha[3] = "=IMPORTXML(\"http://x\")";
  r.linha[4] = "+5";
  post(amb, { acao: "registrar", registros: [r] });
  assert.equal(amb.abas.Registros[1][3], "'=IMPORTXML(\"http://x\")");
  assert.equal(amb.abas.Registros[1][4], "'+5");
  const muitos = Array.from({ length: 25 }, (_, i) => reg("lote" + String(i).padStart(4, "0")));
  assert.equal(post(amb, { acao: "registrar", registros: muitos }).gravados.length, 20);
});

test("doGet registros: só com a chave de gestor", () => {
  const amb = novo();
  post(amb, { acao: "registrar", registros: [reg("abc123def")] });
  assert.deepEqual(amb.ctx.doGet({ parameter: { acao: "registros", chave: "qualquer" } }), { ok: false, erro: "chave" }, "sem chave configurada ninguém lê");
  const k = amb.ctx.configurar();
  assert.equal(amb.ctx.doGet({ parameter: { acao: "registros" } }).erro, "chave");
  assert.equal(amb.ctx.doGet({ parameter: { acao: "registros", chave: "errada" } }).erro, "chave");
  const r = amb.ctx.doGet({ parameter: { acao: "registros", chave: k } });
  assert.equal(r.ok, true);
  assert.deepEqual(r.registros.map((x) => x.id), ["abc123def"]);
  const nova = amb.ctx.trocarChave();
  assert.notEqual(nova, undefined);
  assert.equal(amb.ctx.doGet({ parameter: { acao: "registros", chave: nova } }).ok, true);
});
