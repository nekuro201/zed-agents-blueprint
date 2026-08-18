// Setup global dos testes (Vitest + React Testing Library).
// - jest-dom: matchers legíveis (toBeInTheDocument, etc.)
// - Mocks dos módulos Tauri: em jsdom não existe webview, então `invoke`/`listen`/
//   `open` são stubados para os testes de componentes que importam essas APIs.
import "@testing-library/jest-dom/vitest";
import { vi, beforeEach, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(() => Promise.resolve(() => undefined)),
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(async () => null),
}));

beforeEach(() => {
  cleanup();
});

afterEach(() => {
  cleanup();
});
