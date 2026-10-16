import { test } from "node:test";
import assert from "node:assert/strict";
import { getAiConfig, isAiConfigured, describeAiStatus, aiChat, listSupportedProviders } from "../utils/aiProvider.js";

const KEYS = ["AI_PROVIDER", "AI_MODEL", "AI_API_KEY", "AI_BASE_URL", "AI_TIMEOUT_MS"];
function clearEnv() {
  for (const k of KEYS) delete process.env[k];
}

test("no provider configured reports no_provider", () => {
  clearEnv();
  assert.equal(isAiConfigured(), false);
  assert.equal(describeAiStatus().reason, "no_provider");
});

test("partial configuration reports incomplete", () => {
  clearEnv();
  process.env.AI_PROVIDER = "openai";
  assert.equal(isAiConfigured(), false);
  const status = describeAiStatus();
  assert.equal(status.configured, false);
  assert.equal(status.reason, "incomplete");
});

test("a fully configured supported provider is ready", () => {
  clearEnv();
  process.env.AI_PROVIDER = "openai";
  process.env.AI_MODEL = "gpt-4o-mini";
  process.env.AI_API_KEY = "test-key";
  const status = describeAiStatus();
  assert.equal(status.configured, true);
  assert.equal(status.provider, "openai");
  assert.equal(status.model, "gpt-4o-mini");
  // Key must never be echoed back in the status payload.
  assert.equal(Object.prototype.hasOwnProperty.call(status, "apiKey"), false);
});

test("custom provider requires an explicit base URL", () => {
  clearEnv();
  process.env.AI_PROVIDER = "custom";
  process.env.AI_MODEL = "some-model";
  process.env.AI_API_KEY = "test-key";
  assert.equal(isAiConfigured(), false);
  process.env.AI_BASE_URL = "https://example.invalid/v1";
  assert.equal(isAiConfigured(), true);
});

test("aiChat returns not_configured instead of fabricating an answer", async () => {
  clearEnv();
  const result = await aiChat([{ role: "user", content: "How many tickets?" }]);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "not_configured");
});

test("supported provider list includes known providers", () => {
  const providers = listSupportedProviders();
  assert.ok(providers.includes("openai"));
  assert.ok(providers.includes("gemini"));
  assert.ok(providers.includes("groq"));
  assert.equal(getAiConfig().provider, "");
});
