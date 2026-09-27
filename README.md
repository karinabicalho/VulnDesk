# SecureSight Hub

# Protótipo Funcional — Plataforma de Gestão de Vulnerabilidades

Crie um **protótipo funcional simples de uma plataforma web para gestão de vulnerabilidades**, inspirado conceitualmente no **DefectDojo**, mas com escopo reduzido e interface moderna, limpa e profissional.

O objetivo é permitir que equipes de **Pentest/Red Team** cadastrem e acompanhem vulnerabilidades encontradas durante avaliações de segurança, enquanto os **clientes** conseguem acompanhar os resultados e o status de remediação dos projetos relacionados à sua empresa.

O foco principal deve ser **gestão de vulnerabilidades**, e não gerenciamento completo de pentests.

---

# 1. Perfis de acesso

O sistema deverá possuir dois tipos de usuários:

## Pentester

O Pentester possui uma visão global da plataforma.

Pode:

* Visualizar todas as empresas;
* Visualizar todos os projetos;
* Criar empresas;
* Criar projetos;
* Associar pentesters aos projetos;
* Cadastrar vulnerabilidades/findings;
* Editar vulnerabilidades;
* Alterar o status de remediação;
* Visualizar dashboards;
* Visualizar métricas consolidadas de todas as empresas e projetos.

## Cliente

O Cliente possui acesso restrito à própria empresa.

Pode:

* Visualizar sua empresa;
* Visualizar apenas os projetos associados à sua empresa;
* Visualizar vulnerabilidades dos seus projetos;
* Visualizar evidências;
* Visualizar severidade e CVSS;
* Visualizar status de remediação;
* Visualizar o dashboard dos seus projetos.

O Cliente **não pode visualizar outras empresas ou projetos que não pertençam à sua empresa**.

---

# 2. Estrutura principal do sistema

A hierarquia do sistema deve ser:

```text
Empresa
 └── Projeto
      ├── Pentesters
      └── Vulnerabilidades / Findings
```

Uma empresa pode possuir vários projetos.

Um projeto pertence a uma única empresa.

Um projeto pode possuir vários pentesters.

Um projeto pode possuir várias vulnerabilidades.

---

# 3. Empresa

Criar uma entidade Empresa com, no mínimo:

* Nome da empresa;
* CNPJ ou identificador;
* Descrição;
* Data de criação;
* Status: Ativa / Inativa.

Tela de empresas:

* Listagem;
* Busca;
* Filtro por status;
* Visualização da empresa;
* Quantidade de projetos;
* Quantidade total de vulnerabilidades;
* Distribuição de vulnerabilidades por severidade.

---

# 4. Projeto

Cada projeto deve estar associado a uma empresa.

Campos:

* Nome do projeto;
* Empresa;
* Descrição;
* Tipo de projeto;
* Data de início;
* Data de término;
* Total de horas contratadas/associadas;
* Horas utilizadas;
* Pentesters associados;
* Status do projeto.

Tipos de projeto podem incluir:

* Pentest Web;
* Pentest API;
* Pentest Mobile;
* Pentest Infraestrutura;
* Red Team;
* Vulnerability Assessment;
* Outros.

Status do projeto:

* Planejado;
* Em andamento;
* Finalizado;
* Arquivado.

A página do projeto deve apresentar um resumo contendo:

* Nome do projeto;
* Empresa;
* Tipo;
* Período;
* Horas contratadas;
* Horas utilizadas;
* Pentesters;
* Total de findings;
* Findings críticos;
* Findings altos;
* Findings médios;
* Findings baixos;
* Findings informativos;
* Findings remediados;
* Findings pendentes.

---

# 5. Vulnerabilidades / Findings

A principal entidade do sistema será o **Finding**.

Cada Finding pertence obrigatoriamente a um projeto.

Campos:

* Título;
* Identificador;
* Severidade;
* Descrição;
* Evidências;
* Impacto;
* CVSS Score;
* Proposta de mitigação;
* Status;
* Data de descoberta;
* Data de resolução;
* Pentester responsável;
* Projeto.

O identificador pode ser gerado automaticamente, por exemplo:

```text
FIND-001
FIND-002
FIND-003
```

## Severidade

Utilizar:

* Critical;
* High;
* Medium;
* Low;
* Informational.

O sistema deve apresentar a severidade de forma visual e consistente.

## CVSS

O CVSS Score será **informado manualmente pelo Pentester**.

Não é necessário implementar um calculador CVSS neste protótipo.

Permitir valores de:

```text
0.0 até 10.0
```

O score deve ser exibido junto da severidade.

## Status de remediação

