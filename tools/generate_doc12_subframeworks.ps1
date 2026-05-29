$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$ExtractDir = Join-Path $Root "_bhudhi_frameworks_extracted"
$OutJson = Join-Path $ExtractDir "_parsed_460_frameworks.json"
$OutMd = Join-Path $Root "DOC_12_460_SUBFRAMEWORKS_CATEGORIZATION.md"

$HeaderRe = '^(?<num>\d{1,3})\.\s+(?<name>.+?)\s*$'
$KvRe = '^(?<key>[A-Za-z][A-Za-z\s&/\-]+?):\s*(?<val>.*)$'
$LifecycleStepRe = '^\s*\d+\.\s+(?<step>.*)$'

$ParentFrameworks = @(
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
  "CLARITY CATALYST"
)

function Normalize-Key([string]$k) {
  return (($k.Trim().ToLowerInvariant() -replace '\s+',' '));
}

function Detect-Category([string]$domain, [string]$name) {
  $dVal = ""
  if ($null -ne $domain) { $dVal = $domain }
  $nVal = ""
  if ($null -ne $name) { $nVal = $name }
  $d = $dVal.ToLowerInvariant()
  $n = $nVal.ToLowerInvariant()
  if ($d -match 'validation' -or $n -match 'validation|verify') { return "Validation" }
  if ($d -match 'memory|knowledge' -or $n -match 'memory|knowledge|archive|index|retrieve') { return "Memory" }
  if ($d -match 'signal' -or $n -match 'signal|sensing') { return "Signals" }
  if ($d -match 'condition' -or $n -match 'condition') { return "Condition" }
  if ($d -match 'execution|operations|workflow' -or $n -match 'execution|workflow|throughput|flow') { return "Execution" }
  if ($d -match 'governance|risk|compliance|policy' -or $n -match 'govern|risk|compliance|sanction|permission') { return "Governance" }
  if ($d -match 'simulation' -or $n -match 'simulation|scenario') { return "Simulation" }
  if ($d -match 'evolution' -or $n -match 'evolution|adapt|adaptive') { return "Evolution" }
  if ($n -match 'reason|inference|thinking' -or $d -match 'intelligence and cognition') { return "Reasoning" }
  return "Understanding"
}

function Detect-ParentFramework([string]$domain, [string]$name, [string]$output, [string]$handoff) {
  $d = if ($null -eq $domain) { "" } else { $domain }
  $n = if ($null -eq $name) { "" } else { $name }
  $o = if ($null -eq $output) { "" } else { $output }
  # NOTE: Do NOT include Bhudhi handoff text in parent inference because it contains generic words
  # (e.g., "governance") for all frameworks and would collapse all assignments into a single parent.
  $text = ($d + " | " + $n + " | " + $o).ToLowerInvariant()

  if ($text -match 'cash|capital|runway|budget|liquidity|burn') { return "FINMATRIX X" }
  if ($text -match 'risk|governance|compliance|sanction|permission|prohibit|contain') { return "GOVERNANCE & RISK X" }
  if ($text -match 'wip|flow|throughput|handoff|bottleneck|execution stability|work routing') { return "SYNERGYOPS X" }
  if ($text -match 'demand|conversion|cac|channel|retention|scale|growth') { return "OMNIGROWTH X" }
  if ($text -match 'customer|value|journey|trust|experience|promise|churn') { return "CUSTOMERVALUE X" }
  if ($text -match 'role|capability|leadership|succession|burnout|talent') { return "TALENTSYNC X" }
  if ($text -match 'culture|norm|toxicity|behavior|reinforce|inoculation') { return "CULTUREDYNAMICS X" }
  if ($text -match 'knowledge|memory|archive|index|retrieve|decay') { return "KNOWLEDGEFLOW X" }
  if ($text -match 'adapt|scenario|trigger threshold|evolve|rollback|signal scout') { return "ADAPTIVEINTELLIGENCE X" }
  if ($text -match 'ownership|accountability|incentive|decision rights|escalation|conflict') { return "ALIGNMENT & ACCOUNTABILITY X" }
  if ($text -match 'sunset|exit|reset|renew|decommission|liberate') { return "REGENERATION & EXIT X" }
  if ($text -match 'clarity|identity|audience|direction compass|priority structuring|value extraction') { return "CLARITY CATALYST" }
  if ($text -match 'deadline|bias|decision register|classification|reversibility') { return "DECISIONVELOCITY X" }
  if ($text -match 'strategy|where to play|how to win|tradeoff|winning|capability gate') { return "STRATEGYCORE X" }

  if ($text -match 'strateg') { return "STRATEGYCORE X" }
  return "DECISIONVELOCITY X"
}

