# DOC 29: LEARNING PROGRESSION SPECIFICATION

## SECTION 1: PROGRESSION SYSTEM (Levels 1-64)

### Tier 1: Blueprint Mastery (Levels 1-50)
**One level per blueprint (all 50 business blueprints)**

```typescript
enum ProgressionTier {
  BlueprintMastery = "blueprint_mastery", // Levels 1-50
  FrameworkMastery = "framework_mastery" // Levels 51-64
}

interface ProgressionPath {
  tier: ProgressionTier;
  levels: number[];
  theme: string;
  objective: string;
  estimatedHours: number;
}

const blueprintMasteryPath: ProgressionPath = {
  tier: ProgressionTier.BlueprintMastery,
  levels: Array.from({ length: 50 }, (_, i) => i + 1),
  theme: "Build Business Foundations",
  objective: "Master each of the 50 core business blueprints through scenarios and decision-making",
  estimatedHours: 25 // ~30 min per level
};

// Level grouping by category
const levelsByCategory = {
  businessReality: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  strategyDirection: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
  executionControl: [21, 22, 23, 24, 25, 26, 27, 28, 29, 30],
  productExperience: [31, 32, 33, 34, 35, 36, 37, 38, 39, 40],
  operationsImprovement: [41, 42, 43, 44, 45, 46, 47, 48, 49, 50]
};
```

---

### Tier 2: Framework Mastery (Levels 51-64)
**Teach the 14 frameworks through integrated challenges**

```typescript
const frameworkMasteryPath: ProgressionPath = {
  tier: ProgressionTier.FrameworkMastery,
  levels: Array.from({ length: 14 }, (_, i) => i + 51),
  theme: "Master the Frameworks",
  objective: "Learn how the 14 frameworks work together in complex scenarios",
  estimatedHours: 7 // ~30 min per level
};

// Framework levels (51-64)
const frameworkLevels = {
  51: "StrategyCore X - Strategic Coherence",
  52: "DecisionVelocity X - Momentum & Pacing",
  53: "Governance & Risk X - Safety & Compliance",
  54: "SynergyOps X - Execution Coordination",
  55: "FinMatrix X - Resource Allocation",
  56: "OmniGrowth X - Scaling Intelligence",
  57: "TalentSync X - Capability Alignment",
  58: "CultureDynamics X - Standards & Culture",
  59: "KnowledgeFlow X - Learning & Adaptation",
  60: "Regeneration & Exit X - Renewal & Recovery",
  61: "CustomerValue X - Value Delivery",
  62: "AdaptiveIntelligence X - Change Sensing",
  63: "Alignment & Accountability X - Ownership",
  64: "Clarity Catalyst - Understanding & Communication"
};
```

---

## SECTION 2: UNLOCKING & PREREQUISITES

### Progression Rules

```typescript
interface ProgressionRules {
  unlockConditions: Map<number, UnlockCondition>;
  prerequisiteChains: Map<number, number[]>;
  categoryUnlocks: Map<string, number>;
}

interface UnlockCondition {
  levelId: number;
  requiredPreviouLevel?: number;
  requiredScore?: number; // 0-100
  requiredCategory?: string;
  requiredConceptsMastered?: string[];
}

const progressionRules: ProgressionRules = {
  unlockConditions: new Map([
    // Levels 1-10 (Business Reality): Unlock with progression
    [2, { levelId: 2, requiredPreviousLevel: 1, requiredScore: 60 }],
    [3, { levelId: 3, requiredPreviousLevel: 2, requiredScore: 60 }],
    // ... 4-10

    // Levels 11-20 (Strategy): Require Business Reality mastery
    [11, { levelId: 11, requiredCategory: "businessReality", requiredScore: 70 }],

    // Levels 21-30 (Execution): Require Strategy mastery
    [21, { levelId: 21, requiredCategory: "strategyDirection", requiredScore: 70 }],

    // Levels 51-64 (Frameworks): Require Blueprint mastery
    [51, { levelId: 51, requiredCategory: "blueprintMastery", requiredScore: 70 }],
  ]),

  prerequisiteChains: new Map([
    [2, [1]],
    [3, [2, 1]],
    // ... build full dependency graph
  ]),

  categoryUnlocks: new Map([
    ["strategyDirection", 10], // Unlock after level 10
    ["executionControl", 20],
    ["productExperience", 30],
    ["operationsImprovement", 40],
    ["frameworkMastery", 50]
  ])
};

// Check if level is unlocked
function isLevelUnlocked(
  levelId: number,
  playerProgress: PlayerProgress,
  rules: ProgressionRules
): { unlocked: boolean; reason?: string } {
  const condition = rules.unlockConditions.get(levelId);

  if (!condition) {
    return { unlocked: true }; // No unlock requirement
  }

  // Check prerequisite level
  if (condition.requiredPreviousLevel) {
    if (!playerProgress.completedLevels.includes(condition.requiredPreviousLevel)) {
      return {
        unlocked: false,
        reason: `Complete Level ${condition.requiredPreviousLevel} first`
      };
    }
  }

  // Check score requirement
  if (condition.requiredScore) {
    const previousScore = playerProgress.levelScores.get(condition.requiredPreviousLevel || 1);
    if (!previousScore || previousScore < condition.requiredScore) {
      return {
        unlocked: false,
        reason: `Achieve ${condition.requiredScore}% on previous level`
      };
    }
  }

  // Check category requirement
  if (condition.requiredCategory) {
    const categoryLevels = levelsByCategory[condition.requiredCategory];
    const categoryComplete = categoryLevels.every(lvl =>
      playerProgress.completedLevels.includes(lvl)
    );
    if (!categoryComplete) {
      return {
        unlocked: false,
        reason: `Complete ${condition.requiredCategory} category first`
      };
    }
  }

  return { unlocked: true };
}
```

