# landingbase

Base minimalista para criação de landing pages — **Astro** estático, sem framework de CSS, otimizada para nota máxima em performance, acessibilidade, boas práticas e SEO.

Cada novo projeto parte deste repositório. Estilos e componentes específicos são adicionados depois, conforme a necessidade.

## Stack

- **Astro** (saída estática, zero JS por padrão)
- Reset CSS mínimo em `src/styles/global.css`
- Sem dependências opinativas

## Comandos

| Comando           | Ação                                  |
| ----------------- | ------------------------------------- |
| `npm install`     | Instala as dependências               |
| `npm run dev`     | Servidor de desenvolvimento (`:4321`) |
| `npm run build`   | Build estático em `./dist/`           |
| `npm run preview` | Pré-visualiza o build local           |

## Estrutura

```
src/
├── layouts/Layout.astro   # <head> com meta tags essenciais (SEO/A11y)
├── pages/index.astro      # página inicial (em branco)
└── styles/global.css      # reset mínimo
public/
├── favicon.svg
└── robots.txt
```

## Deploy

Hospedado na Hostinger, via Git.

A Hostinger **não builda o projeto** — ela clona o repositório e serve os
arquivos como estão. Apontá-la para a `main` devolve **403**, porque na raiz
só existe código-fonte Astro, sem `index.html`.

Por isso o repositório tem duas branches com papéis distintos:

| Branch | O que guarda | Quem escreve |
|---|---|---|
| `main` | o código-fonte | você |
| `deploy` | só o conteúdo de `dist/`, pronto para servir | o GitHub Actions |

A cada push na `main`, o fluxo [`build-e-publica.yml`](.github/workflows/build-e-publica.yml)
builda e substitui a `deploy`. **Na Hostinger, a branch de implantação precisa
ser `deploy`** (não `main`), com o diretório raiz em `public_html`.

Nunca edite a `deploy` na mão: a publicação seguinte sobrescreve tudo.
# revolution-energy
