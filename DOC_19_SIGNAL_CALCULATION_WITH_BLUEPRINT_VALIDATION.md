# DOC 19: SIGNAL CALCULATION WITH BLUEPRINT VALIDATION

## INTEGRATION POINT: Signal Engine with Business Reality Blueprints

### Flow

```
FEEDBACK SUBMITTED
  ↓
RAW METRICS COLLECTED
  ├─ completion (done/partial/failed/skipped)
  ├─ quality_score (1-10)
  ├─ reflection (text)
  └─ timestamp
  ↓
Business Reality Blueprint Validation
  ├─ Is feedback realistic?
  ├─ Does score make sense?
  ├─ Is reflection genuine?
  └─ Adjust confidence if violated
  ↓
SIGNAL CALCULATED
  ├─ completion_rate
  ├─ quality_score
  ├─ momentum
  ├─ trend
  └─ confidence (reduced if blueprint violated)
  ↓
CONDITION EVALUATED
```

### Implementation Code

```typescript
class BlueprintAwareSignalCalculationService {
  async calculateSignal(
    blueprintId: string,
    feedback: Feedback,
    previousSignal?: Signal
  ): Promise<Signal> {
    // Step 1: Validate feedback against Business Reality Blueprint
    const feedbackValidation = await this.validateFeedback(feedback, blueprintId);

    // Step 2: Collect metrics
    const metrics = await this.collectMetrics(blueprintId, feedback);

    // Step 3: Calculate core signal values
    const signal = await this.calculateCoreSignal(metrics, previousSignal ?? null, feedbackValidation);

    // Step 4: Apply blueprint constraints
    const constrainedSignal = await this.applyBlueprintConstraints(signal, blueprintId, feedbackValidation);

    // Step 5: Save and return
    await constrainedSignal.save();
    return constrainedSignal;
  }

  private async validateFeedback(
    feedback: Feedback,
    blueprintId: string
  ): Promise<FeedbackValidation> {
    const blueprint = await Blueprint.findById(blueprintId);
    const recentFeedback = await Feedback.find({
      task: { blueprint: blueprintId },
      createdAt: { $gte: Date.now() - 7 * 24 * 60 * 60 * 1000 }
    });

    const validation = {
      scoreMakesSense: true,
      reflectionGenuine: true,
      completionRealistic: true,
      confidenceMod: 1.0,
      notes: [] as string[]
    };

    // Check: Does score match completion?
    if (feedback.completion === "failed" && feedback.score > 3) {
      validation.scoreMakesSense = false;
      validation.confidenceMod -= 0.2;
      validation.notes.push("Score doesn't match failure");
    }

    if (feedback.completion === "completed" && feedback.score < 3) {
      validation.scoreMakesSense = false;
      validation.confidenceMod -= 0.2;
      validation.notes.push("Score too low for completion");
    }

    // Check: Is reflection present for important feedback?
    if (feedback.completion !== "completed" && !feedback.reflection) {
      validation.reflectionGenuine = false;
      validation.confidenceMod -= 0.15;
      validation.notes.push("Missing reflection on non-completion");
    }

    // Check: Is completion realistic given pattern?
    if (recentFeedback.length > 3) {
      const avgCompletion =
        recentFeedback.reduce((sum, f) => sum + (f.completion === "completed" ? 1 : 0), 0) /
        recentFeedback.length;

      if (feedback.completion === "completed" && avgCompletion < 0.3) {
        validation.completionRealistic = false;
        validation.confidenceMod -= 0.15;
        validation.notes.push("Completion breaks pattern");
      }
    }

    return validation;
  }

  private async collectMetrics(
    blueprintId: string,
    feedback: Feedback
  ): Promise<RawMetrics> {
    const tasks = await Task.find({ blueprintId });
    const allFeedback = await Feedback.find({ task: { blueprint: blueprintId } });

    const completedTasks = allFeedback.filter(f => f.completion === "completed").length;

    const scores = allFeedback.map(f => f.score);
    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

    return {
      total_tasks: tasks.length,
      completed_tasks: completedTasks,
      completion_rate: tasks.length > 0 ? completedTasks / tasks.length : 0,
      recent_score: feedback.score,
      avg_score: avgScore,
      avg_score_trend: this.calculateTrend(scores),
      consistency: this.calculateConsistency(allFeedback)
    };
  }

  private async calculateCoreSignal(
    metrics: RawMetrics,
    previousSignal: Signal | null,
    validation: FeedbackValidation
  ): Promise<SignalData> {
    // Completion rate: % of tasks marked complete
    const completionRate = metrics.completion_rate;

    // Quality score: weighted average
    const qualityScore = metrics.avg_score * validation.confidenceMod;

    // Momentum: change in completion rate from previous
    let momentum = 0;
    if (previousSignal) {
      momentum = Math.round((completionRate - previousSignal.completion_rate) * 10);
    }

    // Trend: is completion rate rising or falling?
    const trend = metrics.avg_score_trend;

    // Confidence: how reliable is this signal?
    let confidence = 0.7; // baseline
    confidence *= validation.confidenceMod;

    // Apply Business Reality Blueprint adjustments
    if (!validation.scoreMakesSense) confidence -= 0.1;
    if (!validation.reflectionGenuine) confidence -= 0.1;
    if (!validation.completionRealistic) confidence -= 0.15;

    return {
      completion_rate: completionRate,
      quality_score: Math.max(0, Math.min(10, qualityScore)),
      momentum: momentum,
      trend: trend,
      confidence: Math.max(0.3, Math.min(1.0, confidence))
    };
  }

  private async applyBlueprintConstraints(
    signal: SignalData,
    blueprintId: string,
    validation: FeedbackValidation
  ): Promise<Signal> {
    // Check if signal violates Business Reality Blueprints
    const blueprintChecks = {
      "Realistic Expectations": {
        check: signal.completion_rate > 0.95 && signal.quality_score > 9,
        impact: -0.1,
        reason: "Unrealistic perfection"
      },
      "Downward Spiral": {
        check: signal.momentum < -3 && signal.trend < -3,
        impact: -0.05,
        reason: "Downward trend needs intervention"
      },
      Stagnation: {
        check: signal.momentum === 0 && signal.trend === 0,
        impact: 0,
        reason: "No progress or regression"
      }
    } as const;

    for (const [name, check] of Object.entries(blueprintChecks)) {
      if (check.check) {
        signal.confidence += check.impact;
        validation.notes.push(`${name}: ${check.reason}`);
      }
    }

    return new Signal({
      blueprintId,
      completion_rate: signal.completion_rate,
      quality_score: signal.quality_score,
      momentum: signal.momentum,
      trend: signal.trend,
      confidence: Math.max(0.3, signal.confidence),

      blueprint_valid:
        validation.scoreMakesSense && validation.reflectionGenuine && validation.completionRealistic,
      validation_notes: validation.notes.join("; "),

      window_start: this.getWindowStart(),
      window_end: new Date()
    });
  }

  private calculateTrend(scores: number[]): number {
    if (scores.length < 2) return 0;

    const recent = scores.slice(-5); // Last 5 scores
    const older = scores.slice(-10, -5); // 5-10 scores ago

    const recentAvg = recent.length > 0 ? recent.reduce((a, b) => a + b, 0) / recent.length : 0;
    const olderAvg = older.length > 0 ? older.reduce((a, b) => a + b, 0) / older.length : 0;

    const difference = recentAvg - olderAvg;
    return Math.round(difference * 10); // Scale to -10 to +10
  }
}
```

---

## SECTION 4: PERFORMANCE & MONITORING

### Performance Targets

```
Signal calculation: < 500ms
Feedback validation: < 200ms
Blueprint constraints: < 100ms
Full cascade: < 2 seconds
```

### Monitoring

```
- Track feedback validation rejection rate
- Monitor signal anomalies
- Alert on constraint violations
- Log all decision cascades
- Track Bhudhi timeout frequency
```

