import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ModelSettingsModal } from "./ModelSettingsModal";
import { DEFAULT_MODEL_CONFIG } from "../../lib/modelConfig";

describe("ModelSettingsModal", () => {
  it("não renderiza nada quando fechada", () => {
    const { container } = render(<ModelSettingsModal open={false} config={DEFAULT_MODEL_CONFIG} onSave={() => {}} onClose={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renderiza os 4 agentes com campos manuais de modelo e thinking", () => {
    render(<ModelSettingsModal open config={DEFAULT_MODEL_CONFIG} onSave={() => {}} onClose={() => {}} />);
    expect(screen.getByLabelText(/modelo do planejador/i)).toHaveValue(DEFAULT_MODEL_CONFIG.plan.model);
    expect(screen.getByLabelText(/modelo do coder/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/modelo do juiz tdd/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/thinking do techlead/i)).toBeInTheDocument();
  });

  it("edita um campo e salva via onSave + fecha", async () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<ModelSettingsModal open config={DEFAULT_MODEL_CONFIG} onSave={onSave} onClose={onClose} />);

    await user.clear(screen.getByLabelText(/modelo do coder/i));
    await user.type(screen.getByLabelText(/modelo do coder/i), "llmgateway/grok-4-5");
    await user.click(screen.getByRole("button", { name: /salvar/i }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ coder: expect.objectContaining({ model: "llmgateway/grok-4-5" }) }),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("desabilita Salvar quando algum campo fica vazio", async () => {
    const user = userEvent.setup();
    render(<ModelSettingsModal open config={DEFAULT_MODEL_CONFIG} onSave={() => {}} onClose={() => {}} />);
    await user.clear(screen.getByLabelText(/modelo do juiz tdd/i));
    expect(screen.getByRole("button", { name: /salvar/i })).toBeDisabled();
  });

  it("Cancelar fecha sem salvar", async () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<ModelSettingsModal open config={DEFAULT_MODEL_CONFIG} onSave={onSave} onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: /cancelar/i }));
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
