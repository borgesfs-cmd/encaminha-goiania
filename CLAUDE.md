# Encaminha Goiânia

App de orientação e encaminhamento para políticas públicas (nacionais, do Estado de Goiás e municipais) em Goiânia e região metropolitana. Usado por profissionais da rede (assistência social, saúde, psicologia) e pela população.

Público principal: o **profissional** que faz o encaminhamento, quase sempre pelo celular, com internet. As orientações precisam ser claras e didáticas.

O app é um único arquivo: `index.html` (HTML + CSS + JS puro, sem dependências). O desenho da arquitetura está em `docs/mapa-encaminha.html`. Testes em `tests/` (`npm install` e `npm test`; usam Playwright e o Chromium).

## Regras que não mudam

### LGPD
- Não pedir nem guardar: nome, CPF, NIS, RG, endereço da pessoa, telefone, e-mail.
- Identificação só por **iniciais**.
- Não pedir dados sensíveis (raça/cor, religião, orientação sexual, filiação). Se raça/cor entrar no futuro, que seja opcional, só para estatística e fora do resumo copiado.
- Gênero é pedido como opção (Mulher, Homem, Outro, Prefere não dizer); não é dado sensível pela LGPD, mas é sempre opcional.
- O campo livre de solicitação passa pela função `clean()`, que remove e-mails e números com 7 ou mais dígitos (CPF, NIS, RG, telefone, CEP) antes de ir para o resumo. Valores em reais e datas ficam. Nomes não são detectados: o aviso no campo pede para não escrever.
- Dados de saúde (HIV, saúde mental) são sensíveis. Se um dia houver registro de atendimentos, exigir login de profissional, base legal, finalidade e prazo de descarte.

### Dados
- Todo contato precisa ter **fonte** e **data de conferência**. Não inventar telefone ou endereço. Se não confirmar, deixar sem e dizer de onde buscar (121, prefeitura).
- Endereços de serviços públicos podem aparecer. Endereço de abrigo sigiloso (Casa Abrigo Sempre Viva, CEVAM), nunca.
- Linguagem simples, voz ativa, sem jargão de sistema.

## Fluxo do atendimento (aba Atender)
Atendimento guiado, pensado para o celular. Uma tela de cada vez:
1. **Início**: "O que a pessoa precisa?" com 10 assuntos (`NECESSIDADES`): renda e benefícios, comida, moradia, saúde e remédios, saúde mental, violência e proteção, educação, trabalho, documentos, direito negado. Acima, atalhos de urgência (`URGENCIAS`) que vão direto ao plano. Abaixo, **pedido livre**: texto para o que não cabe nos assuntos. Enquanto a pessoa digita, o app mostra as orientações prontas encontradas (`TEMAS`) e sugere assuntos para marcar (`SUGERE_NEC`).
2. **Sobre a pessoa** (sempre, uma tela, `PERFIL_ROWS`): opções prontas para tocar, todas opcionais. Município (Goiânia já marcado), região de Goiânia, gênero, faixa de idade (`FAIXAS`, alinhadas aos cortes das regras: 14, 16, 18, 60, 65), pessoas na casa, renda (atalhos "Sem renda", "R$ 600", 1, 2 e 3 salários, ou valor digitado), trabalho, moradia, escolaridade, cadastro e benefícios, quem mora na casa. Tocar de novo desmarca.
3. **Perguntas do assunto**, uma por tela (`PERGUNTAS`): cada uma tem `quando(estado)` e só aparece se um assunto marcado precisa dela. Por fim, iniciais e o pedido nas palavras da pessoa (já preenchido com o pedido livre).
4. **Plano**: faixa de segurança (inclui a dos temas urgentes do pedido livre), manejo da crise (quando houver), orientações do pedido livre, "Falta uma resposta" (com botão que volta só àquela pergunta e retorna ao plano), roteiro por lugar e urgência ("O que levar e contatos" recolhido em cada lugar), "Por que cada direito foi indicado" e "Avaliados e não indicados" recolhidos, resumo copiável.

O estado do atendimento fica em `E` (só na memória da página; nada é guardado). `dadosAtendimento()` transforma `E` nos dados do `perfil()`. A versão anterior, com formulário em 3 etapas, está em `docs/versao-formulario.html`.

## Pedido livre (`TEMAS`)
- Cada tema: `k, t, palavras[], passos[], servicos[]` e, se for urgente, `urg` (frase da faixa de segurança).
- Tema com `on[]` não tem passos próprios: liga situações do motor (ex.: "tigrinho" → `apostas`), e o plano mostra o card e o roteiro da política correspondente.
- O texto é comparado sem acento. Palavra de até 3 letras precisa ser inteira; as demais, no começo de uma palavra (evita "dente" em "acidente").
- A busca não entende tempo verbal ("teve AVC" e "está tendo AVC" dão o mesmo tema). Por isso a frase urgente é sempre condicional: "Se está acontecendo agora…".
- Temas atuais: apostas, jogos eletrônicos, álcool e drogas (com `on`), AVC, emergência médica, reabilitação, pessoa acamada, fila de consulta ou cirurgia, pensão e guarda, INSS, desemprego, dívidas e golpes, desastre, funeral e luto, RG e CPF, dentista. Sem tema encontrado, o plano mostra os caminhos gerais.

