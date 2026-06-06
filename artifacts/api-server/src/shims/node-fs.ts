/**
 * Cloudflare Workers bundle shim for `node:fs`.
 * Repo filesystem checks are unavailable on Workers; callers treat CF as deployed.
 */

const isCloudflare = () => process.env.TORGIMA_RUNTIME === "cloudflare";

export function existsSync(_path: string): boolean {
  return isCloudflare();
}

export function readFileSync(_path: string, _encoding?: BufferEncoding): string {
  if (isCloudflare()) return "";
  throw new Error("readFileSync unavailable outside Cloudflare Workers shim context");
}

export function readdirSync(_path: string): string[] {
  return isCloudflare() ? [] : [];
}

export function statSync(_path: string): { isFile(): boolean; isDirectory(): boolean; size: number } {
  return {
    isFile: () => isCloudflare(),
    isDirectory: () => false,
    size: 0,
  };
}

export default { existsSync, readFileSync, readdirSync, statSync };
