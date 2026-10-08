# Conexão do site com a planilha

O site (GitHub Pages) conversa com a planilha "Banco de dados Encaminha Goiânia" por um Apps Script publicado como App da Web.

```
Celular do profissional ──► site (GitHub Pages) ──► Apps Script ──► Planilha Google
                              │ lê Serviços, Políticas, Temas      │ grava na aba Registros
                              └ guarda a última leitura no aparelho
```

## O que acontece no site

- **Ao abrir**, o site lê as abas Serviços, Políticas e Temas e guarda a leitura no aparelho.
  - Se o atendimento ainda não começou, aplica na hora.
  - Se já começou, mostra o aviso "A planilha tem dados novos", com os botões Atualizar e Agora não.
- **Sem internet**, o site usa a última leitura guardada. O rodapé diz de quando ela é.
- **Registrar atendimento** grava uma linha na aba Registros.
  - Sem internet, o registro fica na fila do aparelho e sai quando a conexão volta.
  - Só saem categorias anônimas: o texto livre, as iniciais, a renda exata e a idade exata nunca saem do aparelho.
- **Relatórios** só abrem com a chave de gestor.
  - A chave fica no aparelho do gestor até ele tocar em "Sair do acesso de gestão".

## Instalar o Apps Script (uma vez)

1. Na planilha, abra **Extensões > Apps Script**. Apague o que estiver lá e cole o conteúdo de `apps-script/Codigo.gs`. Salve.
2. No menu de funções, escolha **configurar** e toque em **Executar**.
   - Autorize com a sua conta. O Google avisa que o app não foi verificado: toque em **Avançado > Acessar**.
   - A **chave de gestor** aparece no Registro de execução. Guarde-a: é ela que abre a aba Relatórios.
3. Toque em **Implantar > Nova implantação** e escolha o tipo **App da Web**:
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
4. Copie a URL que termina em `/exec` e envie ao Claude. Ela vai para a meta `encaminha-api` do `index.html`.

## Depois

- **Mudou o código do Apps Script:** abra Implantar > Gerenciar implantações, edite a implantação e escolha **Nova versão**. A URL continua a mesma.
- **Trocar a chave de gestor** (por exemplo, quando alguém sai da gestão): rode a função `trocarChave`.
- **Desativar um serviço:** marque a Situação como **Inativo**. Não apague a linha, porque o app manteria o dado de base do código.

## Segurança e LGPD

- A URL do Apps Script fica no código do site, que é público. Qualquer pessoa com a URL consegue:
  - ler Serviços, Políticas e Temas, que já são informação pública;
  - gravar registros, que são validados (formato, tamanho, no máximo 20 por envio, texto que viraria fórmula entra como texto).
- Os registros só são lidos com a chave de gestor.
- A planilha continua privada. Só quem você compartilhar consegue abri-la.
- O Apps Script roda com a sua conta Google e tem cota diária. A leitura usa um cache de 5 minutos, que é limpo sempre que alguém edita a planilha.
