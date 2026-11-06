# Lores Novelas — site publicado

Este repositório contém **apenas o site** do Lores Novelas (o bundle web
estático), e não o código-fonte do app — que vive em um repositório privado.

| | |
| --- | --- |
| **URL** | https://paulodesigner98.github.io/lores-novelas-site/ |
| **Tipo** | Progressive Web App (PWA), sem backend |
| **Hospedagem** | GitHub Pages, camada gratuita do GitHub Free |

## O que é este repositório

O conteúdo aqui é **gerado**: é a saída de `expo export -p web` mais as
reescritas do host estático (`404.html`, `_redirects`, `.nojekyll`) e o
`sw.js` versionado. Não edite os arquivos à mão — qualquer alteração é
apagada na próxima publicação.

## Como publicar uma atualização

O código-fonte fica em outro repositório (privado). A partir dele:

```powershell
# 1. build do bundle web com o prefixo de publicacao
node scripts/publish-pages.mjs --repo lores-novelas-site --target C:\g\apps\lores-site

# 2. enviar o site gerado
cd C:\g\apps\lores-site
git add -A
git commit -m "publish: web"
git push
```

O prefixo de publicação (`/lores-novelas-site/`) **tem que ser igual ao nome
deste repositório** — é ele que faz o app funcionar sob
`https://paulodesigner98.github.io/lores-novelas-site/`.

O GitHub reconstrói o Pages em ~30 s após o push.

## Credenciais

A chave da API do Google Drive fica embutida no bundle publicado (é público
por construção). A proteção é a **restrição de cliente** da chave no Google
Cloud: no web, apenas requisições com o referrer
`https://paulodesigner98.github.io/*` são aceitas.

## Créditos

Código-fonte do app: repositório privado `lores-novelas`.
