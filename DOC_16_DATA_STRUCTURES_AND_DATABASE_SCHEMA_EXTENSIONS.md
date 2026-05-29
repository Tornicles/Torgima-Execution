# DOC 16: DATA STRUCTURES & DATABASE SCHEMA EXTENSIONS

## SECTION 1: NEW PRISMA MODELS

### Blueprint-related Models

```prisma
model Blueprint {
  id                  String    @id @default(uuid())
  userId              String
  goal                String
  purpose             String
  timeframe_start     DateTime
  timeframe_end       DateTime
  commitment          String    // LOW, MEDIUM, HIGH, INTENSE
  domain              String
  tier                String    // starter, growth, ultimate
  status              String    // active, paused, completed

  // Blueprint-specific
  current_phase_id    String?
  current_condition   String    // Nothingness, Danger, Urgency, etc
  validation_score    Float

  // Constraints
  max_daily_tasks     Int       @default(5)
  difficulty_cap      String    @default("medium")

  created_at          DateTime  @default(now())
  updated_at          DateTime  @updatedAt

  user                User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  plans               Plan[]
  targets             Target[]
  signals             Signal[]
  conditions          Condition[]
  frameworks_active   FrameworkActivation[]

  @@index([userId])
  @@index([status])
}

model BlueprintValidation {
  id                  String    @id @default(uuid())
  blueprintId         String?
  userId              String

  raw_goal            String
  cleaned_goal        String
  validation_score    Float
  verdict             String    // VALID, VALID_WITH_WARNINGS, INVALID

  path_current        Json?
  path_adjusted       Json?
  path_alternative    Json?

  violations          BlueprintViolation[]
  warnings            BlueprintWarning[]

  created_at          DateTime  @default(now())

  user                User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([verdict])
}

model BlueprintViolation {
  id                  String    @id @default(uuid())
  validationId        String
  blueprint_name      String
  violation_type      String
  message             String
  is_blocking         Boolean

  validation          BlueprintValidation  @relation(fields: [validationId], references: [id], onDelete: Cascade)

  @@index([validationId])
}

model BlueprintWarning {
  id                  String    @id @default(uuid())
  validationId        String
  blueprint_name      String
  warning_type        String
  message             String
  severity            String    // low, medium, high

  validation          BlueprintValidation  @relation(fields: [validationId], references: [id], onDelete: Cascade)

  @@index([validationId])
}
```

### Framework-related Models

```prisma
model FrameworkActivation {
  id                  String    @id @default(uuid())
  blueprintId         String
  framework_name      String    // StrategyCore X, DecisionVelocity X, etc

  activation_level    Int       // 1-10 confidence
  is_active           Boolean
  trigger_reason      String

  decisions           FrameworkDecision[]

  created_at          DateTime  @default(now())

  blueprint           Blueprint @relation(fields: [blueprintId], references: [id], onDelete: Cascade)

  @@index([blueprintId])
  @@index([framework_name])
  @@index([is_active])
}

model FrameworkDecision {
  id                  String    @id @default(uuid())
  activationId        String

  decision_type       String    // constrain, enforce, recommend, veto
  target_layer        String    // task, signal, condition, goal, etc
  decision            Json
  confidence          Float

  requires_enforcement Boolean

  created_at          DateTime  @default(now())

  activation          FrameworkActivation @relation(fields: [activationId], references: [id], onDelete: Cascade)

  @@index([activationId])
}

model SubframeworkEvidence {
  id                  String    @id @default(uuid())
  decisionId          String?
  blueprintId         String

  subframework_id     Int       // 1-460
  subframework_name   String
  evidence_type       String
  evidence_value      Json
  confidence          Float

  created_at          DateTime  @default(now())

  blueprint           Blueprint @relation(fields: [blueprintId], references: [id], onDelete: Cascade)

  @@index([blueprintId])
  @@index([subframework_id])
}

model ConstraintValidation {
  id                  String    @id @default(uuid())
  blueprintId         String
  constraint_id       String

  input               Json
  is_valid            Boolean
  violation_reason    String?

  created_at          DateTime  @default(now())

  blueprint           Blueprint @relation(fields: [blueprintId], references: [id], onDelete: Cascade)

  @@index([blueprintId])
  @@index([is_valid])
}

model DecisionCascade {
  id                  String    @id @default(uuid())
  blueprintId         String
  trigger_type        String    // goal_submission, task_generation, etc

  cascade_json        Json      // Complete decision cascade trace
  final_decision      Json
  confidence          Float

  blueprints_checked  String[]
  frameworks_used     String[]
  subframeworks_used  Int[]

  created_at          DateTime  @default(now())

  blueprint           Blueprint @relation(fields: [blueprintId], references: [id], onDelete: Cascade)

  @@index([blueprintId])
  @@index([trigger_type])
}
```

### Extended Models