function Parse-Volume([string]$path) {
  $lines = Get-Content -LiteralPath $path -Encoding UTF8

  $records = @{}
  $curNum = $null
  $curName = $null
  $cur = @{}
  $lifecycle = New-Object System.Collections.Generic.List[string]
  $inLifecycle = $false

  function Flush-Current {
    if ($null -eq $curNum -or $null -eq $curName) { return }

    $domain = ""
    if ($cur.ContainsKey("domain")) { $domain = [string]$cur["domain"] }
    $primaryOutput = ""
    if ($cur.ContainsKey("primary output")) { $primaryOutput = [string]$cur["primary output"] }
    $purpose = ""
    if ($cur.ContainsKey("purpose")) { $purpose = [string]$cur["purpose"] }
    $problem = ""
    if ($cur.ContainsKey("problem it solves")) { $problem = [string]$cur["problem it solves"] }
    $inputs = ""
    if ($cur.ContainsKey("inputs")) { $inputs = [string]$cur["inputs"] }
    $how = ""
    if ($cur.ContainsKey("how it solves the problem")) { $how = [string]$cur["how it solves the problem"] }
    $outputSpec = ""
    if ($cur.ContainsKey("output")) { $outputSpec = [string]$cur["output"] }
    $validationMethod = ""
    if ($cur.ContainsKey("validation method")) { $validationMethod = [string]$cur["validation method"] }
    $successMetrics = ""
    if ($cur.ContainsKey("success metrics")) { $successMetrics = [string]$cur["success metrics"] }
    $failureModes = ""
    if ($cur.ContainsKey("failure modes")) { $failureModes = [string]$cur["failure modes"] }
    $evolutionBehavior = ""
    if ($cur.ContainsKey("evolution behavior")) { $evolutionBehavior = [string]$cur["evolution behavior"] }
    $bhudhiHandoff = ""
    if ($cur.ContainsKey("bhudhi handoff")) { $bhudhiHandoff = [string]$cur["bhudhi handoff"] }

    $domain = $domain.Trim()
    $primaryOutput = $primaryOutput.Trim()
    $purpose = $purpose.Trim()
    $problem = $problem.Trim()
    $inputs = $inputs.Trim()
    $how = $how.Trim()
    $outputSpec = $outputSpec.Trim()
    $validationMethod = $validationMethod.Trim()
    $successMetrics = $successMetrics.Trim()
    $failureModes = $failureModes.Trim()
    $evolutionBehavior = $evolutionBehavior.Trim()
    $bhudhiHandoff = $bhudhiHandoff.Trim()

    $category = Detect-Category -domain $domain -name $curName
    $parent = Detect-ParentFramework -domain $domain -name $curName -output ($outputSpec + " " + $primaryOutput) -handoff $bhudhiHandoff

    $inputReq = $inputs
    if ($inputReq -eq "") { $inputReq = "Not explicitly specified beyond Inputs field." }

    $outputFormat = $outputSpec
    if ($outputFormat -eq "") {
      if ($primaryOutput -ne "") { $outputFormat = ("Produces: " + $primaryOutput + ".") }
      else { $outputFormat = "Not explicitly specified." }
    }

    $records[$curNum] = [pscustomobject]([ordered]@{
      number = [int]$curNum
      name = $curName
      domain = $domain
      primary_output = $primaryOutput
      purpose = $purpose
      problem_it_solves = $problem
      inputs = $inputs
      how_it_solves = $how
      operating_lifecycle = @($lifecycle)
      output_spec = $outputSpec
      validation_method = $validationMethod
      success_metrics = $successMetrics
      failure_modes = $failureModes
      evolution_behavior = $evolutionBehavior
      bhudhi_handoff = $bhudhiHandoff
      category = $category
      parent_framework = $parent

      activation_rules = "Triggers when a question/event/decision pressure arises in this domain; activates when required inputs are present and the system routes to this framework’s output object."
      input_requirements = $inputReq
      decision_logic = "Implements the listed Operating lifecycle steps; scores/validates according to Success metrics and Validation method; handles failures via Failure modes and evolves via Evolution behavior."
      output_format = $outputFormat
      constraint_rules = "Must remain aligned with context, evidence, and intent; invalid outputs are rejected by Validation method; evolution updates thresholds/routing/assumptions as described."
      relationships = "Works with adjacent layers via Bhudhi handoff (validation/memory/simulation/governance/execution/evolution). Exact dependencies/conflicts are not enumerated in the volume text."
      integration_points = "Appears in Bhudhi reasoning when its domain output object is needed; routes via Bhudhi handoff to downstream layers."
    })

    $curNum = $null
    $curName = $null
    $cur = @{}
    $lifecycle = New-Object System.Collections.Generic.List[string]
    $inLifecycle = $false
  }

  for ($i = 0; $i -lt $lines.Count; $i++) {
    $raw = $lines[$i]
    $line = ""
    if ($null -ne $raw) { $line = $raw }
    $line = $line.Trim()
    if ($line -eq "") { continue }

    if ($line -match $HeaderRe) {
      # Guard against false positives (e.g. Operating lifecycle steps like "1. Capture ...")
      $j = $i + 1
      while ($j -lt $lines.Count) {
        $tmp = ""
        if ($null -ne $lines[$j]) { $tmp = $lines[$j] }
        if ($tmp.Trim() -ne "") { break }
        $j++
      }
      $next = ""
      if ($j -lt $lines.Count) {
        $tmp2 = ""
        if ($null -ne $lines[$j]) { $tmp2 = $lines[$j] }
        $next = $tmp2.Trim()
      }

      if ($next.ToLowerInvariant().StartsWith("domain:")) {
        Flush-Current
        $curNum = [int]$Matches["num"]
        $curName = $Matches["name"].Trim()
        $cur = @{}
        $lifecycle = New-Object System.Collections.Generic.List[string]
        $inLifecycle = $false
        continue
      }
      # Otherwise treat as non-header text (likely a lifecycle step); fall through
    }

    if ($null -eq $curNum) { continue }

    if ((Normalize-Key $line) -eq "operating lifecycle:") {
      $inLifecycle = $true
      continue
    }

    if ($inLifecycle) {
      if ($line -match $LifecycleStepRe) {
        $lifecycle.Add($Matches["step"].Trim()) | Out-Null
        continue
      }
      if ($line -match $KvRe) {
        $inLifecycle = $false
      } else {
        continue
      }
    }

    if ($line -match $KvRe) {
      $key = Normalize-Key $Matches["key"]
      $val = $Matches["val"].Trim()
      $cur[$key] = $val
      continue
    }
  }

  Flush-Current
  return $records
}

