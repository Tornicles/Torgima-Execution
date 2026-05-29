$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$BlueprintJson = Join-Path $Root "_blueprints_extracted\\_parsed_50_blueprints.json"
$SubframeworkJson = Join-Path $Root "_bhudhi_frameworks_extracted\\_parsed_460_frameworks.json"
$Out = Join-Path $Root "DOC_14_BHUDHI_46_QUESTIONS_ROUTING.md"

if (-not (Test-Path -LiteralPath $BlueprintJson)) { throw "Missing $BlueprintJson" }
if (-not (Test-Path -LiteralPath $SubframeworkJson)) { throw "Missing $SubframeworkJson" }

$blueprints = Get-Content -LiteralPath $BlueprintJson -Encoding UTF8 | ConvertFrom-Json
$subframeworks = Get-Content -LiteralPath $SubframeworkJson -Encoding UTF8 | ConvertFrom-Json

function Find-Blueprints([string[]]$categories, [string[]]$nameHints, [int]$limit = 3) {
  $items = @($blueprints | Where-Object { $categories -contains $_.category })
  if ($nameHints.Count -gt 0) {
    $scored = foreach ($bp in $items) {
      $score = 0
      foreach ($h in $nameHints) {
        if (($bp.name -as [string]).ToLowerInvariant().Contains($h.ToLowerInvariant())) { $score += 2 }
      }
      if ($score -gt 0) { [pscustomobject]@{ bp=$bp; score=$score } }
    }
    $picked = @($scored | Sort-Object score -Descending | Select-Object -First $limit | ForEach-Object { $_.bp })
    if ($picked.Count -gt 0) { return $picked }
  }
  return @($items | Select-Object -First $limit)
}

function Find-Subframeworks([string[]]$keywords, [string]$parentFramework = $null, [int]$limit = 6) {
  $items = $subframeworks
  if ($null -ne $parentFramework) {
    $items = @($items | Where-Object { $_.parent_framework -eq $parentFramework })
  }
  $scored = foreach ($sf in $items) {
    $name = ($sf.name -as [string]).ToLowerInvariant()
    $score = 0
    foreach ($kw in $keywords) {
      $k = $kw.ToLowerInvariant()
      if ($name.Contains($k)) { $score += 3 }
    }
    if ($score -gt 0) { [pscustomobject]@{ sf=$sf; score=$score } }
  }
  $picked = @($scored | Sort-Object score -Descending | Select-Object -First $limit | ForEach-Object { $_.sf })
  if ($picked.Count -gt 0) { return $picked }
  # Fallback: just take first few from the parent framework (or from global list)
  return @($items | Select-Object -First $limit)
}

function FrameworkPack([string]$lead, [string[]]$advisory) {
  return [pscustomobject]@{ lead=$lead; advisory=$advisory }
}

