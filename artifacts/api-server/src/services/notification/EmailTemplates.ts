const APP_URL =
  process.env["PUBLIC_APP_URL"] ??
  process.env["NEXT_PUBLIC_APP_URL"] ??
  process.env["APP_URL"] ??
  (process.env.NODE_ENV === "production"
    ? "https://torgima.com"
    : `http://localhost:${process.env.APP_DEV_PORT ?? "5173"}`);
const APP_NAME = "Torgima";

function footer(
  unsubscribeUrl: string,
  preferencesUrl: string,
  unsubscribeAllUrl: string,
): string {
  return `
    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;font-family:Arial,sans-serif;">
      <p style="margin:0 0 8px 0;">
        <a href="${unsubscribeUrl}" style="color:#6b7280;">Unsubscribe from this notification</a> &nbsp;·&nbsp;
        <a href="${preferencesUrl}" style="color:#6b7280;">Manage notification preferences</a> &nbsp;·&nbsp;
        <a href="${unsubscribeAllUrl}" style="color:#6b7280;">Unsubscribe from all emails</a>
      </p>
      <p style="margin:0;">${APP_NAME}</p>
    </div>
  `;
}

function textFooter(unsubscribeUrl: string): string {
  return `\n\n---\nUnsubscribe: ${unsubscribeUrl}\nManage preferences: ${APP_URL}/settings\n${APP_NAME}`;
}

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

export interface NotificationContext {
  userId: string;
  displayName?: string | null;
  blueprintId?: string;
  goalText?: string;
  unsubscribeUrl: string;
  preferencesUrl: string;
  unsubscribeAllUrl: string;
  taskTitle?: string;
  hoursInactive?: number;
  severity?: string;
  milestoneTitle?: string;
  milestoneDesc?: string;
  tasksCompleted?: number;
  executionDays?: number;
  conditionName?: string;
  completionRate?: number;
  weeklyTasks?: number;
  weeklyTrend?: string;
}

