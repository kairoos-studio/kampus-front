// Verificação de ponta a ponta dos fluxos que alteram dados, com a app a correr
// localmente (front em BASE_URL, back em API_URL, seed acabado de aplicar). Ver README.
// Uso: node scripts/fluxos.mjs   — sai com erro se algum passo falhar.
import { chromium } from "playwright";

const BASE_URL = process.env.BASE_URL || "http://localhost:5173";
const API_URL = process.env.API_URL || "http://localhost:5005";
const PASSWORD = "Kampus123";
const sufixo = Date.now();
const novoStaff = `staff.${sufixo}@example.com`;
const novoAluno = `aluno.${sufixo}@example.com`;

const browser = await chromium.launch({ chromiumSandbox: false });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const alerts = [];
page.on("dialog", (d) => {
  alerts.push(d.message());
  d.accept();
});

let falhas = 0;
async function passo(nome, fn) {
  try {
    await fn();
    console.log(`OK      ${nome}`);
  } catch (err) {
    falhas++;
    console.log(`FALHOU  ${nome}\n        ${String(err.message).split("\n")[0]}`);
  }
}
const api = (path, opts) => fetch(`${API_URL}${path}`, opts).then((r) => r.json());
const linha = (email) => page.locator("#students-list", { hasText: email });
const botaoAdicionar = () => page.locator('button:has(img[src*="add"])');

await passo("registo de staff em /login (Sign up) entra no dashboard", async () => {
  await page.goto(`${BASE_URL}/login`);
  await page.getByText("Sign up").click();
  await page.getByLabel("First Name").fill("Novo");
  await page.getByLabel("Last Name").fill("Staff");
  await page.getByLabel("Email").fill(novoStaff);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Register" }).click();
  await page.waitForURL("**/dashboard");
  await page.getByText("USERS").waitFor();
});