## Motor de regras
- Renda por pessoa = renda ÷ pessoas. Linhas: R$ 109 (extrema pobreza, usada pelo Estado), R$ 218 (Bolsa Família), 1/4, 1/2, 1, 2 e 3 salários mínimos.
- Salário mínimo padrão: `SM_PADRAO` = R$ 1.621 (2026, Decreto 12.797/2025). Atualizar todo janeiro.
- Cada política em `P[]` tem `test(perfil)`, que devolve `null` (não se aplica) ou `[status, motivo]`. Status: `prov` (provável direito), `ver` (verificar), `enc` (encaminhamento de proteção), `nao` (público certo, mas um critério não bate: o motivo aparece em "não indicados") e `falta` (`["falta","",[campos]]`: falta um dado decisivo, ver `FALTA_RENDA` e `FALTA_IDADE`).
- `avaliar(perfil)` não toca na tela e devolve `{hits, nao, falta, urg, roteiro}`. `perfil(dados)` monta o perfil a partir de dados simples. Os dois ficam em `window.EncaminhaMotor` para os testes.
- Roteiro: `ROTA[id]` lista os passos de cada política como `[lugar, o que fazer, documentos?]` (ou uma função do perfil). `STOPS` define cada lugar (nome, grupo de urgência, contatos, documentos padrão). Sem documentos no passo, valem os do lugar; sem os do lugar, os da política. `CAD_DEP` lista as políticas que dependem do CadÚnico.
- Todo critério novo ou alterado precisa de teste em `tests/motor.test.mjs`.
- Ordem de prioridade: crise suicida, PEP, violência contra mulher, criança, HIV, alto custo, saúde mental, Ministério Público, CadÚnico, demais.
- Crise suicida (chips "Pensamento de suicídio" e "Tentativa de suicídio ou autolesão recente"): faixa de segurança com 192, 188 e CIATox (0800 646 4350); card "Manejo da crise suicida" aberto, com como perguntar, sinais de risco alto e plano de segurança; roteiro com CVV agora, pronto atendimento agora (só na tentativa) e CAPS ou UBS hoje ou amanhã. Tentativa e autolesão: notificação compulsória em até 24h pelo serviço de saúde (Portaria de Consolidação nº 4/2017; Lei 13.819/2019).
- `places(kind, perfil)` escolhe serviços pelo município e pela região (Conselho Tutelar e CREAS de Goiânia).

## Estrutura dos registros
- **Política**: `id, nome, esf (nac|est|mun|rede), val, test(), flow[], docs[], html (extra opcional), where, extra[] (ids de serviços)`, mais `ROTA[id]` e `CURTO[id]` (nome curto)
- **Serviço**: `id, tipo, mun, reg, nome, end, tel[], email, hor, site, obs` (falta adicionar `fonte` e `conferido_em` em cada um)

## Cobertura atual
- Nacional: CadÚnico, Bolsa Família, BPC, Tarifa Social, Pé-de-Meia, Carteira da Pessoa Idosa, Passe Livre interestadual, Farmácia Popular.
- Educação: Enem e isenção da taxa, Prouni, Fies e Fies Social, Sisu e cotas, ProBem (OVG), assistência estudantil, EJA e Encceja.
- Estadual: Mães de Goiás, Goiás + Inclusivo, Dignidade, Goiás Por Elas, Aluguel Social (Agehab), Passe Livre Estudantil, Aprendiz do Futuro, CIPTEA, Passe Livre PcD, Passaporte da Pessoa Idosa, Crédito Social, 2ª via de registro civil, alto custo (Cemac Juarez Barbosa).
- Dependências: álcool e outras drogas (CAPS AD, Credeq, Unidade de Acolhimento, regras da internação involuntária pela Lei 13.840/2019), apostas e bets (autoexclusão centralizada no gov.br, cuidado no SUS e Meu SUS Digital, dívidas, bloqueio de beneficiários pela Portaria SPA/MF 2.217/2025 em discussão no STF), jogos eletrônicos (UBS, CAPSij, ECA Digital).
- Rede: mulher, criança, idoso/PcD, população de rua, saúde mental, gestante, fome, HIV (teste, PEP, PrEP, SAE), Ministério Público (MPGO, MPF, MPT).
- Goiânia: 26 CRAS/centros de convivência, 5 CREAS, Centro POP, 6 Conselhos Tutelares, rede da mulher, Defensoria, CTA/SAE, UPAs com PEP.
- Aparecida: parcial. Demais municípios da RMG: só nacional e estadual.
- Comunitária: PUC Goiás (NPJ, CEPSI, Clínica Escola Vida, CRESA, Cecom), Centro de Psicologia da UFG, Ceap-SOL, CEVAM.

## Pendências conhecidas
- Lista de UBS e CAPS, inclusive CAPS AD e CAPSij (importar do CNES/DataSUS). Credeq sem endereço e telefone conferidos.
- Acompanhar no STF (ADI 7721) o bloqueio de bets para beneficiários do Bolsa Família e do BPC.
- Quadro "Falta uma resposta": `CAMPOS[c].nec` diz em que assuntos vale cobrar renda ou idade.
- Lista de UBS e CAPS (importar do CNES/DataSUS). Prioridade: o roteiro da crise suicida manda ao CAPS, mas ainda sem endereço.
- Promotorias do MPGO por comarca (site do MPGO não respondia na pesquisa).
- CRAS de Aparecida e dos demais municípios da RMG.
- Telefone direto do Centro POP de Goiânia; telefone do MPT em Goiás.
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
