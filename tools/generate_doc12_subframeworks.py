import json
import os
import re
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Dict, List, Optional, Tuple


ROOT = Path(__file__).resolve().parents[1]
EXTRACT_DIR = ROOT / "_bhudhi_frameworks_extracted"
OUT_JSON = ROOT / "_bhudhi_frameworks_extracted" / "_parsed_460_frameworks.json"
OUT_MD = ROOT / "DOC_12_460_SUBFRAMEWORKS_CATEGORIZATION.md"


HEADER_RE = re.compile(r"^(?P<num>\d{1,3})\.\s+(?P<name>.+?)\s*$")
KV_RE = re.compile(r"^(?P<key>[A-Za-z][A-Za-z\s&/-]+?):\s*(?P<val>.*)$")
LIFECYCLE_STEP_RE = re.compile(r"^\s*(\d+)\.\s+(.*)$")


PARENT_FRAMEWORKS = [
    "STRATEGYCORE X",
    "DECISIONVELOCITY X",
    "GOVERNANCE & RISK X",
    "SYNERGYOPS X",
    "FINMATRIX X",
    "OMNIGROWTH X",
    "TALENTSYNC X",
    "CULTUREDYNAMICS X",
    "KNOWLEDGEFLOW X",
    "REGENERATION & EXIT X",
    "CUSTOMERVALUE X",
    "ADAPTIVEINTELLIGENCE X",
    "ALIGNMENT & ACCOUNTABILITY X",
    "CLARITY CATALYST",
]


def normalize_key(k: str) -> str:
    k = k.strip().lower()
    k = re.sub(r"\s+", " ", k)
    return k


def detect_category(domain: str, name: str) -> str:
    """
    Map to required category bucket:
    Understanding/Reasoning/Simulation/Validation/Memory/Signals/Condition/Execution/Governance/Evolution
    """
    d = (domain or "").lower()
    n = (name or "").lower()
    if "validation" in d or "validation" in n or "verify" in n:
        return "Validation"
    if "memory" in d or "knowledge" in d or "memory" in n or "knowledge" in n:
        return "Memory"
    if "signal" in d or "signal" in n or "sensing" in n:
        return "Signals"
    if "condition" in d or "condition" in n:
        return "Condition"
    if "execution" in d or "operations" in d or "workflow" in d or "execution" in n:
        return "Execution"
    if "governance" in d or "risk" in d or "compliance" in d or "policy" in d or "govern" in n:
        return "Governance"
    if "simulation" in d or "simulation" in n or "scenario" in n:
        return "Simulation"
    if "evolution" in d or "evolution" in n or "adapt" in n or "adaptive" in n:
        return "Evolution"
    if "reason" in n or "inference" in n or "thinking" in n or "intelligence" in d:
        return "Reasoning"
    return "Understanding"


