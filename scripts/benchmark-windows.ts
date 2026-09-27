#!/usr/bin/env tsx

/** Repeated Windows live-model coding benchmark. Run with a configured user profile. */
import { spawnSync } from "node:child_process";
import { appendFile, mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";

interface Task {
  id: string;
  files: Record<string, string>;
  editable: string[];
  prompt: string;
}

const tasks: Task[] = [
  {
    id: "retry-boundary",
    files: { "src/retry.js": "export function shouldRetry(status) {\n  return status > 500 && status < 504;\n}\n", "test/retry.test.js": `import { test } from "node:test";
import { strict as assert } from "node:assert";
import { shouldRetry } from "../src/retry.js";
test("retry 500 through 504", () => {
  for (const status of [500, 501, 502, 503, 504]) assert.equal(shouldRetry(status), true);
});
test("do not retry client errors or 505", () => {
  for (const status of [400, 429, 499, 505]) assert.equal(shouldRetry(status), false);
});
` },
    editable: ["src/retry.js"],
    prompt: "Read src/retry.js and test/retry.test.js. Fix shouldRetry so it returns true for HTTP 500 through 504 inclusive and false otherwise. Only edit src/retry.js. Use PowerShell on Windows if a shell is needed; do not use Bash. Run node --test, then summarize the result.",
  },
  {
    id: "parse-list",
    files: { "src/list.js": "export function parseList(text) {\n  return text.split(',');\n}\n", "test/list.test.js": `import { test } from "node:test";
import { strict as assert } from "node:assert";
import { parseList } from "../src/list.js";
test("trims, drops blanks, and preserves first occurrence", () => {
  assert.deepEqual(parseList(" red, blue, red, , green ,blue "), ["red", "blue", "green"]);
});
test("empty input returns an empty list", () => {
  assert.deepEqual(parseList(" ,  , "), []);
});
` },
    editable: ["src/list.js"],
    prompt: "Read src/list.js and test/list.test.js. Make parseList return trimmed nonempty entries, removing duplicates while preserving the first occurrence order. Only edit src/list.js. Use PowerShell on Windows if a shell is needed; do not use Bash. Run node --test, then summarize the result.",
  },
  {
    id: "sorted-report",
    files: { "src/report.js": "export function formatReport(entries) {\n  return entries.sort((a, b) => a.score - b.score).map((entry) => `${entry.name}:${entry.score}`).join('\\n');\n}\n", "test/report.test.js": `import { test } from "node:test";
import { strict as assert } from "node:assert";
import { formatReport } from "../src/report.js";
test("sorts score descending, then name ascending", () => {
  const entries = [{ name: "zoe", score: 8 }, { name: "amy", score: 8 }, { name: "max", score: 10 }];
  assert.equal(formatReport(entries), "max:10\\namy:8\\nzoe:8");
});
test("does not mutate the caller's list", () => {
  const entries = [{ name: "a", score: 1 }, { name: "b", score: 2 }];
  const before = structuredClone(entries);
  formatReport(entries);
  assert.deepEqual(entries, before);
});
` },
    editable: ["src/report.js"],
    prompt: "Read src/report.js and test/report.test.js. Fix formatReport to sort by score descending, then name ascending for ties, without mutating the input array. Only edit src/report.js. Use PowerShell on Windows if a shell is needed; do not use Bash. Run node --test, then summarize the result.",
  },
  {
    id: "invoice-cross-file",
    files: {
      "src/money.js": "export function lineTotal(item) {\n  return item.price * item.quantity;\n}\n",
      "src/invoice.js": "import { lineTotal } from './money.js';\nexport function invoice(items) {\n  const lines = items.map(item => `${item.name}:${lineTotal(item).toFixed(2)}`);\n  return { lines, total: items.reduce((sum, item) => sum + item.price, 0).toFixed(2) };\n}\n",
      "test/invoice.test.js": `import { test } from "node:test";
import { strict as assert } from "node:assert";
import { lineTotal } from "../src/money.js";
import { invoice } from "../src/invoice.js";
test("line totals subtract a percentage discount", () => {
  assert.equal(lineTotal({ price: 10, quantity: 2, discountPercent: 25 }), 15);
  assert.equal(lineTotal({ price: 4, quantity: 3, discountPercent: 0 }), 12);
});
test("invoice lines and grand total use discounted quantities", () => {
  assert.deepEqual(invoice([
    { name: "pen", price: 10, quantity: 2, discountPercent: 25 },
    { name: "pad", price: 4, quantity: 3, discountPercent: 0 },
  ]), { lines: ["pen:15.00", "pad:12.00"], total: "27.00" });
});
`,
    },
    editable: ["src/money.js", "src/invoice.js"],
    prompt: "Read both src/money.js and src/invoice.js, and test/invoice.test.js. lineTotal must use price times quantity after discountPercent (0 to 100); invoice must format those lines and sum those discounted line totals. Fix both source files. Only edit src/money.js and src/invoice.js. Use PowerShell on Windows if a shell is needed; do not use Bash. Run node --test, then summarize the result.",
  },
  {
    id: "windows-path",
    files: {
      "src/path.js": "import path from 'node:path';\nexport function workspaceFile(root, input) {\n  const candidate = path.resolve(root, input);\n  if (!candidate.startsWith(root)) throw new Error('outside workspace');\n  return candidate;\n}\n",
      "test/path.test.js": String.raw`import { test } from "node:test";
import { strict as assert } from "node:assert";
import { workspaceFile } from "../src/path.js";
test("resolves Windows paths and separators independent of host OS", () => {
  assert.equal(workspaceFile("C:\\Work\\App", "src/readme.txt"), "C:\\Work\\App\\src\\readme.txt");
  assert.equal(workspaceFile("C:\\Work\\App", "C:\\Work\\App\\src\\readme.txt"), "C:\\Work\\App\\src\\readme.txt");
});
test("rejects sibling, parent and other drive", () => {
  for (const input of ["..\\App2\\secrets.txt", "C:\\Work\\App2\\secrets.txt", "D:\\secrets.txt"])
    assert.throws(() => workspaceFile("C:\\Work\\App", input), /outside workspace/);
});
test("Windows containment ignores case and keeps canonical root spelling", () => {
  assert.equal(workspaceFile("C:\\Work\\App", "c:\\work\\app\\src\\x.js"), "C:\\Work\\App\\src\\x.js");
});
`,
    },
    editable: ["src/path.js"],
    prompt: "Read src/path.js and test/path.test.js. Implement workspaceFile using Windows path rules even when the test is run on another OS. Accept relative or absolute paths within root, preserve the root spelling, and reject parent, sibling and other-drive paths with an 'outside workspace' error. Only edit src/path.js. Use PowerShell on Windows if a shell is needed; do not use Bash. Run node --test, then summarize the result.",
  },
  {
    id: "config-errors",
    files: {
      "src/config.js": "export function parseConfig(raw) {\n  const config = JSON.parse(raw);\n  return { timeoutMs: config.timeoutMs || 1000, retries: config.retries || 0 };\n}\n",
      "test/config.test.js": `import { test } from "node:test";
import { strict as assert } from "node:assert";
import { parseConfig } from "../src/config.js";
test("valid values and zero retries", () => {
  assert.deepEqual(parseConfig('{"timeoutMs":250,"retries":0}'), { timeoutMs: 250, retries: 0 });
  assert.deepEqual(parseConfig('{}'), { timeoutMs: 1000, retries: 0 });
});
test("malformed JSON gets a stable configuration error", () => {
  assert.throws(() => parseConfig('{'), { name: "ConfigError", message: /invalid JSON/i });
});
test("invalid shapes and fields get field-specific errors", () => {
  assert.throws(() => parseConfig('null'), { name: "ConfigError", message: /object/i });
  assert.throws(() => parseConfig('[]'), { name: "ConfigError", message: /object/i });
  assert.throws(() => parseConfig('{"timeoutMs":-1}'), { name: "ConfigError", message: /timeoutMs/ });
  assert.throws(() => parseConfig('{"retries":1.5}'), { name: "ConfigError", message: /retries/ });
});
`,
    },
    editable: ["src/config.js"],
    prompt: "Read src/config.js and test/config.test.js. Parse configuration safely. Malformed JSON must throw a ConfigError with 'invalid JSON'; null and arrays must throw a ConfigError mentioning object; timeoutMs must be a positive finite number and retries a nonnegative integer, with errors naming the field. Keep defaults 1000 and 0. Only edit src/config.js. Use PowerShell on Windows if a shell is needed; do not use Bash. Run node --test, then summarize the result.",
  },
];

const repo = resolve(import.meta.dirname, "..");
const cli = join(repo, "dist", "eagent.js");
const profile = process.env.EASY_AGENT_BENCHMARK_PROFILE ?? "deepseek";
const fixtureOnly = process.argv.includes("--check-fixtures");
const outputIndex = process.argv.indexOf("--output");
const outputPath = outputIndex < 0 ? null : resolve(process.argv[outputIndex + 1] ?? "");
if (outputIndex >= 0 && !process.argv[outputIndex + 1]) throw new Error("--output needs a path");
if (outputPath) await writeFile(outputPath, "");
const repeats = fixtureOnly ? 1 : 3;
const root = await mkdtemp(join(tmpdir(), "easy-agent-benchmark-"));
const results: Record<string, unknown>[] = [];
const benchmarkCommit = run("git", ["rev-parse", "HEAD"], repo).stdout.trim();

function run(command: string, args: string[], cwd: string, timeout = 180_000) {
  return spawnSync(command, args, {
    cwd, env: process.env, encoding: "utf8", timeout, maxBuffer: 4 * 1024 * 1024,
  });
}

function digest(value: string) { return createHash("sha256").update(value).digest("hex"); }
function safeText(value: string) {
  let safe = value;
  for (const [name, secret] of Object.entries(process.env)) {
    if (/KEY|TOKEN|SECRET|PASSWORD/i.test(name) && secret && secret.length >= 8)
      safe = safe.replaceAll(secret, "[REDACTED]");
  }
  return safe.replace(/(?:sk-[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._-]{12,})/gi, "[REDACTED]");
}
function classifyFailure(exit: number | null, subtype: string | undefined, diagnostic: string,
  testExit: number | null, inScope: boolean, processError: Error | undefined) {
  if (processError || exit === null) return "environment";
  if (exit !== 0 || subtype !== "success") {
    if (/permission|denied|not allowed|approval/i.test(diagnostic)) return "permission";
    if (/tool|powershell|bash|readfile|editfile|writefile/i.test(diagnostic)) return "tool";
    if (/timeout|rate limit|429|connection|network|api key|unauthorized|fetch failed/i.test(diagnostic)) return "environment";
    return "model";
  }
  if (testExit !== 0) return "assertion";
  if (!inScope) return "scope";
  return null;
}
async function emit(item: Record<string, unknown>) {
  const line = `${JSON.stringify(item)}\n`;
  process.stdout.write(line);
  if (outputPath) await appendFile(outputPath, line);
}

try {
  for (const task of tasks) {
    for (let repeat = 1; repeat <= repeats; repeat++) {
    const cwd = join(root, `${task.id}-${repeat}`);
    await mkdir(join(cwd, "src"), { recursive: true });
    await mkdir(join(cwd, "test"));
    await writeFile(join(cwd, "package.json"), '{"type":"module"}\n');
    for (const [file, content] of Object.entries(task.files)) await writeFile(join(cwd, file), content);
    if (run("git", ["init", "-q"], cwd).status !== 0) throw new Error(`${task.id}: git init failed`);
    if (run("git", ["config", "core.autocrlf", "false"], cwd).status !== 0) throw new Error(`${task.id}: git config failed`);
    if (run("git", ["add", "."], cwd).status !== 0) throw new Error(`${task.id}: git add failed`);
    const baseline = run("git", ["-c", "user.name=Benchmark", "-c", "user.email=benchmark@example.invalid", "commit", "-qm", "baseline"], cwd);
    if (baseline.status !== 0) throw new Error(`${task.id}: failed to create baseline`);
    const baselineCommit = run("git", ["rev-parse", "HEAD"], cwd).stdout.trim();
    const initial = run(process.execPath, ["--test", "--test-reporter=tap"], cwd);
    if (initial.status === 0) throw new Error(`${task.id}: fixture unexpectedly passes before model edit`);
    if (initial.error) throw new Error(`${task.id}: initial test could not run: ${initial.error.message}`);
    const initialFailedTests = (initial.stdout.match(/^\s*not ok /gm) ?? []).length;
    if (initialFailedTests === 0) throw new Error(`${task.id}: initial test did not report a failed assertion: ${initial.stdout.slice(0, 1000)}`);
    if (fixtureOnly) {
      await emit({ id: task.id, repeat, baselineCommit, initialTestExit: initial.status,
        initialFailedTests, initialTestOutput: safeText(initial.stdout).slice(0, 3000) });
      continue;
    }

    const started = Date.now();
    const agent = run(process.execPath, [cli, "--model", profile, "--print", task.prompt, "--output-format", "json", "--dangerously-skip-permissions", "--trust-project-config"], cwd, 300_000);
    const wallMs = Date.now() - started;
    let result: { subtype?: string; is_error?: boolean; result?: string; duration_ms?: number; num_turns?: number; usage?: { input_tokens?: number; output_tokens?: number } } = {};
    try { result = JSON.parse(agent.stdout.trim()); } catch { /* Report parse failure without printing provider output. */ }
    const test = run(process.execPath, ["--test", "--test-reporter=tap"], cwd);
    const status = run("git", ["status", "--porcelain", "--untracked-files=all"], cwd);
    const changedFiles = status.stdout.split(/\r?\n/).filter(Boolean).map((line) => line.slice(3).trim().replaceAll("\\", "/")).sort();
    const allowed = task.editable.toSorted();
    const expectedEdits = allowed.every((file) => changedFiles.includes(file));
    const inScope = changedFiles.length === allowed.length && expectedEdits;
    const diff = run("git", ["diff", "--", ...task.editable], cwd);
    const initialFilesHash = digest(Object.entries(task.files).sort().map(([file, content]) => `${file}\0${content}`).join("\0"));
    const success = agent.status === 0 && result.subtype === "success" && !result.is_error
      && test.status === 0 && status.status === 0 && inScope;
    const diagnostic = safeText(agent.error?.message ?? (agent.status !== 0 ? result.result ?? agent.stderr ?? "" : ""));
    const failureType = success ? null : classifyFailure(agent.status, result.subtype, diagnostic,
      test.status, inScope, agent.error);
    const item = {
      id: task.id, repeat, benchmarkCommit, profile, baselineCommit, initialFilesHash,
      initialTestExit: initial.status, initialFailedTests,
      success, cliExit: agent.status, subtype: result.subtype ?? "unparsed",
      testExit: test.status, testFailedTests: (test.stdout.match(/^\s*not ok /gm) ?? []).length,
      testOutput: safeText(test.stdout).slice(0, 12_000), changedFiles, allowedFiles: allowed,
      diff: safeText(diff.stdout).slice(0, 20_000), diffSha256: digest(diff.stdout),
      wallMs, modelDurationMs: result.duration_ms ?? null,
      turns: result.num_turns ?? null, inputTokens: result.usage?.input_tokens ?? null,
      outputTokens: result.usage?.output_tokens ?? null,
      failureType,
      diagnostic: success ? null : diagnostic.slice(0, 2_000),
    };
    results.push(item);
    await emit(item);
    }
  }
} finally {
  await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

const passed = results.filter((item) => item.success).length;
await emit({ summary: { passed, total: results.length, fixtureOnly } });
if (!fixtureOnly && passed !== tasks.length * repeats) process.exitCode = 1;
