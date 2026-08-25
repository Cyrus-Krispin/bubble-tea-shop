import { appendFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const everyGate = Object.freeze({
  backend: true,
  frontend: true,
  infrastructure: true,
  release: true,
});

export function classifyChangedPaths(paths) {
  const gates = {
    backend: false,
    frontend: false,
    infrastructure: false,
    release: false,
  };

  for (const rawPath of paths) {
    const path = rawPath.trim();
    if (!path) continue;

    if (path === ".github/workflows/ci.yml" || path.startsWith(".github/ci/")) {
      return { ...everyGate };
    }

    if (path.startsWith("backend/") || path === "docs/api/openapi.json") {
      gates.backend = true;
      gates.release = true;
    }
    if (path.startsWith("frontend/") || path === "docs/api/openapi.json") {
      gates.frontend = true;
      gates.release = true;
    }
    if (path.startsWith("infra/") || path === "compose.yaml" || path === ".env.example") {
      gates.infrastructure = true;
      gates.release = true;
    }
  }

  return gates;
}

async function main(environment) {
  let input = "";
  for await (const chunk of process.stdin) input += chunk;

  const separator = input.includes("\0") ? "\0" : /\r?\n/;
  const gates = classifyChangedPaths(input.split(separator));
  const output = Object.entries(gates)
    .map(([name, enabled]) => `${name}=${enabled}`)
    .join("\n") + "\n";

  if (environment.GITHUB_OUTPUT) {
    await appendFile(environment.GITHUB_OUTPUT, output);
    return;
  }
  process.stdout.write(output);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main(process.env);
}
