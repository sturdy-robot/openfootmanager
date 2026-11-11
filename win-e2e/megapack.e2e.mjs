// Scratch spec (never merged): a user's session in the World Editor on a very large package, in the REAL
// app window on Windows (WebView2), with the real backend. Per step it records wall time, peak memory of
// the app and of the WebView2 processes, whether the app is alive, and whether the UI froze: the longest
// main-thread stall seen by a 50 ms heartbeat and by the Long Tasks API, and the WebDriver round trip.
import { execSync } from "node:child_process";
import { appendFileSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";

const LOG = process.env.OFM_PERF_LOG ?? "steps.log";
const PROJECT = process.env.OFM_PERF_PROJECT;
const OUT = process.env.OFM_PERF_BUILD_OUT ?? path.resolve("out", "mega.ofm");

const xp = (t) => (t.includes('"') ? `'${t}'` : `"${t}"`);
const buttonNamed = (n) => $(`//button[normalize-space(.)=${xp(n)}]`);
// Sidebar entries and toolbar buttons carry a count or a suffix ("Players 17098", "Validate 3", "Build .ofm").
const buttonStarting = (n) => $(`//button[starts-with(normalize-space(.), ${xp(n)})]`);
async function clickWhenReady(el, timeout = 30_000) {
  await el.waitForClickable({ timeout });
  await el.click();
}

function memory() {
  // Working set, in KB, of the app and (summed) of its WebView2 processes.
  try {
    const out = execSync(
      'powershell -NoProfile -Command "Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -like \'*openfoot*\' -or $_.ProcessName -eq \'msedgewebview2\' } | ForEach-Object { $_.ProcessName + \',\' + $_.WorkingSet64 }"',
      { stdio: "pipe" },
    ).toString();
    let app = 0;
    let web = 0;
    for (const line of out.split(/\r?\n/)) {
      const [name, bytes] = line.trim().split(",");
      if (!name) continue;
      const kb = Number(bytes) / 1024;
      if (/openfoot/i.test(name)) app = Math.max(app, kb);
      else web += kb;
    }
    return { app, web };
  } catch {
    return { app: 0, web: 0 };
  }
}
function appAlive() {
  try {
    return /openfoot/i.test(execSync("tasklist /NH", { stdio: "pipe" }).toString());
  } catch {
    return false;
  }
}

let peak = { app: 0, web: 0 };
let sampler;
before(() => {
  mkdirSync(path.dirname(OUT), { recursive: true });
  sampler = setInterval(() => {
    const r = memory();
    peak.app = Math.max(peak.app, r.app);
    peak.web = Math.max(peak.web, r.web);
  }, 1000);
});
after(() => clearInterval(sampler));

async function probe() {
  // Does the page answer a trivial script within 5 s? Measured from the driver side.
  const t0 = Date.now();
  try {
    await Promise.race([
      browser.execute(() => 1),
      new Promise((_, reject) => setTimeout(() => reject(new Error("no answer in 5 s")), 5000)),
    ]);
    return { answered: true, ms: Date.now() - t0 };
  } catch (e) {
    return { answered: false, ms: Date.now() - t0, error: String(e).slice(0, 120) };
  }
}

async function step(name, fn) {
  peak = { app: 0, web: 0 };
  await browser.execute(() => {
    window.__gap = 0;
    window.__long = [];
  }).catch(() => {});
  const t0 = Date.now();
  let error = null;
  try {
    await fn();
  } catch (e) {
    error = String(e).slice(0, 400);
  }
  const wall = Date.now() - t0;
  const responsive = await probe();
  let page = null;
  try {
    page = await browser.execute(() => ({
      textLen: (document.body.innerText || "").length,
      nodes: document.getElementsByTagName("*").length,
      max_heartbeat_gap_ms: Math.round(window.__gap || 0),
      long_tasks: (window.__long || []).length,
      max_long_task_ms: Math.round(Math.max(0, ...(window.__long || []))),
      errors: (window.__ofmErrors || []).slice(-5),
      ipc: (window.__ipc || []).slice(-60),
      pending: (window.__pending || []).map((c) => ({ ...c, waiting_ms: Math.round(performance.now() - c.at) })),
      text: (document.body.innerText || "").replace(/\s+/g, " ").slice(0, 400),
      buttons: Array.from(document.querySelectorAll("button")).slice(0, 25).map((b) => (b.innerText || "").trim().slice(0, 24)),
    }));
  } catch (e) {
    page = { webdriverError: String(e).slice(0, 200) };
  }
  const line = JSON.stringify({
    step: name,
    wall_ms: wall,
    peak_app_mb: Math.round(peak.app / 1024),
    peak_webview2_mb: Math.round(peak.web / 1024),
    app_alive: appAlive(),
    ui_answers_within_5s: responsive,
    error,
    page,
  });
  console.log("STEP " + line);
  appendFileSync(LOG, line + "\n");
  if (error) throw new Error(`${name}: ${error}`);
}

async function installHooks() {
  await browser.execute((out) => {
    window.__ofmErrors = [];
    window.__ipc = [];
    window.__pending = [];
    window.__gap = 0;
    window.__long = [];
    // A heartbeat every 50 ms: a gap well above 50 ms is a stall of the page's main thread.
    let last = performance.now();
    setInterval(() => {
      const now = performance.now();
      window.__gap = Math.max(window.__gap, now - last - 50);
      last = now;
    }, 50);
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) window.__long.push(e.duration);
      }).observe({ entryTypes: ["longtask"] });
    } catch {}
    window.addEventListener("error", (e) => window.__ofmErrors.push("error: " + e.message));
    window.addEventListener("unhandledrejection", (e) =>
      window.__ofmErrors.push("rejection: " + String(e.reason).slice(0, 300)),
    );
    const ce = console.error.bind(console);
    console.error = (...a) => {
      window.__ofmErrors.push("console.error: " + a.map(String).join(" ").slice(0, 300));
      ce(...a);
    };
    // Tauri's invoke on Windows is a fetch to the ipc custom protocol: record every such request here, with
    // its size, when the response headers arrive and when the whole body has been read. The native save dialog
    // cannot be driven: it is answered with a fixed path; every other command goes to the real backend.
    const realFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = typeof input === "string" ? input : input.url;
      if (!/ipc/.test(url)) return realFetch(input, init);
      const cmd = decodeURIComponent(url.split("?")[0].split("/").pop());
      if (cmd === "plugin:dialog|save") {
        return Promise.resolve(
          new Response(JSON.stringify(out), {
            status: 200,
            headers: { "Content-Type": "application/json", "Tauri-Response": "ok" },
          }),
        );
      }
      const body = init && init.body;
      const bytes = body ? (body.byteLength ?? body.length ?? 0) : 0;
      const t0 = performance.now();
      const started = { cmd, bytes, at: Math.round(t0) };
      window.__pending.push(started);
      const done = () => {
        const at = window.__pending.indexOf(started);
        if (at >= 0) window.__pending.splice(at, 1);
      };
      return realFetch(input, init).then(
        (res) => {
          const headers_ms = Math.round(performance.now() - t0);
          res
            .clone()
            .arrayBuffer()
            .then(
              (buf) => {
                done();
                window.__ipc.push({ cmd, bytes, response_bytes: buf.byteLength, headers_ms, ms: Math.round(performance.now() - t0), status: res.status });
              },
              (e) => {
                done();
                window.__ipc.push({ cmd, bytes, headers_ms, ms: Math.round(performance.now() - t0), error: "body: " + String(e).slice(0, 120) });
              },
            );
          return res;
        },
        (e) => {
          done();
          window.__ipc.push({ cmd, bytes, ms: Math.round(performance.now() - t0), error: "fetch: " + String(e).slice(0, 120) });
          throw e;
        },
      );
    };
  }, OUT);
}

