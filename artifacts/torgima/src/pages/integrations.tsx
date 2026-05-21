import { useCallback, useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { apiGet, apiPost } from "@/lib/torgima-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Integration = {
  id: string;
  integration_type: string;
  is_connected: boolean;
  last_sync_status?: string;
  last_sync_time?: string;
};

type AutomationFlow = {
  id: string;
  name: string;
  trigger: string;
  is_active: boolean;
};

type CalendarConflict = {
  id: string;
  external_calendar: string;
  conflict_type: string;
  resolution_strategy: string;
};

const CALENDAR = ["google-calendar", "apple-calendar", "google-fit", "apple-health"] as const;
const NOTIFY = ["slack", "discord", "telegram"] as const;
const SOCIAL = ["linkedin", "twitter", "instagram", "facebook", "tiktok", "youtube"] as const;

export default function IntegrationsPage() {
  const [connected, setConnected] = useState<Integration[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [flows, setFlows] = useState<AutomationFlow[]>([]);
  const [conflicts, setConflicts] = useState<CalendarConflict[]>([]);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [telegramBot, setTelegramBot] = useState("");
  const [telegramChat, setTelegramChat] = useState("");
  const [publishText, setPublishText] = useState("");
  const [publishPlatforms, setPublishPlatforms] = useState("linkedin,twitter");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<
    "connections" | "notifications" | "social" | "automation" | "webhooks"
  >("connections");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [conn, typeRes, auto, conf] = await Promise.all([
        apiGet<{ integrations: Integration[] }>("/api/integrations/connected").catch(() => null),
        apiGet<{ types: string[] }>("/api/integrations/types").catch(() => null),
        apiGet<{ flows: AutomationFlow[] }>("/api/integrations/automation-flows").catch(() => null),
        apiGet<{ conflicts: CalendarConflict[] }>("/api/integrations/calendar/conflicts").catch(
          () => null,
        ),
      ]);
      if (conn?.integrations) setConnected(conn.integrations);
      if (typeRes?.types) setTypes(typeRes.types);
      if (auto?.flows) setFlows(auto.flows);
      if (conf?.conflicts) setConflicts(conf.conflicts as CalendarConflict[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function connect(type: string, path?: string) {
    const route = path ?? `/api/integrations/connect/${type}`;
    await apiPost(route, { code: `dev-${type}-${Date.now()}` });
    await load();
  }

  async function connectTelegram() {
    await apiPost("/api/integrations/telegram/connect", {
      botToken: telegramBot,
      chatId: telegramChat,
    });
    setTelegramBot("");
    setTelegramChat("");
    await load();
  }

  async function sync(id: string) {
    await apiPost(`/api/integrations/${id}/sync`, {});
    await load();
  }

  async function test(type: string) {
    await apiPost(`/api/integrations/test/${type}`, {});
  }

  async function resolveConflict(id: string, strategy: "torgima-wins" | "external-wins" | "manual") {
    await apiPost(`/api/integrations/calendar/conflicts/${id}/resolve`, {
      resolutionStrategy: strategy,
    });
    await load();
  }

  async function registerWebhook() {
    if (!webhookUrl) return;
    await apiPost("/api/integrations/webhooks/register", {
      eventType: "order-completed",
      webhookUrl,
    });
    setWebhookUrl("");
    await load();
  }

  async function createSampleFlow() {
    await apiPost("/api/integrations/automation-flows", {
      name: "High score celebration",
      trigger: "order-completed",
      triggerConditions: { minScore: 80 },
      actions: [
        { action: "award-xp", config: { amount: 100 } },
        { action: "send-notification", config: { message: "Great execution!" } },
        { action: "trigger-webhook", config: {} },
      ],
    });
    await load();
  }

  async function publishSocial() {
    const platforms = publishPlatforms.split(",").map((p) => p.trim()).filter(Boolean);
    await apiPost("/api/integrations/social/publish", {
      content: publishText,
      platforms,
    });
    setPublishText("");
    await load();
  }

  async function syncAllEngagement() {
    await apiPost("/api/integrations/social/sync-engagement", {});
  }

  function IntegrationCard({ type, connectPath }: { type: string; connectPath?: string }) {
    const row = connected.find((c) => c.integration_type === type);
    return (
      <Card key={type}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm capitalize">{type.replace(/-/g, " ")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-gray-500">
            {row?.is_connected ? `Connected · ${row.last_sync_status ?? "pending"}` : "Not connected"}
          </span>
          <div className="flex gap-1">
            {row ? (
              <>
                <Button size="sm" variant="outline" onClick={() => void sync(row.id)}>
                  Sync
                </Button>
                {NOTIFY.includes(type as (typeof NOTIFY)[number]) && (
                  <Button size="sm" variant="ghost" onClick={() => void test(type)}>
                    Test
                  </Button>
                )}
              </>
            ) : (
              <Button size="sm" onClick={() => void connect(type, connectPath)}>
                Connect
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Layout pageTitle="Integrations" pageSubtitle="Calendars, health, notifications, social, webhooks, Zapier">
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["connections", "Connections"],
              ["notifications", "Notifications"],
              ["social", "Social"],
              ["automation", "Automation"],
              ["webhooks", "Webhooks"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`px-3 py-1.5 text-sm rounded-md border ${
                tab === id ? "bg-green-50 border-green-600 text-green-800" : "border-gray-200 text-gray-600"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading && <p className="text-sm text-gray-500">Loading…</p>}

        {!loading && tab === "connections" && (
          <>
            {conflicts.length > 0 && (
              <Card className="border-amber-200 bg-amber-50">
                <CardHeader>
                  <CardTitle className="text-base text-amber-900">Calendar conflicts</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {conflicts.map((c) => (
                    <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span>
                        {c.external_calendar} · {c.conflict_type}
                      </span>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void resolveConflict(c.id, "torgima-wins")}
                        >
                          Torgima wins
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void resolveConflict(c.id, "manual")}
                        >
                          Manual
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Calendar & health</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {CALENDAR.map((t) => (
                  <IntegrationCard key={t} type={t} />
                ))}
              </div>
            </div>
            <p className="text-xs text-gray-400">
              {types.length} integration types available. OAuth uses server env credentials when set.
            </p>
          </>
        )}

        {!loading && tab === "notifications" && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <IntegrationCard type="slack" connectPath="/api/integrations/slack/connect" />
              <IntegrationCard type="discord" connectPath="/api/integrations/discord/connect" />
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Telegram</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Input
                  placeholder="Bot token"
                  value={telegramBot}
                  onChange={(e) => setTelegramBot(e.target.value)}
                />
                <Input
                  placeholder="Chat ID"
                  value={telegramChat}
                  onChange={(e) => setTelegramChat(e.target.value)}
                />
                <Button size="sm" onClick={() => void connectTelegram()}>
                  Connect Telegram
                </Button>
              </CardContent>
            </Card>
          </>
        )}

        {!loading && tab === "social" && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              {SOCIAL.map((t) => (
                <IntegrationCard
                  key={t}
                  type={t}
                  connectPath={
                    t === "linkedin" || t === "twitter"
                      ? `/api/integrations/${t}/connect`
                      : undefined
                  }
                />
              ))}
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Multi-platform publish</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Textarea
                  placeholder="Post content…"
                  value={publishText}
                  onChange={(e) => setPublishText(e.target.value)}
                  rows={3}
                />
                <Input
                  placeholder="Platforms (comma-separated)"
                  value={publishPlatforms}
                  onChange={(e) => setPublishPlatforms(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => void publishSocial()} disabled={!publishText}>
                    Publish
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void syncAllEngagement()}>
                    Sync all engagement
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {!loading && tab === "automation" && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Automation flows</CardTitle>
              <Button size="sm" variant="outline" onClick={() => void createSampleFlow()}>
                Add sample flow
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {flows.length === 0 && (
                <p className="text-sm text-gray-500">
                  Flows run on order completion (webhooks + XP + notifications).
                </p>
              )}
              {flows.map((f) => (
                <div key={f.id} className="flex justify-between text-sm border-b border-gray-100 py-2">
                  <span className="font-medium">{f.name}</span>
                  <span className="text-gray-500">
                    {f.trigger} · {f.is_active ? "active" : "paused"}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {!loading && tab === "webhooks" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Outbound webhooks</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Input
                placeholder="https://example.com/hooks/torgima"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
              />
              <Button onClick={() => void registerWebhook()}>Register</Button>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
