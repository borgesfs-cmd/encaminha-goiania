# Relatório de testes

Data: 08/10/2026. Comando: `npm test` (Node 22 + Playwright/Chromium). Resultado: **50 de 50 passaram** em cerca de 8 segundos.

## O que a rotina cobre

| Bloco | O que confere |
|---|---|
| A. Integridade dos dados | Políticas completas e sem id repetido; todo contato citado existe; todo passo do roteiro aponta para política e lugar existentes; nenhuma opção de tela sem regra; temas do pedido livre sem palavra repetida |
| B. Perfis aleatórios | 800 perfis sorteados: sem erro, motivo sempre preenchido, sem "undefined" ou "NaN", roteiro em ordem, sem lugar nem documento repetido; todas as 45 políticas alcançadas |
| C. Limites | R$ 218, R$ 109, 1/4 e 1/2 salário exatamente na linha; Minha Casa, Minha Vida só com necessidade de moradia |
| D. Fluxos de tela | Cada um dos 10 assuntos do início ao plano; cada atalho de urgência; voltar, editar e novo atendimento; resumo copiado sem números longos |
| E. Layout e acessibilidade | Nenhuma tela rola para o lado em celular de 360px; todo campo tem rótulo e todo botão tem texto; tema escuro legível |
| F. Privacidade | O registro estatístico não leva iniciais, texto livre, renda nem idade exatas |
| G. Estatísticas | Soma das semanas bate com o total; filtros de período e município; alertas; situações sensíveis com 1 ou 2 casos viram "<3"; exemplos não entram nas estatísticas |
| H. Desempenho | Avaliar um perfil leva menos de 2 ms |

## Problemas que a rotina encontrou e que foram corrigidos

1. Os botões de período dos Relatórios eram tratados como respostas da tela "Sobre a pessoa": 7 dias e Tudo mostravam o mesmo número.
2. O app reabria na última aba visitada; quem saía pelos Relatórios voltava neles. Agora sempre abre em Atender.
3. Minha Casa, Minha Vida aparecia para qualquer família de aluguel; agora só com aluguel pesado, rua, casa cedida ou ocupação.
4. O painel de demanda contava "Pela internet" e "Sem inscrição" como serviços da rede; agora mostra só lugares de atendimento.
5. Palavras do pedido livre: "trans" casava com "transporte" e "hormônio" com menopausa; foram trocadas por expressões específicas.

## Saída completa

