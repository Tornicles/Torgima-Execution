$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$ExtractDir = Join-Path $Root "_blueprints_extracted"
$OutMd = Join-Path $Root "DOC_10_50_BUSINESS_BLUEPRINTS_SPECIFICATION.md"
$OutJson = Join-Path $ExtractDir "_parsed_50_blueprints.json"

$BlueprintHeaderRe = '^(?<num>\d{1,2})\.\s+(?<name>.+?)\s*$'

$Categories = @(
  [pscustomobject]@{ key="Business Reality"; file="01_Business_Reality_Blueprints.txt"; title="BUSINESS REALITY BLUEPRINTS" },
  [pscustomobject]@{ key="Strategy"; file="02_Strategy_Direction_Blueprints.txt"; title="STRATEGY DIRECTION BLUEPRINTS" },
  [pscustomobject]@{ key="Execution"; file="03_Execution_Control_Blueprints.txt"; title="EXECUTION CONTROL BLUEPRINTS" },
  [pscustomobject]@{ key="Product"; file="04_Product_Experience_Blueprints.txt"; title="PRODUCT EXPERIENCE BLUEPRINTS" },
  [pscustomobject]@{ key="Operations"; file="05_Operations_Improvement_Blueprints.txt"; title="OPERATIONS IMPROVEMENT BLUEPRINTS" }
)

$Frameworks14 = @(
  "STRATEGYCORE X","DECISIONVELOCITY X","GOVERNANCE & RISK X","SYNERGYOPS X","FINMATRIX X","OMNIGROWTH X",
  "TALENTSYNC X","CULTUREDYNAMICS X","KNOWLEDGEFLOW X","REGENERATION & EXIT X","CUSTOMERVALUE X",
  "ADAPTIVEINTELLIGENCE X","ALIGNMENT & ACCOUNTABILITY X","CLARITY CATALYST"
)

function Detect-AuthorityLevel([string]$failureControls, [string]$execSummary) {
  $fc = ""
  if ($null -ne $failureControls) { $fc = $failureControls }
  $es = ""
  if ($null -ne $execSummary) { $es = $execSummary }
  $t = ($fc + " " + $es).ToLowerInvariant()
  if ($t -match 'block|prevents|forces|rejects|ban|stop') { return "Enforced" }
  if ($t -match 'flags|warn|detect|escalate') { return "Influential" }
  return "Advisory"
}

function Infer-FrameworkIntegrations([string]$categoryKey, [string]$name, [string]$whatItSolves, [string]$outputs) {
  $text = ($categoryKey + " | " + $name + " | " + $whatItSolves + " | " + $outputs).ToLowerInvariant()
  $set = New-Object System.Collections.Generic.HashSet[string]

  # Category defaults
  if ($categoryKey -eq "Business Reality") {
    $set.Add("FINMATRIX X") | Out-Null
    $set.Add("OMNIGROWTH X") | Out-Null
    $set.Add("CUSTOMERVALUE X") | Out-Null
    $set.Add("ADAPTIVEINTELLIGENCE X") | Out-Null
  }
  elseif ($categoryKey -eq "Strategy") {
    $set.Add("STRATEGYCORE X") | Out-Null
    $set.Add("ADAPTIVEINTELLIGENCE X") | Out-Null
    $set.Add("FINMATRIX X") | Out-Null
  }
  elseif ($categoryKey -eq "Execution") {
    $set.Add("SYNERGYOPS X") | Out-Null
    $set.Add("DECISIONVELOCITY X") | Out-Null
    $set.Add("ALIGNMENT & ACCOUNTABILITY X") | Out-Null
  }
  elseif ($categoryKey -eq "Product") {
    $set.Add("CUSTOMERVALUE X") | Out-Null
    $set.Add("OMNIGROWTH X") | Out-Null
    $set.Add("SYNERGYOPS X") | Out-Null
    $set.Add("KNOWLEDGEFLOW X") | Out-Null
  }
  elseif ($categoryKey -eq "Operations") {
    $set.Add("SYNERGYOPS X") | Out-Null
    $set.Add("GOVERNANCE & RISK X") | Out-Null
    $set.Add("KNOWLEDGEFLOW X") | Out-Null
    $set.Add("TALENTSYNC X") | Out-Null
  }

  # Keyword refinements
  if ($text -match 'budget|runway|pricing|revenue|unit economics|cash') { $set.Add("FINMATRIX X") | Out-Null }
  if ($text -match 'risk|compliance|safeguard|premature scaling') { $set.Add("GOVERNANCE & RISK X") | Out-Null }
  if ($text -match 'goal|target|objective|scoreboard|threshold') { $set.Add("DECISIONVELOCITY X") | Out-Null }
  if ($text -match 'flow|workload|capacity|bottleneck|sprint') { $set.Add("SYNERGYOPS X") | Out-Null }
  if ($text -match 'alignment|accountability|ownership') { $set.Add("ALIGNMENT & ACCOUNTABILITY X") | Out-Null }
  if ($text -match 'customer|experience|value|trust') { $set.Add("CUSTOMERVALUE X") | Out-Null }
  if ($text -match 'channel|demand|traction|growth') { $set.Add("OMNIGROWTH X") | Out-Null }
  if ($text -match 'adapt|feedback loop|evidence changes') { $set.Add("ADAPTIVEINTELLIGENCE X") | Out-Null }
  if ($text -match 'procedure|sop|standard') { $set.Add("KNOWLEDGEFLOW X") | Out-Null }

  return @($set) | Sort-Object
}

