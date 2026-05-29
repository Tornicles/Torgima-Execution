# DOC 28: BLUEPRINT SIMULATION SYSTEM

## SECTION 1: LEVEL ARCHITECTURE (50 Levels = 50 Blueprints)

### Level Structure (Each Blueprint = 1 Level)

```typescript
interface BlueprintLevel {
  id: number; // 1-50 (corresponds to blueprint ID)
  blueprintName: string;
  category: "business_reality" | "strategy" | "execution" | "experience" | "operations";

  // Learning objective
  objective: string;
  keyConceptsToLearn: string[];

  // Game scenario
  scenario: {
    setting: string; // "startup", "scale-up", "mature", "crisis"
    npcCharacters: NPC[];
    startingState: GameState;
    timeLimit?: number; // seconds
  };

  // Challenge
  challenge: {
    problemStatement: string;
    constraintsSender: Constraint[];
    successCriteria: string[];
    failureConditions: string[];
  };

  // Rewards
  rewards: {
    xp: number;
    badge?: Badge;
    unlocksNext: boolean;
  };

  // Difficulty
  difficulty: "starter" | "growth" | "ultimate";
  estimatedDuration: number; // minutes
}

// Example: Level 1 - Market Reality Blueprint
const level1: BlueprintLevel = {
  id: 1,
  blueprintName: "Market Reality Blueprint",
  category: "business_reality",

  objective: "Validate that your business idea has real market demand",
  keyConceptsToLearn: [
    "Demand is not obvious",
    "Customers vote with money/time",
    "Market feedback is truth",
    "Assumptions must be tested"
  ],

  scenario: {
    setting: "startup",
    npcCharacters: [
      {
        name: "Jordan (Founder)",
        role: "You",
        avatar: "ready-player-me-avatar-1",
        initialState: "excited_but_uncertain"
      },
      {
        name: "Sam (Potential Customer)",
        role: "Market reality check",
        avatar: "ready-player-me-avatar-2",
        initialState: "skeptical"
      },
      {
        name: "Alex (Investor)",
        role: "Demand validator",
        avatar: "ready-player-me-avatar-3",
        initialState: "cautious"
      }
    ],

    startingState: {
      scene: "coffee_shop",
      characters: ["jordan", "sam", "alex"],
      props: ["whiteboard", "coffee_cups", "laptop"],
      narration: "You have 10 minutes to convince these two people that your idea has real market demand. But they're skeptical. How will you prove it?"
    },

    timeLimit: 600 // 10 minutes
  },

  challenge: {
    problemStatement: "You believe your idea solves a real problem. But do the customers?",

    constraintsSender: [
      { constraint: "Time limit: 10 minutes", reason: "Real conversations are brief" },
      { constraint: "No fake metrics", reason: "Market reality rewards truth" },
      { constraint: "Must get actual commitment", reason: "Market validates with action" }
    ],

    successCriteria: [
      "Sam commits to trying your solution",
      "Alex sees viable market",
      "You identify 1 real customer pain point"
    ],

    failureConditions: [
      "Time runs out without commitment",
      "You make up statistics",
      "You describe features instead of problems solved"
    ]
  },

  rewards: {
    xp: 100,
    badge: { id: "market_reality_expert", name: "Market Reality Check", icon: "📊" },
    unlocksNext: true
  },

  difficulty: "starter",
  estimatedDuration: 10
};
```

---

## SECTION 2: GAME MECHANICS (Per Level)

### Conversation Mechanic (For Market Reality Levels)