# Canonical question text is not present in repo sources. We define an initial 46-question set matching the 4 categories/counts
# specified in the prompt (12 + 14 + 9 + 11 = 46). Replace question text later if a canonical catalog is supplied.
$Questions = @(
  # CATEGORY 1: YOUR TASKS (12)
  [pscustomobject]@{ id=1; cat="YOUR TASKS"; text="Why is this task assigned to me?"; hints=@("execution planning","goal","dependency","self-assessment"); lead=FrameworkPack "STRATEGYCORE X" @("SYNERGYOPS X","TALENTSYNC X","CLARITY CATALYST") },
  [pscustomobject]@{ id=2; cat="YOUR TASKS"; text="What is the purpose of this task in my blueprint?"; hints=@("purpose","goal","plan"); lead=FrameworkPack "SYNERGYOPS X" @("STRATEGYCORE X","CLARITY CATALYST") },
  [pscustomobject]@{ id=3; cat="YOUR TASKS"; text="What happens if I skip or delay this task?"; hints=@("risk","consequence","dependency"); lead=FrameworkPack "GOVERNANCE & RISK X" @("SYNERGYOPS X","DECISIONVELOCITY X") },
  [pscustomobject]@{ id=4; cat="YOUR TASKS"; text="What is the minimum version of this task that still counts?"; hints=@("minimum","threshold","definition"); lead=FrameworkPack "SYNERGYOPS X" @("DECISIONVELOCITY X","CUSTOMERVALUE X") },
  [pscustomobject]@{ id=5; cat="YOUR TASKS"; text="What proof is this task meant to produce?"; hints=@("proof","validation","test"); lead=FrameworkPack "DECISIONVELOCITY X" @("OMNIGROWTH X","CUSTOMERVALUE X") },
  [pscustomobject]@{ id=6; cat="YOUR TASKS"; text="How does this task connect to my strategic direction?"; hints=@("strategy","tradeoff","goal"); lead=FrameworkPack "STRATEGYCORE X" @("ADAPTIVEINTELLIGENCE X","CLARITY CATALYST") },
  [pscustomobject]@{ id=7; cat="YOUR TASKS"; text="Why is this task the priority over other tasks?"; hints=@("priority","ranking","impact"); lead=FrameworkPack "DECISIONVELOCITY X" @("STRATEGYCORE X","SYNERGYOPS X") },
  [pscustomobject]@{ id=8; cat="YOUR TASKS"; text="What inputs do I need before starting this task?"; hints=@("inputs","context","constraints"); lead=FrameworkPack "SYNERGYOPS X" @("KNOWLEDGEFLOW X","GOVERNANCE & RISK X") },
  [pscustomobject]@{ id=9; cat="YOUR TASKS"; text="What does success look like for this task?"; hints=@("success","metrics","result"); lead=FrameworkPack "DECISIONVELOCITY X" @("CUSTOMERVALUE X","SYNERGYOPS X") },
  [pscustomobject]@{ id=10; cat="YOUR TASKS"; text="What are the risks or constraints on this task?"; hints=@("risk","constraint","threshold"); lead=FrameworkPack "GOVERNANCE & RISK X" @("FINMATRIX X","SYNERGYOPS X") },
  [pscustomobject]@{ id=11; cat="YOUR TASKS"; text="What should I do immediately after completing this task?"; hints=@("next task","handoff","dependency"); lead=FrameworkPack "SYNERGYOPS X" @("DECISIONVELOCITY X") },
  [pscustomobject]@{ id=12; cat="YOUR TASKS"; text="How can I complete this task faster without breaking quality?"; hints=@("speed","quality","bias"); lead=FrameworkPack "DECISIONVELOCITY X" @("SYNERGYOPS X","GOVERNANCE & RISK X") },

  # CATEGORY 2: YOUR EXECUTION (14)
  [pscustomobject]@{ id=13; cat="YOUR EXECUTION"; text="Why is my current condition (Danger/Urgency/Stability/etc.)?"; hints=@("momentum","signal","trend"); lead=FrameworkPack "DECISIONVELOCITY X" @("KNOWLEDGEFLOW X","CULTUREDYNAMICS X","CLARITY CATALYST") },
  [pscustomobject]@{ id=14; cat="YOUR EXECUTION"; text="Is my momentum improving or declining?"; hints=@("momentum","trend","velocity"); lead=FrameworkPack "DECISIONVELOCITY X" @("KNOWLEDGEFLOW X") },
  [pscustomobject]@{ id=15; cat="YOUR EXECUTION"; text="What pattern is causing my execution to stall?"; hints=@("blocker","bottleneck","flow"); lead=FrameworkPack "SYNERGYOPS X" @("KNOWLEDGEFLOW X","TALENTSYNC X") },
  [pscustomobject]@{ id=16; cat="YOUR EXECUTION"; text="What is the single biggest blocker right now?"; hints=@("blocker","dependency","constraint"); lead=FrameworkPack "SYNERGYOPS X" @("ALIGNMENT & ACCOUNTABILITY X") },
  [pscustomobject]@{ id=17; cat="YOUR EXECUTION"; text="Is my workload overloaded or healthy?"; hints=@("capacity","load","wip"); lead=FrameworkPack "SYNERGYOPS X" @("TALENTSYNC X") },
  [pscustomobject]@{ id=18; cat="YOUR EXECUTION"; text="What is the most effective next action given my current signals?"; hints=@("next action","signal","priority"); lead=FrameworkPack "SYNERGYOPS X" @("DECISIONVELOCITY X","ADAPTIVEINTELLIGENCE X") },
  [pscustomobject]@{ id=19; cat="YOUR EXECUTION"; text="Why did the system change my plan or task intensity?"; hints=@("adaptation","evolution","threshold"); lead=FrameworkPack "ADAPTIVEINTELLIGENCE X" @("DECISIONVELOCITY X","SYNERGYOPS X") },
  [pscustomobject]@{ id=20; cat="YOUR EXECUTION"; text="What did I do that improved my condition?"; hints=@("success","signal","improvement"); lead=FrameworkPack "KNOWLEDGEFLOW X" @("DECISIONVELOCITY X") },
  [pscustomobject]@{ id=21; cat="YOUR EXECUTION"; text="What did I do that worsened my condition?"; hints=@("failure","signal","risk"); lead=FrameworkPack "GOVERNANCE & RISK X" @("KNOWLEDGEFLOW X","DECISIONVELOCITY X") },
  [pscustomobject]@{ id=22; cat="YOUR EXECUTION"; text="Are my tasks aligned to results or just activity?"; hints=@("outcome","result","scoreboard"); lead=FrameworkPack "DECISIONVELOCITY X" @("SYNERGYOPS X") },
  [pscustomobject]@{ id=23; cat="YOUR EXECUTION"; text="What is the quality risk if I keep going at this pace?"; hints=@("quality","risk","overload"); lead=FrameworkPack "GOVERNANCE & RISK X" @("SYNERGYOPS X","TALENTSYNC X") },
  [pscustomobject]@{ id=24; cat="YOUR EXECUTION"; text="What should I stop doing because it is not working?"; hints=@("stop","deprecate","waste"); lead=FrameworkPack "REGENERATION & EXIT X" @("SYNERGYOPS X","DECISIONVELOCITY X") },
  [pscustomobject]@{ id=25; cat="YOUR EXECUTION"; text="What should I start doing to recover momentum?"; hints=@("recover","momentum","reset"); lead=FrameworkPack "SYNERGYOPS X" @("DECISIONVELOCITY X","KNOWLEDGEFLOW X") },
  [pscustomobject]@{ id=26; cat="YOUR EXECUTION"; text="What is the fastest safe path to completion right now?"; hints=@("fast","safe","path"); lead=FrameworkPack "SYNERGYOPS X" @("GOVERNANCE & RISK X","FINMATRIX X") },

  # CATEGORY 3: YOUR DIRECTION (9)
  [pscustomobject]@{ id=27; cat="YOUR DIRECTION"; text="Am I in the right direction?"; hints=@("strategy","market","signals"); lead=FrameworkPack "STRATEGYCORE X" @("CUSTOMERVALUE X","ADAPTIVEINTELLIGENCE X","OMNIGROWTH X","CLARITY CATALYST") },
  [pscustomobject]@{ id=28; cat="YOUR DIRECTION"; text="Is my strategy still valid given current reality?"; hints=@("reality","pressure","threat"); lead=FrameworkPack "ADAPTIVEINTELLIGENCE X" @("STRATEGYCORE X","FINMATRIX X") },
  [pscustomobject]@{ id=29; cat="YOUR DIRECTION"; text="What should I change in my strategy right now?"; hints=@("adapt","tradeoff","pivot"); lead=FrameworkPack "STRATEGYCORE X" @("ADAPTIVEINTELLIGENCE X") },
  [pscustomobject]@{ id=30; cat="YOUR DIRECTION"; text="What should I double down on?"; hints=@("advantage","strength","traction"); lead=FrameworkPack "STRATEGYCORE X" @("OMNIGROWTH X","CUSTOMERVALUE X") },
  [pscustomobject]@{ id=31; cat="YOUR DIRECTION"; text="What should I stop pursuing because it is not strategic?"; hints=@("stop","exclude","sunset"); lead=FrameworkPack "REGENERATION & EXIT X" @("STRATEGYCORE X") },
  [pscustomobject]@{ id=32; cat="YOUR DIRECTION"; text="What market signals matter most right now?"; hints=@("signal","trend","market"); lead=FrameworkPack "ADAPTIVEINTELLIGENCE X" @("OMNIGROWTH X") },
  [pscustomobject]@{ id=33; cat="YOUR DIRECTION"; text="Is my offer/value promise strong enough?"; hints=@("value","promise","transformation"); lead=FrameworkPack "CUSTOMERVALUE X" @("OMNIGROWTH X") },
  [pscustomobject]@{ id=34; cat="YOUR DIRECTION"; text="Is my growth path realistic given capital and capacity?"; hints=@("growth","capital","capacity"); lead=FrameworkPack "FINMATRIX X" @("SYNERGYOPS X","OMNIGROWTH X") },
  [pscustomobject]@{ id=35; cat="YOUR DIRECTION"; text="What is the highest-leverage strategic move next?"; hints=@("leverage","move","ranking"); lead=FrameworkPack "STRATEGYCORE X" @("DECISIONVELOCITY X") },

  # CATEGORY 4: YOURSELF (11)
  [pscustomobject]@{ id=36; cat="YOURSELF"; text="What is my next growth edge?"; hints=@("self-assessment","capability","learning"); lead=FrameworkPack "TALENTSYNC X" @("KNOWLEDGEFLOW X","CLARITY CATALYST") },
  [pscustomobject]@{ id=37; cat="YOURSELF"; text="What capability gap is slowing me down?"; hints=@("capability","gap","blocker"); lead=FrameworkPack "TALENTSYNC X" @("SYNERGYOPS X") },
  [pscustomobject]@{ id=38; cat="YOURSELF"; text="Am I burning out or overburdened?"; hints=@("burnout","capacity","strain"); lead=FrameworkPack "TALENTSYNC X" @("SYNERGYOPS X","CULTUREDYNAMICS X") },
  [pscustomobject]@{ id=39; cat="YOURSELF"; text="What behavior standard am I violating (if any)?"; hints=@("behavior","norm","standards"); lead=FrameworkPack "CULTUREDYNAMICS X" @("GOVERNANCE & RISK X") },
  [pscustomobject]@{ id=40; cat="YOURSELF"; text="What should I learn next to improve execution?"; hints=@("learning","knowledge","improve"); lead=FrameworkPack "KNOWLEDGEFLOW X" @("TALENTSYNC X") },
  [pscustomobject]@{ id=41; cat="YOURSELF"; text="What is my best execution style based on history?"; hints=@("style","preference","pattern"); lead=FrameworkPack "KNOWLEDGEFLOW X" @("ADAPTIVEINTELLIGENCE X") },
  [pscustomobject]@{ id=42; cat="YOURSELF"; text="Where am I overthinking or losing clarity?"; hints=@("clarity","identity","direction"); lead=FrameworkPack "CLARITY CATALYST" @("DECISIONVELOCITY X") },
  [pscustomobject]@{ id=43; cat="YOURSELF"; text="What should I commit to for the next 7 days?"; hints=@("commit","milestone","priority"); lead=FrameworkPack "CLARITY CATALYST" @("SYNERGYOPS X","STRATEGYCORE X") },
  [pscustomobject]@{ id=44; cat="YOURSELF"; text="What should I delegate or remove?"; hints=@("remove","sunset","liberate"); lead=FrameworkPack "REGENERATION & EXIT X" @("ALIGNMENT & ACCOUNTABILITY X") },
  [pscustomobject]@{ id=45; cat="YOURSELF"; text="What should I be accountable for right now?"; hints=@("ownership","accountability","role"); lead=FrameworkPack "ALIGNMENT & ACCOUNTABILITY X" @("CLARITY CATALYST") },
  [pscustomobject]@{ id=46; cat="YOURSELF"; text="What should I celebrate and reinforce?"; hints=@("reinforce","success","learning"); lead=FrameworkPack "CULTUREDYNAMICS X" @("KNOWLEDGEFLOW X","CLARITY CATALYST") }
)