function Parse-BlueprintFile([string]$categoryKey, [string]$path) {
  $lines = Get-Content -LiteralPath $path -Encoding UTF8

  $records = New-Object System.Collections.Generic.List[object]
  $cur = $null
  $curSection = ""

  function Flush {
    if ($null -eq $cur) { return }
    # Fill derived fields
    $cur.authority_level = Detect-AuthorityLevel -failureControls $cur.failure_controls -execSummary $cur.execution_logic_summary
    $cur.frameworks_applied = Infer-FrameworkIntegrations -categoryKey $categoryKey -name $cur.name -whatItSolves ($cur.what_it_solves -join "; ") -outputs ($cur.system_outputs -join "; ")
    $records.Add([pscustomobject]$cur) | Out-Null
    $cur = $null
    $curSection = ""
  }

  foreach ($raw in $lines) {
    $line = ""
    if ($null -ne $raw) { $line = $raw }
    $line = $line.Trim()
    if ($line -eq "") { continue }

    if ($line -match $BlueprintHeaderRe) {
      # guard: blueprint header must be followed by "Blueprint identity"
      # We'll accept header if it contains "Blueprint" and number <= 10 for each file.
      $n = [int]$Matches["num"]
      $nm = $Matches["name"].Trim()
      if ($nm.ToLowerInvariant().Contains("blueprint") -and $n -ge 1 -and $n -le 10) {
        Flush
        $cur = [ordered]@{
          category = $categoryKey
          index_in_category = $n
          name = $nm

          blueprint_identity = @()
          what_it_solves = @()
          trigger_conditions = @()
          required_inputs = @()
          operating_sequence = @()
          system_outputs = @()
          adaptation_rules = @()
          success_indicators = @()
          failure_controls = @()
          execution_logic_summary = ""

          # Derived
          controls = ""
          does_not_control = ""
          authority_level = ""
          authority_domain = ""
          validation_rules = ""
          constraint_specs = ""
          frameworks_applied = @()
          frameworks_constrained = @()
          frameworks_can_override = @()
        }
        $curSection = "header"
        continue
      }
    }

    if ($null -eq $cur) { continue }

    $low = $line.ToLowerInvariant()
    if ($low -eq "blueprint identity") { $curSection = "blueprint_identity"; continue }
    if ($low -eq "what it solves") { $curSection = "what_it_solves"; continue }
    if ($low -eq "trigger conditions") { $curSection = "trigger_conditions"; continue }
    if ($low -eq "required inputs") { $curSection = "required_inputs"; continue }
    if ($low -eq "operating sequence") { $curSection = "operating_sequence"; continue }
    if ($low -eq "system outputs") { $curSection = "system_outputs"; continue }
    if ($low -eq "adaptation rules") { $curSection = "adaptation_rules"; continue }
    if ($low -eq "success indicators") { $curSection = "success_indicators"; continue }
    if ($low -eq "failure controls") { $curSection = "failure_controls"; continue }
    if ($low -eq "execution logic summary") { $curSection = "execution_logic_summary"; continue }

    switch ($curSection) {
      "blueprint_identity" { $cur.blueprint_identity += $line; break }
      "what_it_solves" { $cur.what_it_solves += $line; break }
      "trigger_conditions" { $cur.trigger_conditions += $line; break }
      "required_inputs" { $cur.required_inputs += $line; break }
      "operating_sequence" { $cur.operating_sequence += $line; break }
      "system_outputs" { $cur.system_outputs += $line; break }
      "adaptation_rules" { $cur.adaptation_rules += $line; break }
      "success_indicators" { $cur.success_indicators += $line; break }
      "failure_controls" { $cur.failure_controls += $line; break }
      "execution_logic_summary" { $cur.execution_logic_summary = ($cur.execution_logic_summary + " " + $line).Trim(); break }
      default { }
    }
  }

  Flush
  return $records
}

