import { ValidationEngine } from "../engines/validation/ValidationEngine.js";
import type { ValidationResult } from "../engines/validation/ValidationEngine.js";

const engine = new ValidationEngine();

export const ValidationService = {
  async validate(rawGoal: string, domain: string | null): Promise<ValidationResult> {
    return engine.validate(rawGoal, domain);
  },
};
