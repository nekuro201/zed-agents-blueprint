export interface GitBranch {
  name: string;
  current: boolean;
}

export function parseGitBranches(stdout: string, current: string): GitBranch[] {
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((name) => ({ name, current: name === current }));
}

export function folderName(path: string): string {
  return path.replace(/\\/g, "/").split("/").filter(Boolean).pop() || path;
}
