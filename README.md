# VulnDesk

Plataforma web para gestão centralizada de vulnerabilidades identificadas em testes de intrusão — TCC de Sistemas de Informação, PUC Minas (Unidade São Gabriel).

Organiza **Empresa → Projeto → Finding**, com evidências, CVSS, impacto, mitigação e status de remediação, separando o que a equipe de pentest e cada cliente podem ver.

## Stack

| Camada | Tecnologia |
| --- | --- |
| Front-end | React 19 + TanStack Start/Router, TypeScript, Tailwind CSS, shadcn/ui, Recharts |
| Dados no navegador | TanStack Query (cache entre telas) |
| Back-end | Supabase (PostgreSQL + Row Level Security, Auth, Storage privado) |
| Servidor | Funções de servidor TanStack Start (gestão de contas com chave de serviço) |
| Hospedagem | Vercel (preset `vercel` do Nitro) |

## Perfis de acesso

| Perfil | O que faz |
| --- | --- |
| **Administrador** | Tudo que o pentester faz + cria, edita e exclui contas (menu *Usuários*). |
| **Pentester** | Visão global: empresas, projetos, equipe, findings, evidências e dashboards; cadastra, edita e exclui. |
| **Cliente** | Somente leitura dos projetos, findings, evidências e dashboard da **própria empresa**. |

Os papéis ficam na tabela `user_roles` (separada do cadastro do usuário) e as permissões são aplicadas pelo próprio banco via RLS — um cliente não lê dados de outra empresa nem acessando a URL/API diretamente.

## Contas

Não há cadastro público: as contas são provisionadas no deploy por `scripts/db-setup.mjs` ou criadas por um administrador. As senhas vêm de variáveis de ambiente — nenhuma senha fica no código.

| Conta | E-mail | Perfil |
| --- | --- | --- |
| Administrador | `admin@vulndesk.app` | Admin |
| Professor avaliador | `professor@vulndesk.app` | Pentester |
| Demonstração | `pentester@example.com`, `bruno.lima@example.com`, `carla.souza@example.com` | Pentester |
| Demonstração | `cliente.alpha@example.com`, `cliente.beta@example.com`, `cliente.gamma@example.com` | Cliente |

As contas de demonstração aparecem como acesso rápido na tela de login.

## Rastreabilidade dos requisitos

| Requisito | Onde está |
| --- | --- |
| RF01 Login com contas de demonstração | `src/routes/auth.tsx`, `scripts/db-setup.mjs` |
| RF02 Perfis Pentester/Cliente | `user_roles`, `src/hooks/use-app-auth.ts` |
| RF03 Empresa → Projeto → Finding | migração inicial (chaves estrangeiras) |
| RF04–RF06 CRUD de empresas, projetos e findings | `src/routes/_authenticated/{companies,projects,findings}` |
| RF07 Código FIND-001… automático | trigger `set_finding_code` + sequência |
| RF08 Evidências texto/imagem/arquivo | `src/components/evidence-section.tsx`, bucket `evidences` |
| RF10 Status e data de resolução | página do finding + trigger `set_finding_resolved_at` |
| RF11 Dashboard (severidade, status, projeto, 6 meses, recentes) | `src/routes/_authenticated/dashboard.tsx` |
| RF12 Filtros de findings | `src/routes/_authenticated/findings/index.tsx` |
| RF13 Busca global (Ctrl/⌘ + K) | `src/components/global-search.tsx` |
| RF14/RF15 Cliente só lê a própria empresa | políticas RLS + interface somente leitura |
| RF16 Equipe por projeto e projetos/findings por pentester | botão *Equipe* no projeto, `pentesters/$id.tsx` |
| RF17 Confirmação + exclusão em cascata | `ON DELETE CASCADE` + remoção dos arquivos de evidência |
| RF18 Sair | menu do usuário |
| RNF01–RNF03 | RLS, `user_roles`, bucket privado com políticas por empresa |
| RNF04 | `.env` fora do Git; segredos só em variáveis da Vercel |
| RNF05–RNF08 | tema escuro, cores fixas por severidade/status, menu lateral por perfil, toasts |
| RNF09 | TanStack Query |
| RNF10–RNF12 | enums no banco, cascata, `created_at`/`updated_at` em todas as tabelas |
| RNF13 | TypeScript checado no build (`npm run typecheck`) + `supabase/migrations` |
| RNF14 | publicado na Vercel; código no GitHub |

## Rodando localmente

```sh
cp .env.example .env   # preencha com os dados do seu projeto Supabase
npm install
npm run db:setup       # aplica migrações, contas e dados de demonstração
npm run dev
```

## Deploy (Vercel)

1. Importe o repositório na Vercel.
2. Em *Storage*, conecte a integração **Supabase** ao projeto (cria `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `POSTGRES_URL_NON_POOLING` etc.).
3. Defina `VULNDESK_ADMIN_PASSWORD`, `VULNDESK_PROFESSOR_PASSWORD` e `VULNDESK_DEMO_PASSWORD`.
4. Faça o deploy. O build (`scripts/vercel-build.mjs`) verifica os tipos, aplica as migrações pendentes, provisiona as contas e gera o app.

## Autores

Ana Beatriz Costa Viana · Aristides Henrique Gonçalves da Cruz · Grazielle Sorrentino Santos Souza · Gustavo Anselmo Santos Silva · Josué Santana Melo · Karina Oliveira Bicalho de Almeida · Luan Magno Souza Alves · Nicole Marie Agnelo Marques
