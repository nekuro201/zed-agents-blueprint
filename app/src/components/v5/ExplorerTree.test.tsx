import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Atom, Server } from "lucide-react";
import { ExplorerTree, type ExplorerGroup } from "./ExplorerTree";

const groups: ExplorerGroup[] = [
  {
    name: "Frontend E-commerce",
    icon: Atom,
    branches: [
      { name: "main", status: "ok" },
      { name: "feature/auth-ui", status: "run" },
      { name: "fix/cart-calc", status: "new" },
      { name: "refactor/api", status: "err" },
    ],
  },
  { name: "Backend API Hub", icon: Server, branches: [{ name: "main", status: "ok" }] },
];

describe("ExplorerTree", () => {
  it("renderiza grupos e branches", () => {
    render(<ExplorerTree groups={groups} />);
    expect(screen.getByText("Frontend E-commerce")).toBeInTheDocument();
    expect(screen.getByText("feature/auth-ui")).toBeInTheDocument();
    expect(screen.getByText("Backend API Hub")).toBeInTheDocument();
  });

  it("expõe o status de cada branch via data-status", () => {
    const { container } = render(<ExplorerTree groups={groups} />);
    const statuses = [...container.querySelectorAll("[data-status]")].map((el) => el.getAttribute("data-status"));
    expect(statuses).toEqual(["ok", "run", "new", "err", "ok"]);
  });
});
