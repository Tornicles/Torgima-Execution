import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AcademyPage() {
  return (
    <div className="p-8 max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="font-mono">ACADEMY</CardTitle>
          <CardDescription className="font-mono text-xs">Learning paths (placeholder)</CardDescription>
        </CardHeader>
        <CardContent className="font-mono text-sm text-muted-foreground">
          Connect academy content from the API when available.
        </CardContent>
      </Card>
    </div>
  );
}
