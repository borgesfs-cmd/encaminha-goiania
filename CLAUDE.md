# Encaminha Goiânia

App de orientação e encaminhamento para políticas públicas (nacionais, do Estado de Goiás e municipais) em Goiânia e região metropolitana. Usado por profissionais da rede (assistência social, saúde, psicologia) e pela população.

O protótipo atual é um único arquivo: `encaminha-goiania.html` (HTML + CSS + JS puro, sem dependências). O desenho da arquitetura está em `mapa-encaminha.html`.

## Regras que não mudam

### LGPD
- Não pedir nem guardar: nome, CPF, NIS, RG, endereço da pessoa, telefone, e-mail.
- Identificação só por **iniciais**.
- Não pedir dados sensíveis (raça/cor, religião, orientação sexual, filiação). Se raça/cor entrar no futuro, que seja opcional, só para estatística e fora do resumo copiado.
- O campo livre de solicitação passa pela função `clean()`, que remove sequências de números e e-mails antes de ir para o resumo.
- Dados de saúde (HIV, saúde mental) são sensíveis. Se um dia houver registro de atendimentos, exigir login de profissional, base legal, finalidade e prazo de descarte.

### Dados
- Todo contato precisa ter **fonte** e **data de conferência**. Não inventar telefone ou endereço. Se não confirmar, deixar sem e dizer de onde buscar (121, prefeitura).
- Endereços de serviços públicos podem aparecer. Endereço de abrigo sigiloso (Casa Abrigo Sempre Viva, CEVAM), nunca.
- Linguagem simples, voz ativa, sem jargão de sistema.

## Fluxo do atendimento (aba Encaminhar)
1. **Dados socioeconômicos**: iniciais, município, região de Goiânia, idade, pessoas na casa, renda, salário mínimo de referência, trabalho, moradia, escolaridade, benefícios atuais, composição da família.
2. **Necessidades e solicitações**: saúde e medicamentos, proteção e violência, direitos sociais, texto livre.
3. **Fluxo, serviços e encaminhamentos**: alerta de segurança, cards por política (status, motivo, fluxo, documentos, onde ir), resumo copiável.

## Motor de regras
- Renda por pessoa = renda ÷ pessoas. Linhas: R$ 109 (extrema pobreza, usada pelo Estado), R$ 218 (Bolsa Família), 1/4, 1/2, 1, 2 e 3 salários mínimos.
- Cada política em `P[]` tem `test(perfil)`, que devolve `[status, motivo]` ou `null`. Status: `prov` (provável direito), `ver` (verificar), `enc` (encaminhamento de proteção).
- Ordem de prioridade: PEP, violência contra mulher, criança, HIV, alto custo, saúde mental, Ministério Público, CadÚnico, demais.
- `places(kind, perfil)` escolhe serviços pelo município e pela região (Conselho Tutelar e CREAS de Goiânia).

## Estrutura dos registros
- **Política**: `id, nome, esf (nac|est|mun|rede), val, test(), flow[], docs[], html (extra opcional), where, extra[] (ids de serviços)`
- **Serviço**: `id, tipo, mun, reg, nome, end, tel[], email, hor, site, obs` (falta adicionar `fonte` e `conferido_em` em cada um)

## Cobertura atual
- Nacional: CadÚnico, Bolsa Família, BPC, Tarifa Social, Pé-de-Meia, Carteira da Pessoa Idosa, Passe Livre interestadual, Farmácia Popular.
- Estadual: Mães de Goiás, Goiás + Inclusivo, Dignidade, Goiás Por Elas, Aluguel Social (Agehab), Passe Livre Estudantil, Aprendiz do Futuro, CIPTEA, Passe Livre PcD, Passaporte da Pessoa Idosa, Crédito Social, 2ª via de registro civil, alto custo (Cemac Juarez Barbosa).
- Rede: mulher, criança, idoso/PcD, população de rua, saúde mental, gestante, fome, HIV (teste, PEP, PrEP, SAE), Ministério Público (MPGO, MPF, MPT).
- Goiânia: 26 CRAS/centros de convivência, 5 CREAS, Centro POP, 6 Conselhos Tutelares, rede da mulher, Defensoria, CTA/SAE, UPAs com PEP.
- Aparecida: parcial. Demais municípios da RMG: só nacional e estadual.
- Comunitária: PUC Goiás (NPJ, CEPSI, Clínica Escola Vida, CRESA, Cecom), Centro de Psicologia da UFG, Ceap-SOL, CEVAM.

## Pendências conhecidas
- Lista de UBS e CAPS (importar do CNES/DataSUS).
- Promotorias do MPGO por comarca (site do MPGO não respondia na pesquisa).
- CRAS de Aparecida e dos demais municípios da RMG.
- Telefone direto do Centro POP de Goiânia; telefone do MPT em Goiás.
- Conferir a lista de medicamentos da Farmácia Popular no gov.br (os nomes vieram de conhecimento prévio, não da página oficial).
- Salário mínimo padrão está em R$ 1.518 (2025): confirmar o valor vigente.
- Dados com data antiga: CRAS (out/2024), UPAs com PEP (2024), cesta de serviços PUC (2023).

## Próximas etapas sugeridas
1. Separar dados do código: `data/politicas.json`, `data/servicos.json`, `data/territorios.json`, com `fonte` e `conferido_em`.
2. Testes automatizados do motor de regras com os casos de exemplo (família com violência, alto custo, HIV, Farmácia Popular).
3. Painel de atualização com login: editar serviços e políticas, fila de conferência (amarelo > 6 meses, oculto > 12 meses), sugestões de cadastro da rede (igrejas, ONGs, universidades) com aprovação.
4. Busca por CEP para indicar CRAS, UBS e CAPS mais próximos.
5. Guia de encaminhamento para entregar à pessoa (PDF ou impressão).

## Fontes principais
- Seds/GO: https://goias.gov.br/social/projetos-de-participacao-social/ e https://goias.gov.br/social/unidadescrasgoiania/
- SES/GO alto custo: https://goias.gov.br/saude/?p=37536
- Farmácia Popular: https://www.gov.br/saude/pt-br/composicao/sectics/farmacia-popular
- CTA Goiânia: https://www.goiania.go.gov.br/secretaria/secretaria-municipal-de-saude/centros-de-referencia/centro-de-testagem-e-acolhimento-cta/
- Rede da mulher (TRT-18): https://www.trt18.jus.br/portal/ouvidoria/enfrentamento-a-violencia-domestica/
- Agehab Aluguel Social: https://goias.gov.br/agehab/programa-pra-ter-onde-morar-aluguel-social-edital-geral/
- Defensoria: https://www2.defensoria.go.def.br/
- MPF Goiás: https://www.mpf.mp.br/o-mpf/unidades/pr-go/contato-1
