import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const EXCLUDED_FILES = new Set(["SIGNATURE.json", "MANIFEST.json"]);
const EXCLUDED_DIRS = new Set([".git", "node_modules"]);

export interface Manifest {
  files: Record<string, string>;
  rootHash: string;
}

export function sha256(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

export function computeManifest(fileContents: Record<string, string>): Manifest {
  const files: Record<string, string> = {};
  const sortedPaths = Object.keys(fileContents).sort();

  for (const path of sortedPaths) {
    files[path] = `sha256:${sha256(fileContents[path])}`;
  }

  const concatenated = sortedPaths.map((p) => files[p]).join("");
  const rootHash = `sha256:${sha256(concatenated)}`;

  return { files, rootHash };
}

function walkDir(dir: string, base: string): Record<string, string> {
  const entries: Record<string, string> = {};

  for (const entry of readdirSync(dir)) {
    if (EXCLUDED_FILES.has(entry) || EXCLUDED_DIRS.has(entry)) continue;

    const fullPath = join(dir, entry);
    const relPath = relative(base, fullPath);

    if (statSync(fullPath).isDirectory()) {
      Object.assign(entries, walkDir(fullPath, base));
    } else {
      entries[relPath] = readFileSync(fullPath, "utf-8");
    }
  }

  return entries;
}

export function computeManifestFromDir(dirPath: string): Manifest {
  const fileContents = walkDir(dirPath, dirPath);
  return computeManifest(fileContents);
}

export function rootHashToBytes32(rootHash: string): `0x${string}` {
  const hex = rootHash.replace(/^sha256:/, "");
  if (hex.length !== 64) throw new Error(`Invalid hash length: ${hex.length}`);
  return `0x${hex}` as `0x${string}`;
}

export function bytes32ToRootHash(bytes32: `0x${string}`): string {
  return `sha256:${bytes32.slice(2)}`;
}
