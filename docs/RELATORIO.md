# Kampus 2023: relatório da tarefa 1 (pôr a correr e prints do "antes")

Abrange os dois repositórios: `kampus-front` (este) e `kampus-back`.

## O que foi preciso mudar no código da app e porquê

| Repositório | Ficheiro | Alteração | Porquê |
| ----------- | -------- | --------- | ------ |
| back | `db/index.js` | URI do MongoDB passa a vir de `MONGODB_URI` (omissão: MongoDB local) | Estava fixa a URI do Atlas de produção, com credenciais |
| back | `routes/auth.routes.js` | No signup, se o email já existe, a cadeia termina depois da resposta 400 | Um registo duplicado deitava o processo abaixo (`ERR_HTTP_HEADERS_SENT` numa rejeição sem tratamento) |
| front | 9 ficheiros em `src/` | `API_URL` passa a `import.meta.env.VITE_API_URL \|\| "http://localhost:5005"` | Estava fixo o URL do back de produção |
| front | `src/index.css` | Removido o `@import` do Google Fonts (Poppins, VT323) | Era um pedido a um serviço externo. Nenhuma regra usava essas fontes, por isso o aspeto não muda (prints das páginas estáticas iguais ao pixel antes e depois) |

O resto é ferramenta à volta da app: `.env.example`, MongoDB local, seed, testes, lint, `verificar.sh`, scripts Playwright e READMEs. Não houve mudanças de design.

## O que funciona (confirmado no browser, `npm run fluxos`)
- Páginas públicas: `/`, `/landing`, `/login` (login e registo de staff).
- Staff:
  - registo;
  - login;
  - dashboard com a lista de utilizadores;
  - criar, editar e apagar alunos;
  - perfil;
  - logout.
- Aluno:
  - login pelo modal STUDENT;
  - visita virtual;
  - dashboard;
  - tarefas (criar, concluir, apagar);
  - notas (criar, apagar);
  - perfil;
  - lista de staff.
- Um registo com email repetido é recusado com 400 e a API continua de pé.

## O que não funciona ou exige contorno (bugs de 2023, não corrigidos)
1. **Checkbox de tarefas:** o estado só é inicializado ao carregar a lista, e sempre como "To do". Numa tarefa acabada de criar, o primeiro clique grava "To do"; as tarefas já concluídas aparecem por marcar. O `fluxos.mjs` recarrega a página antes de marcar uma tarefa.
2. **API sem autenticação nem autorização:** `/auth/users` (incluindo os hashes das palavras-passe) e o editar, apagar, tarefas e notas respondem sem token. O hash chega ao campo "Password" do perfil.
3. **Edição de utilizadores:** o `PUT /auth/users/:id` grava a palavra-passe tal como recebe. Hoje o front reenvia o hash, por isso o login continua a funcionar. Há uma segunda rota `PUT` igual mais abaixo que nunca é usada.
4. **Mobile:** nenhum ecrã está adaptado (ver os prints `*-mobile`).
5. **Sem página 404:** uma rota inexistente mostra só o fundo.
6. **CORS:** o `app.js` aplica dois `cors()`. Nos preflights só são aceites `localhost:5173` e o domínio Netlify; `ORIGIN` só funciona para pedidos simples.
7. **Lint do front:** 9 avisos `react-hooks/exhaustive-deps`. Corrigi-los mudaria o comportamento.
8. **Código morto:** `middleware/socketServer.js` (requer `./app`, que não existe nessa pasta) e `socket.js` não estão ligados ao servidor.

## Mocks e serviços externos
- **MongoDB Atlas:** substituído por um MongoDB local (`npm run db:local`, binário oficial via mongodb-memory-server).
- **Back de produção (adaptable.app) e front Netlify:** substituídos pelo back e pelo front locais.
- **Google Fonts:** desligado (ver a tabela acima).
- **Chat socket.io:** não está ligado no código de 2023; ficou desligado.
- **Email, pagamentos, uploads:** a app não os usa.

## Segredos encontrados (sem valores)

| Repositório | Ficheiro | Tipo | Estado |
| ----------- | -------- | ---- | ------ |
| kampus-back | `m3-rest-api/project-management-server/db/index.js` | Connection string do MongoDB Atlas com utilizador e palavra-passe | Removida do código; **continua na história do git**. Recomendado mudar a palavra-passe no Atlas ou desativar esse utilizador e, se o repositório for público, limpar a história |

No `kampus-front` não foram encontrados segredos (código e história).

## Verificação
- **`./verificar.sh` do front (completo):** corre o `verificar-unitario.sh` (instala, build, lint e testes com axios simulado) e depois o `kampus/scripts/integrado.sh`.
  - O `integrado.sh` arranca o MongoDB local, aplica o seed com data fixa e arranca a API e o front.
  - Gera os prints com o relógio do browser fixo e confere `docs/antes/`: PNG válidos, dimensões mínimas, não vazios e iguais pixel a pixel aos gerados (tolerância de 0,5 %).
  - Corre os fluxos reais no Chromium.
  - Exige o `kampus-back` em `../kampus-back` ou em `KAMPUS_BACK_DIR`; sem ele, falha.
- **`./verificar.sh` do back:** instala, faz `node --check`, lint e testes de integração da API e do seed (MongoDB em memória).
- **O seed só apaga numa base local de demonstração.** Antes de ligar, o host tem de ser `127.0.0.1`, `localhost` ou `[::1]` e a base tem de se chamar `kampus` ou `kampus-<sufixo>`. Depois de ligar, recusa se a base tiver coleções que não sejam `users`, `tasks` ou `notes`.
