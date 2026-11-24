const { spawn } = require("node:child_process");
const { createRequire } = require("node:module");

const requireFromHere = createRequire(__filename);
const nextBin = requireFromHere.resolve("next/dist/bin/next");
const mode = process.argv[2] === "dev" ? "dev" : "start";
const port = process.env.PORT || "4317";
// Always bind on all interfaces so Render (and other hosts) can reach the process.
// Do not read $HOSTNAME — containers set that to the machine name, not a listen address.
const host = process.env.LISTEN_HOST || "0.0.0.0";
const args = [nextBin, mode, "-H", host, "-p", port];
if (mode === "dev") args.push("--turbopack");

const child = spawn(process.execPath, args, {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code) => process.exit(code ?? 0));