def detect_parent_framework(domain: str, name: str, output: str, handoff: str) -> str:
    """
    Heuristic assignment to one of 14 Torgima frameworks.
    The volumes do not explicitly name the parent; we infer from domain/name/output/handoff keywords.
    """
    text = " | ".join([(domain or ""), (name or ""), (output or ""), (handoff or "")]).lower()

    # Hard signals first
    if any(k in text for k in ["cash", "capital", "runway", "budget", "liquidity", "burn"]):
        return "FINMATRIX X"
    if any(k in text for k in ["risk", "governance", "compliance", "sanction", "permission", "prohibit", "contain"]):
        return "GOVERNANCE & RISK X"
    if any(k in text for k in ["wip", "flow", "throughput", "handoff", "bottleneck", "execution stability", "work routing"]):
        return "SYNERGYOPS X"
    if any(k in text for k in ["demand", "conversion", "cac", "channel", "retention", "scale", "growth"]):
        return "OMNIGROWTH X"
    if any(k in text for k in ["customer", "value", "journey", "trust", "experience", "promise", "churn"]):
        return "CUSTOMERVALUE X"
    if any(k in text for k in ["role", "capability", "leadership", "succession", "burnout", "talent"]):
        return "TALENTSYNC X"
    if any(k in text for k in ["culture", "norm", "toxicity", "behavior", "reinforce", "sanction", "inoculation"]):
        return "CULTUREDYNAMICS X"
    if any(k in text for k in ["knowledge", "memory", "archive", "index", "retrieve", "decay"]):
        return "KNOWLEDGEFLOW X"
    if any(k in text for k in ["adapt", "signal scout", "scenario", "trigger threshold", "evolve", "rollback"]):
        return "ADAPTIVEINTELLIGENCE X"
    if any(k in text for k in ["ownership", "accountability", "incentive", "decision rights", "escalation", "conflict"]):
        return "ALIGNMENT & ACCOUNTABILITY X"
    if any(k in text for k in ["sunset", "exit", "reset", "renew", "decommission", "liberate"]):
        return "REGENERATION & EXIT X"
    if any(k in text for k in ["clarity", "identity", "audience", "value extraction", "direction compass", "priority structuring"]):
        return "CLARITY CATALYST"

    # Decision mechanics vs strategy mechanics
    if any(k in text for k in ["deadline", "bias", "decision register", "escalation packet", "classification", "reversibility"]):
        return "DECISIONVELOCITY X"
    if any(k in text for k in ["strategy", "where to play", "how to win", "tradeoff", "winning", "capability gate"]):
        return "STRATEGYCORE X"

    # Default: core cognition tends to feed StrategyCore/DecisionVelocity; choose StrategyCore for "strategic" names otherwise DV.
    if "strateg" in text:
        return "STRATEGYCORE X"
    return "DECISIONVELOCITY X"


@dataclass
class FrameworkRecord:
    number: int
    name: str
    domain: str
    primary_output: str
    purpose: str
    problem_it_solves: str
    inputs: str
    how_it_solves: str
    operating_lifecycle: List[str]
    output_spec: str
    validation_method: str
    success_metrics: str
    failure_modes: str
    evolution_behavior: str
    bhudhi_handoff: str
    category: str
    parent_framework: str

    # Fields required by DOC_12, even if not explicitly specified in volumes
    activation_rules: str
    input_requirements: str
    decision_logic: str
    output_format: str
    constraint_rules: str
    relationships: str
    integration_points: str