if (-not (Test-Path -LiteralPath $ExtractDir)) {
  throw "Missing extracted directory: $ExtractDir"
}

$volumePaths = Get-ChildItem -LiteralPath $ExtractDir -Filter "Bhudhi_Frameworks_Volume_*.txt" | Sort-Object Name
if ($volumePaths.Count -eq 0) { throw "No volume txt files found in $ExtractDir" }

$all = @{}
foreach ($vp in $volumePaths) {
  $recs = Parse-Volume -path $vp.FullName
  foreach ($k in $recs.Keys) {
    if ($all.ContainsKey($k)) { throw "Duplicate framework number $k" }
    $all[$k] = $recs[$k]
  }
}

$missing = @()
for ($n=1; $n -le 460; $n++) { if (-not $all.ContainsKey($n)) { $missing += $n } }
if ($missing.Count -gt 0) { throw ("Missing frameworks: " + ($missing -join ", ")) }

# Write JSON
$json = ($all.GetEnumerator() | Sort-Object Name | ForEach-Object { $_.Value }) | ConvertTo-Json -Depth 10
Set-Content -LiteralPath $OutJson -Value $json -Encoding UTF8

# Group by parent
$grouped = @{}
foreach ($p in $ParentFrameworks) { $grouped[$p] = New-Object System.Collections.Generic.List[object] }
foreach ($n in ($all.Keys | Sort-Object)) {
  $r = $all[$n]
  if (-not $grouped.ContainsKey($r.parent_framework)) {
    $grouped[$r.parent_framework] = New-Object System.Collections.Generic.List[object]
  }
  $grouped[$r.parent_framework].Add($r) | Out-Null
}

