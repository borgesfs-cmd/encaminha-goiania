# Encaminha Goiânia

App de orientação e encaminhamento para políticas públicas (nacionais, do Estado de Goiás e municipais) em Goiânia e região metropolitana. Usado por profissionais da rede (assistência social, saúde, psicologia) e pela população.

Público principal: o **profissional** que faz o encaminhamento, quase sempre pelo celular, com internet. As orientações precisam ser claras e didáticas.

O app é um único arquivo: `index.html` (HTML + CSS + JS puro, sem dependências). O desenho da arquitetura está em `docs/mapa-encaminha.html`. Testes em `tests/` (`npm install` e `npm test`; usam Playwright e o Chromium).

## Regras que não mudam

### LGPD
- Não pedir nem guardar: nome, CPF, NIS, RG, endereço da pessoa, telefone, e-mail.
- Identificação só por **iniciais**.
- Não pedir dados sensíveis (raça/cor, religião, orientação sexual, filiação). Se raça/cor entrar no futuro, que seja opcional, só para estatística e fora do resumo copiado.
- Discriminação é registrada só como "discriminação" (`discrim`), sem perguntar nem guardar raça, religião, origem ou orientação: são dados sensíveis (LGPD, art. 5º, II). O card explica a lei de cada forma.
- Gênero é pedido como opção (Mulher, Homem, Outro, Prefere não dizer); não é dado sensível pela LGPD, mas é sempre opcional.
- O campo livre de solicitação passa pela função `clean()`, que remove e-mails e números com 7 ou mais dígitos (CPF, NIS, RG, telefone, CEP) antes de ir para o resumo. Valores em reais e datas ficam. Nomes não são detectados: o aviso no campo pede para não escrever.
- Dados de saúde (HIV, saúde mental) são sensíveis. Se um dia houver registro de atendimentos identificados, exigir login de profissional, base legal, finalidade e prazo de descarte.
- **Estatísticas (aba Relatórios):** o registro só acontece quando o profissional toca em "Registrar atendimento" no fim do plano. Guarda só categorias e faixas (`registroDeDados`): município, região, gênero, faixa de idade, pessoas (até 7), faixa de renda por pessoa, trabalho, moradia, escolaridade, assuntos, situações marcadas, políticas indicadas, lugares do roteiro, temas reconhecidos e se houve urgência. Nunca iniciais, texto livre, renda ou idade exatas. Exemplos prontos não entram. Nos painéis, situações sensíveis (`SENSIVEIS`) com 1 ou 2 casos aparecem como "menos de 3".

### Dados
- Todo contato precisa ter **fonte** e **data de conferência**. Não inventar telefone ou endereço. Se não confirmar, deixar sem e dizer de onde buscar (121, prefeitura).
- Endereços de serviços públicos podem aparecer. Endereço de abrigo sigiloso (Casa Abrigo Sempre Viva, CEVAM), nunca.
- Linguagem simples, voz ativa, sem jargão de sistema.

## Fluxo do atendimento (aba Atender)
Atendimento guiado, pensado para o celular. Uma tela de cada vez:
1. **Início**: "O que a pessoa precisa?" com 10 assuntos (`NECESSIDADES`): renda e benefícios, comida, moradia, saúde e remédios, saúde mental, violência e proteção, educação, trabalho, documentos, direito negado. Acima, atalhos de urgência (`URGENCIAS`) que vão direto ao plano. Abaixo, **pedido livre**: texto para o que não cabe nos assuntos. Enquanto a pessoa digita, o app mostra as orientações prontas encontradas (`TEMAS`) e sugere assuntos para marcar (`SUGERE_NEC`).
2. **Sobre a pessoa** (sempre, uma tela, `PERFIL_ROWS`): opções prontas para tocar, todas opcionais. Município (Goiânia já marcado), região de Goiânia, gênero, faixa de idade (`FAIXAS`, alinhadas aos cortes das regras: 14, 16, 18, 60, 65), pessoas na casa, renda (atalhos "Sem renda", "R$ 600", 1, 2 e 3 salários, ou valor digitado), trabalho, moradia, escolaridade, cadastro e benefícios, quem mora na casa. Tocar de novo desmarca. Região, idade, pessoas, renda, trabalho, moradia e escolaridade têm "Não sabe ou não quer dizer" (`E.ni`): o campo fica vazio, o plano mostra "Não informado" com o que depende dele (em vez de cobrar a resposta), o resumo copiado registra o que não foi informado e, sem renda, o CadÚnico vira "verificar" no CRAS (`perfil().rendaNi`).
3. **Perguntas do assunto**, uma por tela (`PERGUNTAS`): cada uma tem `quando(estado)` e só aparece se um assunto marcado precisa dela. Por fim, iniciais e o pedido nas palavras da pessoa (já preenchido com o pedido livre).
4. **Plano**: faixa de segurança (inclui a dos temas urgentes do pedido livre), manejo da crise (quando houver), orientações do pedido livre, "Falta uma resposta" (com botão que volta só àquela pergunta e retorna ao plano), roteiro por lugar e urgência ("O que levar e contatos" recolhido em cada lugar), "Por que cada direito foi indicado" e "Avaliados e não indicados" recolhidos, resumo copiável.