const rows = () => $$("div.cursor-pointer.rounded-xl");
const saveCount = () =>
  browser.execute(
    () => (window.__ipc || []).filter((c) => c.cmd.includes("save_package_project")).length,
  );

describe("a user's session in the World Editor on a very large package (Windows)", () => {
  it("boots and reaches the World Editor, with the project in its recent list", async () => {
    await buttonNamed("New Game").waitForDisplayed({ timeout: 180_000 });
    await step("boot", async () => {
      const entry = $('//button[contains(normalize-space(.), "World Editor")]');
      if (await entry.isExisting()) {
        await clickWhenReady(entry);
      } else {
        await browser.execute(() => {
          history.pushState({}, "", "/world-editor");
          window.dispatchEvent(new PopStateEvent("popstate"));
        });
      }
      await browser.execute((project) => {
        localStorage.setItem(
          "worldEditor.recentProjects",
          JSON.stringify([{ path: project, name: "Synthetic Mega", openedAt: "2026-11-04T00:00:00Z" }]),
        );
        localStorage.removeItem("worldEditor.autoSave"); // the default: auto-save ON
      }, PROJECT);
      await browser.refresh();
      await $('//*[contains(normalize-space(.), "Synthetic Mega")]').waitForDisplayed({ timeout: 60_000 });
      await installHooks();
    });
  });

  it("1. opens the project", async () => {
    await step("open", async () => {
      await clickWhenReady(
        $('//*[contains(normalize-space(.), "Synthetic Mega")]/ancestor-or-self::button[1]'),
        60_000,
      );
      await buttonStarting("Players").waitForDisplayed({ timeout: 120_000 });
    });
  });

  it("2. switches tabs and opens a player, a team and a competition form", async () => {
    await step("tabs_and_forms", async () => {
      for (const [tab, field] of [
        ["Teams", "Club Name"],
        ["Players", "Match Name"],
        ["Competitions", "Name"],
      ]) {
        await clickWhenReady(buttonStarting(tab));
        await $("div.cursor-pointer.rounded-xl").waitForDisplayed({ timeout: 60_000 });
        await clickWhenReady((await rows())[0]);
        await $(`//label[normalize-space(.)="${field}"]`).waitForDisplayed({ timeout: 60_000 });
      }
    });
  });

  it("3. edits 30 players one after another with auto-save on", async () => {
    await step("edit_30_players_autosave", async () => {
      await clickWhenReady(buttonStarting("Players"));
      for (let i = 0; i < 30; i++) {
        const before = await saveCount();
        await clickWhenReady((await rows())[i]);
        const field = $('//label[normalize-space(.)="Match Name"]/following::input[1]');
        await field.waitForDisplayed({ timeout: 60_000 });
        await field.click();
        await browser.keys([" ", "x"]);
        await browser.keys(["Tab"]); // commit: the field saves on blur
        await browser.waitUntil(async () => (await saveCount()) > before, {
          timeout: 120_000,
          timeoutMsg: `edit ${i}: no save completed`,
        });
      }
    });
  });

  it("4. clicks Load more until the whole list is shown", async () => {
    await step("load_more_all", async () => {
      await clickWhenReady(buttonStarting("Players"));
      let clicks = 0;
      for (; clicks < 450; clicks++) {
        const more = $(
          '//button[contains(normalize-space(.), "Load more") or contains(normalize-space(.), "LOAD MORE")]',
        );
        if (!(await more.isExisting()) || !(await more.isDisplayed())) break;
        await more.click();
      }
      console.log("LOADMORE clicks=" + clicks + " rows=" + (await rows()).length);
    });
  });

  it("5. validates, then builds", async () => {
    await step("validate", async () => {
      await clickWhenReady(buttonStarting("Validate"));
      await browser.waitUntil(
        async () =>
          browser.execute(() =>
            (window.__ipc || []).some(
              (c) => c.cmd.includes("validate_package_project") || c.cmd.includes("read_package_project"),
            ),
          ),
        { timeout: 300_000 },
      );
    });
    await step("build", async () => {
      await clickWhenReady(buttonStarting("Build"));
      await browser.waitUntil(
        async () => browser.execute(() => (window.__ipc || []).some((c) => c.cmd === "build_ofm")),
        { timeout: 600_000 },
      );
      try {
        console.log("BUILD bytes=" + statSync(OUT).size);
      } catch (e) {
        console.log("BUILD no output " + e);
      }
    });
  });
});