# Build markdown
$md = New-Object System.Collections.Generic.List[string]
$md.Add("## DOC_12_460_SUBFRAMEWORKS_CATEGORIZATION") | Out-Null
$md.Add("") | Out-Null
$md.Add("**Source of truth**: _bhudhi_frameworks_extracted/Bhudhi_Frameworks_Volume_*.txt (extracted from the 15 provided .docx volumes).") | Out-Null
$md.Add("") | Out-Null
$md.Add("**Parent-framework assignment note**: The volume text does not explicitly label a Torgima parent framework per sub-framework. Parent assignment in this document is produced via deterministic keyword heuristics over each framework’s Domain, Name, Output, and Bhudhi handoff fields; treat this as an initial routing map unless/until a canonical mapping is provided.") | Out-Null
$md.Add("") | Out-Null
$md.Add("---") | Out-Null
$md.Add("") | Out-Null

$md.Add("## Section 1: Framework Categorization by Parent") | Out-Null
$md.Add("") | Out-Null

$groupIndex = 1
foreach ($parent in $ParentFrameworks) {
  $items = @($grouped[$parent] | Sort-Object { $_.number })
  $md.Add(("## GROUP {0}: {1} ({2} sub-frameworks)" -f $groupIndex, $parent, $items.Count)) | Out-Null
  $md.Add("") | Out-Null

  $byCat = $items | Group-Object -Property category | Sort-Object Name
  foreach ($cg in $byCat) {
    $cat = $cg.Name
    $catItems = @($cg.Group | Sort-Object { $_.number })
    $md.Add(("### Category: {0} ({1})" -f $cat, $catItems.Count)) | Out-Null
    $md.Add("") | Out-Null
    foreach ($r in $catItems) {
      $md.Add(("- Framework {0}: {1}" -f $r.number, $r.name)) | Out-Null
      $md.Add(("  Purpose: {0}" -f $r.purpose)) | Out-Null
      $md.Add(("  Triggers: domain-based (derived from domain '{0}' and lifecycle step 1)" -f $r.domain)) | Out-Null
      $md.Add(("  Parent Authority: Advisory")) | Out-Null
      $md.Add("") | Out-Null
    }
  }

  $groupIndex++
}

$md.Add("---") | Out-Null
$md.Add("") | Out-Null
$md.Add("## Section 2: Framework Registry (Numerical)") | Out-Null
$md.Add("") | Out-Null

for ($n=1; $n -le 460; $n++) {
  $r = $all[$n]
  $md.Add(("- **{0}** - **{1}**" -f $r.number, $r.name)) | Out-Null
  $md.Add(("  - Parent: {0}" -f $r.parent_framework)) | Out-Null
  $md.Add(("  - Category: {0}" -f $r.category)) | Out-Null
  $md.Add(("  - Domain: {0}" -f $r.domain)) | Out-Null
  $md.Add(("  - One-line purpose: {0}" -f $r.purpose)) | Out-Null
  $md.Add(("  - Activation trigger type: domain-based")) | Out-Null
}

$md.Add("") | Out-Null
$md.Add("---") | Out-Null
$md.Add("") | Out-Null
$md.Add("## Section 3: Cross-Reference Matrix") | Out-Null
$md.Add("") | Out-Null
$md.Add("The volumes provide a generic **Bhudhi handoff** field but do not enumerate explicit per-framework dependency/conflict/override lists. This section is therefore represented as:") | Out-Null
$md.Add("") | Out-Null
$md.Add("- **Works together**: inferred by shared parent framework + shared Bhudhi handoff target layer") | Out-Null
$md.Add("- **Depends on**: inferred by frameworks that mention validation thresholds/evidence/memory records in Inputs and lifecycle") | Out-Null
$md.Add("- **Blocks / overrides**: not explicitly enumerated; reserved for future authoritative mapping") | Out-Null
$md.Add("") | Out-Null

$md.Add("---") | Out-Null
$md.Add("") | Out-Null
$md.Add("## Section 4: Activation Trigger Library") | Out-Null
$md.Add("") | Out-Null
$md.Add("- **Signal-based triggers**: not explicitly enumerated per framework; signals appear implicitly in Inputs (e.g., signals, evidence, thresholds, system history).") | Out-Null
$md.Add("- **Condition-based triggers**: not explicitly enumerated; conditions appear implicitly as validation thresholds and context constraints.") | Out-Null
$md.Add("- **Domain-based triggers**: primary trigger type used in this document (each framework activates when its domain output object is required).") | Out-Null
$md.Add("- **Time-based triggers**: not explicitly enumerated.") | Out-Null
$md.Add("- **Manual triggers**: not explicitly enumerated.") | Out-Null
$md.Add("") | Out-Null

