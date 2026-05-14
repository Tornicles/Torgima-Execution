import { useGetSettings, useUpdateSettings } from "@workspace/api-client-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
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

  const handleSave = () => {
    updateSettings.mutate(
      { data: formData },
      {
        onSuccess: () => {
          toast({ title: "Saved", description: "Your preferences were updated." });
        },
      },
    );
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
            <Label className="text-sm font-semibold text-gray-900">Daily task target</Label>
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

        <Button
          type="button"
          onClick={handleSave}
          disabled={updateSettings.isPending}
          className="w-full h-12 rounded-xl bg-gray-900 text-white font-semibold hover:bg-gray-800"
        >
          <Save className="w-4 h-4 mr-2" /> Save changes
        </Button>
      </div>
    </div>
  );
}