---

## SECTION 3: PROGRESSION TRACKING

### Player Progress State

```typescript
interface PlayerProgress {
  userId: string;
  blueprintId: string; // Current Torgima blueprint

  // Levels
  currentLevel: number;
  completedLevels: number[];
  levelScores: Map<number, number>;
  levelAttempts: Map<number, number>;

  // XP & Rewards
  totalXP: number;
  badges: Badge[];
  achievements: Achievement[];

  // Learning
  masteredConcepts: string[];
  partialConcepts: string[];
  conceptErrors: Map<string, number>; // concept → error count

  // Stats
  playtimeHours: number;
  lastPlayedLevel: number;
  lastPlayedAt: DateTime;

  // Connection to Torgima
  linkedBlueprintId: string;
  insightsToApply: string[]; // Lessons from Erector → apply to Torgima
}

// Save progress
async function saveProgress(progress: PlayerProgress): Promise<void> {
  await api.post("/api/erector/progress", {
    userId: progress.userId,
    currentLevel: progress.currentLevel,
    completedLevels: progress.completedLevels,
    levelScores: Object.fromEntries(progress.levelScores),
    totalXP: progress.totalXP,
    masteredConcepts: progress.masteredConcepts,
    linkedBlueprintId: progress.linkedBlueprintId,
    insightsToApply: progress.insightsToApply,
    lastPlayedAt: new Date()
  });
}

// Get recommended next level
function getRecommendedNextLevel(progress: PlayerProgress): number {
  // If currently playing level, continue
  if (progress.currentLevel > 0 && !progress.completedLevels.includes(progress.currentLevel)) {
    return progress.currentLevel;
  }

  // Find next incomplete level
  for (let level = 1; level <= 64; level++) {
    if (!progress.completedLevels.includes(level)) {
      return level;
    }
  }

  // All complete
  return -1;
}
```

---

## SECTION 4: INSIGHTS TO TORGIMA CONNECTION

### Transfer Learning to Real Blueprint