await passo("registo com email repetido é recusado e a API continua de pé", async () => {
  const res = await fetch(`${API_URL}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: novoStaff, password: PASSWORD, firstName: "Novo", lastName: "Staff", isStudent: false }),
  });
  if (res.status !== 400) throw new Error(`signup duplicado devolveu ${res.status}`);
  await new Promise((r) => setTimeout(r, 300));
  if ((await fetch(`${API_URL}/api`)).status !== 200) throw new Error("API em baixo");
});

await passo("staff cria aluno no dashboard", async () => {
  await botaoAdicionar().click();
  const modal = page.getByRole("dialog");
  await modal.getByLabel("First Name").fill("Novo");
  await modal.getByLabel("Last Name").fill("Aluno");
  await modal.getByLabel("Email").fill(novoAluno);
  await modal.getByLabel("Password").fill(PASSWORD);
  await modal.getByLabel("Cohort").fill("WD-2023-EXEMPLO");
  await modal.getByLabel("Campus").fill("Campus Exemplo");
  await modal.getByLabel("Teacher").fill("Bruno Ficticio");
  await modal.getByLabel("Manager").fill("Ana Exemplo");
  await modal.getByRole("button", { name: "Submit" }).click();
  await modal.waitFor({ state: "detached" });
  await linha(novoAluno).waitFor();
  if (!alerts.includes("Student created successfully")) throw new Error(`alerts: ${alerts}`);
});

await passo("staff edita aluno (cohort) no dashboard", async () => {
  await linha("eduardo.aluno@example.com").locator('button:has(img[src*="pencil"])').click();
  const modal = page.getByRole("dialog");
  await modal.getByLabel("Cohort").fill("WD-EDITADO");
  await modal.getByRole("button", { name: "Submit" }).click();
  await modal.waitFor({ state: "detached" });
  await page.waitForTimeout(1000);
  const users = await api("/auth/users");
  const eduardo = users.find((u) => u.email === "eduardo.aluno@example.com");
  if (eduardo.cohort !== "WD-EDITADO") throw new Error(`cohort = ${eduardo.cohort}`);
  // Depois de criar outro aluno, a edição não pode levar valores desse aluno.
  const esperado = { firstName: "Eduardo", lastName: "Exemplo", campus: "Campus Exemplo", isStudent: true };
  for (const [k, v] of Object.entries(esperado)) {
    if (eduardo[k] !== v) throw new Error(`${k} = ${eduardo[k]} (esperado ${v})`);
  }
  if (!users.some((u) => u.email === novoAluno)) throw new Error("aluno criado antes desapareceu");
  const login = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "eduardo.aluno@example.com", password: PASSWORD }),
  });
  if (login.status !== 200) throw new Error(`login do aluno editado devolveu ${login.status}`);
});

await passo("staff apaga aluno no dashboard", async () => {
  await linha("filipa.aluna@example.com").locator('button:has(img[src*="remove"])').click();
  await linha("filipa.aluna@example.com").waitFor({ state: "detached" });
});

await passo("logout volta à página inicial", async () => {
  await page.locator('button:has(img[src*="logout"])').click();
  await page.waitForTimeout(500);
  if (await page.evaluate(() => localStorage.getItem("authToken"))) throw new Error("token ficou guardado");
});

await passo("aluno novo entra pelo modal STUDENT e vai para a visita virtual", async () => {
  await page.goto(`${BASE_URL}/landing`);
  await page.getByRole("button", { name: "STUDENT" }).click();
  await page.getByLabel("Email").fill(novoAluno);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL("**/virtualtour");
});

await passo("visita virtual avança com Next", async () => {
  await page.getByRole("button", { name: "Next" }).click();
  await page.waitForTimeout(500);
});

await passo("aluno cria, conclui e apaga uma tarefa", async () => {
  await page.goto(`${BASE_URL}/dashboard`);
  await page.getByText("Hi Novo!").waitFor();
  await botaoAdicionar().first().click();
  const modal = page.getByRole("dialog");
  await modal.getByPlaceholder("Enter the title of the task").fill("Tarefa E2E (exemplo)");
  await modal.getByRole("button", { name: "Submit" }).click();
  const tarefa = page.locator('input[value="Tarefa E2E (exemplo)"]');
  await tarefa.waitFor();
  // Bug conhecido de 2023: o estado das checkboxes só é inicializado ao carregar a lista,
  // por isso numa tarefa acabada de criar o primeiro clique grava "To do". Recarrega-se antes.
  await page.reload();
  await tarefa.waitFor();
  const cartao = page.locator("div.bg-Color2", { has: tarefa });
  await cartao.locator('input[type="checkbox"]').click({ force: true });
  await page.waitForTimeout(500);
  const me = (await api("/auth/users")).find((u) => u.email === novoAluno);
  const tasks = await api(`/api/tasks/${me._id}`);
  if (tasks[0]?.status !== "Done") throw new Error(`status = ${tasks[0]?.status}`);
  await cartao.locator('button:has(img[src*="remove"])').click();
  await tarefa.waitFor({ state: "detached" });
});

await passo("aluno cria e apaga uma nota", async () => {
  await botaoAdicionar().nth(1).click();
  const modal = page.getByRole("dialog");
  await modal.getByPlaceholder("Enter the title of the note").fill("Nota E2E (exemplo)");
  await modal.getByPlaceholder("Write the description of the note").fill("Texto fictício.");
  await modal.getByRole("button", { name: "Submit" }).click();
  const nota = page.locator('input[value="Nota E2E (exemplo)"]');
  await nota.waitFor();
  const cartao = page.locator("div", { has: nota }).filter({ has: page.locator('img[src*="remove"]') }).last();
  await cartao.locator('button:has(img[src*="remove"])').click();
  await nota.waitFor({ state: "detached" });
});

await passo("aluno edita o nome no perfil", async () => {
  await page.goto(`${BASE_URL}/profile`);
  await page.getByLabel("First Name").fill("Renomeado");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.waitForURL("**/dashboard");
  await page.getByText("Hi Renomeado!").waitFor();
});

await passo("aluno vê a lista de staff", async () => {
  await page.goto(`${BASE_URL}/staff`);
  await page.getByText(novoStaff).waitFor();
});

await browser.close();
console.log(falhas ? `\n${falhas} passo(s) falharam` : "\nTodos os passos OK");
process.exit(falhas ? 1 : 0);