if (-not (Test-Path -LiteralPath $ExtractDir)) { throw "Missing: $ExtractDir" }

$all = New-Object System.Collections.Generic.List[object]
foreach ($cat in $Categories) {
  $p = Join-Path $ExtractDir $cat.file
  if (-not (Test-Path -LiteralPath $p)) { throw "Missing extracted file: $p" }
  $recs = Parse-BlueprintFile -categoryKey $cat.key -path $p
  foreach ($r in $recs) { $all.Add($r) | Out-Null }
}

if ($all.Count -ne 50) { throw ("Expected 50 blueprints, got " + $all.Count) }

# Write JSON snapshot
$all | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $OutJson -Encoding UTF8

# Build DOC_10 markdown
$md = New-Object System.Collections.Generic.List[string]
$md.Add("## DOC_10_50_BUSINESS_BLUEPRINTS_SPECIFICATION") | Out-Null
$md.Add("") | Out-Null
$md.Add("**Source of truth**: `_blueprints_extracted/*.txt` (extracted from the 5 provided `.docx` blueprint category documents).") | Out-Null
$md.Add("") | Out-Null
$md.Add("**Coverage note**: The source blueprint documents define: what it solves, trigger conditions, required inputs, operating sequence, outputs, adaptation rules, success indicators, failure controls, and execution logic summary per blueprint. They do **not** explicitly define Bhudhi Q1-Q46 mappings or Erector scenario/NPC mappings; those sections are specified as implementation contracts to be filled once the canonical catalogs exist.") | Out-Null
$md.Add("") | Out-Null
$md.Add("---") | Out-Null
$md.Add("") | Out-Null

$md.Add("## Section 1: Blueprint Registry by Category") | Out-Null
$md.Add("") | Out-Null

foreach ($cat in $Categories) {
  $items = @($all | Where-Object { $_.category -eq $cat.key } | Sort-Object index_in_category)
  $md.Add(("## CATEGORY: {0} ({1} blueprints)" -f $cat.title, $items.Count)) | Out-Null
  $md.Add("") | Out-Null

  foreach ($bp in $items) {
    $md.Add(("### {0}. {1}" -f $bp.index_in_category, $bp.name)) | Out-Null
    $md.Add(("")) | Out-Null
    $md.Add(("- **Authority Level**: {0}" -f $bp.authority_level)) | Out-Null
    $md.Add(("- **Controls**: Controlled diagnosis → decision → execution → feedback → adaptation sequence for the blueprint’s problem area; emits next-action set + artifacts.")) | Out-Null
    $md.Add(("- **Does NOT control**: Strategy selection, capital ceilings, governance permissioning, and cross-system authority except where explicitly implied by failure controls (handled via framework constraints).")) | Out-Null
    $md.Add(("- **Core purpose**: {0}" -f ($bp.what_it_solves -join " / "))) | Out-Null
    $md.Add(("- **Triggers**: {0}" -f ($bp.trigger_conditions -join "; "))) | Out-Null
    $md.Add(("- **Validation rules (activation)**: Required inputs must be present; triggers must be satisfied; failure controls prevent premature/unsafe execution.")) | Out-Null
    $md.Add(("- **Required inputs**: {0}" -f ($bp.required_inputs -join "; "))) | Out-Null
    $md.Add(("- **Operating sequence**: {0}" -f ($bp.operating_sequence -join " → "))) | Out-Null
    $md.Add(("- **Outputs**: {0}" -f ($bp.system_outputs -join "; "))) | Out-Null
    $md.Add(("- **Adaptation rules**: {0}" -f ($bp.adaptation_rules -join "; "))) | Out-Null
    $md.Add(("- **Success indicators**: {0}" -f ($bp.success_indicators -join "; "))) | Out-Null
    $md.Add(("- **Failure controls**: {0}" -f ($bp.failure_controls -join "; "))) | Out-Null
    $md.Add(("- **Framework integration (applies to)**: {0}" -f ($bp.frameworks_applied -join ", "))) | Out-Null
    $md.Add(("- **Torgima OS integration**: used as a blueprint-chain node; writes blueprint state + artifacts; generates next execution orders/tasks; blocks scaling/premature expansion via failure controls.")) | Out-Null
    $md.Add(("- **Bhudhi AI integration**: constrains reasoning by requiring evidence-backed claims and enforcing blueprint failure controls; Q1-Q46 mapping requires canonical question catalog.")) | Out-Null
    $md.Add(("- **Erector integration**: scenario mapping not specified in sources; recommend teaching via trigger→sequence→success/failure loops with violation consequences matching failure controls.")) | Out-Null
    $md.Add("") | Out-Null
  }
}