$md = New-Object System.Collections.Generic.List[string]
$md.Add("## DOC_14_BHUDHI_46_QUESTIONS_ROUTING") | Out-Null
$md.Add("") | Out-Null
$md.Add("**Prerequisites used**: DOC_10, DOC_11, DOC_12, DOC_13.") | Out-Null
$md.Add("") | Out-Null
$md.Add("**Critical source note**: A canonical Bhudhi '46 questions' catalog was not found in the workspace sources. This document therefore defines an initial 46-question set matching the required category counts and routes them deterministically. Replace question text if/when the canonical list is added.") | Out-Null
$md.Add("") | Out-Null
$md.Add("---") | Out-Null
$md.Add("") | Out-Null

function Emit-Question($q) {
  $md.Add(("## Q{0}: {1}" -f $q.id, $q.text)) | Out-Null
  $md.Add("") | Out-Null

  $cat = $q.cat
  $bpCats = @()
  switch ($cat) {
    "YOUR TASKS" { $bpCats = @("Strategy","Execution","Product") }
    "YOUR EXECUTION" { $bpCats = @("Business Reality","Execution","Operations") }
    "YOUR DIRECTION" { $bpCats = @("Business Reality","Strategy","Product") }
    "YOURSELF" { $bpCats = @("Operations","Business Reality","Strategy") }
  }
  $bps = Find-Blueprints -categories $bpCats -nameHints @() -limit 3

  $md.Add("**Primary Blueprints**") | Out-Null
  foreach ($bp in $bps) { $md.Add(("- {0} ({1})" -f $bp.name, $bp.category)) | Out-Null }
  $md.Add("") | Out-Null

  $md.Add("**Primary Frameworks**") | Out-Null
  $md.Add(("- {0} (LEAD)" -f $q.lead.lead)) | Out-Null
  foreach ($a in $q.lead.advisory) { $md.Add(("- {0} (ADVISORY)" -f $a)) | Out-Null }
  $md.Add("") | Out-Null

  $md.Add("**Sub-frameworks Providing Evidence**") | Out-Null
  $sf = Find-Subframeworks -keywords $q.hints -parentFramework $q.lead.lead -limit 6
  foreach ($s in $sf) { $md.Add(("- Framework {0} ({1})" -f $s.number, $s.name)) | Out-Null }
  $md.Add("") | Out-Null

  $md.Add("**Answer Construction**") | Out-Null
  $md.Add("1. Load blueprint context (goal, inputs, current phase, constraints).") | Out-Null
  $md.Add(("2. Apply LEAD framework logic: {0}." -f $q.lead.lead)) | Out-Null
  $md.Add("3. Consult advisory frameworks for sequencing, capability, risk, and clarity.") | Out-Null
  $md.Add("4. Pull sub-framework evidence objects (reasoning/signal/validation/memory as needed).") | Out-Null
  $md.Add("5. Validate against blueprint failure controls (block unsupported / premature / unsafe answers).") | Out-Null
  $md.Add("6. Produce plain-English answer + confidence score + next actions.") | Out-Null
  $md.Add("") | Out-Null

  $md.Add("**Validation Rules**") | Out-Null
  $md.Add("- Must reference the relevant blueprint artifacts (inputs/outputs) for this question type.") | Out-Null
  $md.Add("- Must cite at least 2 evidence items (signals/records/decisions) tied to the user’s current state.") | Out-Null
  $md.Add("- Must not violate blueprint failure controls (e.g., no scale without proof).") | Out-Null
  $md.Add("- Confidence target: >= 0.70; otherwise use fallback.") | Out-Null
  $md.Add("") | Out-Null

  $md.Add("**Fallback if cannot answer**") | Out-Null
  $md.Add("- Provide: (a) what the system can confirm, (b) what is missing, (c) the next proof task to obtain missing evidence.") | Out-Null
  $md.Add("") | Out-Null

  $md.Add("**Bhudhi Trigger Router Integration**") | Out-Null
  $md.Add(("- Activation: user asks Q{0} / UI opens question context" -f $q.id)) | Out-Null
  $md.Add("- Input: blueprint state + last 7-day signals + active tasks + constraints") | Out-Null
  $md.Add(("- Route: {0} -> {1}" -f $q.lead.lead, ($q.lead.advisory -join " -> "))) | Out-Null
  $md.Add("- Timeout: 2 seconds") | Out-Null
  $md.Add("") | Out-Null

  $md.Add("**Test Scenarios**") | Out-Null
  $md.Add("- Scenario A: Normal case with sufficient evidence (expect specific, grounded answer).") | Out-Null
  $md.Add("- Scenario B: Conflicting evidence (expect conflict rule application + decision record).") | Out-Null
  $md.Add("- Scenario C: Missing evidence (expect fallback + proof task).") | Out-Null
  $md.Add("") | Out-Null
}

