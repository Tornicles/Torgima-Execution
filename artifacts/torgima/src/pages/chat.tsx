import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet, apiPost } from "@/lib/torgima-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Message = {
  id: string;
  messageType: string;
  content?: string;
  voiceTranscription?: string;
  isBlocker?: boolean;
  blockerType?: string;
  sentiment?: string;
  createdAt: string;
  tags: string[];
};

type InAppNotification = {
  id: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [blockers, setBlockers] = useState<unknown[]>([]);
  const [inApp, setInApp] = useState<InAppNotification[]>([]);
  const [tab, setTab] = useState<"chat" | "notifications">("chat");
  const [loading, setLoading] = useState(true);
  const [recording, setRecording] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [msgData, blockerData, notifData] = await Promise.all([
        apiGet<{ messages: Message[] }>("/api/chat/messages?limit=80"),
        apiGet<{ blockers: unknown[] }>("/api/chat/blockers?status=active"),
        apiGet<{ notifications: InAppNotification[] }>("/api/notifications/in-app?unread=true"),
      ]);
      if (msgData?.messages) setMessages(msgData.messages);
      if (blockerData?.blockers) setBlockers(blockerData.blockers);
      if (notifData?.notifications) setInApp(notifData.notifications);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  async function sendMessage() {
    if (!text.trim()) return;
    await apiPost("/api/chat/messages", {
      messageType: text.toLowerCase().includes("blocked") ? "blocker" : "text",
      content: text.trim(),
    });
    setText("");
    await load();
  }

  async function runSearch() {
    if (!searchQ.trim()) {
      await load();
      return;
    }
    const data = await apiGet<{ results: Message[] }>(
      `/api/chat/search?q=${encodeURIComponent(searchQ)}`,
    );
    if (data?.results) setMessages(data.results);
  }

  async function recordVoice() {
    setRecording(true);
    try {
      await apiPost("/api/chat/voice/record", {
        duration: 12,
        transcription: "Voice memo captured — wire Whisper for live transcript.",
      });
      await load();
    } finally {
      setRecording(false);
    }
  }

  async function quickStatus() {
    await apiPost("/api/chat/status", {
      status: "On track",
      energy: 7,
      clarity: 8,
      momentum: 7,
      notes: "Quick check-in from chat",
    });
    await load();
  }

  if (tab === "notifications") {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6">
        <header className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Notifications</h1>
          <Button variant="outline" size="sm" onClick={() => setTab("chat")}>
            Back to chat
          </Button>
        </header>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">In-app (unread)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {inApp.length === 0 ? (
              <p className="text-gray-500">No unread notifications.</p>
            ) : (
              inApp.map((n) => (
                <div key={n.id} className="border-b pb-2">
                  <p className="font-medium">{n.title}</p>
                  <p className="text-gray-600">{n.body}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <p className="text-xs text-gray-400">
          Connect Slack, Telegram, email, and SMS under Settings → Notifications (API:{" "}
          <code className="bg-gray-100 px-1 rounded">/api/notifications/channels/connect/:type</code>
          ).
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] max-w-2xl mx-auto md:border-x border-gray-100">
      <header className="p-4 border-b flex flex-wrap gap-2 items-center justify-between bg-white shrink-0">
        <div>
          <p className="text-[10px] font-bold uppercase text-violet-800">Personal</p>
          <h1 className="text-lg font-bold">Execution chat</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setTab("notifications")}>
            Alerts {inApp.length > 0 ? `(${inApp.length})` : ""}
          </Button>
          <Button variant="outline" size="sm" onClick={() => void quickStatus()}>
            Status
          </Button>
        </div>
      </header>

      {blockers.length > 0 ? (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 text-xs text-amber-900">
          {blockers.length} active blocker(s) logged from chat
        </div>
      ) : null}

      <div className="px-4 py-2 flex gap-2 border-b bg-gray-50 shrink-0">
        <input
          className="flex-1 text-sm border rounded-lg px-2 py-1"
          placeholder="Search messages…"
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void runSearch()}
        />
        <Button size="sm" variant="outline" onClick={() => void runSearch()}>
          Search
        </Button>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50">
        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">
            Your private execution log. Text, voice, blockers — searchable.
          </p>
        ) : (
          messages
            .slice()
            .reverse()
            .map((m) => (
              <div
                key={m.id}
                className={`max-w-[90%] ml-auto rounded-2xl rounded-br-md px-3 py-2 text-sm shadow-sm ${
                  m.isBlocker
                    ? "bg-amber-100 border border-amber-200"
                    : "bg-violet-600 text-white"
                }`}
              >
                <p className={m.isBlocker ? "text-amber-950" : ""}>
                  {m.content ?? m.voiceTranscription ?? `[${m.messageType}]`}
                </p>
                <p
                  className={`text-[10px] mt-1 ${m.isBlocker ? "text-amber-800" : "text-violet-200"}`}
                >
                  {new Date(m.createdAt).toLocaleString()}
                  {m.isBlocker && m.blockerType ? ` · ${m.blockerType}` : ""}
                  {m.sentiment ? ` · ${m.sentiment}` : ""}
                </p>
              </div>
            ))
        )}
      </div>

      <footer className="p-3 border-t bg-white shrink-0 space-y-2">
        <div className="flex gap-2">
          <textarea
            className="flex-1 border rounded-xl px-3 py-2 text-sm min-h-[44px] max-h-32 resize-none"
            placeholder="Log a thought, blocker, or reflection…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendMessage();
              }
            }}
          />
          <Button onClick={() => void sendMessage()} disabled={!text.trim()}>
            Send
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          disabled={recording}
          onClick={() => void recordVoice()}
        >
          {recording ? "Recording…" : "Voice memo (stub upload + transcript)"}
        </Button>
      </footer>
    </div>
  );
}
