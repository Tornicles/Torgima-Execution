import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function CapabilityPage() {
  return (
    <div className="p-8 max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="font-mono">CAPABILITY</CardTitle>
          <CardDescription className="font-mono text-xs">Capability overview (placeholder)</CardDescription>
        </CardHeader>
        <CardContent className="font-mono text-sm text-muted-foreground">
          Wire this view to capability APIs when ready.
        </CardContent>
      </Card>
    </div>
  );
}
