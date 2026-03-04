import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import { app, BrowserWindow, dialog, ipcMain } from "electron";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let backendProcess = null;
let backendLogStream = null;
let mainWindow = null;
let isAppQuitting = false;
let backendRestartAttempts = 0;
let currentBackendRuntime = null;
let currentRuntimePaths = null;

const MAX_BACKEND_RESTARTS = 1;
const BACKEND_SHUTDOWN_TIMEOUT_MS = 5000;
const MAX_LOG_FILES = 10;

function getBackendExecutableName() {
  return process.platform === "win32" ? "planner-backend.exe" : "planner-backend";
}

function resolveProjectRoot() {
  return path.resolve(__dirname, "..");
}

function resolveRendererEntry() {
  return path.resolve(resolveProjectRoot(), "frontend", "index.html");
}

function resolveBackendExecutablePath() {
  const executableName = getBackendExecutableName();
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "backend", executableName);
  }
  return path.resolve(resolveProjectRoot(), "dist", "backend", executableName);
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

function createRuntimePaths() {
  const userDataRoot = ensureDir(app.getPath("userData"));
  const logsDir = ensureDir(path.join(userDataRoot, "logs"));
  cleanupOldLogs(logsDir);
  return {
    userDataRoot,
    logsDir,
    checkpointsDir: ensureDir(path.join(userDataRoot, "checkpoints")),
    runsDir: ensureDir(path.join(userDataRoot, "runs")),
    stateDir: ensureDir(path.join(userDataRoot, "state")),
    tempDir: ensureDir(path.join(userDataRoot, "temp")),
  };
}

function cleanupOldLogs(logsDir) {
  const entries = fs
    .readdirSync(logsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".log"))
    .map((entry) => ({
      name: entry.name,
      fullPath: path.join(logsDir, entry.name),
      modified: fs.statSync(path.join(logsDir, entry.name)).mtimeMs,
    }))
    .sort((a, b) => b.modified - a.modified);

  for (const entry of entries.slice(MAX_LOG_FILES)) {
    fs.unlinkSync(entry.fullPath);
  }
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

async function findAvailablePort(preferredPort, maxAttempts = 25) {
  let port = preferredPort;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (await isPortAvailable(port)) {
      return port;
    }
    port += 1;
  }
  throw new Error(`Unable to find an available backend port near ${preferredPort}.`);
}

function waitForBackendHealth(apiBaseUrl, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  const url = new URL("/health", apiBaseUrl);

  return new Promise((resolve, reject) => {
    const attempt = () => {
      const request = http.get(url, (response) => {
        response.resume();
        if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
          resolve();
          return;
        }
        if (Date.now() >= deadline) {
          reject(new Error(`Backend health check failed with status ${response.statusCode}.`));
          return;
        }
        setTimeout(attempt, 500);
      });

      request.on("error", (error) => {
        if (Date.now() >= deadline) {
          reject(new Error(`Backend failed to become healthy: ${error.message}`));
          return;
        }
        setTimeout(attempt, 500);
      });
    };

    attempt();
  });
}

async function stopBackend() {
  const processToStop = backendProcess;
  backendProcess = null;

  if (processToStop && !processToStop.killed) {
    processToStop.kill();
    await new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (!settled) {
          settled = true;
          resolve();
        }
      };

      processToStop.once("exit", finish);
      setTimeout(() => {
        if (!processToStop.killed) {
          processToStop.kill("SIGKILL");
        }
        finish();
      }, BACKEND_SHUTDOWN_TIMEOUT_MS);
    });
  }

  if (backendLogStream) {
    backendLogStream.end();
    backendLogStream = null;
  }
}

