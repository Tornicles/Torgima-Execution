import { Card, CardContent } from "@/components/ui/card";
import { TerminalSquare } from "lucide-react";

export default function IdentityPage() {
  return (
    <div className="h-full flex flex-col items-center justify-center p-8 animate-in fade-in">
      <Card className="max-w-md w-full bg-secondary/10 border-dashed border-2">
        <CardContent className="p-12 text-center space-y-4">
          <TerminalSquare className="w-12 h-12 text-muted-foreground/50 mx-auto" />
          <h2 className="text-xl font-bold font-mono tracking-widest text-muted-foreground">IDENTITY_MATRIX</h2>
          <p className="text-sm font-mono text-muted-foreground/80 uppercase">
            Module offline. Awaiting further instruction set.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