```typescript
interface ConversationNode {
  id: string;
  speaker: string;
  dialogue: string;
  npcState: "engaged" | "skeptical" | "sold" | "lost";

  // Player choices
  playerOptions: PlayerChoice[];

  // Outcome tracking
  engagement: number; // -1 to +1
  truthfulness: number; // -1 to +1
  evidenceQuality: number; // 0 to +1
}

interface PlayerChoice {
  id: string;
  text: string;
  type: "claim" | "question" | "evidence" | "listen";
  impact: {
    engagement: number;
    truthfulness: number;
    evidenceQuality: number;
  };
  nextNode: string;
  feedback: string;
}

// Example conversation flow
const market_reality_conversation = {
  nodes: [
    {
      id: "start",
      speaker: "sam",
      dialogue: "So what's this problem you're solving?",
      npcState: "skeptical",
      playerOptions: [
        {
          id: "claim_big",
          text: "It's going to change the world!",
          type: "claim",
          impact: { engagement: 0, truthfulness: -0.5, evidenceQuality: 0 },
          nextNode: "sam_eye_roll",
          feedback: "Hmm, big claims without evidence don't land well."
        },
        {
          id: "ask_about_pain",
          text: "What problems do you face with [domain]?",
          type: "question",
          impact: { engagement: 0.3, truthfulness: 0, evidenceQuality: 0 },
          nextNode: "sam_shares_pain",
          feedback: "Good! You're listening first."
        },
        {
          id: "show_data",
          text: "Market research shows 73% of people in your industry waste time on [task]",
          type: "evidence",
          impact: { engagement: 0.2, truthfulness: 0.3, evidenceQuality: 0.5 },
          nextNode: "sam_interested",
          feedback: "Evidence grounded in real data resonates."
        }
      ]
    },

    {
      id: "sam_shares_pain",
      speaker: "sam",
      dialogue: "Actually, I spend 2-3 hours daily on reporting that could be automated.",
      npcState: "engaged",
      playerOptions: [
        {
          id: "validate_pain",
          text: "That sounds frustrating. How much would that time be worth to you?",
          type: "question",
          impact: { engagement: 0.4, truthfulness: 0.2, evidenceQuality: 0 },
          nextNode: "sam_quantifies",
          feedback: "Excellent! You're connecting pain to value."
        },
        {
          id: "jump_to_solution",
          text: "My tool can automate that in minutes!",
          type: "claim",
          impact: { engagement: -0.2, truthfulness: -0.3, evidenceQuality: 0 },
          nextNode: "sam_skeptical_again",
          feedback: "You jumped to solution before fully understanding the problem."
        }
      ]
    },

    // [More nodes...]
  ]
};
```

### Decision Mechanic (For Strategy/Execution Levels)

```typescript
interface DecisionScenario {
  situation: string;
  constraints: Constraint[];
  options: DecisionOption[];
  correctAnswer: string;
  explanations: Map<string, string>;
}

interface DecisionOption {
  id: string;
  text: string;
  frameworks: string[];
  blueprints: string[];
  outcome: "optimal" | "acceptable" | "risky" | "disastrous";
}

// Example decision scenario
const scaling_decision: DecisionScenario = {
  situation: "Your startup has achieved product-market fit. You have $2M in funding. The team is 5 people. Three major customers are asking for enterprise features. A larger competitor just entered the market.",

  constraints: [
    { id: "funding", description: "$2M runway", priority: "high" },
    { id: "team", description: "5 people (limited capacity)", priority: "high" },
    { id: "market", description: "Competitor threat", priority: "high" },
    { id: "customer_demand", description: "Enterprise feature requests", priority: "medium" }
  ],

  options: [
    {
      id: "scale_now",
      text: "Hire aggressively (10 new people) and build enterprise features",
      frameworks: ["OmniGrowth X"],
      blueprints: ["Scaling Readiness"],
      outcome: "risky",
      explanation: "Without operational maturity, scaling adds chaos. You'll burn cash faster and risk product quality."
    },
    {
      id: "focus_existing",
      text: "Retain current customers, refine core product, hire 1-2 people",
      frameworks: ["StrategyCore X", "SynergyOps X"],
      blueprints: ["Scaling Readiness", "Execution Control"],
      outcome: "optimal",
      explanation: "Stabilize first. Build operational infrastructure. Then scale sustainably. Competitor threat is best met with a stronger core product."
    },
    {
      id: "pivot",
      text: "Pivot to enterprise from the start",
      frameworks: ["StrategyCore X"],
      blueprints: ["Pivot Decision"],
      outcome: "acceptable",
      explanation: "Could work, but changes your entire positioning and loses the SMB customers who trust you now."
    }
  ],

  correctAnswer: "focus_existing"
};
```

### Resource Management Mechanic (For Operations Levels)

