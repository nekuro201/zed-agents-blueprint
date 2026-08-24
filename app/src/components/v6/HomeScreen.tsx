import { useState } from "react";
import { FolderOpen, FolderPlus, GitBranch, Plus, Settings, X } from "lucide-react";
import type { WorkspaceSession } from "../../lib/workspaceSession";
import { TitleBar } from "../v5/TitleBar";
import { StatusBar } from "../v5/StatusBar";

function folderName(path: string): string {
  return path.replace(/\\/g, "/").split("/").filter(Boolean).pop() || path;
}

function ago(ts: number): string {
  const m = Math.floor(Math.max(0, Date.now() - ts) / 60_000);
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  const days = Math.floor(h / 24);
  return days === 1 ? "ontem" : `há ${days} dias`;
}

export function HomeScreen({
  recents,
  mock = false,
  onOpen,
  onRemove,
  onPickFolder,
  onMockChange,
  onOpenSettings,
}: {
  recents: WorkspaceSession[];
  mock?: boolean;
  onOpen: (session: { name: string; path: string }) => void;
  onRemove: (path: string) => void;
  onPickFolder: () => Promise<string | null>;
  onMockChange?: (value: boolean) => void;
  onOpenSettings?: () => void;
}) {
  const [modal, setModal] = useState(false);
  const [name, setName] = useState("");
  const [path, setPath] = useState("");

  const openModal = () => {
    setName("");
    setPath("");
    setModal(true);
  };

  const confirm = () => {
    const trimmed = path.trim();
    if (!trimmed) return;
    onOpen({ name: name.trim() || folderName(trimmed), path: trimmed });
    setModal(false);
  };

  return (
    <div className="flex h-full flex-col bg-surface text-zinc-200">
      <TitleBar onOpenPalette={() => undefined} tokensLabel="0" />
      <section className="flex min-h-0 flex-1 justify-center overflow-auto px-6 py-12">
        <div className="w-full max-w-xl">
          <div className="mb-7 text-center">
            <div className="mx-auto mb-3.5 grid h-11 w-11 place-items-center rounded-xl bg-linear-to-br from-amber-300 to-amber-500 text-lg font-bold text-zinc-950">
              π
            </div>
            <h1 className="text-[22px] font-bold tracking-tight text-zinc-100">Abrir um projeto</h1>
            <p className="mt-1.5 text-[13px] text-zinc-500">Escolha uma pasta para começar, ou continue de onde parou.</p>
            <div className="mt-3 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => onMockChange?.(!mock)}
                className="rounded-full border border-accent/40 bg-accent/10 px-2.5 py-0.5 text-[11px] text-amber-300"
              >
                {mock ? "Modo simulado" : "Modo real"}
              </button>
              <button
                type="button"
                aria-label="Configurações"
                onClick={() => onOpenSettings?.()}
                className="grid h-7 w-7 place-items-center rounded-md border border-edge text-zinc-400 hover:text-zinc-100"
              >
                <Settings size={14} aria-hidden />
              </button>
            </div>
          </div>

          <div className="mb-7 grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={openModal}
              className="rounded-[10px] border border-edge bg-panel p-4 text-left transition-colors hover:border-accent/40 hover:bg-accent/10"
            >
              <span className="mb-2.5 grid h-8 w-8 place-items-center rounded-lg bg-linear-to-br from-amber-300 to-amber-500 text-zinc-950">
                <Plus size={16} aria-hidden />
              </span>
              <b className="block text-[13px] font-semibold text-zinc-100">Novo projeto</b>
              <span className="text-[11.5px] leading-snug text-zinc-500">Cria um workspace a partir de uma pasta no disco.</span>
            </button>
            <button
              type="button"
              onClick={openModal}
              className="rounded-[10px] border border-edge bg-panel p-4 text-left transition-colors hover:border-accent/40 hover:bg-accent/10"
            >
              <span className="mb-2.5 grid h-8 w-8 place-items-center rounded-lg bg-[#2a2a2a] text-accent">
                <FolderOpen size={16} aria-hidden />
              </span>
              <b className="block text-[13px] font-semibold text-zinc-100">Abrir pasta</b>
              <span className="text-[11.5px] leading-snug text-zinc-500">Seleciona um projeto já existente no computador.</span>
            </button>
          </div>

          <div className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">Recentes</div>
          {recents.length === 0 ? (
            <div className="rounded-[10px] border border-dashed border-edge px-4 py-5 text-center text-xs text-zinc-500">
              Nenhum projeto recente. Abra uma pasta para começar.
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {recents.map((item) => (
                <div
                  key={item.path}
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpen(item)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onOpen(item);
                  }}
                  className="grid grid-cols-[36px_1fr_auto] items-center gap-3 rounded-[10px] border border-edge bg-[#171717] px-3 py-3 text-left"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#2a2a2a] text-accent">
                    <GitBranch size={16} aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold text-zinc-100">{item.name}</div>
                    <div className="truncate font-mono text-[11px] text-zinc-500">{item.path}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10.5px] text-zinc-500">{ago(item.openedAt)}</span>
                    <button
                      type="button"
                      aria-label={`Remover ${item.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove(item.path);
                      }}
                      className="grid h-6.5 w-6.5 place-items-center rounded-md text-zinc-500 hover:bg-red-950/40 hover:text-red-300"
                    >
                      <X size={14} aria-hidden />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
      <StatusBar motor="idle" branch="—" fase="Nenhum projeto aberto" tokens="0" version="v0.1.0" />

      {modal && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModal(false);
          }}
        >
          <div className="w-[min(520px,calc(100vw-32px))] overflow-hidden rounded-xl border border-edge bg-panel shadow-2xl">
            <header className="flex items-center justify-between border-b border-edge px-4 py-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
                <FolderPlus size={14} aria-hidden /> Novo projeto
              </h3>
              <button type="button" aria-label="Fechar" onClick={() => setModal(false)} className="grid h-7 w-7 place-items-center rounded-md text-zinc-500">
                <X size={14} aria-hidden />
              </button>
            </header>
            <div className="grid gap-3 px-4 py-4">
              <label className="grid gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Nome
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Frontend E-commerce"
                  className="h-9 rounded-md border border-edge bg-surface px-2.5 text-sm font-normal normal-case tracking-normal text-zinc-100 outline-none focus:border-accent"
                />
              </label>
              <label className="grid gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Pasta
                <span className="grid grid-cols-[1fr_auto] gap-2">
                  <input
                    value={path}
                    onChange={(e) => setPath(e.target.value)}
                    placeholder="~/www/meu-projeto"
                    spellCheck={false}
                    className="h-9 rounded-md border border-edge bg-surface px-2.5 font-mono text-sm font-normal normal-case tracking-normal text-zinc-100 outline-none focus:border-accent"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      void onPickFolder().then((dir) => {
                        if (!dir) return;
                        setPath(dir);
                        if (!name.trim()) setName(folderName(dir));
                      });
                    }}
                    className="inline-flex items-center gap-1.5 rounded-md border border-edge px-2.5 text-xs text-zinc-300"
                  >
                    <FolderOpen size={12} aria-hidden /> Escolher
                  </button>
                </span>
              </label>
            </div>
            <footer className="flex justify-end gap-2 border-t border-edge px-4 py-3">
              <button type="button" onClick={() => setModal(false)} className="rounded-md px-3 py-1.5 text-sm text-zinc-400">
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirm}
                disabled={!path.trim()}
                className="rounded-md bg-amber-500 px-3.5 py-1.5 text-sm font-semibold text-zinc-950 disabled:opacity-40"
              >
                Abrir projeto
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