# Emit by category ordering as requested
$md.Add("## CATEGORY 1: YOUR TASKS (12 Questions)") | Out-Null
$md.Add("") | Out-Null
foreach ($q in $Questions | Where-Object { $_.cat -eq "YOUR TASKS" } | Sort-Object id) { Emit-Question $q }

$md.Add("---") | Out-Null
$md.Add("") | Out-Null
$md.Add("## CATEGORY 2: YOUR EXECUTION (14 Questions)") | Out-Null
$md.Add("") | Out-Null
foreach ($q in $Questions | Where-Object { $_.cat -eq "YOUR EXECUTION" } | Sort-Object id) { Emit-Question $q }

$md.Add("---") | Out-Null
$md.Add("") | Out-Null
$md.Add("## CATEGORY 3: YOUR DIRECTION (9 Questions)") | Out-Null
$md.Add("") | Out-Null
foreach ($q in $Questions | Where-Object { $_.cat -eq "YOUR DIRECTION" } | Sort-Object id) { Emit-Question $q }

$md.Add("---") | Out-Null
$md.Add("") | Out-Null
$md.Add("## CATEGORY 4: YOURSELF (11 Questions)") | Out-Null
$md.Add("") | Out-Null
foreach ($q in $Questions | Where-Object { $_.cat -eq "YOURSELF" } | Sort-Object id) { Emit-Question $q }

