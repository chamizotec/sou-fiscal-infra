import {
  defineRailway,
  github,
  group,
  image,
  preserve,
  project,
  service,
  volume,
} from "railway/iac";

// Um arquivo descreve o projeto inteiro. O apply cria Neo4j, importação,
// API, worker e site. A API e o site usam os Dockerfiles dos repositórios.
export default defineRailway((ctx) => {
  const senha = ctx.randomString("neo4j-senha", 16);

  const dados = volume("neo4j-data", {
    sizeMB: 20000,
    region: "us-east4-eqdc4a",
  });
  const fotos = volume("fotos-tse", {
    sizeMB: 1024,
    region: "us-east4-eqdc4a",
  });

  const banco = service("neo4j", {
    source: image("neo4j:5.26"),
    volumeMounts: {
      "/data": dados,
    },
    env: {
      NEO4J_AUTH: `neo4j/${senha}`,
      NEO4J_server_memory_heap_initial__size: "512m",
      NEO4J_server_memory_heap_max__size: "1G",
      NEO4J_server_memory_pagecache_size: "512m",
    },
  });

  const carga = service("import", {
    source: github("chamizotec/sou-fiscal-import", { branch: "main" }),
    deploy: { restartPolicyType: "NEVER" },
    env: {
      NEO4J_URI: "bolt://${{neo4j.RAILWAY_PRIVATE_DOMAIN}}:7687",
      NEO4J_USER: "neo4j",
      NEO4J_PASSWORD: senha,
      TSE_DIR: "/dados/arquivos-tse",
      RECEITA_DIR: "/dados/arquivos-receita",
      IMPORT_AGUARDAR: "1",
    },
  });

  const api = service("back", {
    source: github("chamizotec/sou-fiscal-api", { branch: "main" }),
    healthcheck: "/api/health",
    healthcheckTimeout: 30,
    volumeMounts: {
      "/dados/arquivos-tse": fotos,
    },
    env: {
      PORT: "3001",
      NODE_ENV: "production",
      NEO4J_URI: "bolt://${{neo4j.RAILWAY_PRIVATE_DOMAIN}}:7687",
      NEO4J_USER: "neo4j",
      NEO4J_PASSWORD: senha,
      CORS_ORIGINS: "https://${{web.RAILWAY_PUBLIC_DOMAIN}}",
      TSE_DIR: "/dados/arquivos-tse",
    },
  });

  const worker = service("analise-fornecedores", {
    source: github("chamizotec/sou-fiscal-api", { branch: "main" }),
    deploy: {
      startCommand: "node src/worker.js",
    },
    env: {
      NODE_ENV: "production",
      NEO4J_URI: "bolt://${{neo4j.RAILWAY_PRIVATE_DOMAIN}}:7687",
      NEO4J_USER: "neo4j",
      NEO4J_PASSWORD: senha,
      ANALISE_SCORE_MINIMO: "55",
      ANALISE_LIMITE_DIARIO: "50",
      ANALISE_PRIORIZAR_INTERVALO_MIN: "1",
      ANALISE_PRIORIZAR_CANDIDATURAS: "80",
      ANALISE_PRIORIZAR_ORCAMENTO_MS: "45000",
      AI_BASE_URL: "https://api.openai.com/v1",
      AI_MODEL: "gpt-4.1-mini",
      AI_API_KEY: preserve(),
    },
  });

  const site = service("web", {
    source: github("chamizotec/sou-fiscal-web", { branch: "main" }),
    env: {
      BACKEND_HOST: "${{back.RAILWAY_PRIVATE_DOMAIN}}",
      BACKEND_PORT: "3001",
      NGINX_RESOLVER: "[fd12::10] ipv6=on valid=1s",
    },
  });

  return project("sou-fiscal", {
    resources: [
      group("Base", [banco, dados]),
      group("Carga", [carga]),
      group("Aplicação", [api, worker, site, fotos]),
    ],
  });
});
