#!/usr/bin/env node

import vm from "node:vm";
import readline from "node:readline";

const SIGNER_BUNDLE_FALLBACK =
  "https://lf-package-cn.feishucdn.com/obj/atsx-throne/hire-fe-prod/portal/campus/static/js/8896.8fcfbfba.js";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36";

async function loadSigner() {
  let bundleUrl = SIGNER_BUNDLE_FALLBACK;
  try {
    const portalResponse = await fetch(
      "https://jobs.bytedance.com/campus/position",
    );
    if (portalResponse.ok) {
      const html = await portalResponse.text();
      const currentBundle = html.match(
        /<script[^>]+src="([^"]*\/static\/js\/8896\.[^"]+\.js)"/i,
      )?.[1];
      if (currentBundle) bundleUrl = currentBundle;
    }
  } catch {
    // The immutable CDN fallback remains usable when the portal HTML is down.
  }
  const response = await fetch(bundleUrl);
  if (!response.ok) {
    throw new Error(`official ATS signer bundle returned HTTP ${response.status}`);
  }
  const source = await response.text();
  const modules = {};
  const chunks = [];
  chunks.push = (entry) => {
    Object.assign(modules, entry[1] || {});
    return 1;
  };
  const navigator = {
    userAgent: USER_AGENT,
    language: "zh-CN",
    languages: ["zh-CN", "zh"],
  };
  const document = {
    cookie: "",
    referrer: "",
    createElement: () => ({}),
    getElementsByTagName: () => [],
  };
  const window = { webpackChunkportal_: chunks, navigator, document };
  const sandbox = {
    window,
    self: window,
    navigator,
    document,
    console,
    location: { href: "", origin: "" },
    screen: { width: 1920, height: 1080 },
    setTimeout,
    clearTimeout,
  };
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(source, context, { timeout: 15_000 });
  if (typeof modules[57195] !== "function") {
    throw new Error("official ATS signer module 57195 was not found");
  }
  const module = { exports: {} };
  modules[57195](module, module.exports);
  if (typeof module.exports.sign !== "function") {
    throw new Error("official ATS sign function was not exported");
  }
  return module.exports.sign;
}

const sign = await loadSigner();
const input = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});

for await (const line of input) {
  if (!line.trim()) continue;
  try {
    const request = JSON.parse(line);
    const signature = sign({
      url: request.url,
      body: request.body || {},
    });
    process.stdout.write(`${JSON.stringify({ signature })}\n`);
  } catch (error) {
    process.stdout.write(
      `${JSON.stringify({ error: String(error?.message || error) })}\n`,
    );
  }
}
