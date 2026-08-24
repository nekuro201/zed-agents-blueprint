import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HomeScreen } from "./HomeScreen";

const recents = [
  { name: "store-front", path: "/tmp/store-front", openedAt: Date.now() },
  { name: "api-hub", path: "/tmp/api-hub", openedAt: Date.now() - 3600e3 },
];

describe("HomeScreen (v6)", () => {
  it("mostra hero e CTAs Novo projeto / Abrir pasta", () => {
    render(<HomeScreen recents={[]} onOpen={() => {}} onRemove={() => {}} onPickFolder={async () => null} />);
    expect(screen.getByText(/abrir um projeto/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /novo projeto/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /abrir pasta/i })).toBeInTheDocument();
    expect(screen.getByText(/modo real/i)).toBeInTheDocument();
  });

  it("mock=true mostra Modo simulado e o chip chama onMockChange", async () => {
    const onMockChange = vi.fn();
    const user = userEvent.setup();
    render(
      <HomeScreen
        recents={[]}
        mock
        onOpen={() => {}}
        onRemove={() => {}}
        onPickFolder={async () => null}
        onMockChange={onMockChange}
        onOpenSettings={() => {}}
      />,
    );
    expect(screen.getByText(/modo simulado/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /modo simulado/i }));
    expect(onMockChange).toHaveBeenCalledWith(false);
  });

  it("engrenagem chama onOpenSettings", async () => {
    const onOpenSettings = vi.fn();
    const user = userEvent.setup();
    render(
      <HomeScreen
        recents={[]}
        onOpen={() => {}}
        onRemove={() => {}}
        onPickFolder={async () => null}
        onOpenSettings={onOpenSettings}
      />,
    );
    await user.click(screen.getByRole("button", { name: /configurações/i }));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it("sem recents mostra empty", () => {
    render(<HomeScreen recents={[]} onOpen={() => {}} onRemove={() => {}} onPickFolder={async () => null} />);
    expect(screen.getByText(/nenhum projeto recente/i)).toBeInTheDocument();
  });

  it("lista recents com nome e path", () => {
    render(<HomeScreen recents={recents} onOpen={() => {}} onRemove={() => {}} onPickFolder={async () => null} />);
    expect(screen.getByText("store-front")).toBeInTheDocument();
    expect(screen.getByText("/tmp/store-front")).toBeInTheDocument();
  });

  it("clicar recente chama onOpen", async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();
    render(<HomeScreen recents={recents} onOpen={onOpen} onRemove={() => {}} onPickFolder={async () => null} />);
    await user.click(screen.getByText("store-front"));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ path: "/tmp/store-front" }));
  });

  it("remover recente chama onRemove e não onOpen", async () => {
    const onOpen = vi.fn();
    const onRemove = vi.fn();
    const user = userEvent.setup();
    render(<HomeScreen recents={recents} onOpen={onOpen} onRemove={onRemove} onPickFolder={async () => null} />);
    await user.click(screen.getByRole("button", { name: /remover store-front/i }));
    expect(onRemove).toHaveBeenCalledWith("/tmp/store-front");
    expect(onOpen).not.toHaveBeenCalled();
  });
});