O estado do atendimento fica em `E` (só na memória da página; nada é guardado). `dadosAtendimento()` transforma `E` nos dados do `perfil()`. A versão anterior, com formulário em 3 etapas, está em `docs/versao-formulario.html`.

## Aba Relatórios
- Armazenamento: capacidade `db` do artefato (declarar `{db:{}, user:{}, downloads:true}` ao publicar). Um documento por profissional e dia: `registros/<dia>__<id>`, campo `itens` = `{<id do atendimento>: registro}`. Assim cada um escreve só no próprio documento, sem disputa.
- `agregar(registros, período, município)` conta tudo; `alertas()` gera as informações estratégicas (assunto mais frequente, renda até R$ 218, famílias de baixa renda sem CadÚnico, lugar presencial mais acionado, urgências, dependências, pedidos sem orientação, região, respostas que faltam).
- Painéis: atendimentos por semana, assuntos, onde a rede é mais acionada (sem "Pela internet" e "Sem inscrição", ver `NAO_LUGAR`), direitos indicados, situações psicossociais em grupos, renda, idade e gênero, território, lacunas. Exportação em CSV agregado (nunca registros linha a linha) e texto copiável.
- Sem armazenamento (arquivo local, testes), a aba oferece **dados de exemplo** gerados pelo motor (`gerarExemplo`), marcados na tela e nunca gravados.
- O app sempre abre na aba Atender; links diretos: `#rede`, `#servicos`, `#relatorios`.

## Testes
- `tests/motor.test.mjs`: regras, casos e telas principais.
- `tests/rotina.test.mjs`: rotina detalhada (integridade dos dados, 800 perfis aleatórios, cobertura de todas as políticas, limites de renda, todos os fluxos, celular de 360px, acessibilidade, tema escuro, privacidade, estatísticas, desempenho). Relatório em `docs/relatorio-testes.md`.
- Mudou dado ou regra: rode `npm test`. Toda política nova precisa ser alcançada por algum perfil (teste B2).

## Pedido livre (`TEMAS`)
- Cada tema: `k, t, palavras[], passos[], servicos[]` e, se for urgente, `urg` (frase da faixa de segurança). `exceto[]` (só no código, mantido quando a planilha corrige o tema) lista expressões que não contam: "auxílio acidente" não liga a emergência médica.
- Tema com `on[]` não tem passos próprios: liga situações do motor (ex.: "tigrinho" → `apostas`), e o plano mostra o card e o roteiro da política correspondente.
- O texto é comparado sem acento. Palavra de até 3 letras precisa ser inteira; as demais, no começo de uma palavra (evita "dente" em "acidente").
- A busca não entende tempo verbal ("teve AVC" e "está tendo AVC" dão o mesmo tema). Por isso a frase urgente é sempre condicional: "Se está acontecendo agora…".
- Temas atuais: psicoterapia, transtorno mental grave e crise psiquiátrica (com `on`), apostas, jogos eletrônicos, álcool e drogas, discriminação (racismo, xenofobia, intolerância religiosa, LGBTfobia, capacitismo, idadismo) (com `on`), violência sexual, pessoa trans, migrantes, egressos, câncer, tráfico de pessoas, AVC, emergência médica, acidente ou resgate (Bombeiros, com `on`), reabilitação, pessoa acamada, fila de consulta ou cirurgia, pensão e guarda, INSS, desemprego, dívidas e golpes, desastre, funeral e luto, RG e CPF, dentista. Sem tema encontrado, o plano mostra os caminhos gerais.