Utilizar inicialmente:

* Open;
* In Progress;
* Resolved;
* Accepted Risk;
* False Positive;
* Closed.

O status deve ser facilmente alterável na página do Finding.

---

# 6. Evidências

O Finding deverá possuir uma seção específica para evidências.

Para o protótipo, permitir:

* Upload de imagens;
* Upload de arquivos;
* Inserção de evidências em texto/Markdown.

A página do Finding deve apresentar as evidências de maneira organizada.

Exemplo:

```text
Finding: SQL Injection

Descrição
...

Impacto
...

Evidências
[imagem]
[imagem]

CVSS
9.1

Mitigação
...

Status
Open
```

---

# 7. Dashboard

Criar um dashboard principal focado em **gestão de vulnerabilidades**.

Para Pentesters, o dashboard deve apresentar dados consolidados de todas as empresas/projetos.

Para Clientes, apresentar apenas dados da própria empresa.

## Cards principais

Exibir:

* Total de empresas;
* Total de projetos;
* Total de findings;
* Findings abertos;
* Findings críticos;
* Findings altos;
* Findings médios;
* Findings baixos;
* Findings resolvidos.

Para Cliente, esconder métricas relacionadas a outras empresas.

## Gráficos

Adicionar gráficos simples e visualmente claros:

### Findings por severidade

Gráfico mostrando:

```text
Critical
High
Medium
Low
Informational
```

### Findings por status

Mostrar:

```text
Open
In Progress
Resolved
Accepted Risk
False Positive
Closed
```

### Vulnerabilidades por projeto

Permitir visualizar quais projetos possuem maior quantidade de vulnerabilidades.

### Evolução da remediação

Gráfico mostrando a evolução dos findings:

```text
Total
Abertos
Resolvidos
```

---

# 8. Dashboard do projeto

Cada projeto deve possuir seu próprio dashboard.

Exibir:

* Total de findings;
* Distribuição por severidade;
* Distribuição por status;
* Percentual de findings resolvidos;
* Percentual de findings abertos;
* CVSS médio;
* Maior CVSS;
* Findings críticos e altos;
* Lista dos findings mais relevantes.

Adicionar uma barra de progresso de remediação:

```text
Remediação
████████████░░░░ 75%
```

---

# 9. Listagem de Findings

Criar uma tabela para gerenciamento dos findings.

Colunas:

| ID | Título | Severidade | CVSS | Status | Projeto | Pentester | Data |
| -- | ------ | ---------- | ---- | ------ | ------- | --------- | ---- |

Recursos:

* Busca;
* Filtro por severidade;
* Filtro por status;
* Filtro por projeto;
* Filtro por empresa;
* Ordenação;
* Paginação.

Ao clicar em um Finding, abrir sua página de detalhes.

---

# 10. Página de detalhes do Finding

Criar uma página completa para visualização do Finding.

Estrutura sugerida:

```text
[FIND-001] SQL Injection
Critical · CVSS 9.1 · Open

Projeto: Pentest Empresa X
Pentester: João

------------------------------------------------

Descrição

...

------------------------------------------------

Impacto

...

------------------------------------------------

Evidências

...

------------------------------------------------

Proposta de Mitigação

...

------------------------------------------------

Informações

Severidade: Critical
CVSS: 9.1
Status: Open
Data de descoberta: 10/08/2026

------------------------------------------------

[Alterar Status] [Editar Finding]
```

---

# 11. Navegação

Criar uma sidebar principal.

Para Pentester:

```text
Dashboard
Empresas
Projetos
Findings
Pentesters
```

Para Cliente:

```text
Dashboard
Projetos
Findings
```

Adicionar no topo:

* Nome do usuário;
* Tipo de acesso;
* Menu de perfil;
* Logout.

---

# 12. Controle de acesso

Implementar controle de acesso baseado no perfil.

Regra fundamental:

```text
Pentester
    ↓
Todas as empresas
    ↓
Todos os projetos
    ↓
Todos os findings

Cliente
    ↓
Somente sua empresa
    ↓
Somente seus projetos
    ↓
Somente seus findings
```

O controle deve existir também no backend/API, e não apenas na interface.

Um Cliente não deve conseguir acessar diretamente um projeto ou finding de outra empresa alterando o ID na URL.

---

# 13. Interface e UX

A interface deve ter aparência de uma aplicação SaaS profissional de segurança.

Características:

* Layout responsivo;
* Sidebar fixa;
* Dashboard moderno;
* Cards de métricas;
* Tabelas organizadas;
* Badges para severidade e status;
* Modais ou páginas para criação/edição;
* Feedback visual após ações;
* Estados de loading;
* Estados vazios;
* Mensagens de erro;
* Confirmação para ações destrutivas.