```prisma
model Signal {
  id                  String    @id @default(uuid())
  blueprintId         String

  // Core metrics
  completion_rate     Float
  quality_score       Float
  momentum            Int       // 0-10
  trend               Int       // -5 to +5
  confidence          Float

  // Blueprint validation
  blueprint_valid     Boolean
  validation_notes    String?

  // Time window
  window_start        DateTime
  window_end          DateTime

  created_at          DateTime  @default(now())

  blueprint           Blueprint @relation(fields: [blueprintId], references: [id], onDelete: Cascade)

  @@index([blueprintId])
  @@index([created_at])
}

model Condition {
  id                  String    @id @default(uuid())
  blueprintId         String
  signal_id           String?

  condition_type      String    // Nothingness, Danger, Urgency, Stability, Power, Affluence, PowerChange
  frameworks_enforcing String[]
  enforcement_active  Boolean

  // Enforcement package
  task_limit_min      Int
  task_limit_max      Int
  difficulty_cap      String

  created_at          DateTime  @default(now())

  blueprint           Blueprint @relation(fields: [blueprintId], references: [id], onDelete: Cascade)

  @@index([blueprintId])
  @@index([condition_type])
}

model Task {
  id                  String    @id @default(uuid())
  blueprintId         String
  targetId            String

  // Blueprint constraint tracking
  blueprints_applied  String[]
  frameworks_enforced String[]
  subframeworks_used  Int[]

  // Generation context
  generation_reason   String
  generation_trigger  String

  // Execution
  instruction         String
  expected_output     String
  definition_of_done  String
  proof_required      Boolean
  why_matters         String

  difficulty         String     // easy, medium, hard
  time_estimate      Int        // minutes
  status             String     // pending, in_progress, completed, skipped, blocked

  created_at         DateTime   @default(now())
  updated_at         DateTime   @updatedAt

  blueprint          Blueprint  @relation(fields: [blueprintId], references: [id], onDelete: Cascade)
  target             Target     @relation(fields: [targetId], references: [id], onDelete: Cascade)
  feedback           Feedback[]

  @@index([blueprintId])
  @@index([status])
}
```

---

## SECTION 2: MIGRATIONS STRATEGY

### Migration 1: Create Blueprint-related tables

```sql
-- New tables for blueprint validation and tracking
CREATE TABLE blueprint_validations (...);
CREATE TABLE blueprint_violations (...);
CREATE TABLE blueprint_warnings (...);
```

### Migration 2: Create Framework-related tables

```sql
-- New tables for framework activation and decision tracking
CREATE TABLE framework_activations (...);
CREATE TABLE framework_decisions (...);
```

### Migration 3: Create Sub-framework evidence tables

```sql
CREATE TABLE subframework_evidence (...);
CREATE TABLE constraint_validations (...);
CREATE TABLE decision_cascades (...);
```

### Migration 4: Extend existing tables

```sql
-- Add columns to blueprints, signals, conditions, tasks
ALTER TABLE blueprints ADD validation_score ...;
ALTER TABLE signals ADD blueprint_valid ...;
ALTER TABLE conditions ADD frameworks_enforcing ...;
ALTER TABLE tasks ADD blueprints_applied ...;
```

**Execution:** Run migrations in order, with data backups.

---

## SECTION 3: TYPESCRIPT INTERFACES

```typescript
// Blueprint-related
interface BlueprintValidationInput {
  goal: string;
  purpose: string;
  timeframe: string;
  commitment: "LOW" | "MEDIUM" | "HIGH" | "INTENSE";
  context?: string;
  tier: "starter" | "growth" | "ultimate";
}

interface ValidationResult {
  verdict: "VALID" | "VALID_WITH_WARNINGS" | "INVALID";
  cleanedGoal: string;
  validationScore: number;
  pathRecommendation: {
    current: PlanPath;
    adjusted?: PlanPath;
    alternative?: PlanPath;
  };
  violations: BlueprintViolation[];
  warnings: BlueprintWarning[];
}

// Framework-related
interface FrameworkEvaluation {
  frameworkName: string;
  activationLevel: number;
  isActive: boolean;
  triggerReason: string;
  decisions: FrameworkDecision[];
}

interface FrameworkDecision {
  decisionType: "constrain" | "enforce" | "recommend" | "veto";
  targetLayer: string;
  decision: any;
  confidence: number;
  requiresEnforcement: boolean;
}

// Sub-framework evidence
interface SubframeworkEvidence {
  subframeworkId: number;
  subframeworkName: string;
  evidenceType: string;
  evidenceValue: any;
  confidence: number;
}

// Decision cascade
interface DecisionCascade {
  blueprintsChecked: string[];
  frameworksUsed: string[];
  subframeworksUsed: number[];
  finalDecision: any;
  confidence: number;
  timestamp: DateTime;
}

// Constraint validation
interface ConstraintValidation {
  isValid: boolean;
  violationReason?: string;
  appliedConstraints: string[];
}
```

