import { useAppRouteGuard } from "@/hooks/useAppRouteGuard";
import { useBhudhiBlueprint } from "@/hooks/useBhudhiBlueprint";
import {
  BhudhiUniversalLayout,
  parseBhudhiSection,
} from "@/components/bhudhi/universal/BhudhiUniversalLayout";
import { BhudhiHubView } from "@/components/bhudhi/BhudhiHubView";
import { OverviewSection } from "@/components/bhudhi/universal/sections/OverviewSection";
import { ExecutionSection } from "@/components/bhudhi/universal/sections/ExecutionSection";
import { IntelligenceSection } from "@/components/bhudhi/universal/sections/IntelligenceSection";
import { GovernanceSection } from "@/components/bhudhi/universal/sections/GovernanceSection";
import { MemorySection } from "@/components/bhudhi/universal/sections/MemorySection";
import { ProtocolSection } from "@/components/bhudhi/universal/sections/ProtocolSection";
import { SystemsSection } from "@/components/bhudhi/universal/sections/SystemsSection";
import { SettingsSection } from "@/components/bhudhi/universal/sections/SettingsSection";
import { MonitoringSection } from "@/components/bhudhi/universal/sections/MonitoringSection";
import { CertificationSection } from "@/components/bhudhi/universal/sections/CertificationSection";
import { ConvergenceSection } from "@/components/bhudhi/universal/sections/ConvergenceSection";
import { LaunchSection } from "@/components/bhudhi/universal/sections/LaunchSection";
import { CivilizationSection } from "@/components/bhudhi/universal/sections/CivilizationSection";
import { ExpansionSection } from "@/components/bhudhi/universal/sections/ExpansionSection";
import { useLocation } from "wouter";

function SectionContent({ section, blueprintId }: { section: string; blueprintId: string }) {
  switch (section) {
    case "execution":
      return <ExecutionSection blueprintId={blueprintId} />;
    case "intelligence":
      return <IntelligenceSection blueprintId={blueprintId} />;
    case "governance":
      return <GovernanceSection blueprintId={blueprintId} />;
    case "memory":
      return <MemorySection blueprintId={blueprintId} />;
    case "protocol":
      return <ProtocolSection blueprintId={blueprintId} />;
    case "systems":
      return <SystemsSection blueprintId={blueprintId} />;
    case "monitoring":
      return <MonitoringSection blueprintId={blueprintId} />;
    case "convergence":
      return <ConvergenceSection blueprintId={blueprintId} />;
    case "certification":
      return <CertificationSection blueprintId={blueprintId} />;
    case "launch":
      return <LaunchSection blueprintId={blueprintId} />;
    case "civilization":
      return <CivilizationSection blueprintId={blueprintId} />;
    case "expansion":
      return <ExpansionSection blueprintId={blueprintId} />;
    case "settings":
      return <SettingsSection blueprintId={blueprintId} />;
    default:
      return <BhudhiHubView blueprintId={blueprintId} />;
  }
}

export default function BhudhiUniversalPage() {
  const { checking } = useAppRouteGuard("post-launch");
  const blueprintId = useBhudhiBlueprint();
  const [location] = useLocation();
  const section = parseBhudhiSection(location);

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <p className="text-gray-500 text-sm">Loading…</p>
      </div>
    );
  }

  if (section === "overview") {
    return <BhudhiHubView blueprintId={blueprintId} />;
  }

  return (
    <BhudhiUniversalLayout blueprintId={blueprintId} section={section}>
      <SectionContent section={section} blueprintId={blueprintId} />
    </BhudhiUniversalLayout>
  );
}