def parse_volume(path: Path) -> Tuple[List[Tuple[int, str, str]], Dict[int, FrameworkRecord]]:
    """
    Returns:
      - table rows: (num, name, domain) from the initial index table
      - records: parsed framework bodies keyed by number
    """
    lines = path.read_text(encoding="utf-8", errors="replace").splitlines()

    # Phase 1: pull index-like table at top (num, name, domain, output) by scanning early lines until first "1. ..."
    table: List[Tuple[int, str, str]] = []
    i = 0
    while i < len(lines):
        m = HEADER_RE.match(lines[i].strip())
        if m:
            # We are at body section header; stop table scan only if next line looks like "Domain:"
            if i + 1 < len(lines) and lines[i + 1].strip().lower().startswith("domain:"):
                break
        i += 1

    # No need to perfectly parse table; we will parse bodies as source of truth.

    # Phase 2: parse framework bodies
    records: Dict[int, FrameworkRecord] = {}
    cur_num: Optional[int] = None
    cur_name: Optional[str] = None
    cur: Dict[str, object] = {}
    lifecycle: List[str] = []
    in_lifecycle = False

    def flush():
        nonlocal cur_num, cur_name, cur, lifecycle, in_lifecycle
        if cur_num is None or cur_name is None:
            return

        domain = str(cur.get("domain", "")).strip()
        primary_output = str(cur.get("primary output", "")).strip()
        purpose = str(cur.get("purpose", "")).strip()
        problem = str(cur.get("problem it solves", "")).strip()
        inputs = str(cur.get("inputs", "")).strip()
        how = str(cur.get("how it solves the problem", "")).strip()
        output_spec = str(cur.get("output", "")).strip()
        validation_method = str(cur.get("validation method", "")).strip()
        success_metrics = str(cur.get("success metrics", "")).strip()
        failure_modes = str(cur.get("failure modes", "")).strip()
        evolution_behavior = str(cur.get("evolution behavior", "")).strip()
        bhudhi_handoff = str(cur.get("bhudhi handoff", "")).strip()

        category = detect_category(domain, cur_name)
        parent = detect_parent_framework(domain, cur_name, output_spec or primary_output, bhudhi_handoff)

        # Derive required DOC_12 fields (explicit when available; otherwise doctrinally inferred)
        activation_rules = (
            "Triggers when a question/event/decision pressure arises in this domain; "
            "activates when required inputs are present and the system routes to this framework’s output object."
        )
        input_requirements = inputs or "Not explicitly specified beyond Inputs field."
        decision_logic = (
            "Implements the listed Operating lifecycle steps; scores/validates according to Success metrics and Validation method; "
            "handles failures via Failure modes and evolves via Evolution behavior."
        )
        output_format = output_spec or (primary_output and f"Produces: {primary_output}.") or "Not explicitly specified."
        constraint_rules = (
            "Must remain aligned with context, evidence, and intent; invalid outputs are rejected by Validation method; "
            "evolution updates thresholds/routing/assumptions as described."
        )
        relationships = (
            "Works with adjacent layers via Bhudhi handoff (validation/memory/simulation/governance/execution/evolution). "
            "Exact dependencies/conflicts are not enumerated in the volume text."
        )
        integration_points = (
            "Appears in Bhudhi reasoning when its domain output is needed; routes via Bhudhi handoff to downstream layers."
        )

        rec = FrameworkRecord(
            number=cur_num,
            name=cur_name,
            domain=domain,
            primary_output=primary_output,
            purpose=purpose,
            problem_it_solves=problem,
            inputs=inputs,
            how_it_solves=how,
            operating_lifecycle=list(lifecycle),
            output_spec=output_spec,
            validation_method=validation_method,
            success_metrics=success_metrics,
            failure_modes=failure_modes,
            evolution_behavior=evolution_behavior,
            bhudhi_handoff=bhudhi_handoff,
            category=category,
            parent_framework=parent,
            activation_rules=activation_rules,
            input_requirements=input_requirements,
            decision_logic=decision_logic,
            output_format=output_format,
            constraint_rules=constraint_rules,
            relationships=relationships,
            integration_points=integration_points,
        )
        records[cur_num] = rec

        # reset
        cur_num = None
        cur_name = None
        cur = {}
        lifecycle = []
        in_lifecycle = False

    for raw in lines:
        line = raw.strip()
        if not line:
            continue

        m = HEADER_RE.match(line)
        if m:
            flush()
            cur_num = int(m.group("num"))
            cur_name = m.group("name").strip()
            cur = {}
            lifecycle = []
            in_lifecycle = False
            continue

        if cur_num is None:
            continue

        # Detect lifecycle steps
        if normalize_key(line) == "operating lifecycle:":
            in_lifecycle = True
            continue

        if in_lifecycle:
            sm = LIFECYCLE_STEP_RE.match(line)
            if sm:
                lifecycle.append(sm.group(2).strip())
                continue
            # if lifecycle block ends when we hit a KV
            if KV_RE.match(line):
                in_lifecycle = False
            else:
                # tolerate stray lines
                continue

        km = KV_RE.match(line)
        if km:
            key = normalize_key(km.group("key"))
            val = km.group("val").strip()
            cur[key] = val
            continue

    flush()
    return table, records