```
✔ a página carrega sem erros de script (264.196807ms)
✔ salário mínimo padrão é o de 2026 (R$ 1.621) (20.827668ms)
✔ texto livre: apaga CPF, telefone, RG, CEP e e-mail; mantém valores e datas (7.010579ms)
✔ caso Família com violência: proteção primeiro e benefícios por renda (22.113952ms)
✔ caso Alto custo: Cemac e Farmácia Popular; Bolsa Família não indicado com motivo (7.155279ms)
✔ Carteira da Pessoa Idosa usa a renda própria: casa até 2 SM é provável; acima, verificar (6.728825ms)
✔ Aluguel Social: limite de meio salário mínimo por pessoa (10.325291ms)
✔ BPC: 1/4 SM provável, até 1/2 verificar, acima não indicado (12.278891ms)
✔ Dignidade não é indicado para quem recebe Bolsa Família (10.721253ms)
✔ sem renda e sem idade, o app diz o que falta e para quê (2.784982ms)
✔ roteiro junta no mesmo CRAS o CadÚnico e o que ele abre, sem repetir documentos (4.718648ms)
✔ pessoa em situação de rua faz o CadÚnico pelo Centro POP (4.080478ms)
✔ PEP vem antes de tudo no roteiro (3.367329ms)
✔ pensamento de suicídio: manejo da crise primeiro, CVV agora e CAPS hoje ou amanhã (5.455146ms)
✔ tentativa de suicídio: pronto atendimento agora, com embalagem e CIATox (5.160243ms)
✔ educação: Prouni integral, Fies Social, ProBem e isenção do Enem para quem quer a faculdade (5.729596ms)
✔ EJA e Encceja para adulto que não terminou a escola (3.105182ms)
✔ EJA também aparece pela escolaridade de um adulto (5.480922ms)
✔ pedido livre: reconhece AVC e reabilitação sem confundir palavras parecidas (6.774946ms)
✔ dependências: álcool e drogas, apostas e jogos eletrônicos têm cuidado próprio (6.407358ms)
✔ pedido livre: bets, tigrinho, videogame e álcool ligam o cuidado certo (6.499362ms)
✔ tela: só pergunta o que o assunto precisa (379.265845ms)
✔ tela: dados da pessoa por toque, 'Responder' volta só ao que falta (788.68957ms)
✔ tela: região só aparece para Goiânia; aluguel pesado só com moradia alugada (269.622412ms)
✔ tela: pedido livre de AVC mostra a orientação e a faixa de emergência (247.462414ms)
✔ tela: atalho de urgência vai direto ao plano com o manejo; depois completa as perguntas (247.788564ms)
✔ tela: caso Crise suicida abre o manejo e o link da faixa leva até ele (180.996583ms)
✔ tela: pedido livre sobre bets traz autoexclusão e cuidado no SUS (251.20341ms)
✔ tela: todos os exemplos mostram o plano sem erros (949.443055ms)
✔ A1. Toda política tem nome, critério, passo a passo e esfera válida (245.976883ms)
✔ A2. Todo contato citado (onde ir, extras, temas, lugares) existe na lista de serviços (7.591152ms)
✔ A3. Todo passo do roteiro aponta para uma política e um lugar que existem (5.819905ms)
✔ A4. Toda opção que a tela oferece é usada por alguma regra ou tema (nada de opção morta) (6.456741ms)
✔ A5. Temas do pedido livre: palavras sem repetição entre temas e chips ligados existem (4.820789ms)
✔ B1. 800 perfis aleatórios: sem erro, motivo sempre preenchido, roteiro coerente (221.069697ms)
✔ B2. Cobertura: toda política aparece em algum perfil (aleatório ou dirigido) (16.730864ms)
✔ C1. Limites exatos: R$ 218, R$ 109, 1/4 e 1/2 salário (4.908872ms)
✔ C2. Minha Casa, Minha Vida só com necessidade de moradia; painel de demanda só com serviços presenciais (5.736315ms)
✔ D1. Cada assunto sozinho: responder tudo com a primeira opção chega ao plano sem erro (3706.962125ms)
✔ D2. Cada atalho de urgência mostra a faixa de segurança (446.875455ms)
✔ D3. Voltar, editar respostas e novo atendimento preservam e limpam o estado certo (441.996028ms)
✔ D4. Copiar resumo gera texto com roteiro e sem números longos do texto livre (231.459062ms)
✔ E1. Celular de 360px: nenhuma tela rola para o lado (1072.108688ms)
✔ E2. Acessibilidade: todo campo tem rótulo e todo botão tem texto (478.991681ms)
✔ E3. Tema escuro: fundo escuro, texto claro, sem erros (217.93619ms)
✔ F1. O registro para estatísticas não leva iniciais, texto livre, renda nem idade exatas (5.249002ms)
✔ G1. Agregação, alertas, ocultação de números pequenos e CSV (18.568692ms)
✔ G2. Aba Relatórios: sem armazenamento avisa e mostra os painéis com dados de exemplo (373.32048ms)
✔ G3. Exemplo pronto não oferece registro nas estatísticas (120.861705ms)
✔ H1. Desempenho: avaliar um perfil leva menos de 2 ms em média (31.699178ms)
ℹ tests 50
ℹ pass 50
ℹ fail 0
ℹ duration_ms 8097.896271
```
