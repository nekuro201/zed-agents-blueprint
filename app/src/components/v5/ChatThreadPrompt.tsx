import { useState } from "react";

/**
 * Composer da Chat da Thread (v5 → `.composer`).
 * O usuário descreve o escopo e o Planejador gera o PLAN.md (comando `plan`).
 */
export function ChatThreadPrompt({
  onGenerate,
  disabled = false,
}: {
  onGenerate: (prompt: string) => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState("");

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onGenerate(trimmed);
    setText("");
  };

  return (
    <div className="border-t border-edge bg-panel/60 px-4 py-3">
      <div className="relative">
        <textarea
          value={text}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Descreva o escopo… o Planejador gera o PLAN.md"
          rows={3}
          className="w-full resize-none rounded-lg border border-edge bg-surface px-3 py-2 pr-14 text-sm leading-relaxed text-zinc-100 placeholder:text-zinc-600 focus:border-accent focus:outline-none disabled:opacity-40"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!text.trim() || disabled}
          title="Enviar para o Planejador (Ctrl/Cmd+Enter)"
          className="absolute bottom-2 right-2 rounded-md bg-amber-500 px-3 py-1.5 text-xs font-bold text-zinc-950 transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        >
          Enviar
        </button>
      </div>
    </div>
  );
}
