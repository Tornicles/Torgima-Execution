export interface ErectorDashboardPanels {
  activeBlueprintId: string | null;
  recentValidations: Array<{
    id: string;
    name: string;
    description: string;
    verdict: string;
    verdictLabel: string;
    date: string;
    realityScorePercent: number;
    href: string;
  }>;
  simulationScenarios: Array<{
    id: string;
    question: string;
    projectName: string | null;
    impactPercent: number;
    impactLabel: string;
    condition: string;
    href: string | null;
  }>;
  industrySnapshot: {
    available: boolean;
    validationId: string | null;
    marketMomentum: { status: string; changeLabel: string | null };
    competitionLevel: { status: string; subtext: string };
    opportunityWindow: { status: string; subtext: string; percent: number };
    riskLevel: { status: string; subtext: string };
    topOpportunity: { title: string; description: string };
    insight: string | null;
    href: string | null;
  };
  learningProgress: Array<{
    id: string;
    courseName: string;
    courseType: string;
    progressPercent: number;
    action: "Continue" | "Review";
    href: string;
  }>;
  links: {
    simulatorHref: string | null;
    industryHref: string | null;
  };
}
