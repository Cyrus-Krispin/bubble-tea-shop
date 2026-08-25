import assert from "node:assert/strict";
import test from "node:test";

import { classifyChangedPaths } from "./detect-changes.mjs";

test("runs only frontend verification and the release gate for frontend changes", () => {
  assert.deepEqual(classifyChangedPaths(["frontend/src/App.tsx"]), {
    backend: false,
    frontend: true,
    infrastructure: false,
    release: true,
  });
});

test("runs only backend verification and the release gate for backend changes", () => {
  assert.deepEqual(classifyChangedPaths(["backend/src/main/java/Application.java"]), {
    backend: true,
    frontend: false,
    infrastructure: false,
    release: true,
  });
});

test("runs infrastructure verification and the release gate for Compose changes", () => {
  assert.deepEqual(classifyChangedPaths(["compose.yaml"]), {
    backend: false,
    frontend: false,
    infrastructure: true,
    release: true,
  });
});

test("runs the release gate when the Docker build context changes", () => {
  assert.deepEqual(classifyChangedPaths([".dockerignore"]), {
    backend: false,
    frontend: false,
    infrastructure: false,
    release: true,
  });
});

test("runs backend and frontend verification for the shared OpenAPI contract", () => {
  assert.deepEqual(classifyChangedPaths(["docs/api/openapi.json"]), {
    backend: true,
    frontend: true,
    infrastructure: false,
    release: true,
  });
});

test("skips expensive verification for documentation-only changes", () => {
  assert.deepEqual(classifyChangedPaths(["README.md", "docs/product/mvp.md"]), {
    backend: false,
    frontend: false,
    infrastructure: false,
    release: false,
  });
});

test("runs every gate when CI routing changes", () => {
  for (const path of [".github/workflows/ci.yml", ".github/ci/detect-changes.mjs"]) {
    assert.deepEqual(classifyChangedPaths([path]), {
      backend: true,
      frontend: true,
      infrastructure: true,
      release: true,
    });
  }
});

test("combines categories across multiple changed files", () => {
  assert.deepEqual(classifyChangedPaths([
    "backend/pom.xml",
    "infra/supabase/kong/kong.yml",
  ]), {
    backend: true,
    frontend: false,
    infrastructure: true,
    release: true,
  });
});
