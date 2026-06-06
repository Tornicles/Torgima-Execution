declare module "cloudflare:node" {
  import type { Server } from "node:http";

  export function httpServerHandler(
    server: Server | { port: number },
  ): (request: Request, env: unknown, ctx: unknown) => Response | Promise<Response>;

  export function handleAsNodeRequest(
    port: number,
    request: Request,
  ): Response | Promise<Response>;
}
