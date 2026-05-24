import { useGetSettings, useUpdateSettings } from "@workspace/api-client-react";
import { apiPatch } from "@/lib/torgima-api";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Settings as SettingsIcon, Save } from "lucide-react";
export default function SettingsPage() {
  const { data: settingsRes, isLoading } = useGetSettings();
  const updateSettings = useUpdateSettings();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    dailyTaskTarget: 3,
    notificationsEnabled: true,
    weeklyReviewDay: "sunday",
  });
  const [commProfile, setCommProfile] = useState({
    tone: "standard" as "direct" | "standard" | "warm",
    detailLevel: "standard" as "brief" | "standard" | "detailed",
  });

  useEffect(() => {
    if (settingsRes) {
      setFormData({
        dailyTaskTarget: settingsRes.dailyTaskTarget,
        notificationsEnabled: settingsRes.notificationsEnabled,
        weeklyReviewDay: settingsRes.weeklyReviewDay || "sunday",
      });
    }
  }, [settingsRes]);

  if (isLoading) {
    return (
      <div className="p-8 max-w-2xl mx-auto animate-pulse space-y-4">
        <div className="h-10 bg-gray-100 rounded-lg w-48" />
        <div className="h-64 bg-gray-100 rounded-2xl" />
      </div>
    );
  }

  const handleSave = async () => {
    updateSettings.mutate(
      { data: formData },
      {
        onSuccess: () => {
          toast({ title: "Saved", description: "Your preferences were updated." });
        },
      },
    );
    await apiPatch("/api/me/communication-profile", commProfile).catch(() => null);
  };

  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto space-y-8 pb-16">
      <header className="space-y-2 border-b border-gray-200 pb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center border border-gray-200">
            <SettingsIcon className="w-5 h-5 text-gray-800" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
            <p className="text-sm text-gray-500 mt-0.5">Notifications and execution defaults</p>
          </div>
        </div>
      </header>

      <Link
        href="/settings/skills"
        className="block rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 text-sm text-indigo-900 hover:bg-indigo-50"
      >
        <span className="font-semibold">Execution skills</span>
        <span className="block text-xs text-indigo-700 mt-0.5">View capability scores and mastered skills</span>
      </Link>

      <Link
        href="/settings/profile"
        className="block rounded-2xl border border-green-100 bg-green-50/40 p-4 text-sm text-green-900 hover:bg-green-50"
      >
        <span className="font-semibold">Public profile</span>
        <span className="block text-xs text-green-700 mt-0.5">
          Privacy, shareable entries, embeddable widgets, pledges
        </span>
      </Link>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between gap-4 py-2">
          <div>
            <Label className="text-sm font-semibold text-gray-900">Notifications</Label>
            <p className="text-xs text-gray-500 mt-0.5">Alerts for orders and reviews</p>
          </div>
          <Switch
            checked={formData.notificationsEnabled}
            onCheckedChange={(c) => setFormData((p) => ({ ...p, notificationsEnabled: c }))}
          />
        </div>

        <div className="h-px bg-gray-100" />

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <Label className="text-sm font-semibold text-gray-900">Daily Order target</Label>
            <p className="text-xs text-gray-500 mt-0.5">Expected completed orders per day</p>
          </div>
          <Input
            type="number"
            value={formData.dailyTaskTarget}
            onChange={(e) => setFormData((p) => ({ ...p, dailyTaskTarget: parseInt(e.target.value, 10) || 1 }))}
            className="w-24 text-center border-gray-200"
            min={1}
            max={20}
          />
        </div>

        <div className="h-px bg-gray-100" />

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <Label className="text-sm font-semibold text-gray-900">Weekly review day</Label>
            <p className="text-xs text-gray-500 mt-0.5">When to prompt for reflection</p>
          </div>
          <Select
            value={formData.weeklyReviewDay}
            onValueChange={(v) => setFormData((p) => ({ ...p, weeklyReviewDay: v }))}
          >
            <SelectTrigger className="w-44 border-gray-200">
              <SelectValue placeholder="Select day" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="friday">Friday</SelectItem>
              <SelectItem value="saturday">Saturday</SelectItem>
              <SelectItem value="sunday">Sunday</SelectItem>
              <SelectItem value="monday">Monday</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="h-px bg-gray-100" />

        <div className="space-y-4">
          <p className="text-sm font-semibold text-gray-900">Communication preferences</p>
          <p className="text-xs text-gray-500">Shapes how system intelligence is phrased on your next session.</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-gray-600">Tone</Label>
              <Select
                value={commProfile.tone}
                onValueChange={(v) =>
                  setCommProfile((p) => ({ ...p, tone: v as typeof commProfile.tone }))
                }
              >
                <SelectTrigger className="mt-1 border-gray-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="direct">Direct</SelectItem>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="warm">Warm</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-gray-600">Detail level</Label>
              <Select
                value={commProfile.detailLevel}
                onValueChange={(v) =>
                  setCommProfile((p) => ({ ...p, detailLevel: v as typeof commProfile.detailLevel }))
                }
              >
                <SelectTrigger className="mt-1 border-gray-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="brief">Brief</SelectItem>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="detailed">Detailed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <Button
          type="button"
          onClick={() => void handleSave()}
          disabled={updateSettings.isPending}
          className="w-full h-12 rounded-xl bg-gray-900 text-white font-semibold hover:bg-gray-800"
        >
          <Save className="w-4 h-4 mr-2" /> Save changes
        </Button>
      </div>
    </div>
  );
}
