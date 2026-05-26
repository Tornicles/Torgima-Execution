import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useGetMe, useGetSettings, useUpdateSettings } from "@workspace/api-client-react";
import { apiPatch } from "@/lib/torgima-api";
import { DashboardPageLayout } from "@/components/shell/DashboardPageLayout";
import { StickyFooter } from "@/components/design-system/StickyFooter";
import { Switch } from "@/components/ui/switch";
import { cards, buttons, PageLoading } from "@/design";
import { useToast } from "@/hooks/use-toast";

const INTEGRATIONS = [
  { name: "Google Calendar", connected: true },
  { name: "Notion", connected: true },
  { name: "Slack", connected: false },
  { name: "Email Notifications", connected: true },
  { name: "Zapier", connected: false },
];

const SYSTEM_TOGGLES = [
  { key: "autoAdaptation", label: "Auto Adaptation", defaultOn: true },
  { key: "aiRecommendations", label: "AI Recommendations", defaultOn: true },
  { key: "conditionExecution", label: "Condition-Based Execution", defaultOn: true },
  { key: "weeklySignals", label: "Weekly Signal Calculation", defaultOn: true },
  { key: "strictMode", label: "Strict Execution Mode", defaultOn: false },
  { key: "advancedData", label: "Show Advanced Data", defaultOn: false },
] as const;

export function SettingsDashboardView() {
  const { data: me, isLoading: meLoading } = useGetMe();
  const { data: settingsRes, isLoading: settingsLoading } = useGetSettings();
  const updateSettings = useUpdateSettings();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    dailyTaskTarget: 3,
    notificationsEnabled: true,
    weeklyReviewDay: "sunday",
  });
  const [toggles, setToggles] = useState<Record<string, boolean>>({});
  const [theme, setTheme] = useState<"light" | "dark" | "system">("light");

  useEffect(() => {
    if (settingsRes) {
      setFormData({
        dailyTaskTarget: settingsRes.dailyTaskTarget,
        notificationsEnabled: settingsRes.notificationsEnabled,
        weeklyReviewDay: settingsRes.weeklyReviewDay || "sunday",
      });
    }
  }, [settingsRes]);

  useEffect(() => {
    const initial: Record<string, boolean> = {};
    for (const t of SYSTEM_TOGGLES) initial[t.key] = t.defaultOn;
    setToggles(initial);
  }, []);

  if (meLoading || settingsLoading) return <PageLoading />;

  const displayName = me?.displayName ?? me?.email?.split("@")[0] ?? "Builder";
  const tier = me?.tier ?? "Premium";

  async function handleSave() {
    updateSettings.mutate(
      { data: formData },
      {
        onSuccess: () => toast({ title: "Saved", description: "Your preferences were updated." }),
      },
    );
    await apiPatch("/api/me/communication-profile", { tone: "standard", detailLevel: "standard" }).catch(() => null);
  }

  return (
    <DashboardPageLayout
      title="Settings"
      subtitle="Customize your experience. Control your system."
      footer={
        <StickyFooter
          message="Your settings shape your execution experience. Optimize everything."
          action={
            <button type="button" className={buttons.primary} onClick={() => void handleSave()}>
              Save Changes
            </button>
          }
        />
      }
    >
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className={cards.padded}>
            <p className="text-xs font-bold uppercase text-gray-500 mb-4">Account settings</p>
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-gray-800 text-white flex items-center justify-center text-lg font-bold">
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{displayName}</p>
                  <span className="text-xs font-bold text-emerald-600 uppercase">{tier} Plan</span>
                  <p className="text-sm text-gray-500 mt-1">{me?.email}</p>
                </div>
              </div>
              <div className="flex-1 grid sm:grid-cols-2 gap-3 min-w-[240px]">
                <label className="text-sm">
                  <span className="text-gray-500 block mb-1">Name</span>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2" defaultValue={displayName} readOnly />
                </label>
                <label className="text-sm">
                  <span className="text-gray-500 block mb-1">Daily Order target</span>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2"
                    value={formData.dailyTaskTarget}
                    onChange={(e) => setFormData((f) => ({ ...f, dailyTaskTarget: Number(e.target.value) }))}
                  />
                </label>
              </div>
            </div>
          </div>

          <div className={cards.padded}>
            <p className="text-xs font-bold uppercase text-gray-500 mb-4">Preferences</p>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Notifications</p>
                  <p className="text-xs text-gray-500">Choose what you want to be notified about</p>
                </div>
                <Switch
                  checked={formData.notificationsEnabled}
                  onCheckedChange={(v) => setFormData((f) => ({ ...f, notificationsEnabled: v }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Theme</p>
                  <p className="text-xs text-gray-500">Select your preferred appearance</p>
                </div>
                <div className="flex gap-1 border border-gray-200 rounded-lg p-0.5">
                  {(["light", "dark", "system"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTheme(t)}
                      className={`px-3 py-1 text-xs rounded-md capitalize ${theme === t ? "bg-emerald-50 text-emerald-700 font-semibold" : "text-gray-600"}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <label className="block text-sm">
                <span className="text-gray-500">Weekly review day</span>
                <select
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 capitalize"
                  value={formData.weeklyReviewDay}
                  onChange={(e) => setFormData((f) => ({ ...f, weeklyReviewDay: e.target.value }))}
                >
                  {["sunday", "monday", "friday"].map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
              <Link href="/settings/skills" className="text-sm text-emerald-600 font-medium hover:underline">
                Configure execution skills →
              </Link>
            </div>
          </div>

          <div className={cards.padded}>
            <p className="text-xs font-bold uppercase text-gray-500 mb-4">System settings</p>
            <div className="grid sm:grid-cols-2 gap-4">
              {SYSTEM_TOGGLES.map((t) => (
                <div key={t.key} className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">{t.label}</span>
                  <Switch
                    checked={toggles[t.key] ?? t.defaultOn}
                    onCheckedChange={(v) => setToggles((prev) => ({ ...prev, [t.key]: v }))}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className={cards.padded}>
            <div className="flex justify-between items-center mb-4">
              <p className="text-xs font-bold uppercase text-gray-500">Integrations</p>
              <Link href="/integrations" className="text-xs text-emerald-600 font-medium">
                Manage All →
              </Link>
            </div>
            <ul className="space-y-3 text-sm">
              {INTEGRATIONS.map((i) => (
                <li key={i.name} className="flex items-center justify-between">
                  <span>{i.name}</span>
                  <button type="button" className={i.connected ? buttons.secondary : buttons.primary}>
                    {i.connected ? "Manage" : "Connect"}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className={cards.padded}>
            <p className="text-xs font-bold uppercase text-gray-500 mb-4">Data management</p>
            <div className="space-y-2 text-sm">
              {["Export My Data", "Import Data", "Backup Now"].map((label) => (
                <div key={label} className="flex justify-between items-center">
                  <span>{label}</span>
                  <button type="button" className={buttons.secondary}>
                    {label.split(" ")[0]}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className={cards.padded}>
            <p className="text-xs font-bold uppercase text-gray-500 mb-4">System information</p>
            <dl className="text-sm space-y-2">
              <div className="flex justify-between">
                <dt className="text-gray-500">Plan</dt>
                <dd className="text-emerald-600 font-medium capitalize">{tier}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Plan Status</dt>
                <dd className="text-emerald-600 font-medium">Active</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </DashboardPageLayout>
  );
}
