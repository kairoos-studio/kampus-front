// Testes de fumo do front: as páginas públicas renderizam e o login de staff
// fala com a API configurada (axios simulado, sem back-end real).
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { NextUIProvider } from "@nextui-org/react";
import axios from "axios";
import App from "../src/App.jsx";
import { AuthProviderWrapper } from "../src/Context/auth.context.jsx";

const API = import.meta.env.VITE_API_URL || "http://localhost:5005";

const staff = {
  _id: "000000000000000000000001",
  email: "staff@example.com",
  firstName: "Ana",
  lastName: "Exemplo",
  isStudent: false,
};
const student = {
  _id: "000000000000000000000002",
  email: "aluno@example.com",
  firstName: "Diana",
  lastName: "Aluna",
  cohort: "WD-2023-EXEMPLO",
  campus: "Campus Exemplo",
  isStudent: true,
};

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProviderWrapper>
        <NextUIProvider>
          <App />
        </NextUIProvider>
      </AuthProviderWrapper>
    </MemoryRouter>
  );
}

describe("páginas públicas", () => {
  it("/ mostra a página promocional", () => {
    renderAt("/");
    expect(screen.getByText("KAMPUS")).toBeTruthy();
    expect(screen.getByText("GET STARTED")).toBeTruthy();
  });

  it("/landing mostra as entradas de staff e aluno", () => {
    renderAt("/landing");
    expect(screen.getByText("STAFF")).toBeTruthy();
    expect(screen.getByText("STUDENT")).toBeTruthy();
  });

  it("/login mostra o formulário de login de staff", () => {
    renderAt("/login");
    expect(screen.getByText("Welcome back")).toBeTruthy();
    expect(screen.getByLabelText("Email")).toBeTruthy();
  });
});

describe("login de staff", () => {
  it("chama a API configurada e abre o dashboard de staff", async () => {
    vi.spyOn(axios, "post").mockImplementation(async (url) => {
      if (url === `${API}/auth/login`) return { data: { authToken: "token-falso" } };
      throw new Error(`POST inesperado: ${url}`);
    });
    vi.spyOn(axios, "get").mockImplementation(async (url) => {
      if (url === `${API}/auth/verify`) return { data: { _id: staff._id, email: staff.email } };
      if (url === `${API}/auth/users` || url === `${API}/auth/users/`) return { data: [staff, student] };
      if (url === `${API}/auth/users/${staff._id}`) return { data: staff };
      throw new Error(`GET inesperado: ${url}`);
    });

    renderAt("/login");
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: staff.email } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "Kampus123" } });
    fireEvent.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() => expect(screen.getByText("USERS")).toBeTruthy());
    expect(axios.post).toHaveBeenCalledWith(`${API}/auth/login`, {
      email: staff.email,
      password: "Kampus123",
    });
    expect(localStorage.getItem("authToken")).toBe("token-falso");
    expect(screen.getByText("aluno@example.com")).toBeTruthy();
  });
});
