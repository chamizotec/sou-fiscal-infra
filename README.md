# Sou Fiscal

Ficha de candidato das eleições de 2026. Os arquivos do TSE viram um grafo no Neo4j. A consulta mostra despesa, receita, bens, histórico, processo e o cadastro das empresas pagas ou doadoras, quando o CNPJ aparece nos dados abertos da Receita Federal.

| Pasta | Conteúdo |
| --- | --- |
| `../import/` | Projeto Node que lê os zips de `arquivos-tse/` e `arquivos-receita/` e grava no Neo4j |
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
