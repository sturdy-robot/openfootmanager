import { spawn } from "node:child_process";
import net from "node:net";

let driver;
let app;

const up = (port) =>
  new Promise((resolve) => {
    const socket = net.connect({ port, host: "127.0.0.1" });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });

export const config = {
  runner: "local",
  specs: ["./megapack.e2e.mjs"],
  maxInstances: 1,
  hostname: "127.0.0.1",
  port: 9515,
  path: "/",
  // msedgedriver attaches to the app's WebView2 over the debugging port the build opened (9222).
  capabilities: [
    {
      browserName: "webview2",
      "wdio:enforceWebDriverClassic": true,
      "ms:edgeOptions": { debuggerAddress: "127.0.0.1:9222" },
    },
  ],
  logLevel: "warn",
  framework: "mocha",
  reporters: ["spec"],
  mochaOpts: { ui: "bdd", timeout: 900_000 },

  async onPrepare() {
    // The runner is a throwaway VM: nothing here touches a person's session.
    app = spawn(process.env.OFM_APP, [], { stdio: "ignore" });
    for (let i = 0; i < 90 && !(await up(9222)); i++) await new Promise((r) => setTimeout(r, 1000));
    if (!(await up(9222))) throw new Error("the app's WebView2 never opened port 9222");
    driver = spawn(process.env.OFM_DRIVER, ["--port=9515"], { stdio: ["ignore", process.stdout, process.stderr] });
    await new Promise((resolve) => setTimeout(resolve, 3000));
  },

  onComplete() {
    driver?.kill();
    app?.kill();
  },
};
