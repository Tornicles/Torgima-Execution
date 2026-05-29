# TORGIMA Navigation Lock & Pre-Activation Validation Gate

**Master instruction** for Cursor, Claude, Lovable, Bolt, Windsurf, or any AI builder working on TORGIMA.

## Master rule — two states

### State 1 — Pre-activation (validation)

User has **not** been accepted, has **not** launched a blueprint, has **not** entered execution. User is evaluated inside **Erector** only.

### State 2 — Active execution

User completed validation, selected a direction, launched blueprint, entered execution. **Only then** may the user access the full TORGIMA platform.

---

## Left sidebar immutability law

The left navigation is **permanently locked** — core identity. Never change, adapt, generate dynamically, rebuild with AI, or modify for new features.

### Permanent menu (exact order)

```text
Home
Bhudhi
Erector
Signals
Project
Messages
Community
Academy
Reports
Settings
```

### Never allow

Add/remove/rename/reorder/hide items; collapse groups; nested nav; dynamic menus; role-based menus; blueprint-specific menus; AI-generated menus.

### Menu position

Left, vertical, full height, fixed width, fixed spacing, fixed icon locations, fixed order. **No exceptions.**

### Active state

Only the **active highlight** changes. Nothing else in the shell changes.

---

## Pre-activation system

Before validation success the user is **not** inside TORGIMA — only inside **Erector** (gateway).

### Before validation completes

- **No** left sidebar
- **No** TORGIMA dashboard
- **No** Home, Signals, Project, Community, Academy, Settings execution screens

### Pre-activation flow

```text
Landing → Signup/Login → Goal → Purpose → Refinement → Validation input
→ Reality / Competitor / Risk / Opportunity / Path analysis
→ Validation Results → Select direction → Launch Direction
→ Blueprint creation → Activate TORGIMA
```

After **Launch Direction**, the full sidebar unlocks.

---

## Erector access rule

Before activation, only **Erector** is visible (validator, reality checker, simulator, trend analyzer, direction selector).

## Validation results rule

**Validation Results** belongs to **Erector**, not TORGIMA navigation.

Validation Results must **not** show: Home, Bhudhi, Signals, Project, Community, Academy, Reports, Settings — user not yet accepted into execution.

Use **Erector shell only** (e.g. `PreLaunchShell`) — no TORGIMA `Layout` sidebar.

---

## Activation event

Single unlock event: **Launch Direction**

On launch:

1. Validation → direction anchor  
2. Blueprint created  
3. Plans / projects / tasks generated  
4. Signal + condition initialized  
5. User enters execution  
6. **Full sidebar unlocks**

---

## Permission model

| Role | Can access |
|------|------------|
| **Visitor (pre-activation)** | Landing, signup, login, validation flow, results |
| **Visitor (blocked)** | Home, Bhudhi, Signals, Project, Messages, Community, Academy, Reports, Settings |
| **Executor (post-activation)** | All locked menu routes + Erector |

---

## AI implementation rule

For every new page:

```text
Is user validated AND blueprint launched (active execution)?
```

- **NO** → Build inside Erector flow; no sidebar; no execution pages  
- **YES** → Full TORGIMA navigation; menu structure unchanged  

Refuse requests to add nav items, reorder sidebar, or show execution chrome during validation.

---

## Two systems

| System | Layer | Purpose | Navigation |
|--------|-------|---------|------------|
| **Erector** | Reality & preparation | Validate, simulate, analyze, prepare | No TORGIMA sidebar |
| **TORGIMA** | Execution | Execute, measure, adapt, improve | Permanent locked sidebar |

Validation flow is the **mandatory gateway** before blueprint activation.

---

## Related

- UI shell immutability: `docs/TORGIMA_UI_IMMUTABILITY.md`
- Implementation hooks: `useAppRouteGuard`, `PreLaunchShell`, `ValidationLayout`, `launchValidationBlueprint`