## Motor de regras
- Renda por pessoa = renda ÷ pessoas. Linhas: R$ 109 (extrema pobreza, usada pelo Estado), R$ 218 (Bolsa Família), 1/4, 1/2, 1, 2 e 3 salários mínimos.
- Salário mínimo padrão: `SM_PADRAO` = R$ 1.621 (2026, Decreto 12.797/2025). Atualizar todo janeiro.
- Cada política em `P[]` tem `test(perfil)`, que devolve `null` (não se aplica) ou `[status, motivo]`. Status: `prov` (provável direito), `ver` (verificar), `enc` (encaminhamento de proteção), `nao` (público certo, mas um critério não bate: o motivo aparece em "não indicados") e `falta` (`["falta","",[campos]]`: falta um dado decisivo, ver `FALTA_RENDA` e `FALTA_IDADE`).
- `avaliar(perfil)` não toca na tela e devolve `{hits, nao, falta, urg, roteiro}`. `perfil(dados)` monta o perfil a partir de dados simples. Os dois ficam em `window.EncaminhaMotor` para os testes.
- Roteiro: `ROTA[id]` lista os passos de cada política como `[lugar, o que fazer, documentos?]` (ou uma função do perfil). `STOPS` define cada lugar (nome, grupo de urgência, contatos, documentos padrão). Sem documentos no passo, valem os do lugar; sem os do lugar, os da política. `CAD_DEP` lista as políticas que dependem do CadÚnico.
- Todo critério novo ou alterado precisa de teste em `tests/motor.test.mjs`.
- Ordem de prioridade: crise suicida, crise psiquiátrica, PEP, violência contra mulher, criança, HIV, alto custo, CAPS, psicoterapia, Ministério Público, CadÚnico, demais.
- Saúde mental tem três caminhos, escolhidos na pergunta "O que a pessoa está vivendo?":
  - `crisePsiq` (crise agora: surto, vozes, agitação, confusão) → `r-psiq`: faixa de segurança com 192 e o Pronto-Socorro Psiquiátrico Wassily Chuc (Goiânia) ou UPA/CAIS 24h (região); lembra que confusão súbita pode ser causa clínica; depois CAPS. Também é atalho de urgência.
  - `mentalGrave` (transtorno grave ou persistente) → `r-caps`: CAPS da região sem encaminhamento (`places("caps")`: por região de Goiânia, CAPSi abaixo de 18 anos, CAPS AD com drogas).
  - `mental` (sofrimento sem crise, quer psicoterapia) → `r-mental`: UBS e clínicas-escola (`places("clinica")`). Explica que CRAS e CREAS não fazem psicoterapia. Some quando há `mentalGrave` ou `crisePsiq`.
- Bombeiros (`resgate`): atalho de urgência "Incêndio, acidente ou resgate (Bombeiros)" e tema do pedido livre; faixa com 193, card `r-resgate` (quando ligar, o que dizer, o que fazer enquanto espera) logo depois de `r-cardio`; serviço `193`.
- Dor no peito (`dorPeito`) e parada cardiorrespiratória (`pcr`): atalhos de urgência e temas do pedido livre; faixa com 192, sinais de infarto (também os atípicos), RCP só com as mãos (100 a 120 por minuto, 5 a 6 cm) e DEA; card `r-cardio` em primeiro lugar.
- Crise suicida (chips "Pensamento de suicídio" e "Tentativa de suicídio ou autolesão recente"): faixa de segurança com 192, 188 e CIATox (0800 646 4350); card "Manejo da crise suicida" aberto, com como perguntar, sinais de risco alto e plano de segurança; roteiro com CVV agora, pronto atendimento agora (só na tentativa) e CAPS ou UBS hoje ou amanhã. Tentativa e autolesão: notificação compulsória em até 24h pelo serviço de saúde (Portaria de Consolidação nº 4/2017; Lei 13.819/2019).
- `places(kind, perfil)` escolhe serviços pelo município e pela região (Conselho Tutelar e CREAS de Goiânia).

## Estrutura dos registros
- **Política**: `id, nome, esf (nac|est|mun|rede), val, test(), flow[], docs[], html (extra opcional), where, extra[] (ids de serviços)`, mais `ROTA[id]` e `CURTO[id]` (nome curto)
- **Serviço**: `id, tipo, mun, reg, nome, end, tel[], email, hor, site, obs` (falta adicionar `fonte` e `conferido_em` em cada um)

