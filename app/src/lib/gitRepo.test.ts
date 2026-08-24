import { describe, it, expect } from "vitest";
import { parseGitBranches } from "./gitRepo";

describe("parseGitBranches", () => {
  it("parseia nomes e marca a current", () => {
    const list = parseGitBranches("main\nfeature/auth-ui\n", "feature/auth-ui");
    expect(list).toEqual([
      { name: "main", current: false },
      { name: "feature/auth-ui", current: true },
    ]);
  });

  it("stdout vazio vira lista vazia", () => {
    expect(parseGitBranches("", "main")).toEqual([]);
  });
});