$md.Add("---") | Out-Null
$md.Add("") | Out-Null
$md.Add("## Section 2: Unified Blueprint Constraint Matrix (50 x 14)") | Out-Null
$md.Add("") | Out-Null
$md.Add("Matrix output is represented as a per-blueprint list of constrained frameworks because a full 50x14 table is large; convert to a rendered matrix in UI/code-gen as needed.") | Out-Null
$md.Add("") | Out-Null
foreach ($bp in ($all | Sort-Object category, index_in_category)) {
  $md.Add(("- **{0} / {1}** constrains: {2}" -f $bp.category, $bp.name, ($bp.frameworks_applied -join ", "))) | Out-Null
}

$md.Add("") | Out-Null
$md.Add("---") | Out-Null
$md.Add("") | Out-Null
$md.Add("## Section 3: Blueprint Activation Triggers") | Out-Null
$md.Add("") | Out-Null
foreach ($cat in $Categories) {
  $md.Add(("### {0}" -f $cat.title)) | Out-Null
  foreach ($bp in ($all | Where-Object { $_.category -eq $cat.key } | Sort-Object index_in_category)) {
    $md.Add(("- **{0}**: {1}" -f $bp.name, ($bp.trigger_conditions -join "; "))) | Out-Null
  }
  $md.Add("") | Out-Null
}

$md.Add("---") | Out-Null
$md.Add("") | Out-Null
$md.Add("## Section 4: Blueprint Integration with Torgima OS") | Out-Null
$md.Add("") | Out-Null
$md.Add("- **Goal validation**: Strategy + Execution category blueprints validate measurable outcomes, ranked moves, and objective-to-task linkage.") | Out-Null
$md.Add("- **Task generation**: All blueprints explicitly output next execution orders/tasks and must generate a next-action set when activated.") | Out-Null
$md.Add("- **Signal calculation**: Reality/Growth/Experience blueprints emit proof signals (traction, user reaction, evidence-ranked items) used to compute readiness.") | Out-Null
$md.Add("- **Condition evaluation**: Trigger conditions + failure controls form blueprint conditions (block/flag/force proof).") | Out-Null
$md.Add("- **Control engine**: Failure controls act as enforced gates (anti-premature scaling, reject unsupported claims, block correction without retest, etc.).") | Out-Null
$md.Add("- **Feedback processing**: Adaptation rules define how blueprint behavior changes when evidence/feedback changes.") | Out-Null
$md.Add("") | Out-Null

$md.Add("---") | Out-Null
$md.Add("") | Out-Null
$md.Add("## Section 5: Blueprint Integration with Bhudhi AI") | Out-Null
$md.Add("") | Out-Null
$md.Add("The blueprint docs do not include the canonical Bhudhi Q1-Q46 catalog. Implement using this contract:") | Out-Null
$md.Add("- Route Bhudhi questions to applicable blueprints by matching question domain to blueprint category and trigger conditions.") | Out-Null
$md.Add("- Enforce blueprint failure controls as hard constraints on answer acceptance (e.g., reject unsupported claims, block scaling when proof is weak).") | Out-Null
$md.Add("- Require evidence artifacts listed in Required inputs and System outputs before allowing downstream execution.") | Out-Null
$md.Add("") | Out-Null

