import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Browser UI for notification unsubscribe; token handling can be added when wired to API. */
export default function UnsubscribePage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <Card className="max-w-lg w-full">
        <CardHeader>
          <CardTitle className="font-mono">NOTIFICATIONS — UNSUBSCRIBE</CardTitle>
          <CardDescription className="font-mono text-xs">
            If you followed an email link, your preferences are processed server-side. This page is a
            fallback confirmation.
          </CardDescription>
        </CardHeader>
        <CardContent className="font-mono text-sm text-muted-foreground">
          Contact support if you still receive unwanted messages.
        </CardContent>
      </Card>
    </div>
  );
}
