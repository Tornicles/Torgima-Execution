# DOC 18: TASK GENERATION WITH BLUEPRINT CONSTRAINTS

## INTEGRATION POINT: Task Generation Engine with Execution Control Blueprints

### Flow

```
SIGNAL CALCULATED + CONDITION ASSIGNED
  ↓
Execution Control Blueprint Constraints
  ├─ Task Sequencing Blueprint (frameworks 125-134)
  ├─ Task Limiting (WIP management)
  ├─ Bottleneck Detection (frameworks 145-152)
  └─ Workload Distribution (frameworks 153-160)
  ↓
SynergyOps X Evaluation
  ├─ Check dependencies
  ├─ Check capability match
  └─ Check timing
  ↓
TASK GENERATED
  ├─ Must respect constraint
  ├─ Must have clear output
  └─ Must have success criteria
```

### Implementation Code

```typescript
class ConstrainedTaskGenerationService {
  async generateTask(
    blueprintId: string,
    targetId: string,
    signal: Signal,
    condition: Condition
  ): Promise<Task> {
    // Step 1: Get execution constraints
    const constraints = await this.getExecutionConstraints(blueprintId, condition);

    // Step 2: Check if task generation is allowed
    const canGenerate = await this.canGenerateTask(blueprintId, constraints);

    if (!canGenerate.allowed) {
      // Generate recovery task instead
      return await this.generateRecoveryTask(blueprintId, canGenerate.reason);
    }

    // Step 3: Generate task using Bhudhi with constraints
    const task = await this.generateTaskWithBhudhi(blueprintId, targetId, signal, constraints);

    // Step 4: Validate task against blueprints
    const validation = await this.validateTask(task, blueprintId);

    if (!validation.passed) {
      // Generate fallback task
      return await this.generateFallbackTask(blueprintId, targetId, validation.violations);
    }

    // Step 5: Save and return
    await task.save();
    return task;
  }

  private async getExecutionConstraints(
    blueprintId: string,
    condition: Condition
  ): Promise<ExecutionConstraints> {
    const blueprint = await Blueprint.findById(blueprintId);

    // Get Execution Control Blueprint constraints
    const constraintsByCondition = {
      Nothingness: { taskLimit: [1, 2], difficulty: "easy", priority: "high" },
      Danger: { taskLimit: [1, 3], difficulty: "easy", priority: "recovery" },
      Urgency: { taskLimit: [2, 4], difficulty: "medium", priority: "urgent" },
      Stability: { taskLimit: [3, 5], difficulty: "medium", priority: "normal" },
      Power: { taskLimit: [4, 6], difficulty: "hard", priority: "growth" },
      Affluence: { taskLimit: [5, 8], difficulty: "hard", priority: "scaling" },
      PowerChange: { taskLimit: [2, 4], difficulty: "medium", priority: "strategic" }
    };

    const constraints = constraintsByCondition[condition.condition_type];

    return {
      taskLimitMin: constraints.taskLimit[0],
      taskLimitMax: constraints.taskLimit[1],
      difficultyMax: constraints.difficulty,
      priority: constraints.priority,
      blockedActions: await this.getBlockedActions(condition),
      allowedActions: await this.getAllowedActions(condition)
    };
  }

  private async canGenerateTask(
    blueprintId: string,
    constraints: ExecutionConstraints
  ): Promise<{ allowed: boolean; reason?: string }> {
    const blueprint = await Blueprint.findById(blueprintId);

    // Count active tasks
    const activeTasks = await Task.count({
      where: { blueprintId, status: { in: ["pending", "in_progress"] } }
    });

    if (activeTasks >= constraints.taskLimitMax) {
      return { allowed: false, reason: `Reached maximum active tasks (${constraints.taskLimitMax})` };
    }

    // Check for critical blockers
    const blockers = await this.detectBlockers(blueprintId);
    if (blockers.length > 0) {
      return { allowed: false, reason: `Critical blockers detected: ${blockers.join(", ")}` };
    }

    return { allowed: true };
  }

  private async generateTaskWithBhudhi(
    blueprintId: string,
    targetId: string,
    signal: Signal,
    constraints: ExecutionConstraints
  ): Promise<Task> {
    const blueprint = await Blueprint.findById(blueprintId);
    const target = await Target.findById(targetId);

    // Call Bhudhi with constraint context
    const bhudhi_response = await bhudhi.callFrameworks(
      [125, 126, 127, 128, 129, 130, 131, 132, 133, 134],
      {
        goal: blueprint.goal,
        target: target,
        signal: signal,
        constraints: constraints,
        constraint_language: `Generate ONE task only. Difficulty max: ${constraints.difficultyMax}.
          Task count: ${await Task.count({ where: { blueprintId, status: "pending" } })}
          active (max: ${constraints.taskLimitMax})`
      },
      { timeout: 2000, fallback: true }
    );

    return new Task({
      blueprintId,
      targetId,
      instruction: bhudhi_response.instruction,
      expected_output: bhudhi_response.expected_output,
      definition_of_done: bhudhi_response.definition_of_done,
      why_matters: bhudhi_response.why_matters,
      difficulty: bhudhi_response.difficulty,
      time_estimate: bhudhi_response.time_estimate,

      // Track constraints applied
      blueprints_applied: ["Execution Control Blueprint", "Task Sequencing Blueprint", "SynergyOps X"],
      frameworks_enforced: ["SynergyOps X", "TalentSync X"],
      subframeworks_used: [125, 126, 127, 128, 129, 130, 131, 132, 133, 134],

      generation_trigger: "signal_condition_update",
      status: "pending"
    });
  }

  private async validateTask(
    task: Task,
    blueprintId: string
  ): Promise<{ passed: boolean; violations?: string[] }> {
    const violations = [];

    // Check Execution Control constraints
    if (!task.instruction || task.instruction.length < 10) {
      violations.push("Instruction too vague");
    }

    if (!task.definition_of_done || task.definition_of_done.length < 10) {
      violations.push("Definition of done unclear");
    }

    if (!task.time_estimate || task.time_estimate > 180) {
      violations.push("Task duration unrealistic");
    }

    // Check against blueprints
    const blueprint = await Blueprint.findById(blueprintId);
    const capabilityCheck = await this.checkCapability(task, blueprint);
    if (!capabilityCheck) {
      violations.push("Task exceeds user capability");
    }

    return {
      passed: violations.length === 0,
      violations: violations.length > 0 ? violations : undefined
    };
  }
}
```

