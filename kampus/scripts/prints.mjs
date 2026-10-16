// Tira prints de todas as páginas, em desktop e mobile, com a app a correr localmente
// (front em BASE_URL e back com o seed aplicado). Ver README.
// Uso: node scripts/prints.mjs [pasta-destino]   (omissão: ../docs/antes)
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE_URL = process.env.BASE_URL || "http://localhost:5173";
const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(process.argv[2] || path.join(here, "..", "..", "docs", "antes"));
const PASSWORD = "Kampus123"; // palavra-passe das contas fictícias do seed (kampus-back)
const STAFF = "staff@example.com";
const ALUNO = "aluno@example.com";

const TAMANHOS = {
  desktop: { viewport: { width: 1440, height: 900 } },
  mobile: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
};

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ chromiumSandbox: false });

async function print(page, nome, tamanho) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(800); // animações do NextUI / framer-motion
  const file = path.join(OUT, `${nome}-${tamanho}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log("print", path.relative(process.cwd(), file));
}

async function sair(page) {
  await page.evaluate(() => localStorage.clear());
}

for (const [tamanho, opts] of Object.entries(TAMANHOS)) {
  const context = await browser.newContext(opts);
  const page = await context.newPage();
  page.on("dialog", (d) => {
    console.log(`  [alert] ${d.message()}`);
    d.dismiss();
  });

  // Páginas públicas
  await page.goto(`${BASE_URL}/`);
  await page.getByText("GET STARTED").waitFor();
  await print(page, "inicio", tamanho);

  await page.getByText("GET STARTED").click();
  await page.waitForURL("**/landing");
  await print(page, "landing", tamanho);

  await page.getByRole("button", { name: "STUDENT" }).click();
  await page.getByRole("dialog").waitFor();
  await print(page, "landing-login-aluno", tamanho);

  await page.goto(`${BASE_URL}/login`);
  await page.getByText("Welcome back").waitFor();
  await print(page, "login-staff", tamanho);

  await page.getByText("Sign up").click();
  await page.getByText("Sign Up to Get Started").waitFor();
  await print(page, "registo-staff", tamanho);

  // Página privada sem sessão
  await page.goto(`${BASE_URL}/dashboard`);
  await page.getByText("User not Logged in").waitFor();
  await print(page, "dashboard-sem-sessao", tamanho);

  // Rota inexistente (a app não tem página 404)
  await page.goto(`${BASE_URL}/pagina-que-nao-existe`);
  await print(page, "rota-inexistente", tamanho);

  // Staff: login pela página /login
  await page.goto(`${BASE_URL}/login`);
  await page.getByLabel("Email").fill(STAFF);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await page.waitForURL("**/dashboard");
  await page.getByText("USERS").waitFor();
  await page.getByText(ALUNO, { exact: true }).waitFor();
  await print(page, "dashboard-staff", tamanho);

  await page.goto(`${BASE_URL}/profile`);
  await page.getByPlaceholder(STAFF).waitFor();
  await print(page, "perfil-staff", tamanho);
  await sair(page);

  // Aluno: login pelo modal STUDENT da landing
  await page.goto(`${BASE_URL}/landing`);
  await page.getByRole("button", { name: "STUDENT" }).click();
  await page.getByLabel("Email").fill(ALUNO);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL("**/virtualtour");
  await page.waitForTimeout(1500);
  await print(page, "visita-virtual", tamanho);

  await page.goto(`${BASE_URL}/dashboard`);
  await page.getByText("Hi Diana!").waitFor();
  // Os títulos das tarefas e notas são valores de <input>.
  await page.locator('input[value="Ler o guia de boas-vindas (exemplo)"]').waitFor();
  await print(page, "dashboard-aluno", tamanho);

  await page.goto(`${BASE_URL}/profile`);
  await page.getByPlaceholder(ALUNO).waitFor();
  await print(page, "perfil-aluno", tamanho);

  await page.goto(`${BASE_URL}/staff`);
  await page.getByText("bruno.staff@example.com").waitFor();
  await print(page, "contactos-staff", tamanho);
  await sair(page);

  await context.close();
}

await browser.close();
