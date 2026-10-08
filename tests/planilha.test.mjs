// Sincronização com o Google Planilhas: planilha → app e app → planilha.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const raiz = fileURLToPath(new URL("..", import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), "planilha-"));

test("planilha → app: corrige telefone, desativa serviço, cria tema e avisa contato inexistente", async () => {
  const cabS = ["ID (não altere)", "Nome", "Tipo", "Município", "Região de Goiânia", "Endereço", "Telefones (separe com /)", "E-mail", "Horário", "Site", "Observação", "Fonte", "Situação", "Conferido em", "Conferido por (setor)", "Precisa conferir?"];
  const planilha = {
    servicos: [cabS,
      ["cevam", "CEVAM, Centro de Valorização da Mulher Consuelo Nasser", "Rede comunitária e gratuita", "Goiânia", "", "", "(62) 90000-0000", "", "", "", "Telefone novo.", "", "Ativo", "09/10/2026", "CRAS Norte", "Não"],
      ["puc-cecom", "Cecom", "Rede comunitária e gratuita", "Goiânia", "", "", "", "", "", "", "", "", "Inativo", "", "", ""],
      ["oculos-social", "Óculos Social (exemplo)", "Saúde", "Goiânia", "", "Rua Teste, 1", "(62) 3000-0000", "", "", "", "Óculos a preço social.", "", "Ativo", "09/10/2026", "Gestão", "Não"]],
    politicas: [["ID (não altere)", "Nome", "Nome curto", "Esfera", "Valor ou benefício", "Passo a passo (um passo por linha)", "Documentos (um por linha)", "Onde ir", "Outros contatos (IDs da aba Serviços)"],
      ["fpop", "Farmácia Popular", "Farmácia Popular", "Nacional", "Gratuito", "Levar a receita.\nIr à farmácia credenciada.", "Receita", "", "fp, contato-que-nao-existe"]],
    temas: [["Chave (não altere)", "Título", "Palavras-chave (sem acento, separadas por vírgula)", "Liga a situação do app", "Passo a passo (um por linha)", "Contatos (IDs da aba Serviços)", "Frase de urgência"],
      ["oculos", "Óculos e saúde dos olhos", "oculos, oftalmo, enxergar", "", "Pedir consulta na UBS.\nÓculos a preço social: ver contato.", "oculos-social", ""]],
  };
  writeFileSync(join(tmp, "planilha.json"), JSON.stringify(planilha));
  const saida = execFileSync("node", [join(raiz, "scripts/planilha-para-app.mjs"), join(tmp, "planilha.json"), join(tmp, "index.html")], { encoding: "utf8" });
  assert.match(saida, /Serviços alterados, novos ou desativados: 3/);
  assert.match(saida, /contato-que-nao-existe/);
  const b = await chromium.launch(); const p = await b.newPage();
  await p.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const erros = []; p.on("pageerror", (e) => erros.push(e.message));
  await p.goto("file://" + join(tmp, "index.html"), { waitUntil: "domcontentloaded" });
  const r = await p.evaluate(() => {
    const M = window.EncaminhaMotor, D = M._dados;
    return { tel: D.S.find((s) => s.id === "cevam").tel, cecom: !!D.S.find((s) => s.id === "puc-cecom"), novo: !!D.S.find((s) => s.id === "oculos-social"),
      tema: M.temasDe("minha filha precisa de oculos").map((t) => t.k), flow: D.P.find((x) => x.id === "fpop").flow };
  });
  await b.close();
  assert.deepEqual(erros, []);
  assert.deepEqual(r.tel, ["(62) 90000-0000"]);
  assert.equal(r.cecom, false, "serviço inativo sai do app");
  assert.equal(r.novo, true);
  assert.deepEqual(r.tema, ["oculos"]);
  assert.deepEqual(r.flow, ["Levar a receita.", "Ir à farmácia credenciada."]);
});

test("app → planilha: registros viram linhas legíveis e não se repetem", () => {
  const pasta = join(tmp, "db", "registros"); mkdirSync(pasta, { recursive: true });
  const rec = { v: 1, id: "r1", dia: "2026-10-08", hora: 10, mun: "Goiânia", reg: "norte", gen: "mulher", faixa: "30-59", pess: 4, renda: "ate218", trab: "desempregado", mor: "alugada", escol: "medio",
    nec: ["renda", "comida"], sit: ["c06", "fome"], pol: ["cad:prov", "pbf:prov"], nao: [], paradas: ["cras", "auto"], temas: [], semTema: false, urg: false, falta: [] };
  writeFileSync(join(pasta, "2026-10-08__u1.json"), JSON.stringify({ id: "2026-10-08__u1", data: { dia: "2026-10-08", itens: { r1: rec, r2: { ...rec, id: "r2", hora: 11 } } } }));
  writeFileSync(join(tmp, "ja.txt"), "r2\n");
  const linhas = JSON.parse(execFileSync("node", [join(raiz, "scripts/registros-para-planilha.mjs"), join(tmp, "db"), join(tmp, "ja.txt")], { encoding: "utf8" }));
  assert.equal(linhas.length, 1);
  const l = linhas[0];
  assert.equal(l.length, 20);
  assert.deepEqual(l.slice(0, 9), ["r1", "08/10/2026", 10, "Goiânia", "Norte", "Mulher", "30 a 59", 4, "De R$ 110 a R$ 218"]);
  assert.equal(l[12], "Renda e benefícios; Comida");
  assert.match(l[14], /CadÚnico \(provável direito\)/);
  assert.equal(l[15], "CRAS de referência", "passos que não são serviço presencial ficam de fora");
  assert.deepEqual(l.slice(17, 19), ["Não", "Não"]);
});
