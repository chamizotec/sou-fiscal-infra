# Sou Fiscal

Ficha de candidato das eleições de 2026. Os arquivos do TSE viram um grafo no Neo4j. A consulta mostra despesa, receita, bens, histórico, processo e o cadastro das empresas pagas ou doadoras, quando o CNPJ aparece nos dados abertos da Receita Federal.

| Pasta | Conteúdo |
| --- | --- |
| `../import/` | Projeto Node que lê `arquivos-tse/` e `arquivos-receita/`, nesta mesma pasta, e grava no Neo4j |
| `../back/` | API Express (`/api/*`) que consulta o grafo e monta os sinais da ficha |
| `../web/` | Interface React com MUI (Vite). Em produção, o nginx serve o build e repassa `/api` para o `back` |
| `../import/docs/modelo-grafo.md` | Contrato do grafo para as próximas bases (Receita Federal, JUCESP, preço de mercado) |

CPF e título de eleitor não são gravados. A pessoa do candidato entra como hash SHA-256. O quadro de sócios da Receita, neste arquivo aberto, traz CPF mascarado: ele não usa o mesmo hash, e os dígitos mascarados não são gravados. A API não devolve hash.

## Subir

Nesta pasta:

```bash
docker compose up -d --build
docker compose run --rm import --uf AC
docker compose run --rm import --only receita
```

A ficha abre em `http://localhost:3000`. A API responde direto em `http://localhost:3001/api/resumo`. O Neo4j Browser fica em `http://localhost:7474` (usuário `neo4j`, senha `soufiscal-local`). Troque `NEO4J_AUTH` no `docker-compose.yml` se esta instância for sair da sua máquina.

O serviço `import` só roda quando chamado. `--uf AC` carrega o Acre. `--uf all` percorre o país. A etapa `receita` usa o zip mensal mais recente de `arquivos-receita/` e cruza apenas os CNPJs que já estão no grafo. O catálogo desses arquivos está em `../../docs/arquivos-receita.md`.

```bash
docker compose run --rm import --uf SP --only financeiro,candidatos
docker compose run --rm import --only processos
docker compose run --rm import --only receita
```

Também dá para rodar a importação fora do Docker, com o Neo4j publicado na porta 7687:

```bash
cd ../import
npm install
npm run import -- --uf AC
npm run import:receita
```

## Desenvolver o front e a API

Com o Neo4j no ar (`docker compose up -d neo4j`), rode os dois projetos fora do Docker:

```bash
cd ../back && npm install && npm run dev      # API em http://localhost:3001
cd ../web && npm install && npm run dev       # Vite em http://localhost:5173, com proxy de /api para a porta 3001
```

Depois de alterar `back/` ou `web/`, reconstrua as imagens nesta pasta: `docker compose up -d --build back web`.

## Worker de análise de fornecedores

O worker só considera candidaturas com recursos públicos e ignora CNPJs de contas eleitorais. Gastos excepcionais, como combustível acima do padrão, aumentam o score e geram alerta documental, mas não disparam análise de fachada quando CNAE, cadastro e item declarado são coerentes.

Para processar fachadas, configure uma fonte que permita expressamente armazenamento e inferência por IA. O Street View do Google é exibido na ficha, mas não é persistido nem enviado ao modelo. Em desenvolvimento, coloque arquivos como `<cnpj>.jpg` em `../dados/fachadas` e rode:

```bash
AI_API_KEY=... AI_MODEL=... docker compose up -d --build worker
docker compose logs -f worker
```

Cada lote sai como uma linha com data, status, cursor e duração. `docker compose logs -f worker` acompanha a execução ao vivo.

Também é possível usar `FACHADA_FONTE_URL_TEMPLATE`, desde que `FACHADA_FONTE_PERMITE_IA=1`, `FACHADA_FONTE_NOME` e `FACHADA_FONTE_LICENCA` estejam definidos. O limite diário padrão é 50 análises e pode ser alterado com `ANALISE_LIMITE_DIARIO`.

A priorização roda no máximo 45 segundos e cobre 80 candidaturas por vez. O worker repete esse lote a cada minuto. O ponto de continuação fica no Neo4j, então cada execução retoma o lote seguinte sem recomeçar a base e sem sobrepor a anterior.

## Publicar no Railway

O projeto inteiro está em `.railway/railway.ts`: Neo4j com volume, importação, API, worker e site. Um `apply` cria os cinco. Não há um arquivo por pasta.

Nesta pasta, com o [Railway CLI](https://docs.railway.com/guides/cli) instalado:

```bash
railway login
railway link
railway config plan
railway config apply
```

`plan` só mostra o que mudaria. `apply` pede confirmação e cria os serviços no projeto ligado a esta pasta.

A senha do Neo4j é gerada na hora do apply e fica só no Railway. O site usa o domínio privado da API. A API usa o domínio privado do Neo4j. Gere o domínio público no serviço `web` depois do apply; a variável de CORS da API aponta para ele.

No Railway, a chave da IA fica na variável compartilhada `AI_API_KEY`. O modelo padrão do worker é `gpt-4.1-mini`. Fotos de fachada e o bucket S3/R2 só entram quando `FACHADA_FONTE_*` e `ANALISE_S3_*` existirem; sem isso, a análise usa o cadastro e as despesas. API e worker precisam do mesmo bucket para a foto persistida aparecer na ficha, porque volumes do Railway não são compartilhados entre serviços.

O serviço `import` sobe e encerra sem carregar nada (`IMPORT_AGUARDAR=1`), porque os zips do TSE e da Receita não entram no Git. Volume do Railway não é compartilhado entre serviços, então a API também não vê as fotos por essa pasta. A primeira carga continua na sua máquina, contra o Bolt, ou depois que os arquivos estiverem num armazenamento acessível pelo import.

Antes do primeiro deploy, os ajustes de `web`, `back` e `import` precisam estar nos repositórios `sou-fiscal-web`, `sou-fiscal-api` e `sou-fiscal-import`. Este arquivo só referencia esses repositórios; ele não envia o código.