async function startBackend(runtimePaths) {
  const executablePath = resolveBackendExecutablePath();
  if (!fs.existsSync(executablePath)) {
    throw new Error(
      `Bundled backend executable not found at ${executablePath}. Run "npm run package:backend" before launching Electron.`
    );
  }

  const backendPort = await findAvailablePort(8000);
  const apiBaseUrl = `http://127.0.0.1:${backendPort}/api`;
  const logPath = path.join(runtimePaths.logsDir, "backend.log");
  backendLogStream = fs.createWriteStream(logPath, { flags: "a" });

  const env = {
    ...process.env,
    PLANNER_BACKEND_PORT: String(backendPort),
    PLANNER_APP_DATA_ROOT: runtimePaths.userDataRoot,
    PLANNER_LOG_DIR: runtimePaths.logsDir,
    PLANNER_CHECKPOINT_DIR: runtimePaths.checkpointsDir,
    PLANNER_RUNS_ROOT: runtimePaths.userDataRoot,
    PLANNER_STATE_DIR: runtimePaths.stateDir,
    PLANNER_TEMP_ROOT: runtimePaths.tempDir,
    PLANNER_ALLOWED_ORIGINS: "null,http://localhost:3000,http://127.0.0.1:3000",
  };

  currentRuntimePaths = runtimePaths;
  backendProcess = spawn(executablePath, ["--host", "127.0.0.1", "--port", String(backendPort)], {
    cwd: path.dirname(executablePath),
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  backendProcess.stdout.on("data", (chunk) => backendLogStream.write(chunk));
  backendProcess.stderr.on("data", (chunk) => backendLogStream.write(chunk));
  backendProcess.once("exit", (code, signal) => {
    if (backendLogStream) {
      backendLogStream.write(`\n[backend-exit] code=${code ?? "null"} signal=${signal ?? "null"}\n`);
    }
    const exitedProcess = backendProcess;
    backendProcess = null;

    const shouldRestart =
      !isAppQuitting &&
      currentBackendRuntime &&
      exitedProcess &&
      backendRestartAttempts < MAX_BACKEND_RESTARTS;

    if (shouldRestart) {
      backendRestartAttempts += 1;
      const preferredPort = currentBackendRuntime.backendPort;
      setTimeout(() => {
        restartBackend(preferredPort).catch((error) => {
          dialog.showErrorBox(
            "Planner Backend Failed",
            error instanceof Error ? error.message : String(error),
          );
        });
      }, 500);
    }
  });

  await waitForBackendHealth(apiBaseUrl);

  currentBackendRuntime = {
    apiBaseUrl,
    backendPort,
  };

  return currentBackendRuntime;
}

async function restartBackend(preferredPort) {
  if (!currentRuntimePaths) {
    throw new Error("Cannot restart backend without runtime paths.");
  }
  const executablePath = resolveBackendExecutablePath();
  const backendPort = await findAvailablePort(preferredPort);
  const apiBaseUrl = `http://127.0.0.1:${backendPort}/api`;
  const logPath = path.join(currentRuntimePaths.logsDir, "backend.log");

  if (!backendLogStream) {
    backendLogStream = fs.createWriteStream(logPath, { flags: "a" });
  }

  const env = {
    ...process.env,
    PLANNER_BACKEND_PORT: String(backendPort),
    PLANNER_APP_DATA_ROOT: currentRuntimePaths.userDataRoot,
    PLANNER_LOG_DIR: currentRuntimePaths.logsDir,
    PLANNER_CHECKPOINT_DIR: currentRuntimePaths.checkpointsDir,
    PLANNER_RUNS_ROOT: currentRuntimePaths.userDataRoot,
    PLANNER_STATE_DIR: currentRuntimePaths.stateDir,
    PLANNER_TEMP_ROOT: currentRuntimePaths.tempDir,
    PLANNER_ALLOWED_ORIGINS: "null,http://localhost:3000,http://127.0.0.1:3000",
  };

  backendProcess = spawn(executablePath, ["--host", "127.0.0.1", "--port", String(backendPort)], {
    cwd: path.dirname(executablePath),
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  backendProcess.stdout.on("data", (chunk) => backendLogStream.write(chunk));
  backendProcess.stderr.on("data", (chunk) => backendLogStream.write(chunk));
  backendProcess.once("exit", (code, signal) => {
    if (backendLogStream) {
      backendLogStream.write(`\n[backend-exit] code=${code ?? "null"} signal=${signal ?? "null"}\n`);
    }
    backendProcess = null;
  });

  await waitForBackendHealth(apiBaseUrl);
  currentBackendRuntime = { apiBaseUrl, backendPort };
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("planner:runtime-config-updated", currentBackendRuntime);
  }
}

async function createMainWindow(runtimeConfig) {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
      additionalArguments: [
        `--planner-api-base-url=${runtimeConfig.apiBaseUrl}`,
        `--planner-user-data-root=${runtimeConfig.userDataRoot}`,
      ],
    },
  });

  await window.loadFile(resolveRendererEntry());
  window.once("ready-to-show", () => {
    window.show();
  });

  return window;
}

async function bootstrap() {
  const runtimePaths = createRuntimePaths();
  const backendRuntime = await startBackend(runtimePaths);
  mainWindow = await createMainWindow({
    ...runtimePaths,
    ...backendRuntime,
  });
}

ipcMain.handle("planner:pick-folder", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return "";
  }

  return result.filePaths[0];
});

app.on("window-all-closed", () => {
  void stopBackend();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  isAppQuitting = true;
  void stopBackend();
});

app.whenReady().then(async () => {
  try {
    await bootstrap();
  } catch (error) {
    stopBackend();
    dialog.showErrorBox("Planner Startup Failed", error instanceof Error ? error.message : String(error));
    app.quit();
  }
});