## Cobertura atual
- Nacional: CadÚnico, Bolsa Família, Benefício de Prestação Continuada (escrito por extenso na tela; o primeiro passo explica que é o "BPC ou LOAS"), Tarifa Social, Pé-de-Meia, Carteira da Pessoa Idosa, Passe Livre interestadual, Farmácia Popular.
- INSS (pergunta "Algum destes casos do INSS?", `previd`, nos assuntos Renda e Trabalho): `meuinss` (onde conferir o direito: CNIS, Simular aposentadoria, Consultar Pedidos, exigência e recurso em 30 dias, Justiça Federal com a DPU, golpes), aposentadoria (`apos`), auxílio por incapacidade temporária com Atestmed até 90 dias (`incap`), auxílio-acidente (`acid`), pensão por morte (`pensao`), auxílio-reclusão (`reclusao`), salário-maternidade (`salmat`, card próprio, tirado do roteiro de `r-gest`), salário-família (`salfam`, com o chip "Criança de 7 a 14 anos") e facultativo de baixa renda ou MEI (`facult`). Opção `segurado` (contribui ou contribuiu há até 12 meses) ajusta os motivos. Valores de 2026 em `LIM_BAIXA` (R$ 1.980,38) e `COTA_SALFAM` (R$ 67,54), Portaria Interministerial MPS/MF nº 13/2026: atualizar todo janeiro. Lugares novos: `empresa` e `dpu` (Defensoria Pública da União, sem endereço confirmado em Goiânia).
- Educação básica por etapa (pergunta de educação): creche e pré-escola (`r-creche`, Central de Vagas de Goiânia, Tema 548 do STF), ensino fundamental (`r-fund`, SME e Seduc), ensino médio (`r-medio`, CEPI, CEPMG) e Bolsa Estudo, educação especial (`r-especial`: AEE e profissional de apoio sem laudo, Decreto 12.686/2025; recusa é crime), fora da escola (`r-foraescola`). Lugares: `places("educ")` (SME/CREs, Gemul de Aparecida), `places("seduc")` (Seduc e CRE por município), `places("especial")` (CMAI, NAS, escola bilíngue, CEBRAV, APAE, Pestalozzi). Datas de matrícula mudam todo ano: conferir em outubro.
- Educação: Enem e isenção da taxa, Prouni, Fies e Fies Social, Sisu e cotas, ProBem (OVG), assistência estudantil, EJA e Encceja.
- Estadual: Mães de Goiás, Goiás + Inclusivo, Dignidade, Goiás Por Elas, Aluguel Social (Agehab), Passe Livre Estudantil, Aprendiz do Futuro, CIPTEA, Passe Livre PcD, Passaporte da Pessoa Idosa, Crédito Social, 2ª via de registro civil, alto custo (Cemac Juarez Barbosa).
- Dependências: álcool e outras drogas (CAPS AD, Credeq, Unidade de Acolhimento, regras da internação involuntária pela Lei 13.840/2019), apostas e bets (autoexclusão centralizada no gov.br, cuidado no SUS e Meu SUS Digital, dívidas, bloqueio de beneficiários pela Portaria SPA/MF 2.217/2025 em discussão no STF), jogos eletrônicos (UBS, CAPSij, ECA Digital).
- Gestante (`r-gest` e pergunta "Sobre a gestação"): pré-natal, Rede Nascer 155, vinculação à maternidade, maternidades com urgência 24h por município (`places("maternidade")`), acompanhante, salário-maternidade, Meninas de Luz; adolescente (sigilo; menor de 14 = estupro de vulnerável). Situações: `gestAlto` (alto risco, faixa de alerta), `posParto` (Lei 14.721/2023), `entregaAdocao` (Entrega Legal, Juizado da Infância), `lutoPerinatal` (Lei municipal 11.303/2024).
- Apoio psicossocial e dependências: grupos AA, NA, Al-Anon e Amor-Exigente; CRESM (antigo Credeq) com contato conferido; orientação para checar ONG e comunidade terapêutica.
- Segurança alimentar (`r-fome`, roteiro por município via `places("comida")`): Restaurante do Bem (Centro, Campinas, Aparecida, Trindade), restaurantes populares de Aparecida e Senador Canedo, cesta pelo CRAS, Banco de Alimentos da OVG (famílias e entidades), Mesa Brasil Sesc e Cozinha Solidária (só entidades), ONG Tio Cleobaldo.
- Rede: mulher, criança, idoso/PcD, população de rua, saúde mental, gestante, fome, HIV (teste, PEP, PrEP, SAE), Ministério Público (MPGO, MPF, MPT).
- Goiânia: 26 CRAS/centros de convivência, 5 CREAS, Centro POP, 6 Conselhos Tutelares, rede da mulher, Defensoria, CTA/SAE, UPAs com PEP.
- Aparecida: parcial. Demais municípios da RMG: só nacional e estadual.
- Comunitária: PUC Goiás (NPJ, CEPSI, Clínica Escola Vida, CRESA, Cecom), Centro de Psicologia da UFG, Ceap-SOL, CEVAM.

