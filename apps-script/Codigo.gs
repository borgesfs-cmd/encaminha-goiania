/**
 * Encaminha Goiânia: ponte entre o site e esta planilha.
 *
 * O site lê as abas Serviços, Políticas e Temas (doGet) e grava os atendimentos
 * registrados na aba Registros (doPost). Os relatórios só saem com a chave de gestor.
 *
 * Instalação (uma vez):
 *  1. Na planilha: Extensões > Apps Script. Apague o conteúdo e cole este arquivo.
 *  2. Rode a função "configurar" (botão Executar) e autorize. A chave de gestor
 *     aparece no Registro de execução: guarde-a, ela abre a aba Relatórios do site.
 *  3. Implantar > Nova implantação > Tipo: App da Web.
 *     Executar como: Eu. Quem pode acessar: Qualquer pessoa. Copie a URL /exec.
 * Ao mudar este código: Implantar > Gerenciar implantações > editar > Nova versão.
 */

const ABA_REGISTROS = "Registros";
const COLUNAS_LINHA = 20;          // A a T: colunas legíveis da aba Registros
const COLUNA_DADOS = 21;           // U: o registro completo, para os relatórios do site
const MAX_POR_ENVIO = 20;
const CACHE_SEGUNDOS = 300;
const CACHE_PEDACO = 90000;        // o CacheService guarda até 100 KB por chave

function doGet(e) {
  const p = (e && e.parameter) || {};
  try {
    if (!p.acao || p.acao === "dados") return json_(dadosComCache_());
    if (p.acao === "registros") {
      if (!chaveOk_(p.chave)) return json_({ ok: false, erro: "chave" });
      return json_({ ok: true, registros: lerRegistros_() });
    }
    return json_({ ok: false, erro: "acao" });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, erro: "interno" });
  }
}

function doPost(e) {
  let corpo;
  try { corpo = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, erro: "formato" }); }
  if (!corpo || corpo.acao !== "registrar" || !Array.isArray(corpo.registros)) return json_({ ok: false, erro: "acao" });
  const lista = corpo.registros.slice(0, MAX_POR_ENVIO).filter(registroValido_);
  if (!lista.length) return json_({ ok: false, erro: "vazio" });

  const trava = LockService.getScriptLock();
  trava.waitLock(20000);
  try {
    const aba = SpreadsheetApp.getActive().getSheetByName(ABA_REGISTROS);
    garantirColunas_(aba);
    const ultima = aba.getLastRow();
    const ids = ultima > 1 ? aba.getRange(2, 1, ultima - 1, 1).getDisplayValues().map((r) => r[0]) : [];
    const gravados = [];
    lista.forEach((r) => {
      const linha = r.linha.map(texto_).concat([JSON.stringify(r.dados)]);
      const i = ids.indexOf(r.id);
      if (i >= 0) aba.getRange(i + 2, 1, 1, COLUNA_DADOS).setValues([linha]);
      else { aba.appendRow(linha); ids.push(r.id); }
      gravados.push(r.id);
    });
    return json_({ ok: true, gravados: gravados });
  } finally {
    trava.releaseLock();
  }
}

/* Edição na planilha: o site vê a mudança na próxima abertura, sem esperar o cache. */
function onEdit() {
  CacheService.getScriptCache().remove("dados:n");
}

/* Rode uma vez depois de colar o código. Também serve para ver a chave de novo. */
function configurar() {
  const props = PropertiesService.getScriptProperties();
  let chave = props.getProperty("CHAVE_GESTOR");
  if (!chave) {
    chave = Utilities.getUuid().replace(/-/g, "").slice(0, 12);
    props.setProperty("CHAVE_GESTOR", chave);
  }
  const aba = SpreadsheetApp.getActive().getSheetByName(ABA_REGISTROS);
  garantirColunas_(aba);
  aba.getRange(1, COLUNA_DADOS).setValue("Dados do app (não altere)");
  aba.hideColumns(COLUNA_DADOS);
  console.log("Chave de gestor: " + chave);
  return chave;
}

/* Troca a chave (por exemplo, quando alguém sai da gestão). */
function trocarChave() {
  PropertiesService.getScriptProperties().deleteProperty("CHAVE_GESTOR");
  return configurar();
}

/* A aba Registros precisa ter a coluna U (registro completo). */
function garantirColunas_(aba) {
  const falta = COLUNA_DADOS - aba.getMaxColumns();
  if (falta > 0) aba.insertColumnsAfter(aba.getMaxColumns(), falta);
}

function dadosComCache_() {
  const cache = CacheService.getScriptCache();
  const n = Number(cache.get("dados:n"));
  if (n) {
    const partes = cache.getAll(Array.from({ length: n }, (_, i) => "dados:" + i));
    const texto = Array.from({ length: n }, (_, i) => partes["dados:" + i]).join("");
    if (Object.keys(partes).length === n) return JSON.parse(texto);
  }
  const dados = {
    ok: true,
    lidoEm: new Date().toISOString(),
    servicos: lerAba_("Serviços"),
    politicas: lerAba_("Políticas"),
    temas: lerAba_("Temas"),
  };
  const texto = JSON.stringify(dados);
  const pedacos = {};
  for (let i = 0; i * CACHE_PEDACO < texto.length; i++) pedacos["dados:" + i] = texto.slice(i * CACHE_PEDACO, (i + 1) * CACHE_PEDACO);
  cache.putAll(pedacos, CACHE_SEGUNDOS);
  cache.put("dados:n", String(Object.keys(pedacos).length), CACHE_SEGUNDOS);
  return dados;
}

/* Valores como aparecem na tela (datas dd/mm/aaaa, "136" como texto), só linhas com ID. */
function lerAba_(nome) {
  const aba = SpreadsheetApp.getActive().getSheetByName(nome);
  if (!aba) return [];
  return aba.getDataRange().getDisplayValues().filter((linha, i) => i === 0 || String(linha[0]).trim());
}

function lerRegistros_() {
  const aba = SpreadsheetApp.getActive().getSheetByName(ABA_REGISTROS);
  const ultima = aba.getLastRow();
  if (ultima < 2) return [];
  return aba.getRange(2, COLUNA_DADOS, ultima - 1, 1).getValues().map((r) => {
    try { return JSON.parse(r[0]); } catch (err) { return null; }
  }).filter((r) => r && typeof r === "object");
}

function registroValido_(r) {
  if (!r || typeof r.id !== "string" || !/^[a-z0-9]{6,24}$/.test(r.id)) return false;
  if (!Array.isArray(r.linha) || r.linha.length !== COLUNAS_LINHA || r.linha[0] !== r.id) return false;
  if (!r.linha.every((v) => (typeof v === "string" || typeof v === "number") && String(v).length <= 800)) return false;
  if (!r.dados || typeof r.dados !== "object" || r.dados.id !== r.id) return false;
  return JSON.stringify(r.dados).length <= 8000;
}

/* Texto que começa com = + - @ viraria fórmula: entra como texto. */
function texto_(v) {
  const s = String(v);
  return /^[=+\-@]/.test(s) ? "'" + s : v;
}

function chaveOk_(c) {
  const chave = PropertiesService.getScriptProperties().getProperty("CHAVE_GESTOR");
  return !!chave && typeof c === "string" && c === chave;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
