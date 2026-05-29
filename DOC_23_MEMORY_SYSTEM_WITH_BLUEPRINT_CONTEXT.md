# DOC 23: MEMORY SYSTEM WITH BLUEPRINT CONTEXT

## SECTION 1: BHUDHI MEMORY ARCHITECTURE

```typescript
interface BhudhhiMemoryEntry {
  id: string;
  blueprintId: string;
  userId: string;

  // Memory content
  memoryType: "decision" | "pattern" | "learning" | "context";
  content: any;

  // Blueprint context
  blueprints_active: string[];
  frameworks_active: string[];
  condition: string;
  signal: Signal;

  // Metadata
  created_at: DateTime;
  last_accessed: DateTime;
  access_count: number;

  // Relevance
  relevance_score: number;
  relevance_tags: string[];
}

class BhudhhiMemoryService {
  private MAX_MEMORY_PER_BLUEPRINT = 100; // entries
  private MEMORY_RETENTION = 90; // days

  async storeMemory(
    blueprintId: string,
    memoryType: string,
    content: any,
    context: TriggerContext
  ): Promise<BhudhhiMemoryEntry> {
    // Create memory entry
    const entry: BhudhhiMemoryEntry = {
      id: generateId(),
      blueprintId,
      userId: context.userId,
      memoryType,
      content,
      blueprints_active: context.blueprint_context?.active_blueprints || [],
      frameworks_active: context.blueprint_context?.active_frameworks || [],
      condition: context.condition,
      signal: context.signal,
      created_at: new Date(),
      last_accessed: new Date(),
      access_count: 0,
      relevance_score: 1.0,
      relevance_tags: this.generateTags(memoryType, content)
    };

    // Store in database
    await BhudhhiMemory.create(entry);

    // Manage memory size
    await this.pruneMemory(blueprintId);

    return entry;
  }

  async retrieveMemory(
    blueprintId: string,
    query: string,
    context: TriggerContext
  ): Promise<BhudhhiMemoryEntry[]> {
    // Find relevant memories
    const memories = await BhudhhiMemory.find({
      blueprintId,
      created_at: { $gte: Date.now() - this.MEMORY_RETENTION * 24 * 60 * 60 * 1000 }
    });

    // Rank by relevance to current context
    const scored = memories.map(m => ({
      ...m,
      score: this.scoreRelevance(m, context)
    }));

    // Sort and return top matches
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(m => {
        m.last_accessed = new Date();
        m.access_count++;
        m.save();
        return m;
      });
  }

  private scoreRelevance(
    memory: BhudhhiMemoryEntry,
    context: TriggerContext
  ): number {
    let score = memory.relevance_score;

    // Same condition? +0.2
    if (memory.condition === context.condition) {
      score += 0.2;
    }

    // Similar signal? +0.15
    if (this.signalsMatch(memory.signal, context.signal)) {
      score += 0.15;
    }

    // Overlapping frameworks? +0.1 per framework
    const blueprintFrameworks = context.blueprint_context?.active_frameworks || [];
    const overlap = memory.frameworks_active.filter(f =>
      blueprintFrameworks.includes(f)
    );
    score += overlap.length * 0.1;

    // Recent? +0.1 per week (max 0.3)
    const daysOld = (Date.now() - memory.created_at.getTime()) / (24 * 60 * 60 * 1000);
    const recencyBonus = Math.max(0, 0.3 - (daysOld / 7) * 0.05);
    score += recencyBonus;

    return Math.min(1.0, score);
  }

  private async pruneMemory(blueprintId: string): Promise<void> {
    const count = await BhudhhiMemory.count({ blueprintId });

    if (count > this.MAX_MEMORY_PER_BLUEPRINT) {
      // Delete least relevant
      const toDelete = count - this.MAX_MEMORY_PER_BLUEPRINT;

      const least = await BhudhhiMemory.find({ blueprintId })
        .sort({
          access_count: 1,
          last_accessed: 1,
          relevance_score: 1
        })
        .limit(toDelete);

      for (const entry of least) {
        await entry.delete();
      }
    }
  }
}
```