## Banco de dados no Google Planilhas
- Planilha oficial no Google: "Banco de dados Encaminha Goiânia", ID `111MIZct1XosUB0332x1P5tioGbe1i1jrQyQUPpQ5ICI` (localidade pt_BR: fórmulas com `;`). Primeira carga e sincronização em 08/10/2026. Ao escrever pelo conector, proteja com `'` os IDs e textos que parecem número (ex.: `'136`), e use máscaras de campo simples (sem vírgula) no batchUpdate.
- `dados/banco-de-dados-encaminha.xlsx`: abas Leia-me, Serviços, Políticas, Temas, Registros, Resumo e Fontes. Gerada a partir do app por `node scripts/exportar-planilha.mjs` (Playwright + Python/openpyxl).
- Serviços tem Situação (Ativo, A conferir, Inativo), Conferido em, Conferido por e a fórmula "Precisa conferir?" (Sim se nunca conferido ou com mais de 180 dias).
- Os critérios de direito ficam no código; a planilha guarda textos, contatos e palavras-chave. Pedido de mudança de critério: coluna própria na aba Políticas.
- **Sincronização (caminho B, sob pedido):** o app publicado no Claude não busca dados em outro endereço, então a sincronização é feita pelo Claude com os conectores Google Drive e Google Planilhas.
  - Planilha → app: ler as abas Serviços, Políticas e Temas (valores), salvar como JSON `{servicos, politicas, temas}` e rodar `node scripts/planilha-para-app.mjs planilha.json`. O script grava no bloco `<script id="dados-planilha">` do index.html só o que difere dos dados de base, avisa contatos inexistentes, e o app aplica por cima: serviço corrigido, novo ou desativado (Situação = Inativo); texto de política (o critério continua no código); tema corrigido ou novo. Depois: `npm test` e publicar.
  - App → planilha: ler a coleção `registros` do banco do app (ArtifactData list com out_dir), ler a coluna ID da aba Registros, rodar `node scripts/registros-para-planilha.mjs pasta ids.txt` e acrescentar as linhas no fim da aba Registros.
  - Testes: `tests/planilha.test.mjs`.
- **Conexão direta (caminho A, em uso no site):** o site no GitHub Pages lê a planilha e grava registros pelo Apps Script (`apps-script/Codigo.gs`), cuja URL fica na meta `encaminha-api` do `index.html`. Passo a passo e segurança: `docs/conexao-planilha.md`.
  - O app aplica a última leitura guardada no aparelho (`localStorage` enc-planilha) por cima do bloco dados-planilha. Função de leitura das abas: `tabelasParaPlanilha` (a mesma usada por `scripts/planilha-para-app.mjs`).
  - Registros: fila no aparelho (enc-fila) quando falta internet. Relatórios: só com a chave de gestor (Script Properties CHAVE_GESTOR); a coluna U da aba Registros guarda o registro completo.
  - Dentro do Claude (artefato) a URL é ignorada: o artefato não acessa outros endereços e segue com o banco do artefato e a sincronização sob pedido (caminho B).
  - A URL real está no `index.html`: todo teste e script que abre o app bloqueia `script.google.com` (junto com as fontes), para nunca ler nem gravar na planilha de verdade. Página nova em teste: bloquear também.
  - O site aplica os textos da planilha por cima dos do código. Mudou texto de política ou tema no código: atualize também a linha na planilha (abas Políticas e Temas), senão a planilha desfaz a mudança no site. Serviço novo no código: inclua na aba Serviços. Mudou um serviço que está no bloco `dados-planilha` do index.html: tire-o do bloco (ou rode a sincronização), senão o bloco desfaz a mudança.
  - Ao mudar `Codigo.gs`, a pessoa precisa publicar nova versão da implantação. Testes: `tests/conexao.test.mjs` (API simulada) e `tests/apps-script.test.mjs` (serviços Google simulados).

