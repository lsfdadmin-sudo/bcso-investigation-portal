/**
 * Replays the stale-session redirect loop and the normal sign-in path.
 *
 * A browser that signed in before the Render container restarted still sends
 * `bcso_session`. That cookie must land on the login screen, not bounce
 * between `/` and a protected page until Chrome reports ERR_TOO_MANY_REDIRECTS.
 *
 * Requires `npm run build` first. Starts its own server. Usage:
 *   node scripts/check-session-redirects.mjs
 */
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { setTimeout as delay } from "node:timers/promises";

const PORT = Number(process.env.CHECK_PORT || 4391);
const BASE = `http://127.0.0.1:${PORT}`;
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const ARTIFACTS = "/opt/cursor/artifacts";
const MAX_HOPS = 5;

const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

class Jar {
  constructor(seed) {
    this.cookies = new Map(seed ? Object.entries(seed) : []);
  }

  apply(response) {
    const lines =
      typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
    for (const line of lines) {
      const [pair] = line.split(";");
      const eq = pair.indexOf("=");
      if (eq < 0) continue;
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      const expired = /max-age=0/i.test(line) || /expires=thu, 01 jan 1970/i.test(line) || value.length === 0;
      if (expired) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
    return lines;
  }

  header() {
    return [...this.cookies.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
  }
}

async function request(url, { jar, method = "GET", body, headers } = {}) {
  const response = await fetch(url, {
    method,
    body,
    redirect: "manual",
    headers: {
      ...(headers ?? {}),
      ...(jar?.header() ? { cookie: jar.header() } : {}),
    },
  });
  const setCookies = jar ? jar.apply(response) : [];
  return { response, setCookies };
}

async function follow(start, options = {}) {
  const chain = [];
  let current = start;
  for (let hop = 0; hop <= MAX_HOPS; hop += 1) {
    const { response, setCookies } = await request(current, {
      ...options,
      method: hop === 0 ? options.method || "GET" : "GET",
      body: hop === 0 ? options.body : undefined,
      headers: hop === 0 ? options.headers : undefined,
    });
    const location = response.headers.get("location");
    chain.push({
      url: current,
      status: response.status,
      location,
      cleared: setCookies.some((line) => line.startsWith("bcso_session=") && /max-age=0/i.test(line)),
    });
    if (response.status >= 300 && response.status < 400 && location) {
      if (hop === MAX_HOPS) {
        return { chain, loop: true, status: response.status, text: "", url: current };
      }
      current = new URL(location, current).href;
      continue;
    }
    const text = await response.text();
    return { chain, loop: false, status: response.status, text, url: current };
  }
  return { chain, loop: true, status: 0, text: "", url: current };
}

function isLogin(result) {
  const pathName = new URL(result.url).pathname;
  return (
    !result.loop &&
    result.chain.length <= 3 &&
    result.status === 200 &&
    pathName === "/" &&
    result.text.includes('id="badge"') &&
    result.text.includes("Sign in") &&
    !result.text.includes("Case board")
  );
}

let server;
let serverLog = "";

function startServer(dataDir) {
  serverLog = "";
  const child = spawn(process.execPath, ["scripts/run.cjs", "start"], {
    cwd: ROOT,
    detached: true,
    env: {
      ...process.env,
      PORT: String(PORT),
      DATA_DIR: dataDir,
      LISTEN_HOST: "127.0.0.1",
      BCSO_COOKIE_SECURE: "false",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const capture = (chunk) => {
    serverLog = (serverLog + chunk.toString()).slice(-12000);
  };
  child.stdout.on("data", capture);
  child.stderr.on("data", capture);
  return child;
}

async function stopServer(child) {
  if (!child || child.killed) return;
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
  const exited = await Promise.race([
    new Promise((resolve) => child.once("exit", () => resolve(true))),
    delay(4000).then(() => false),
  ]);
  if (!exited) {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {
      child.kill("SIGKILL");
    }
    await Promise.race([
      new Promise((resolve) => child.once("exit", resolve)),
      delay(2000),
    ]);
  }
}

async function waitForHealth() {
  const started = Date.now();
  let last = "no response";
  while (Date.now() - started < 30000) {
    try {
      const response = await fetch(`${BASE}/api/health`);
      if (response.ok) return;
      last = `HTTP ${response.status}`;
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
    await delay(200);
  }
  throw new Error(`Server did not become healthy (${last}).\n${serverLog}`);
}

async function signIn(jar, badge = "412", password = "patrol412") {
  const result = await follow(`${BASE}/api/auth/login`, {
    jar,
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ badge, password }),
  });
  assert(result.status === 200 && !result.loop, `login failed: ${JSON.stringify(result.chain)}`);
  assert(jar.cookies.get("bcso_session"), "login did not set bcso_session");
  return result;
}

function expireSessions(dataDir) {
  const database = new DatabaseSync(path.join(dataDir, "bcso.sqlite"));
  database.exec("PRAGMA busy_timeout = 5000");
  database.prepare("UPDATE sessions SET expires_at = ?").run("2000-01-01T00:00:00.000Z");
  database.close();
}

async function checkAnonymousAndStale() {
  const anonymous = new Jar();
  const home = await follow(`${BASE}/`, { jar: anonymous });
  assert(isLogin(home) && home.chain.length === 1, `anonymous / should be the login page, got ${summarize(home)}`);

  const health = await follow(`${BASE}/api/health`, { jar: anonymous });
  assert(health.status === 200 && health.chain.length === 1 && health.text.includes('"ok":true'), "anonymous /api/health");

  const board = await follow(`${BASE}/board`, { jar: anonymous });
  assert(isLogin(board) && board.chain.length === 2, `anonymous /board should redirect once to login, got ${summarize(board)}`);

  const targets = ["/", "/cases", "/cases/1", "/board"];
  for (const target of targets) {
    const jar = new Jar({ bcso_session: "stale-token-from-before-restart" });
    const result = await follow(`${BASE}${target}`, { jar });
    assert(isLogin(result), `stale cookie ${target} should land on login, got ${summarize(result)}`);
    assert(result.chain.some((hop) => hop.cleared), `stale cookie ${target} should clear bcso_session`);
    assert(!jar.cookies.has("bcso_session"), `jar still has bcso_session after ${target}`);
  }

  const api = new Jar({ bcso_session: "stale-token-from-before-restart" });
  const denied = await follow(`${BASE}/api/cases`, { jar: api });
  assert(denied.status === 401 && denied.chain.length === 1, `stale /api/cases should be 401, got ${summarize(denied)}`);
  assert(denied.chain[0].cleared, "stale /api/cases should clear the cookie");
  assert(!api.cookies.has("bcso_session"), "api jar kept the stale cookie");
}

async function checkSignedIn(dataDir) {
  const jar = new Jar();
  await signIn(jar);
  const token = jar.cookies.get("bcso_session");

  const home = await follow(`${BASE}/`, { jar });
  assert(
    !home.loop && home.status === 200 && new URL(home.url).pathname === "/board" && home.text.includes("Case board"),
    `valid session / should open the board, got ${summarize(home)}`,
  );
  assert(home.chain.length === 2, `valid session / should redirect once, got ${home.chain.length}`);
  assert(jar.cookies.get("bcso_session") === token, "visiting / cleared a valid session");

  const board = await follow(`${BASE}/board`, { jar });
  assert(board.status === 200 && board.chain.length === 1 && board.text.includes("Case board"), "valid /board");

  const listed = await follow(`${BASE}/api/cases?status=open`, { jar });
  assert(listed.status === 200, `case list failed: ${listed.status}`);
  const payload = JSON.parse(listed.text);
  assert(Array.isArray(payload.cases) && payload.cases.length > 0, "expected seeded cases");
  const caseId = payload.cases[0].id;

  const file = await follow(`${BASE}/cases/${caseId}`, { jar });
  assert(
    file.status === 200 && file.chain.length === 1 && file.text.includes("Sign out") && !file.text.includes("Badge number"),
    `valid case file should render the portal, got ${summarize(file)}`,
  );
  assert(jar.cookies.get("bcso_session") === token, "opening a case cleared a valid session");

  expireSessions(dataDir);
  const expired = await follow(`${BASE}/board`, { jar });
  assert(isLogin(expired), `expired session should land on login, got ${summarize(expired)}`);
  assert(expired.chain.some((hop) => hop.cleared), "expired session should clear the cookie");
  assert(!jar.cookies.has("bcso_session"), "expired cookie remained in the jar");

  await signIn(jar);
  const replaced = jar.cookies.get("bcso_session");
  const afterLogin = await follow(`${BASE}/board`, { jar });
  assert(afterLogin.status === 200 && afterLogin.text.includes("Case board"), "re-login should open the board");
  assert(jar.cookies.get("bcso_session") === replaced, "board navigation dropped the new session");
  return { token: replaced, caseId };
}

function summarize(result) {
  const hops = result.chain.map((hop) => `${hop.status} ${new URL(hop.url).pathname}${hop.location ? ` -> ${hop.location}` : ""}`).join(" | ");
  return `${hops} final=${result.status} ${result.url}`;
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.next = 1;
    this.pending = new Map();
    this.events = [];
    this.waiters = [];
    ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result ?? {});
        return;
      }
      if (message.method) {
        this.events.push(message);
        this.waiters = this.waiters.filter((waiter) => {
          if (waiter.method !== message.method) return true;
          clearTimeout(waiter.timer);
          waiter.resolve(message);
          return false;
        });
      }
    });
  }

  send(method, params = {}, timeout = 20000) {
    const id = this.next++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP timeout: ${method}`));
      }, timeout);
      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  waitFor(method, timeout = 15000) {
    const existing = this.events.find((event) => event.method === method);
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${method}`)), timeout);
      this.waiters.push({ method, resolve, timer });
    });
  }

  async eval(expression) {
    const result = await this.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text || "page script failed");
    }
    return result.result?.value;
  }
}