$md.Add("---") | Out-Null
$md.Add("") | Out-Null

$md.Add("## CROSS-REFERENCE SECTION") | Out-Null
$md.Add("") | Out-Null
$md.Add("### Question to Blueprint Mapping (by category rule)") | Out-Null
$md.Add("") | Out-Null
foreach ($q in $Questions | Sort-Object id) {
  $bpCats = switch ($q.cat) {
    "YOUR TASKS" { "Strategy + Execution + Product" }
    "YOUR EXECUTION" { "Business Reality + Execution + Operations" }
    "YOUR DIRECTION" { "Business Reality + Strategy + Product" }
    "YOURSELF" { "Operations + Business Reality + Strategy" }
  }
  $md.Add(("- Q{0} -> {1}" -f $q.id, $bpCats)) | Out-Null
}
$md.Add("") | Out-Null

$md.Add("### Question to Framework Mapping") | Out-Null
$md.Add("") | Out-Null
foreach ($q in $Questions | Sort-Object id) {
  $md.Add(("- Q{0} -> {1} (LEAD) -> {2}" -f $q.id, $q.lead.lead, ($q.lead.advisory -join ", "))) | Out-Null
}
$md.Add("") | Out-Null

$md.Add("### Question to Sub-framework Mapping (evidence IDs)") | Out-Null
$md.Add("") | Out-Null
foreach ($q in $Questions | Sort-Object id) {
  $sf = Find-Subframeworks -keywords $q.hints -parentFramework $q.lead.lead -limit 6
  $md.Add(("- Q{0} -> [{1}]" -f $q.id, (($sf | ForEach-Object { $_.number }) -join ", "))) | Out-Null
}
$md.Add("") | Out-Null

$md.Add("---") | Out-Null
$md.Add("") | Out-Null
$md.Add("## Deployment Checklist") | Out-Null
$md.Add("") | Out-Null
$md.Add("- [x] 46 questions routed (initial set)") | Out-Null
$md.Add("- [x] Blueprints per question") | Out-Null
$md.Add("- [x] Frameworks per question") | Out-Null
$md.Add("- [x] Sub-framework evidence IDs per question") | Out-Null
$md.Add("- [x] Validation + fallback logic") | Out-Null
$md.Add("- [ ] Replace question text with canonical catalog when available") | Out-Null

Set-Content -LiteralPath $Out -Value $md -Encoding UTF8
Write-Host ("Wrote {0}" -f $Out)