## Levantamentos
- `docs/levantamento-2026-10-08.md`: políticas, rede, ONGs, instituições de ensino e demandas psicossociais, com fonte e grau de confiança de cada item.

## Pendências conhecidas
- Lista de UBS (importar do CNES/DataSUS). CAPS de Goiânia entraram em 09/10/2026 (vários "A conferir": telefones divergem entre páginas da Prefeitura); faltam CAPS AD III Ipê e os CAPS de Aparecida e da RMG. Pronto-Socorro Psiquiátrico Wassily Chuc vai mudar de endereço (anúncio de 2026).
- Não encontrados no levantamento: clínicas-escola de UNIP, Universo, Estácio e Unialfa; Bento Cottolengo; núcleo de enfrentamento ao tráfico de pessoas de Goiás; endereço da Defensoria Pública da União em Goiânia.
- INSS, conferir no gov.br: número da portaria do Atestmed de 2026 e a prorrogação (Portaria Conjunta MPS/INSS nº 43/2026, só vista na imprensa); se o Bolsa Família entra na renda do Benefício de Prestação Continuada; tabela oficial de duração da pensão por morte; prazos da biometria e da CIN; se o auxílio-acidente já pode ser pedido pelo Meu INSS; lei do salário-paternidade de 2026.
- Acompanhar no STF (ADI 7721) o bloqueio de bets para beneficiários do Bolsa Família e do BPC.
- Quadro "Falta uma resposta": `CAMPOS[c].nec` diz em que assuntos vale cobrar renda ou idade.
- Promotorias do MPGO por comarca (site do MPGO não respondia na pesquisa).
- CRAS de Aparecida e dos demais municípios da RMG.
- Telefone do Centro POP de Goiânia diverge entre fontes (endereço novo desde o fim de 2025); telefone do MPT em Goiás.
- Conferir a lista de medicamentos da Farmácia Popular no gov.br (os nomes vieram de conhecimento prévio, não da página oficial).
- Conferir na página oficial os critérios de renda que vieram só do protótipo: Tarifa Social (houve mudança em 2025), Pé-de-Meia, Passe Livre PcD, Crédito Social.
- Aluguel Social: critério corrigido para meio salário mínimo por pessoa (Edital Geral 001/2023 e perguntas frequentes da Agehab). Cada município pode ter edital próprio.
- Dados com data antiga: CRAS (out/2024), UPAs com PEP (2024), cesta de serviços PUC (2023).

## Próximas etapas sugeridas
1. Separar dados do código: `data/politicas.json`, `data/servicos.json`, `data/territorios.json`, com `fonte` e `conferido_em`. Os critérios (`test`) continuam no código, com testes.
2. Guia em linguagem simples para entregar à pessoa (WhatsApp ou impressão), a partir do roteiro.
3. Painel de atualização com login: editar serviços e políticas, fila de conferência (amarelo > 6 meses, oculto > 12 meses), sugestões de cadastro da rede (igrejas, ONGs, universidades) com aprovação.
4. Busca por CEP para indicar CRAS, UBS e CAPS mais próximos.

## Fontes principais
- Seds/GO: https://goias.gov.br/social/projetos-de-participacao-social/ e https://goias.gov.br/social/unidadescrasgoiania/
- SES/GO alto custo: https://goias.gov.br/saude/?p=37536
- Farmácia Popular: https://www.gov.br/saude/pt-br/composicao/sectics/farmacia-popular
- CTA Goiânia: https://www.goiania.go.gov.br/secretaria/secretaria-municipal-de-saude/centros-de-referencia/centro-de-testagem-e-acolhimento-cta/
- Rede da mulher (TRT-18): https://www.trt18.jus.br/portal/ouvidoria/enfrentamento-a-violencia-domestica/
- Agehab Aluguel Social: https://goias.gov.br/agehab/programa-pra-ter-onde-morar-aluguel-social-edital-geral/
- Defensoria: https://www2.defensoria.go.def.br/
- MPF Goiás: https://www.mpf.mp.br/o-mpf/unidades/pr-go/contato-1
