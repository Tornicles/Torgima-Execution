import type { TeamRole } from "./blueprint-types.js";

export interface RolePermissions {
  role: TeamRole;
  canExecuteOrders: boolean;
  canAssignTargets: boolean;
  canApproveProof: boolean;
  canViewSignals: boolean;
  canViewStrategy: boolean;
  canModifyDependencies: boolean;
  visibilityScope: "self" | "team" | "blueprint";
  executionAuthority: "none" | "contributor" | "operator" | "owner";
}

const ROLE_MATRIX: Record<TeamRole, RolePermissions> = {
  owner: {
    role: "owner",
    canExecuteOrders: true,
    canAssignTargets: true,
    canApproveProof: true,
    canViewSignals: true,
    canViewStrategy: true,
    canModifyDependencies: true,
    visibilityScope: "blueprint",
    executionAuthority: "owner",
  },
  strategist: {
    role: "strategist",
    canExecuteOrders: false,
    canAssignTargets: true,
    canApproveProof: false,
    canViewSignals: true,
    canViewStrategy: true,
    canModifyDependencies: true,
    visibilityScope: "blueprint",
    executionAuthority: "none",
  },
  operator: {
    role: "operator",
    canExecuteOrders: true,
    canAssignTargets: false,
    canApproveProof: false,
    canViewSignals: true,
    canViewStrategy: false,
    canModifyDependencies: false,
    visibilityScope: "team",
    executionAuthority: "operator",
  },
  contributor: {
    role: "contributor",
    canExecuteOrders: true,
    canAssignTargets: false,
    canApproveProof: false,
    canViewSignals: true,
    canViewStrategy: false,
    canModifyDependencies: false,
    visibilityScope: "self",
    executionAuthority: "contributor",
  },
  reviewer: {
    role: "reviewer",
    canExecuteOrders: false,
    canAssignTargets: false,
    canApproveProof: true,
    canViewSignals: true,
    canViewStrategy: true,
    canModifyDependencies: false,
    visibilityScope: "team",
    executionAuthority: "none",
  },
  observer: {
    role: "observer",
    canExecuteOrders: false,
    canAssignTargets: false,
    canApproveProof: false,
    canViewSignals: true,
    canViewStrategy: false,
    canModifyDependencies: false,
    visibilityScope: "team",
    executionAuthority: "none",
  },
};

export function getRolePermissions(role: TeamRole): RolePermissions {
  return ROLE_MATRIX[role];
}

export function canRoleExecuteOrders(role: TeamRole): boolean {
  return ROLE_MATRIX[role].canExecuteOrders;
}
