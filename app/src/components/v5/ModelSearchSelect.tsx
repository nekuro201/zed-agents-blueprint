import { useState, useRef, useEffect } from "react";
import { Search, X } from "lucide-react";
import { cn } from "../../lib/cn";
import { formatCost } from "../../lib/format";

export interface SelectableModel {
  id: string;
  name: string;
  provider: string;
  pricing: { prompt: number; completion: number } | null;
  reasoningEfforts?: string[];
}

export function ModelSearchSelect({
  value,
  onChange,
  onRegister,
  models,
}: {
  value: string;
  onChange: (id: string) => void;
  onRegister?: (m: SelectableModel) => void;
  models: SelectableModel[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Abre e foca o input de busca
  const openPopup = () => {
    setOpen(true);
    setQuery("");
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  // Fecha ao clicar fora
  const popupRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const filtered = query.trim()
    ? models.filter((m) => {
        const q = query.toLowerCase();
        return m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q) || m.provider.toLowerCase().includes(q);
      })
    : models;

  // Preço em $/Mtok
  function price(pricing: SelectableModel["pricing"]) {
    if (!pricing) return "—";
    return `${pricing.prompt}/${pricing.completion}`;
  }

  return (
    <span className="relative inline-flex items-center" ref={popupRef}>
      <button
        type="button"
        onClick={open ? () => setOpen(false) : openPopup}
        aria-label="Buscar modelo"
        title="Buscar modelo no llmgateway"
        className={cn(
          "grid h-[26px] w-[26px] shrink-0 place-items-center rounded-md border transition-colors",
          open ? "border-accent bg-accent/10 text-accent" : "border-edge bg-surface text-zinc-500 hover:border-zinc-500 hover:text-zinc-300",
        )}
      >
        <Search size={12} aria-hidden />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-[380px] overflow-hidden rounded-lg border border-edge bg-[#15161a] shadow-2xl">
          <div className="flex items-center gap-1.5 px-2.5 py-2">
            <Search size={12} className="text-zinc-500" aria-hidden />
            <input
              ref={inputRef}
              placeholder="Pesquisar modelos..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setOpen(false);
              }}
              className="flex-1 bg-transparent text-[12px] text-zinc-200 outline-none placeholder:text-zinc-600"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="grid h-5 w-5 place-items-center rounded text-zinc-500 hover:text-zinc-200"
            >
              <X size={10} aria-hidden />
            </button>
          </div>

          <div className="max-h-[240px] overflow-y-auto border-t border-edge/40">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-[11px] text-zinc-600">Nenhum modelo encontrado.</div>
            ) : (
              filtered.slice(0, 50).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    onChange(m.id);
                    onRegister?.(m);
                    setOpen(false);
                  }}
                  title={m.id}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-accent/10",
                    value === m.id && "bg-accent/5",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] font-semibold text-zinc-200">{m.name}</div>
                    <div className="text-[10px] text-zinc-500">{m.id}</div>
                  </div>
                  {m.pricing && (
                    <div className="shrink-0 text-right text-[10px]">
                      <div className="text-amber-300/80">in {price({ prompt: m.pricing.prompt, completion: m.pricing.completion })}</div>
                      <div className="text-zinc-600">out {formatCost(m.pricing.completion)}/Mtok</div>
                    </div>
                  )}
                </button>
              ))
            )}
          </div>

          <div className="border-t border-edge/40 px-2.5 py-1.5 text-[10px] text-zinc-600">
            {models.length > 0 ? `${models.length} modelos · preços em $/Mtok` : "Carregando..."}
          </div>
        </div>
      )}
    </span>
  );
}
