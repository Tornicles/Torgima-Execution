#!/usr/bin/env node
/**
 * After Orval codegen, replace duplicated status enums with re-exports from @workspace/state-machine.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const blueprintStatusZod = path.join(
  root,
  "lib/api-zod/src/generated/types/blueprintStatus.ts",
);
const orderStatusZod = path.join(root, "lib/api-zod/src/generated/types/orderStatus.ts");
const apiSchemas = path.join(root, "lib/api-client-react/src/generated/api.schemas.ts");

const blueprintStatusSource = `/**
 * Canonical BlueprintStatus — @workspace/state-machine (do not duplicate values here).
 */
export { BlueprintStatus } from "@workspace/state-machine";
`;

const orderStatusSource = `/**
 * OpenAPI Order status uses ApiOrderStatus vocabulary from @workspace/state-machine.
 */
export { ApiOrderStatus as OrderStatus } from "@workspace/state-machine";
`;

fs.writeFileSync(blueprintStatusZod, blueprintStatusSource, "utf8");
fs.writeFileSync(orderStatusZod, orderStatusSource, "utf8");

if (fs.existsSync(apiSchemas)) {
  let src = fs.readFileSync(apiSchemas, "utf8");

  src = src.replace(
    /export type BlueprintStatus =[\s\S]*?export const BlueprintStatus = \{[\s\S]*?\} as const;\n\n/,
    "",
  );
  src = src.replace(
    /export type OrderStatus =[\s\S]*?export const OrderStatus = \{[\s\S]*?\} as const;\n\n/,
    "",
  );

  const reExportBlock = `import {
  BlueprintStatus,
  ApiOrderStatus,
} from "@workspace/state-machine";

export { BlueprintStatus, ApiOrderStatus as OrderStatus };

type OrderStatus = (typeof ApiOrderStatus)[keyof typeof ApiOrderStatus];

`;

  if (!src.includes('from "@workspace/state-machine"')) {
    const closeComment = src.indexOf("*/");
    if (closeComment !== -1) {
      const insertAt = closeComment + 2;
      src = `${src.slice(0, insertAt)}\n${reExportBlock}${src.slice(insertAt)}`;
    }
  }

  fs.writeFileSync(apiSchemas, src, "utf8");
}

console.log("[sync-generated-state-enums] BlueprintStatus + OrderStatus now re-export @workspace/state-machine");
