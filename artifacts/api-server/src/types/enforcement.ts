export interface EnforcementPackage {
  blueprintId: string;
  userId: string;
  condition: string;
  allowedTaskTypes: string[];
  blockedTaskTypes: string[];
  maxDailyTasks: number;
  focusDomain: string | null;
  overrideReason: string | null;
  generatedAt: string;
}
