import { spawnSync } from "node:child_process";

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: false,
    env: process.env,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const isWindows = process.platform === "win32";
const allowCrossBuild = process.env.PLANNER_ALLOW_CROSS_BUILD === "1";

if (!isWindows && !allowCrossBuild) {
  console.error(
    "build:desktop is configured for Windows-hosted release builds because the bundled PyInstaller backend is host-native.\n" +
      "Run this command on Windows for release packaging, or set PLANNER_ALLOW_CROSS_BUILD=1 to override for experimentation."
  );
  process.exit(1);
}

if (!isWindows && allowCrossBuild) {
  console.warn(
    "Warning: cross-building is enabled. The frozen backend produced by PyInstaller will be host-native unless you use a Windows build environment."
  );
}

run("npm", ["--prefix", "frontend", "ci", "--omit=dev"]);
run("python", ["-m", "PyInstaller", "pyinstaller/backend.spec", "--noconfirm"]);
run("node", ["scripts/verify-desktop-package.mjs"]);
run("npx", ["electron-builder", "--win", "nsis"]);