```typescript
interface ResourceState {
  cash: number;
  team: Map<string, TeamMember>;
  morale: number; // 0-100
  productQuality: number; // 0-100
  customerSatisfaction: number; // 0-100
  time: number; // days remaining
}

interface ResourceDecision {
  allocation: {
    salaries: number;
    product: number;
    marketing: number;
    support: number;
    contingency: number;
  };
  hires?: string[];
  layoffs?: string[];
  projectsToKill?: string[];
}

// Simulate outcomes
function simulateResourceDecision(
  state: ResourceState,
  decision: ResourceDecision
): { newState: ResourceState; feedback: string[] } {
  const feedback = [];
  const newState = { ...state };

  // Check constraints
  const totalSpend = Object.values(decision.allocation).reduce((a, b) => a + b, 0);
  if (totalSpend > state.cash) {
    feedback.push("❌ Budget exceeded! You ran out of cash.");
    return { newState, feedback };
  }

  // Apply decisions
  newState.cash -= totalSpend;

  if (decision.hires && decision.hires.length > 0) {
    feedback.push(`✓ Hired ${decision.hires.length} people`);
    // Increase capacity but reduce morale
    newState.morale -= decision.hires.length * 3;
  }

  if (decision.layoffs && decision.layoffs.length > 0) {
    feedback.push(`✓ Laid off ${decision.layoffs.length} people`);
    // Save cost but severely damage morale
    newState.morale -= decision.layoffs.length * 10;
  }

  // Product quality affected by allocation
  newState.productQuality += (decision.allocation.product / 10000) * 20;
  newState.customerSatisfaction = Math.min(
    100,
    newState.customerSatisfaction + (decision.allocation.support / 5000) * 10
  );

  // Morale affects everything
  if (newState.morale < 30) {
    feedback.push("⚠️ Team morale is critically low. Expect turnover.");
    newState.morale -= 5;
  }

  feedback.push(`Cash remaining: $${newState.cash}k`);
  feedback.push(`Team morale: ${newState.morale}%`);
  feedback.push(`Product quality: ${newState.productQuality}%`);

  return { newState, feedback };
}
```

---

## SECTION 3: NPC BEHAVIOR & ANIMATION

### NPC State Machine

```typescript
enum NPCEmotionalState {
  Enthusiastic = "enthusiastic",
  Engaged = "engaged",
  Neutral = "neutral",
  Skeptical = "skeptical",
  Disappointed = "disappointed",
  Sold = "sold",
  Angry = "angry"
}

interface NPC {
  id: string;
  name: string;
  role: string;
  readyPlayerMeAvatarId: string;

  // Emotional state
  emotionalState: NPCEmotionalState;
  emotionalHistory: NPCEmotionalState[];

  // Memory (for conversation continuity)
  memory: Map<string, any>;

  // Behavior
  behavior: NPCBehavior;
}

// Map emotions to animations
const emotionToAnimation = {
  [NPCEmotionalState.Enthusiastic]: "enthusiastic_gesture",
  [NPCEmotionalState.Engaged]: "leaning_in",
  [NPCEmotionalState.Neutral]: "neutral_stance",
  [NPCEmotionalState.Skeptical]: "arms_crossed",
  [NPCEmotionalState.Disappointed]: "head_shake",
  [NPCEmotionalState.Sold]: "thumbs_up",
  [NPCEmotionalState.Angry]: "pointing"
};

// React component for NPC with Mixamo animation
function NPCCharacter({ npc, emotionalState }: { npc: NPC; emotionalState: NPCEmotionalState }) {
  const [animation, setAnimation] = useState(emotionToAnimation[emotionalState]);

  useEffect(() => {
    setAnimation(emotionToAnimation[emotionalState]);
  }, [emotionalState]);

  return (
    <div className="npc-character">
      <Canvas>
        <Suspense fallback={<mesh />}>
          {/* Ready Player Me Avatar */}
          <Avatar
            avatarId={npc.readyPlayerMeAvatarId}
            animation={animation}
            position={[0, 0, 0]}
          />

          {/* Lighting */}
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} />
        </Suspense>
      </Canvas>

      {/* Dialogue bubble */}
      <div className="dialogue-bubble">
        <p>{npc.currentDialogue}</p>
      </div>

      {/* Emotional state indicator */}
      <div className="emotional-indicator">
        <span className={`state ${emotionalState}`}>
          {emotionalState}
        </span>
      </div>
    </div>
  );
}
```

---

## SECTION 4: SCORING & OUTCOMES

