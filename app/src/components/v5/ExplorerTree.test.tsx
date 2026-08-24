import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Atom } from "lucide-react";
import { ExplorerTree, type ExplorerGroup } from "./ExplorerTree";

const groups: ExplorerGroup[] = [
  {
    name: "store-front",
    icon: Atom,
    branches: [
      { name: "main", status: "ok" },
      { name: "feature/auth-ui", status: "run" },
    ],
  },
];

describe("ExplorerTree", () => {
  it("topo só tem Adicionar workspace; fechar e nova branch são ícones", () => {
    render(<ExplorerTree groups={groups} />);
    expect(screen.getByRole("button", { name: /adicionar workspace/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^fechar workspace$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^nova thread$/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /fechar/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /nova branch/i })).toBeInTheDocument();
  });

  it("sem branches mostra (default)", () => {
    render(<ExplorerTree groups={[{ name: "proj", icon: Atom, branches: [] }]} />);
    expect(screen.getByText("(default)")).toBeInTheDocument();
  });

  it("sem git, nova branch avisa e não chama onNewThread", async () => {
    const onNewThread = vi.fn();
    const user = userEvent.setup();
    render(<ExplorerTree groups={[{ name: "proj", icon: Atom, branches: [] }]} hasGit={false} onNewThread={onNewThread} />);
    await user.click(screen.getByRole("button", { name: /nova branch/i }));
    expect(onNewThread).not.toHaveBeenCalled();
    expect(screen.getByText(/configure git/i)).toBeInTheDocument();
  });

  it("com git, nova branch chama onNewThread", async () => {
    const onNewThread = vi.fn();
    const user = userEvent.setup();
    render(<ExplorerTree groups={groups} hasGit onNewThread={onNewThread} />);
    await user.click(screen.getByRole("button", { name: /nova branch/i }));
    expect(onNewThread).toHaveBeenCalledTimes(1);
  });

  it("visible=false marca data-hidden", () => {
    const { container } = render(<ExplorerTree groups={groups} visible={false} />);
    expect(container.firstChild).toHaveAttribute("data-hidden", "true");
  });
});