async function chromeCheck(staleToken) {
  const profile = await mkdtemp(path.join(tmpdir(), "bcso-chrome-"));
  const chrome = spawn(
    "google-chrome",
    [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--remote-debugging-port=9333",
      `--user-data-dir=${profile}`,
      "about:blank",
    ],
    { detached: true, stdio: "ignore" },
  );
  try {
    let version;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      try {
        version = await fetch("http://127.0.0.1:9333/json/version").then((response) => response.json());
        break;
      } catch {
        await delay(100);
      }
    }
    if (!version?.webSocketDebuggerUrl) throw new Error("Chrome DevTools did not start");

    const browser = new Cdp(new WebSocket(version.webSocketDebuggerUrl));
    await new Promise((resolve, reject) => {
      browser.ws.addEventListener("open", resolve, { once: true });
      browser.ws.addEventListener("error", reject, { once: true });
    });
    const created = await browser.send("Target.createTarget", { url: "about:blank" });
    const targets = await fetch("http://127.0.0.1:9333/json/list").then((response) => response.json());
    const page = targets.find((target) => target.id === created.targetId);
    if (!page?.webSocketDebuggerUrl) throw new Error("Chrome did not expose the new tab");
    const cdp = new Cdp(new WebSocket(page.webSocketDebuggerUrl));
    await new Promise((resolve, reject) => {
      cdp.ws.addEventListener("open", resolve, { once: true });
      cdp.ws.addEventListener("error", reject, { once: true });
    });
    await cdp.send("Page.enable");
    await cdp.send("Network.enable");
    await cdp.send("Runtime.enable");

    async function setStaleCookie() {
      await cdp.send("Network.setCookie", {
        name: "bcso_session",
        value: staleToken,
        url: BASE,
        httpOnly: true,
        path: "/",
        sameSite: "Lax",
      });
    }

    async function visit(target) {
      cdp.events = cdp.events.filter((event) => event.method !== "Network.requestWillBeSent");
      const navigated = await cdp.send("Page.navigate", { url: `${BASE}${target}` });
      assert(!navigated.errorText, `Chrome navigation to ${target} failed: ${navigated.errorText || "unknown"}`);
      const deadline = Date.now() + 15000;
      let href = "";
      let text = "";
      while (Date.now() < deadline) {
        href = await cdp.eval("location.href");
        const ready = await cdp.eval("document.readyState");
        text = await cdp.eval("document.body ? document.body.innerText : ''");
        if (href.startsWith(BASE) && ready === "complete" && text.trim().length > 0) break;
        await delay(100);
      }
      await delay(150);
      text = await cdp.eval("document.body ? document.body.innerText : ''");
      href = await cdp.eval("location.href");
      const redirects = cdp.events.filter(
        (event) => event.method === "Network.requestWillBeSent" && event.params?.redirectResponse,
      ).length;
      const cookies = await cdp.send("Network.getCookies", { urls: [BASE] });
      const session = (cookies.cookies || []).find((cookie) => cookie.name === "bcso_session");
      return { href, text, redirects, session };
    }

    await mkdir(ARTIFACTS, { recursive: true });
    const shots = [];

    for (const target of ["/", "/cases", "/cases/1"]) {
      await setStaleCookie();
      const seen = await visit(target);
      const visible = seen.text.toLowerCase();
      assert(seen.redirects < MAX_HOPS, `${target} redirected ${seen.redirects} times in Chrome`);
      assert(new URL(seen.href).pathname === "/", `${target} finished at ${seen.href}, expected login`);
      assert(
        visible.includes("sign in") && visible.includes("badge number"),
        `${target} did not render the login screen at ${seen.href}. Text: ${JSON.stringify(seen.text.slice(0, 300))}`,
      );
      assert(!seen.session, `${target} left the stale session cookie in Chrome (${seen.session ? seen.session.value : ""})`);
      if (target === "/") {
        const shot = await cdp.send("Page.captureScreenshot", { format: "png" });
        const file = path.join(ARTIFACTS, "stale-session-login.png");
        await writeFile(file, Buffer.from(shot.data, "base64"));
        shots.push(file);
      }
    }

    await cdp.eval(`
      const setValue = (element, value) => {
        const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
        descriptor.set.call(element, value);
        element.dispatchEvent(new Event("input", { bubbles: true }));
      };
      setValue(document.querySelector("#badge"), "412");
      setValue(document.querySelector("#password"), "patrol412");
      document.querySelector("form").requestSubmit();
    `);
    const boardDeadline = Date.now() + 20000;
    let boardText = "";
    let boardHref = "";
    while (Date.now() < boardDeadline) {
      await delay(250);
      boardHref = await cdp.eval("location.href");
      boardText = await cdp.eval("document.body.innerText");
      if (boardText.toLowerCase().includes("case board") && new URL(boardHref).pathname === "/board") break;
    }
    assert(
      boardText.toLowerCase().includes("case board") && new URL(boardHref).pathname === "/board",
      `login navigation ended at ${boardHref}: ${JSON.stringify(boardText.slice(0, 240))}`,
    );
    const boardShot = await cdp.send("Page.captureScreenshot", { format: "png" });
    const boardFile = path.join(ARTIFACTS, "signed-in-board.png");
    await writeFile(boardFile, Buffer.from(boardShot.data, "base64"));
    shots.push(boardFile);

    const opened = await cdp.eval(`
      const link = document.querySelector('a[href^="/cases/"]');
      if (!link) "missing";
      else { link.click(); "ok"; }
    `);
    assert(opened === "ok", "case board did not render a case link");
    const caseDeadline = Date.now() + 20000;
    let caseText = "";
    let caseHref = "";
    const caseReady = (text) =>
      ["armed robbery", "narcotics", "hit and run", "homicide", "case file unavailable"].some((label) =>
        text.toLowerCase().includes(label),
      );
    while (Date.now() < caseDeadline) {
      await delay(250);
      caseHref = await cdp.eval("location.href");
      caseText = await cdp.eval("document.body.innerText");
      if (new URL(caseHref).pathname.startsWith("/cases/") && caseReady(caseText)) break;
    }
    assert(
      new URL(caseHref).pathname.startsWith("/cases/") &&
        caseReady(caseText) &&
        !caseText.toLowerCase().includes("badge number") &&
        !caseText.toLowerCase().includes("case file unavailable"),
      `case navigation failed at ${caseHref}: ${caseText.slice(0, 240)}`,
    );
    const caseShot = await cdp.send("Page.captureScreenshot", { format: "png" });
    const caseFile = path.join(ARTIFACTS, "signed-in-case.png");
    await writeFile(caseFile, Buffer.from(caseShot.data, "base64"));
    shots.push(caseFile);

    cdp.ws.close();
    browser.ws.close();
    return shots;
  } finally {
    try {
      process.kill(-chrome.pid, "SIGKILL");
    } catch {
      chrome.kill("SIGKILL");
    }
    await Promise.race([new Promise((resolve) => chrome.once("exit", resolve)), delay(2000)]);
    await rm(profile, { recursive: true, force: true });
  }
}