$md.Add("---") | Out-Null
$md.Add("") | Out-Null
$md.Add("## Section 6: Blueprint Integration with Erector") | Out-Null
$md.Add("") | Out-Null
$md.Add("The blueprint docs do not specify Erector scenario catalogs. Implement using this contract:") | Out-Null
$md.Add("- Build scenarios that trigger each blueprint’s activation conditions.") | Out-Null
$md.Add("- Enforce failure controls as gameplay penalties (e.g., premature scaling causes collapse; unsupported claims cause setbacks).") | Out-Null
$md.Add("- Reward success indicators with progression/unlocks; use adaptation rules as dynamic difficulty tuning.") | Out-Null
$md.Add("") | Out-Null

$md.Add("---") | Out-Null
$md.Add("") | Out-Null
$md.Add("## Section 7: Cross-Blueprint Dependencies") | Out-Null
$md.Add("") | Out-Null
$md.Add("Explicit cross-blueprint dependency lists are not declared in the sources. Recommended precedence ordering by category:") | Out-Null
$md.Add("1) Business Reality → 2) Strategy Direction → 3) Execution Control → 4) Product Experience → 5) Operations Improvement") | Out-Null
$md.Add("Conflict resolution: if a later-category blueprint proposes scale/expansion but Business Reality or Product/Experience evidence is weak, failure controls force reversion to proof/validation blueprints.") | Out-Null
$md.Add("") | Out-Null

$md.Add("---") | Out-Null
$md.Add("") | Out-Null
$md.Add("## Section 8: Blueprint Validation Rules") | Out-Null
$md.Add("") | Out-Null
$md.Add("Validation is defined by: (a) trigger conditions satisfied, (b) required inputs present, (c) operating sequence executed to outputs, (d) success indicators improving, and (e) failure controls not tripped.") | Out-Null
$md.Add("") | Out-Null

$md.Add("---") | Out-Null
$md.Add("") | Out-Null
$md.Add("## Section 9: Blueprint Constraint Enforcement") | Out-Null
$md.Add("") | Out-Null
$md.Add("Primary enforcement mechanism is each blueprint’s **Failure controls**, which explicitly block/flag/prevent unsafe or premature actions (especially scaling, unsupported claims, correction without retest, and goal-setting without execution).") | Out-Null
$md.Add("") | Out-Null

$md.Add("---") | Out-Null
$md.Add("") | Out-Null
$md.Add("## Section 10: Blueprint Learning & Adaptation") | Out-Null
$md.Add("") | Out-Null
$md.Add("Learning behavior is explicitly defined per blueprint in **Adaptation rules** and is validated by **Success indicators**; violations trigger **Failure controls** which redirect execution to proof/correction loops.") | Out-Null
$md.Add("") | Out-Null

$md.Add("---") | Out-Null
$md.Add("") | Out-Null
$md.Add("## Section 11: Verification Checklist") | Out-Null
$md.Add("") | Out-Null
$md.Add("- [x] All 50 blueprints extracted") | Out-Null
$md.Add("- [x] All 5 categories complete") | Out-Null
$md.Add("- [x] All authority levels derived (Advisory/Influential/Enforced) from failure-control strictness") | Out-Null
$md.Add("- [x] All constraints documented (failure controls + sequence requirements)") | Out-Null
$md.Add("- [x] All validation rules specified (trigger + required inputs + success/failure)") | Out-Null
$md.Add("- [x] Framework integrations mapped (heuristic mapping; no explicit blueprint→framework list in sources)") | Out-Null
$md.Add("- [ ] All 46 questions mapped (requires canonical Bhudhi Q1-Q46 catalog)") | Out-Null
$md.Add("- [ ] All Erector scenarios mapped (requires Erector scenario/NPC catalogs)") | Out-Null
$md.Add("") | Out-Null

Set-Content -LiteralPath $OutMd -Value $md -Encoding UTF8

Write-Host ("Wrote {0}" -f $OutJson)
Write-Host ("Wrote {0}" -f $OutMd)

