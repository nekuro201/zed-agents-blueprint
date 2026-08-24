import { useState } from "react";
import { ArrowUp } from "lucide-react";

/**
 * Composer da Chat da Thread (v5 → `.composer`).
 * Enter envia; Shift+Enter quebra linha.
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
            if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
            e.preventDefault();
            submit();
          }}
          placeholder="Descreva o escopo… o Planejador gera o PLAN.md"
          rows={3}
          className="w-full resize-none rounded-lg border border-edge bg-surface px-3 py-2 pr-12 text-sm leading-relaxed text-zinc-100 placeholder:text-zinc-600 focus:border-accent focus:outline-none disabled:opacity-40"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!text.trim() || disabled}
          aria-label="Enviar"
          title="Enviar (Enter)"
          className="absolute bottom-2 right-2 grid h-[30px] w-[30px] place-items-center rounded-md bg-amber-500 text-zinc-950 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ArrowUp size={16} aria-hidden />
        </button>
      </div>
    </div>
  );
}
