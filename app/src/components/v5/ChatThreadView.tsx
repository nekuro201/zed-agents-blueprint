import { MessageSquare } from "lucide-react";
import { ChatThreadPrompt } from "./ChatThreadPrompt";

/**
 * View "Chat da Thread" — por ora só o composer do Planejador (o histórico real
 * de conversa é Fase C). Usado pelo Shell quando `threadView` é fornecido.
 */
export function ChatThreadView({
  projectDir,
  onGenerate,
}: {
  projectDir: string;
  onGenerate: (prompt: string) => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-edge bg-panel/40 px-4 py-2.5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
          <MessageSquare size={14} aria-hidden /> Assistente da Thread
        </h3>
        <p className="text-[11px] text-zinc-500">
          Descreva o escopo. O Planejador gera o PLAN.md para o loop Techlead ↔ Coder.
        </p>
        <p className="mt-1 truncate font-mono text-[10px] text-zinc-600">{projectDir || "sem projeto"}</p>
      </div>
      <div className="grid flex-1 place-items-center px-8 text-center text-sm text-zinc-600">
        Escreva o que precisa ser construído — o cadastro/escopo vira um PLAN.md na pasta do projeto.
      </div>
      <ChatThreadPrompt onGenerate={onGenerate} />
    </div>
  );
}
