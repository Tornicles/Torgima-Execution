declare module "cloudflare:node:http" {
  import type { Server } from "node:http";

  export function httpServerHandler(server: Server): (
    request: Request,
    env: unknown,
    ctx: unknown,
  ) => Response | Promise<Response>;
}