async function main() {
  const dataDir = await mkdtemp(path.join(tmpdir(), "bcso-session-"));
  server = startServer(dataDir);
  try {
    await waitForHealth();
    await checkAnonymousAndStale();

    const signedIn = await checkSignedIn(dataDir);
    await stopServer(server);
    server = null;
    await rm(dataDir, { recursive: true, force: true });
    await mkdir(dataDir, { recursive: true });
    server = startServer(dataDir);
    await waitForHealth();

    for (const target of ["/", "/cases", "/cases/1"]) {
      const jar = new Jar({ bcso_session: signedIn.token });
      const result = await follow(`${BASE}${target}`, { jar });
      assert(isLogin(result), `cookie from the previous process on ${target} should land on login, got ${summarize(result)}`);
      assert(!jar.cookies.has("bcso_session"), `previous-process cookie survived ${target}`);
    }

    const shots = await chromeCheck(signedIn.token);
    if (failures.length) {
      console.error(failures.map((failure) => `- ${failure}`).join("\n"));
      console.error(serverLog);
      process.exitCode = 1;
      return;
    }
    console.log("Session redirect checks passed.");
    for (const shot of shots) console.log(`screenshot ${shot}`);
  } finally {
    await stopServer(server);
    await rm(dataDir, { recursive: true, force: true });
  }
}

main().catch(async (error) => {
  console.error(error);
  console.error(serverLog);
  await stopServer(server);
  process.exit(1);
});
