const { contextBridge, ipcRenderer } = require("electron");

function getArgValue(prefix) {
  const match = process.argv.find((entry) => entry.startsWith(prefix));
  return match ? match.slice(prefix.length) : "";
}

const runtimeConfig = Object.freeze({
  apiBaseUrl: getArgValue("--planner-api-base-url="),
  userDataRoot: getArgValue("--planner-user-data-root="),
  isElectron: true,
});

contextBridge.exposeInMainWorld("desktopRuntime", {
  getConfig: () => runtimeConfig,
  pickFolder: () => ipcRenderer.invoke("planner:pick-folder"),
  onConfigUpdated: (callback) => {
    if (typeof callback !== "function") {
      return () => {};
    }
    const listener = (_event, nextConfig) => callback(nextConfig);
    ipcRenderer.on("planner:runtime-config-updated", listener);
    return () => ipcRenderer.removeListener("planner:runtime-config-updated", listener);
  },
});
