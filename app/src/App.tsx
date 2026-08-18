import { useState } from "react";
import { useEngine } from "./hooks/useEngine";
import { Shell } from "./components/v5/Shell";
import { EnginePanel } from "./components/EnginePanel";
import { ChatThreadView } from "./components/v5/ChatThreadView";
import { StatusBar, type MotorState } from "./components/v5/StatusBar";
import { formatCost, formatTokens } from "./lib/format";

const LS_KEY = "pi-factory:last-project";
const DEFAULT_DIR = "/home/abe/www/nekuro";

/**
 * Raiz do app: o Shell v5 é o chrome. O App é a fonte única do engine
 * (`useEngine`) e do projeto/modo-alvo, repassando para o painel do Loop e
 * para o composer do Planejador (Chat da Thread).
 */
export default function App() {
  const { state, actions, notTauri } = useEngine();

  const [projectDir, setProjectDir] = useState(() => {
    try {
      return localStorage.getItem(LS_KEY) ?? DEFAULT_DIR;
    } catch {
      return DEFAULT_DIR;
    }
  });
  const [mock, setMock] = useState(() => {
    try {
      return localStorage.getItem(LS_KEY + ":mock") === "1";
    } catch {
      return false;
    }
  });

  const persist = (dir: string) => {
    setProjectDir(dir);
    try {
      localStorage.setItem(LS_KEY, dir);
    } catch {
      /* armazenamento indisponível */
    }
  };

  const setMockValue = (value: boolean) => {
    setMock(value);
    try {
      localStorage.setItem(LS_KEY + ":mock", value ? "1" : "0");
    } catch {
      /* noop */
    }
  };

  const motor: MotorState =
    state.status === "running" || state.status === "starting" ? "run" : state.connected ? "on" : "idle";

  const statusBar = (
    <StatusBar
      motor={motor}
      branch="feature/auth-ui"
      fase={state.phase?.fase ?? "Sem fase ativa"}
      tokens={`${formatTokens(state.tokens.total)} · ${formatCost(state.cost)}`}
      elapsed={`${state.elapsed}s`}
      version={`v${state.version ?? "0.1.0"}`}
    />
  );

  return (
    <Shell
      workspaceView={
        <EnginePanel
          state={state}
          actions={actions}
          notTauri={notTauri}
          projectDir={projectDir}
          mock={mock}
          onProjectDirChange={persist}
          onMockChange={setMockValue}
        />
      }
      threadView={
        <ChatThreadView projectDir={projectDir} onGenerate={(prompt) => void actions.generatePlan(projectDir, prompt)} />
      }
      statusBar={statusBar}
    />
  );
}