```typescript
interface GameInsight {
  conceptLearned: string;
  blueprintApplied: string;
  realWorldApplication: string;
  relevanceScore: number; // 0-1
}

const insightsMapping: Map<number, GameInsight[]> = new Map([
  [1, [
    {
      conceptLearned: "Market reality comes from customers, not assumptions",
      blueprintApplied: "Market Reality Blueprint",
      realWorldApplication: "Your current goal: validate market demand before building",
      relevanceScore: 0.95
    }
  ]],
  [21, [
    {
      conceptLearned: "Task sequencing prevents bottlenecks",
      blueprintApplied: "Execution Control Blueprint",
      realWorldApplication: "Your current tasks should follow proven sequencing patterns",
      relevanceScore: 0.85
    }
  ]],
  // [More mappings...]
]);

// Suggest insight application
function suggestInsightFromLevel(
  level: number,
  userBlueprint: Blueprint
): GameInsight | null {
  const insights = insightsMapping.get(level);
  if (!insights) return null;

  // Find most relevant insight
  return insights.reduce((best, current) =>
    current.relevanceScore > best.relevanceScore ? current : best
  );
}

// Component: Show insight suggestion
function GameInsightSuggestion({ insight }: { insight: GameInsight }) {
  return (
    <div className="game-insight-card">
      <h3>💡 Game Insight</h3>
      <p className="insight-text">{insight.conceptLearned}</p>

      <div className="application">
        <label>Apply to Your Blueprint:</label>
        <p>{insight.realWorldApplication}</p>
      </div>

      <div className="relevance">
        <span>Relevance: {Math.round(insight.relevanceScore * 100)}%</span>
      </div>

      <button onClick={() => applyInsightToBlueprint(insight)}>
        Apply This Insight
      </button>
    </div>
  );
}
```

---

## SECTION 5: PROGRESSION UI

### Level Select Screen

```typescript
function LevelSelectScreen({ progress }: { progress: PlayerProgress }) {
  const [selectedCategory, setSelectedCategory] = useState("businessReality");

  const categoryLevels = levelsByCategory[selectedCategory];
  const unlockedLevels = categoryLevels.filter(level =>
    isLevelUnlocked(level, progress, progressionRules).unlocked
  );

  return (
    <div className="level-select">
      <div className="header">
        <h1>Erector: Master the Blueprints</h1>
        <div className="player-stats">
          <span className="xp">XP: {progress.totalXP}</span>
          <span className="progress">
            Progress: {progress.completedLevels.length}/64 Levels
          </span>
        </div>
      </div>

      {/* Category tabs */}
      <div className="category-tabs">
        {Object.keys(levelsByCategory).map(category => (
          <button
            key={category}
            className={`tab ${selectedCategory === category ? "active" : ""}`}
            onClick={() => setSelectedCategory(category)}
          >
            {category.replace(/([A-Z])/g, ' $1')}
          </button>
        ))}
      </div>

      {/* Level grid */}
      <div className="level-grid">
        {categoryLevels.map(level => {
          const unlockStatus = isLevelUnlocked(level, progress, progressionRules);
          const isCompleted = progress.completedLevels.includes(level);
          const score = progress.levelScores.get(level);

          return (
            <div
              key={level}
              className={`level-card ${isCompleted ? "completed" : ""} ${unlockStatus.unlocked ? "" : "locked"}`}
            >
              <div className="level-number">{level}</div>

              {isCompleted ? (
                <div className="score-badge">
                  {score}%
                </div>
              ) : unlockStatus.unlocked ? (
                <button onClick={() => startLevel(level)}>Play</button>
              ) : (
                <div className="lock-reason">{unlockStatus.reason}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

### Progression Analytics

```typescript
function ProgressionAnalytics({ progress }: { progress: PlayerProgress }) {
  return (
    <div className="progression-analytics">
      <h2>Your Learning Journey</h2>

      {/* XP Progress */}
      <div className="xp-section">
        <h3>Total XP: {progress.totalXP}</h3>
        <ProgressBar value={progress.totalXP / 6400} /> {/* 50 levels × 100 XP + 14 × 100 */}
      </div>

      {/* Completion by category */}
      <div className="category-completion">
        {Object.entries(levelsByCategory).map(([category, levels]) => {
          const completed = levels.filter(l => progress.completedLevels.includes(l)).length;
          return (
            <div key={category} className="category-stat">
              <label>{category}</label>
              <ProgressBar value={completed / levels.length} />
              <span>{completed}/{levels.length}</span>
            </div>
          );
        })}
      </div>

      {/* Mastered concepts */}
      <div className="concepts-section">
        <h3>Concepts Mastered ({progress.masteredConcepts.length})</h3>
        <div className="concept-tags">
          {progress.masteredConcepts.map(concept => (
            <span key={concept} className="concept-tag mastered">
              {concept}
            </span>
          ))}
        </div>
      </div>

      {/* Badges */}
      <div className="badges-section">
        <h3>Badges Earned ({progress.badges.length})</h3>
        <div className="badge-grid">
          {progress.badges.map(badge => (
            <div key={badge.id} className="badge" title={badge.name}>
              {badge.icon}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

