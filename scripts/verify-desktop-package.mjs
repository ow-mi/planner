import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const backendExecutable = process.platform === "win32" ? "planner-backend.exe" : "planner-backend";

const requiredPaths = [
  path.join(projectRoot, "dist", "backend", backendExecutable),
  path.join(projectRoot, "frontend", "index.html"),
  path.join(projectRoot, "frontend", "deps", "htmx.min.js"),
  path.join(projectRoot, "frontend", "deps", "alpinejs.min.js"),
  path.join(projectRoot, "frontend", "deps", "jszip.min.js"),
  path.join(projectRoot, "frontend", "deps", "d3.v7.min.js"),
  path.join(projectRoot, "frontend", "deps", "papaparse.min.js"),
  path.join(projectRoot, "frontend", "deps", "tailwindcss.js"),
  path.join(projectRoot, "frontend", "deps", "daisyui.css"),
  path.join(projectRoot, "frontend", "node_modules", "@codemirror", "view", "dist", "index.js"),
  path.join(projectRoot, "frontend", "node_modules", "@codemirror", "state", "dist", "index.js"),
  path.join(projectRoot, "frontend", "node_modules", "@lezer", "common", "dist", "index.js"),
  path.join(projectRoot, "frontend", "node_modules", "crelt", "index.js"),
  path.join(projectRoot, "sample_data", "sample_data.csv"),
  path.join(projectRoot, "sample_data", "planner_configuration.json"),
];

const missingPaths = requiredPaths.filter((entry) => !fs.existsSync(entry));

if (missingPaths.length > 0) {
  console.error("Desktop packaging verification failed. Missing required runtime assets:");
  for (const entry of missingPaths) {
    console.error(`- ${path.relative(projectRoot, entry)}`);
  }
  process.exit(1);
}

function hasRecursiveMatch(rootPath, pattern) {
  if (!fs.existsSync(rootPath)) {
    return false;
  }

  const entries = fs.readdirSync(rootPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(rootPath, entry.name);
    if (pattern.test(entry.name)) {
      return true;
    }
    if (entry.isDirectory() && hasRecursiveMatch(fullPath, pattern)) {
      return true;
    }
  }
  return false;
}

const distBackendRoot = path.join(projectRoot, "dist", "backend");
if (!hasRecursiveMatch(distBackendRoot, /ortools/i)) {
  console.error(
    "Desktop packaging verification failed. The frozen backend output does not appear to contain OR-Tools artifacts."
  );
  process.exit(1);
}

console.log("Desktop packaging verification passed.");