export function buildInactivityReminder(ctx: NotificationContext, isEscalation = false): EmailContent {
  const goal = ctx.goalText ? `"${ctx.goalText.slice(0, 80)}"` : "your goal";
  const hours = ctx.hoursInactive ?? 0;

  if (isEscalation) {
    return {
      subject: `${goal} needs your attention`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#111827;">
          <h2 style="color:#1f2937;font-size:20px;">Your blueprint needs attention</h2>
          <p>Your execution of ${goal} has been paused for <strong>${Math.round(hours / 24)} days</strong>.</p>
          <p>Your blueprint is still active and holding your position. The next step is ready when you are.</p>
          <p style="margin-top:24px;">
            <a href="${APP_URL}/dashboard" style="background:#2563eb;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">Resume execution</a>
          </p>
          ${footer(ctx.unsubscribeUrl, ctx.preferencesUrl, ctx.unsubscribeAllUrl)}
        </div>`,
      text: `Your blueprint needs attention.\n\nYour execution of ${goal} has been paused for ${Math.round(hours / 24)} days. Your position is preserved.\n\nResume: ${APP_URL}/dashboard${textFooter(ctx.unsubscribeUrl)}`,
    };
  }

  return {
    subject: `Your next task is still ready — ${ctx.goalText?.slice(0, 40) ?? "your goal"}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#111827;">
        <h2 style="color:#1f2937;font-size:20px;">Your task is waiting for you</h2>
        <p>You have an active task${ctx.taskTitle ? `: <strong>${ctx.taskTitle}</strong>` : " in your blueprint"}.</p>
        <p>It's ready whenever you are. Submit feedback when you're done and the system will generate your next step.</p>
        <p style="margin-top:24px;">
          <a href="${APP_URL}/dashboard" style="background:#2563eb;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">Return to your task</a>
        </p>
        ${footer(ctx.unsubscribeUrl, ctx.preferencesUrl, ctx.unsubscribeAllUrl)}
      </div>`,
    text: `Your next task is ready.\n\n${ctx.taskTitle ? `Task: ${ctx.taskTitle}\n\n` : ""}Return to your execution: ${APP_URL}/dashboard${textFooter(ctx.unsubscribeUrl)}`,
  };
}

export function buildMilestoneAchieved(ctx: NotificationContext): EmailContent {
  const title = ctx.milestoneTitle ?? "Milestone reached";
  const desc = ctx.milestoneDesc ?? "A verified result from your execution.";

  return {
    subject: `You reached a milestone — ${title}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#111827;">
        <h2 style="color:#1f2937;font-size:20px;">${title}</h2>
        <p>${desc}</p>
        <p>This is a verified result from your execution. See your full progress on the dashboard.</p>
        <p style="margin-top:24px;">
          <a href="${APP_URL}/dashboard" style="background:#2563eb;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">See your progress</a>
        </p>
        ${footer(ctx.unsubscribeUrl, ctx.preferencesUrl, ctx.unsubscribeAllUrl)}
      </div>`,
    text: `${title}\n\n${desc}\n\nSee your progress: ${APP_URL}/dashboard${textFooter(ctx.unsubscribeUrl)}`,
  };
}

export function buildBlueprintCompleted(ctx: NotificationContext): EmailContent {
  const goal = ctx.goalText?.slice(0, 80) ?? "your goal";
  const tasks = ctx.tasksCompleted ?? 0;
  const days = ctx.executionDays ?? 0;

  return {
    subject: `Goal complete — ${goal}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#111827;">
        <h2 style="color:#1f2937;font-size:20px;">Blueprint complete</h2>
        <p>Your execution of <strong>${goal}</strong> is complete.</p>
        <p>The system verified ${tasks} execution cycles across ${days} days. Your execution history and capability are preserved and carry forward to your next goal.</p>
        <p style="margin-top:24px;">
          <a href="${APP_URL}/dashboard" style="background:#2563eb;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">View your results and start a new goal</a>
        </p>
        ${footer(ctx.unsubscribeUrl, ctx.preferencesUrl, ctx.unsubscribeAllUrl)}
      </div>`,
    text: `Blueprint complete.\n\nYour execution of "${goal}" is complete. ${tasks} tasks completed across ${days} days.\n\nStart your next goal: ${APP_URL}/dashboard${textFooter(ctx.unsubscribeUrl)}`,
  };
}

export function buildPivotReviewReady(ctx: NotificationContext): EmailContent {
  const goal = ctx.goalText?.slice(0, 60) ?? "your goal";

  return {
    subject: `Direction review ready — ${goal}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#111827;">
        <h2 style="color:#1f2937;font-size:20px;">A direction review is ready for you</h2>
        <p>Your execution signals suggest a review may be useful for <strong>${goal}</strong>.</p>
        <p>The system has prepared three path options. You can continue as-is, adjust your approach, or change direction. The choice is yours.</p>
        <p style="margin-top:24px;">
          <a href="${APP_URL}/dashboard" style="background:#2563eb;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">Review your options</a>
        </p>
        ${footer(ctx.unsubscribeUrl, ctx.preferencesUrl, ctx.unsubscribeAllUrl)}
      </div>`,
    text: `A direction review is ready.\n\nThe system has prepared three execution path options for "${goal}". Review and choose your direction.\n\nOpen review: ${APP_URL}/dashboard${textFooter(ctx.unsubscribeUrl)}`,
  };
}

export function buildBlueprintPaused(ctx: NotificationContext): EmailContent {
  const goal = ctx.goalText?.slice(0, 80) ?? "your goal";

  return {
    subject: `Your execution is paused — ${goal}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#111827;">
        <h2 style="color:#1f2937;font-size:20px;">Your blueprint has been paused</h2>
        <p>Your execution of <strong>${goal}</strong> is paused. Your position, progress, and signal history are preserved.</p>
        <p>You can resume at any time. The system will determine the best re-entry mode based on how long you've been away.</p>
        <p style="margin-top:24px;">
          <a href="${APP_URL}/dashboard" style="background:#2563eb;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">Resume when ready</a>
        </p>
        ${footer(ctx.unsubscribeUrl, ctx.preferencesUrl, ctx.unsubscribeAllUrl)}
      </div>`,
    text: `Your blueprint has been paused.\n\nExecution of "${goal}" is paused. Your position is preserved. Resume any time: ${APP_URL}/dashboard${textFooter(ctx.unsubscribeUrl)}`,
  };
}

export function buildWeeklySummary(ctx: NotificationContext): EmailContent {
  const goal = ctx.goalText?.slice(0, 80) ?? "your goal";
  const tasks = ctx.weeklyTasks ?? 0;
  const condition = ctx.conditionName ?? "active";
  const trend = ctx.weeklyTrend ?? "stable";

  return {
    subject: `Your week — ${goal}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#111827;">
        <h2 style="color:#1f2937;font-size:20px;">Your execution week</h2>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:8px 0;color:#6b7280;">Tasks completed</td><td style="padding:8px 0;font-weight:bold;">${tasks}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;">Current condition</td><td style="padding:8px 0;font-weight:bold;text-transform:capitalize;">${condition}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;">Trend</td><td style="padding:8px 0;font-weight:bold;text-transform:capitalize;">${trend}</td></tr>
        </table>
        <p style="margin-top:24px;">
          <a href="${APP_URL}/dashboard" style="background:#2563eb;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">Open dashboard</a>
        </p>
        ${footer(ctx.unsubscribeUrl, ctx.preferencesUrl, ctx.unsubscribeAllUrl)}
      </div>`,
    text: `Your execution week for "${goal}".\n\nTasks completed: ${tasks}\nCondition: ${condition}\nTrend: ${trend}\n\nView dashboard: ${APP_URL}/dashboard${textFooter(ctx.unsubscribeUrl)}`,
  };
}