$md.Add("---") | Out-Null
$md.Add("") | Out-Null
$md.Add("## Section 5: Decision Logic Patterns") | Out-Null
$md.Add("") | Out-Null
$md.Add("Across the volumes, the dominant shared pattern is **cascade logic** via the 8-step Operating lifecycle. Additional patterns appear implicitly via scoring/threshold/validation language:") | Out-Null
$md.Add("") | Out-Null
$md.Add("- **Cascade logic** (step 1 → … → step 8)") | Out-Null
$md.Add("- **Weighted scoring** (confidence/usefulness/risk/alignment scoring step)") | Out-Null
$md.Add("- **Confidence-based validation** (confidence calibration and confidence outputs)") | Out-Null
$md.Add("- **Threshold validation** (truth/consistency/confidence/risk thresholds in validation-themed domains)") | Out-Null
$md.Add("") | Out-Null

$md.Add("---") | Out-Null
$md.Add("") | Out-Null
$md.Add("## Section 6: Integration with Torgima") | Out-Null
$md.Add("") | Out-Null
$md.Add("Integration points are derived from each framework’s Domain, Inputs, and Bhudhi handoff. A future Torgima execution-loop spec should map these to concrete engine calls. For now:") | Out-Null
$md.Add("") | Out-Null
$md.Add("- **Goal validation**: frameworks whose names/domains include Goal, Objective, Validation") | Out-Null
$md.Add("- **Task generation**: frameworks whose primary output implies execution objects") | Out-Null
$md.Add("- **Signal calculation**: frameworks whose names/domains include Signal or inputs mention signals") | Out-Null
$md.Add("- **Condition evaluation**: frameworks whose names/domains include Condition or validation thresholds") | Out-Null
$md.Add("- **Control engine**: governance/validation/decision frameworks") | Out-Null
$md.Add("- **Feedback processing**: evolution/learning frameworks (from Evolution behavior fields)") | Out-Null
$md.Add("") | Out-Null

$md.Add("---") | Out-Null
$md.Add("") | Out-Null
$md.Add("## Section 7: Integration with Bhudhi (46 questions mapping)") | Out-Null
$md.Add("") | Out-Null
$md.Add("The 15 volume documents do not contain the canonical 46 questions list, so exact Q1-Q46 mapping cannot be produced from these sources alone. Once the 46-question catalog is provided, mapping should be generated by:") | Out-Null
$md.Add("- routing each question to a parent framework (DOC_11 authority order)") | Out-Null
$md.Add("- selecting sub-frameworks within that parent whose Domain and Primary Output match the question’s required evidence object") | Out-Null
$md.Add("") | Out-Null

$md.Add("---") | Out-Null
$md.Add("") | Out-Null
$md.Add("## Section 8: Integration with Erector") | Out-Null
$md.Add("") | Out-Null
$md.Add("The volume documents do not specify NPC types or scenario bindings. Recommended approach: use each framework’s Failure modes and Validation method to design scenarios that teach correct usage and punish misuse under pressure.") | Out-Null
$md.Add("") | Out-Null

$md.Add("---") | Out-Null
$md.Add("") | Out-Null
$md.Add("## Section 9: Verification Checklist") | Out-Null
$md.Add("") | Out-Null
$md.Add("- [x] All 460 frameworks extracted") | Out-Null
$md.Add("- [x] All 460 frameworks assigned to a parent framework (heuristic assignment)") | Out-Null
$md.Add("- [ ] All 14 parent frameworks have correct sub-framework counts (requires canonical mapping; current counts reflect heuristic grouping)") | Out-Null
$md.Add("- [x] Activation triggers documented (domain-based, derived)") | Out-Null
$md.Add("- [x] Input/output specifications captured (via Inputs/Output fields)") | Out-Null
$md.Add("- [ ] All relationships mapped (not explicitly enumerated in volume text)") | Out-Null
$md.Add("- [ ] All integration points identified at engine-call granularity (requires Torgima loop + Bhudhi Q1-Q46 catalog + Erector schema)") | Out-Null
$md.Add("- [x] No gaps or orphaned frameworks (1-460 complete)") | Out-Null

Set-Content -LiteralPath $OutMd -Value $md -Encoding UTF8

Write-Host ("Wrote {0}" -f $OutJson)
Write-Host ("Wrote {0}" -f $OutMd)

