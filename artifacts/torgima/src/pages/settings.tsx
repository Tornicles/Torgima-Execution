import { useGetSettings, useUpdateSettings } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
    weeklyReviewDay: "sunday"
  });

  useEffect(() => {
    if (settingsRes) {
      setFormData({
        dailyTaskTarget: settingsRes.dailyTaskTarget,
        notificationsEnabled: settingsRes.notificationsEnabled,
        weeklyReviewDay: settingsRes.weeklyReviewDay || "sunday"
      });
    }
  }, [settingsRes]);

  if (isLoading) return <div className="p-8 text-mono">LOADING CONFIGURATION...</div>;

  const handleSave = () => {
    updateSettings.mutate({ data: formData }, {
      onSuccess: () => {
        toast({ title: "Configuration Updated", description: "System parameters saved." });
      }
    });
  };

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8 animate-in fade-in">
      <header className="space-y-2 border-b border-border pb-6">
        <h1 className="text-3xl font-bold font-mono tracking-tight flex items-center gap-3">
          <SettingsIcon className="w-8 h-8 text-primary" /> SYSTEM_CONFIG
        </h1>
      </header>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="font-mono text-lg">EXECUTION PARAMETERS</CardTitle>
          <CardDescription className="font-mono text-xs">Define your operational baselines.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 bg-secondary/10 p-5 rounded border border-border/50">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="font-mono font-bold text-sm">SYSTEM NOTIFICATIONS</Label>
                <div className="text-xs text-muted-foreground font-mono">Allow Torgima to enforce execution via alerts.</div>
              </div>
              <Switch
                checked={formData.notificationsEnabled}
                onCheckedChange={(c) => setFormData(p => ({ ...p, notificationsEnabled: c }))}
              />
            </div>

            <div className="pt-4 border-t border-border/50 flex items-center justify-between">
              <div className="space-y-0.5 w-1/2">
                <Label className="font-mono font-bold text-sm">DAILY YIELD TARGET</Label>
                <div className="text-xs text-muted-foreground font-mono">Expected completed orders per cycle.</div>
              </div>
              <Input
                type="number"
                value={formData.dailyTaskTarget}
                onChange={(e) => setFormData(p => ({ ...p, dailyTaskTarget: parseInt(e.target.value) || 1 }))}
                className="w-24 font-mono text-center bg-background"
                min={1}
                max={20}
              />
            </div>

            <div className="pt-4 border-t border-border/50 flex items-center justify-between">
              <div className="space-y-0.5 w-1/2">
                <Label className="font-mono font-bold text-sm">REVIEW CYCLE TRIGGER</Label>
                <div className="text-xs text-muted-foreground font-mono">Day designated for weekly feedback processing.</div>
              </div>
              <Select value={formData.weeklyReviewDay} onValueChange={(v) => setFormData(p => ({ ...p, weeklyReviewDay: v }))}>
                <SelectTrigger className="w-40 font-mono text-xs">
                  <SelectValue placeholder="Select day" />
                </SelectTrigger>
                <SelectContent className="font-mono text-xs">
                  <SelectItem value="friday">FRIDAY</SelectItem>
                  <SelectItem value="saturday">SATURDAY</SelectItem>
                  <SelectItem value="sunday">SUNDAY</SelectItem>
                  <SelectItem value="monday">MONDAY</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={handleSave}
            disabled={updateSettings.isPending}
            className="w-full font-mono font-bold tracking-widest h-12"
          >
            <Save className="w-4 h-4 mr-2" /> COMMIT CHANGES
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
