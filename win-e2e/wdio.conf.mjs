import { spawn } from "node:child_process";

let driver;

export const config = {
  runner: "local",
  specs: ["./megapack.e2e.mjs"],
  maxInstances: 1,
  hostname: "127.0.0.1",
  port: 4444,
  path: "/",
  capabilities: [
    { maxInstances: 1, "tauri:options": { application: process.env.OFM_APP } },
  ],
  logLevel: "warn",
  framework: "mocha",
  reporters: ["spec"],
  mochaOpts: { ui: "bdd", timeout: 900_000 },

  async onPrepare() {
    // The runner is a throwaway VM: nothing here touches a person's session.
    const args = ["--port", "4444"];
    if (process.env.OFM_NATIVE_DRIVER) args.push("--native-driver", process.env.OFM_NATIVE_DRIVER);
    driver = spawn("tauri-driver", args, { stdio: ["ignore", process.stdout, process.stderr] });
    await new Promise((resolve) => setTimeout(resolve, 5000));
  },

  onComplete() {
    driver?.kill();
  },
};