### Score Calculation

```typescript
interface LevelScore {
  baseScore: number;
  bonusMultiplier: number;
  finalScore: number;
  breakdown: {
    objectivesCompleted: number;
    constraintsRespected: number;
    learningDemonstrated: number;
    speedBonus: number;
    efficiencyBonus: number;
  };
}

function calculateLevelScore(
  level: BlueprintLevel,
  performance: PerformanceData,
  timeSpent: number
): LevelScore {
  let baseScore = 0;
  let bonusMultiplier = 1.0;

  // Objectives completed: up to 40 points
  const objectivesCompleted = level.challenge.successCriteria.filter(
    criteria => performance.successCriteria.includes(criteria)
  ).length;
  baseScore += (objectivesCompleted / level.challenge.successCriteria.length) * 40;

  // Constraints respected: up to 30 points
  const constraintsRespected = level.challenge.constraintsSender.filter(
    constraint => !performance.violatedConstraints.includes(constraint.constraint)
  ).length;
  baseScore += (constraintsRespected / level.challenge.constraintsSender.length) * 30;

  // Learning demonstrated: up to 20 points
  // (assessed by whether player applied correct frameworks/blueprints)
  baseScore += (performance.correctDecisions / performance.totalDecisions) * 20;

  // Speed bonus: up to 10 points
  if (timeSpent < (level.estimatedDuration * 60 * 0.8)) {
    bonusMultiplier += 0.1;
  }

  // Efficiency bonus: up to 10 points
  if (performance.failuresBeforeSuccess < 2) {
    bonusMultiplier += 0.1;
  }

  const finalScore = Math.round(baseScore * bonusMultiplier);

  return {
    baseScore,
    bonusMultiplier,
    finalScore,
    breakdown: {
      objectivesCompleted: (objectivesCompleted / level.challenge.successCriteria.length) * 40,
      constraintsRespected: (constraintsRespected / level.challenge.constraintsSender.length) * 30,
      learningDemonstrated: (performance.correctDecisions / performance.totalDecisions) * 20,
      speedBonus: timeSpent < (level.estimatedDuration * 60 * 0.8) ? 10 : 0,
      efficiencyBonus: performance.failuresBeforeSuccess < 2 ? 10 : 0
    }
  };
}
```

### Outcome Presentation

```typescript
interface LevelOutcome {
  passed: boolean;
  score: LevelScore;
  learningResults: {
    conceptsMastered: string[];
    conceptsPartial: string[];
    conceptsMissed: string[];
  };
  feedback: string[];
  recommendations: string[];
  nextLevel: number;
}

function LevelOutcomeScreen({ outcome }: { outcome: LevelOutcome }) {
  return (
    <div className="outcome-screen">
      {outcome.passed ? (
        <div className="success-state">
          <h2>✓ Level Complete!</h2>
          <div className="score-display">
            <div className="final-score">{outcome.score.finalScore}</div>
            <div className="score-breakdown">
              {Object.entries(outcome.score.breakdown).map(([key, value]) => (
                <div key={key} className="score-item">
                  <span>{key}:</span>
                  <span className="points">{Math.round(value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="failure-state">
          <h2>✗ Level Failed</h2>
          <p>{outcome.feedback.join("\n")}</p>
        </div>
      )}

      <div className="learning-results">
        <h3>Concepts Learned</h3>
        <div className="concepts">
          {outcome.learningResults.conceptsMastered.map(concept => (
            <div key={concept} className="concept mastered">✓ {concept}</div>
          ))}
          {outcome.learningResults.conceptsPartial.map(concept => (
            <div key={concept} className="concept partial">◐ {concept}</div>
          ))}
          {outcome.learningResults.conceptsMissed.map(concept => (
            <div key={concept} className="concept missed">✗ {concept}</div>
          ))}
        </div>
      </div>

      <div className="recommendations">
        <h3>Next Steps</h3>
        <ul>
          {outcome.recommendations.map((rec, idx) => (
            <li key={idx}>{rec}</li>
          ))}
        </ul>
      </div>

      <div className="actions">
        <button onClick={() => continueToNextLevel(outcome.nextLevel)}>
          Next Level →
        </button>
        <button onClick={() => retryLevel()}>
          Retry
        </button>
      </div>
    </div>
  );
}
```

