import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT_DIR = process.cwd();
const EXTENSIONS = ["", ".ts", ".tsx", ".js", ".mjs", ".json"];

async function canAccess(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveFile(candidate) {
  for (const extension of EXTENSIONS) {
    const filePath = `${candidate}${extension}`;
    if (await canAccess(filePath)) return filePath;
  }

  for (const extension of EXTENSIONS.slice(1)) {
    const filePath = path.join(candidate, `index${extension}`);
    if (await canAccess(filePath)) return filePath;
  }

  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const filePath = await resolveFile(path.join(ROOT_DIR, "src", specifier.slice(2)));
    if (filePath) {
      return { shortCircuit: true, url: pathToFileURL(filePath).href };
    }
  }

  if (specifier.startsWith("@shared/")) {
    const filePath = await resolveFile(path.join(ROOT_DIR, "shared", specifier.slice(8)));
    if (filePath) {
      return { shortCircuit: true, url: pathToFileURL(filePath).href };
    }
  }

  if (
    context.parentURL?.startsWith("file:") &&
    (specifier.startsWith("./") || specifier.startsWith("../"))
  ) {
    const parentDir = path.dirname(fileURLToPath(context.parentURL));
    const filePath = await resolveFile(path.resolve(parentDir, specifier));
    if (filePath) {
      return { shortCircuit: true, url: pathToFileURL(filePath).href };
    }
  }

  return nextResolve(specifier, context);
}
