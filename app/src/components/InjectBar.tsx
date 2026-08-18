import { useState } from "react";

export function InjectBar({
  enabled,
  onInject,
}: {
  enabled: boolean;
  onInject: (text: string) => void;
}) {
  const [text, setText] = useState("");

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onInject(t);
    setText("");
  };

  return (
    <div className="rounded-xl border border-edge bg-panel p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">Injeção de correção (human-in-the-loop)</span>
        <span className="text-[11px] text-zinc-600">Aplicada no próximo passo do agente</span>
      </div>
      <div className="flex gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          }}
          placeholder={enabled ? "Ex.: Use pnpm em vez de npm nos testes. Priorize a camada ViewModel." : "Inicie a execução para injetar correções…"}
          rows={2}
          disabled={!enabled}
          className="w-full resize-none rounded-lg border border-edge bg-surface px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-accent focus:outline-none disabled:opacity-40"
        />
        <button
          onClick={submit}
          disabled={!enabled || !text.trim()}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-sky-800 bg-sky-900/40 px-3 py-1.5 text-sm font-medium text-sky-200 hover:bg-sky-800/50 disabled:cursor-not-allowed disabled:opacity-40"
          title="Injetar correção (Ctrl/Cmd+Enter)"
        >
          ⤵ Injetar
        </button>
      </div>
    </div>
  );
}