def main():
    if not EXTRACT_DIR.exists():
        raise SystemExit(f"Missing extracted directory: {EXTRACT_DIR}")

    volume_paths = sorted(EXTRACT_DIR.glob("Bhudhi_Frameworks_Volume_*.txt"))
    if not volume_paths:
        raise SystemExit(f"No volume text files found in {EXTRACT_DIR}")

    all_records: Dict[int, FrameworkRecord] = {}
    for vp in volume_paths:
        _, recs = parse_volume(vp)
        for n, r in recs.items():
            if n in all_records:
                raise SystemExit(f"Duplicate framework number {n} in {vp.name}")
            all_records[n] = r

    missing = [n for n in range(1, 461) if n not in all_records]
    if missing:
        raise SystemExit(f"Missing frameworks: {missing[:20]}{'...' if len(missing)>20 else ''}")

    # Write JSON for debugging/auditing
    OUT_JSON.write_text(
        json.dumps({k: asdict(v) for k, v in sorted(all_records.items())}, indent=2),
        encoding="utf-8",
    )

    # Group by parent framework
    grouped: Dict[str, List[FrameworkRecord]] = {p: [] for p in PARENT_FRAMEWORKS}
    for rec in all_records.values():
        grouped.setdefault(rec.parent_framework, []).append(rec)

    for p in grouped:
        grouped[p].sort(key=lambda r: r.number)

    # Build markdown
    md: List[str] = []
    md.append("## DOC_12_460_SUBFRAMEWORKS_CATEGORIZATION")
    md.append("")
    md.append("**Source of truth**: `._bhudhi_frameworks_extracted/Bhudhi_Frameworks_Volume_*.txt` (extracted from the 15 provided `.docx` volumes).")
    md.append("")
    md.append("**Parent-framework assignment note**: The volume text does not explicitly label a Torgima parent framework per sub-framework. Parent assignment in this document is therefore produced via deterministic keyword heuristics over each framework’s `Domain`, `Name`, `Output`, and `Bhudhi handoff` fields, and should be treated as an initial routing map for implementation (override as needed if a future canonical mapping is provided).")
    md.append("")
    md.append("---")
    md.append("")
    md.append("## Section 1: Framework Categorization by Parent")
    md.append("")

    for idx, parent in enumerate(PARENT_FRAMEWORKS, start=1):
        items = grouped.get(parent, [])
        md.append(f"## GROUP {idx}: {parent} ({len(items)} sub-frameworks)")
        md.append("")
        # Category within parent: by detected Category field
        by_cat: Dict[str, List[FrameworkRecord]] = {}
        for r in items:
            by_cat.setdefault(r.category, []).append(r)
        for cat in sorted(by_cat.keys()):
            md.append(f"### Category: {cat} ({len(by_cat[cat])})")
            md.append("")
            for r in by_cat[cat]:
                trig_type = "domain-based"
                md.append(f"- Framework {r.number}: {r.name}")
                md.append(f"  Purpose: {r.purpose}")
                md.append(f"  Triggers: {trig_type} (derived from domain `{r.domain}` and lifecycle step 1)")
                md.append(f"  Parent Authority: Advisory")
                md.append("")

    md.append("---")
    md.append("")
    md.append("## Section 2: Framework Registry (Numerical)")
    md.append("")
    for n in range(1, 461):
        r = all_records[n]
        md.append(f"- **{r.number}** — **{r.name}**")
        md.append(f"  - Parent: `{r.parent_framework}`")
        md.append(f"  - Category: `{r.category}`")
        md.append(f"  - Domain: `{r.domain}`")
        md.append(f"  - One-line purpose: {r.purpose}")
        md.append(f"  - Activation trigger type: domain-based")
    md.append("")

    md.append("---")
    md.append("")
    md.append("## Section 3: Cross-Reference Matrix")
    md.append("")
    md.append("The volume text provides a generic **Bhudhi handoff** field (routes to validation/memory/simulation/governance/execution/evolution). It does **not** enumerate explicit per-framework dependency/conflict/override lists. This section is therefore represented as:")
    md.append("")
    md.append("- **Works together**: inferred by shared parent framework + shared Bhudhi handoff target layer")
    md.append("- **Depends on**: inferred by frameworks that mention validation thresholds/evidence/memory records in Inputs and lifecycle")
    md.append("- **Blocks / overrides**: not explicitly enumerated in the volumes; reserved for future authoritative mapping")
    md.append("")

    md.append("---")
    md.append("")
    md.append("## Section 4: Activation Trigger Library")
    md.append("")
    md.append("- **Signal-based triggers**: not explicitly enumerated per framework; signals appear implicitly in Inputs (e.g., `signals`, `evidence`, `thresholds`, `system history`).")
    md.append("- **Condition-based triggers**: not explicitly enumerated per framework; conditions appear implicitly as validation thresholds and context constraints.")
    md.append("- **Domain-based triggers**: primary trigger type used in this document (each framework activates when its domain output object is required).")
    md.append("- **Time-based triggers**: not explicitly enumerated.")
    md.append("- **Manual triggers**: not explicitly enumerated.")
    md.append("")

    md.append("---")
    md.append("")
    md.append("## Section 5: Decision Logic Patterns")
    md.append("")
    md.append("Across the volumes, the dominant shared pattern is **cascade logic** via the 8-step `Operating lifecycle`. Additional patterns appear implicitly via scoring/threshold/validation language:")
    md.append("")
    md.append("- **Cascade logic** (step 1 → … → step 8)")
    md.append("- **Weighted scoring** (confidence/usefulness/risk/alignment scoring step)")
    md.append("- **Confidence-based validation** (confidence calibration and confidence outputs)")
    md.append("- **Threshold validation** (truth/consistency/confidence/risk thresholds in validation-themed domains)")
    md.append("")

    md.append("---")
    md.append("")
    md.append("## Section 6: Integration with Torgima")
    md.append("")
    md.append("Integration points are derived from each framework’s `Domain`, `Inputs`, and `Bhudhi handoff`. A future Torgima execution-loop spec should map these to concrete engine calls. For now:")
    md.append("")
    md.append("- **Goal validation**: frameworks whose names/domains include `Goal`, `Objective`, `Validation`")
    md.append("- **Task generation**: frameworks whose primary output implies execution objects")
    md.append("- **Signal calculation**: frameworks whose names/domains include `Signal` or inputs mention `signals`")
    md.append("- **Condition evaluation**: frameworks whose names/domains include `Condition` or validation thresholds")
    md.append("- **Control engine**: governance/validation/decision frameworks")
    md.append("- **Feedback processing**: evolution/learning frameworks (e.g., meta learning / evolution behavior fields)")
    md.append("")

    md.append("---")
    md.append("")
    md.append("## Section 7: Integration with Bhudhi (46 questions mapping)")
    md.append("")
    md.append("The 15 volume documents do not contain the canonical `46 questions` list, so exact Q1–Q46 mapping cannot be produced from these sources alone. Once the 46-question catalog is provided, mapping should be generated by:")
    md.append("- routing each question to a parent framework (DOC_11 authority order)")
    md.append("- selecting sub-frameworks within that parent whose `Domain` and `Primary Output` match the question’s required evidence object")
    md.append("")

    md.append("---")
    md.append("")
    md.append("## Section 8: Integration with Erector")
    md.append("")
    md.append("The volume documents do not specify NPC types or scenario bindings. Recommended approach: use each framework’s `Failure modes` and `Validation method` to design scenarios that teach correct usage and punish misuse under pressure.")
    md.append("")

    md.append("---")
    md.append("")
    md.append("## Section 9: Verification Checklist")
    md.append("")
    md.append("- [x] All 460 frameworks extracted")
    md.append("- [x] All 460 frameworks assigned to a parent framework (heuristic assignment)")
    md.append("- [ ] All 14 parent frameworks have correct sub-framework counts (requires canonical mapping; current counts reflect heuristic grouping)")
    md.append("- [x] Activation triggers documented (domain-based, derived)")
    md.append("- [x] Input/output specifications captured (via Inputs/Output fields)")
    md.append("- [ ] All relationships mapped (not explicitly enumerated in volume text)")
    md.append("- [ ] All integration points identified at engine-call granularity (requires Torgima loop + Bhudhi Q1–Q46 catalog + Erector schema)")
    md.append("- [x] No gaps or orphaned frameworks (1–460 complete)")
    md.append("")

    OUT_MD.write_text("\n".join(md) + "\n", encoding="utf-8")

    print(f"Wrote {OUT_JSON}")
    print(f"Wrote {OUT_MD}")


if __name__ == '__main__':
    main()

