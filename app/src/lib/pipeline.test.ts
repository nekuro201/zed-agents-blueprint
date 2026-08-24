import { describe, it, expect } from "vitest";
import { pipelineFromTimeline } from "./pipeline";
import type { TimelineItem } from "../hooks/useEngine";

describe("pipelineFromTimeline", () => {
  it("sem timeline: 4 agentes idle", () => {
    const agents = pipelineFromTimeline([]);
    expect(agents.map((a) => a.status)).toEqual(["idle", "idle", "idle", "idle"]);
    expect(agents.map((a) => a.id)).toEqual(["plan", "techlead", "coder", "qa"]);
  });

  it("techlead aberto: plan done, techlead active, resto idle", () => {
    const tl: TimelineItem[] = [
      { id: 1, kind: "agent", role: "techlead", ended: false, thinking: "", text: "", tools: [] },
    ];
    expect(pipelineFromTimeline(tl).map((a) => a.status)).toEqual(["done", "active", "idle", "idle"]);
  });

  it("techlead ended + coder aberto: coder active", () => {
    const tl: TimelineItem[] = [
      { id: 1, kind: "agent", role: "techlead", ended: true, thinking: "", text: "", tools: [] },
      { id: 2, kind: "agent", role: "coder", ended: false, thinking: "", text: "", tools: [] },
    ];
    expect(pipelineFromTimeline(tl).map((a) => a.status)).toEqual(["done", "done", "active", "idle"]);
  });
});
