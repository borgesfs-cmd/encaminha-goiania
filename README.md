# Encaminha Goiânia

Orientação e encaminhamento para políticas públicas (nacionais, do Estado de Goiás e municipais) em Goiânia e região metropolitana. Feito para o profissional da rede que faz o encaminhamento, pelo celular.

- `index.html`: o app inteiro (HTML, CSS e JavaScript, sem dependências). Abra no navegador.
- `docs/mapa-encaminha.html`: mapa da arquitetura.
- `tests/`: testes do motor de regras e da tela.
- `CLAUDE.md`: regras do projeto (LGPD, fontes, motor de regras, pendências).

## Testes

```bash
npm install
npm test
```

Os testes abrem o `index.html` no Chromium (Playwright) e conferem os critérios com casos conhecidos.