Priorizar **clareza e produtividade** em vez de excesso de elementos visuais.

A interface deve parecer uma ferramenta utilizada diariamente por uma equipe de segurança.

Evitar criar uma landing page. O objetivo é criar **a aplicação propriamente dita**.

---

# 14. Dados de demonstração

O protótipo deve iniciar com dados fictícios suficientes para demonstrar o funcionamento.

Criar, por exemplo:

### Empresas

* Empresa Alpha;
* Empresa Beta;
* Empresa Gamma.

### Projetos

Criar pelo menos 2 projetos por empresa.

### Pentesters

Criar pelo menos 3 usuários Pentester.

### Clientes

Criar pelo menos 1 usuário Cliente por empresa.

### Findings

Criar findings variados:

* Critical;
* High;
* Medium;
* Low;
* Informational.

Distribuir diferentes status entre eles.

Os dados devem gerar dashboards visualmente interessantes e permitir testar filtros e permissões.

---

# 15. Autenticação / Demonstração

Para o protótipo, implementar uma autenticação simples.

Criar usuários de demonstração:

```text
Pentester
email: pentester@example.com

Cliente Alpha
email: cliente.alpha@example.com

Cliente Beta
email: cliente.beta@example.com
```

Pode utilizar uma senha simples de demonstração.

Após o login, o sistema deve identificar o tipo de usuário e carregar a visão correspondente.

---

# 16. Escopo do protótipo

Não implementar neste momento:

* Integração com scanners;
* Importação automática de Nessus;
* Importação de Burp Suite;
* Importação de Nmap;
* Integração com Jira;
* Integração com e-mail;
* Notificações;
* SSO;
* MFA;
* Cálculo automático de CVSS;
* Gestão financeira;
* Gestão completa de contratos;
* Relatórios PDF avançados;
* Workflow complexo de aprovação.

O objetivo é criar um **MVP funcional e navegável**, não uma plataforma completa como o DefectDojo.

---

# 17. Prioridades de implementação

Priorize nesta ordem:

### P0 — Essencial

1. Login;
2. Controle de acesso;
3. Empresas;
4. Projetos;
5. Findings;
6. Dashboard;
7. Filtros;
8. Página de detalhes do Finding.

### P1 — Importante

9. Upload de evidências;
10. Gestão de pentesters;
11. Controle de horas;
12. Dashboard por projeto;
13. Busca global.

### P2 — Futuro

14. Relatórios;
15. Integrações;
16. Notificações;
17. Importação de ferramentas de segurança.

---

# 18. Requisitos técnicos

Construa o projeto como uma aplicação funcional, e não apenas como mockup.

Requisitos:

* Frontend responsivo;
* Backend/API;
* Banco de dados persistente;
* Autenticação;
* Autorização baseada em perfil;
* CRUD de empresas;
* CRUD de projetos;
* CRUD de findings;
* Upload de evidências;
* Dados seed/demo;
* Validação dos formulários;
* Tratamento de erros.

Utilize uma arquitetura simples e fácil de evoluir posteriormente.

Não implemente funcionalidades fora do escopo apenas para aumentar a complexidade.

---

# 19. Critérios de aceite

O protótipo será considerado funcional quando for possível executar o seguinte fluxo:

```text
Login
  ↓
Dashboard
  ↓
Criar empresa
  ↓
Criar projeto
  ↓
Associar pentesters
  ↓
Criar Finding
  ↓
Adicionar descrição
  ↓
Adicionar evidência
  ↓
Definir severidade
  ↓
Definir CVSS
  ↓
Definir mitigação
  ↓
Definir status
  ↓
Visualizar Finding
  ↓
Alterar status
  ↓
Dashboard atualizado
```

Também deve ser possível:

```text
Login como Pentester
        ↓
Visualizar Empresa A
Visualizar Empresa B
Visualizar todos os projetos
Visualizar todos os findings


Login como Cliente A
        ↓
Visualizar Empresa A
Visualizar projetos da Empresa A
Visualizar findings da Empresa A
        X
Não visualizar Empresa B
        X
Não visualizar projetos da Empresa B
        X
Não visualizar findings da Empresa B
```

O resultado final deve ser um **MVP visualmente profissional, funcional e fácil de demonstrar**, servindo como base para posteriormente adicionar recursos mais avançados de uma plataforma de gestão de vulnerabilidades.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://z9f68a36-2abc-4503-a928-479f5cba9de8.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/6045f1d7-a4ca-4269-bc5e-50ddb1162bfe).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
