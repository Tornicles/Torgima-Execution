import { db, orders, academyTasks, feedback } from "@workspace/db";
import { eq } from "drizzle-orm";
import { advanceLearningPath } from "./LearningPathGenerator.js";
import { assessMastery } from "./MasteryAssessmentEngine.js";

export async function handleAcademyFeedback(params: {
  userId: string;
  blueprintId: string;
  orderId: string;
  feedbackId: string;
  completionScore: number;
}): Promise<void> {
  const [order] = await db
    .select({ task_type: orders.task_type })
    .from(orders)
    .where(eq(orders.id, params.orderId))
    .limit(1);

  if (order?.task_type !== "academy") return;

  const [task] = await db
    .select()
    .from(academyTasks)
    .where(eq(academyTasks.order_id, params.orderId))
    .limit(1);

  if (!task?.learning_path_id || !task.lesson_number) return;

  const [fb] = await db
    .select({ reflection: feedback.reflection })
    .from(feedback)
    .where(eq(feedback.id, params.feedbackId))
    .limit(1);

  if (task.practice_type === "ASSESSMENT") {
    const result = await assessMastery({
      userId: params.userId,
      learningPathId: task.learning_path_id,
      feedbackId: params.feedbackId,
      completionScore: params.completionScore,
      proofText: fb?.reflection ?? undefined,
    });
    if (result.mastered) {
      await db
        .update(academyTasks)
        .set({
          status: "completed",
          completed_at: new Date(),
          completion_score: params.completionScore,
        })
        .where(eq(academyTasks.id, task.id));
      return;
    }
  }

  const advance = await advanceLearningPath({
    userId: params.userId,
    learningPathId: task.learning_path_id,
    blueprintId: params.blueprintId,
    completedLessonNumber: task.lesson_number,
    completionScore: params.completionScore,
  });

  await db
    .update(academyTasks)
    .set({
      status: "completed",
      completed_at: new Date(),
      completion_score: params.completionScore,
    })
    .where(eq(academyTasks.id, task.id));

  if (advance.complete) {
    await assessMastery({
      userId: params.userId,
      learningPathId: task.learning_path_id,
      feedbackId: params.feedbackId,
      completionScore: params.completionScore,
      proofText: fb?.reflection ?? undefined,
    });
  }
}
