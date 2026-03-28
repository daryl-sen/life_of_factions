# Genetics Feature — Current State Analysis

## 1. Current Traits (only 2)

| Trait | Range | Assignment | Inheritance | Used In |
|-------|-------|-----------|-------------|---------|
| **Aggression** | 0.0–1.0 | `Math.random()` | Average of parents | Attack probability calculation |
| **Cooperation** | 0.0–1.0 | `Math.random()` | Average of parents | Share/heal/talk probability calculation |

That's it. Two traits, each used in exactly one probability calculation. No mutation, no variance on inheritance, no genetic drift.

---

## 2. All Agent Stats (potential genetics targets)

### Base Stats (set at birth, currently hardcoded)
| Stat | Default | Per-Level Growth | Could be Genetic? |
|------|---------|-----------------|-------------------|
| Max Health | 100 | +8/level | **Yes** — birth HP and growth rate |
| Max Energy | 200 | +5/level | **Yes** — stamina at birth and scaling |
| Attack | 8.0 | +1.5/level | **Yes** — base power and growth |
| Max Age | 240k–360k ms | N/A | **Yes** — lifespan |
| XP per Level | `level × 25` | Scales linearly | **Yes** — learning speed |
| Level Cap | 20 | N/A | Possibly |

### Needs System (all currently global constants)
| Need | Start | Passive Decay | Critical | Seek | Recovery |
|------|-------|--------------|----------|------|----------|
| Fullness | 50 | -0.03/tick | <20 | <40 | +20/eat |
| Hygiene | 50 | -0.05/move | <20 | <40 | +30/drink |
| Social | 50 | -0.01/tick | — | — | +8/share |
| Inspiration | 50 | -0.015/tick | — | <40 | +15/play |
| Energy | 100 | -0.0625/tick | <20 (mandatory sleep) | <40 (voluntary sleep) | +8/tick sleeping |

All decay rates and thresholds are global — no per-agent variation.

---

## 3. All 18 Actions & How Genetics Could Impact Each

### Combat
| Action | Duration | Cost/sec | Genetics Impact |
|--------|----------|----------|----------------|
| **attack** | 1170–2340ms | 1.1 | Attack speed (duration), damage per hit (`attack * 0.4`), aggression threshold, flee HP threshold |
| **attack_flag** | 2600–5200ms | 1.0 | Same as attack |

### Social
| Action | Duration | Cost/sec | Genetics Impact |
|--------|----------|----------|----------------|
| **talk** | 2340–4680ms | 0.2 | Cooperation threshold, relationship gain rate |
| **quarrel** | 2340–4680ms | 0.4 | Aggression-driven, could have genetic temper |
| **heal** | 2340–4680ms | 1.5 | Cooperation threshold, heal amount (currently +2/tick) |
| **share** | 780–1300ms | 0.4 | When to share — at what inventory level? What to share — generosity gene |

### Survival
| Action | Duration | Cost/sec | Genetics Impact |
|--------|----------|----------|----------------|
| **sleep** | 20800–31200ms | 0 (restores +8/tick) | Sleep efficiency (energy restored per tick), sleep thresholds |
| **eat** | 780–1300ms | 0 | When to eat (hunger threshold gene) |
| **drink** | 780–1300ms | 0 | When to drink (hygiene threshold gene) |
| **harvest** | varies by type | 0.25 | Harvest speed, resource preference |
| **pickup** | 780–1300ms | 0 | Opportunism gene (how eager to loot) |

### Construction / Hygiene / Play
| Action | Duration | Cost/sec | Genetics Impact |
|--------|----------|----------|----------------|
| **build_farm** | 5200ms (fixed) | 0.25 | Build probability (currently 3.125%), industriousness gene |
| **poop** | 1300–2600ms | 0 | Metabolic rate gene (poop frequency) |
| **clean** | 2080–3120ms | 0.25 | Cleanliness gene (at what inspiration level they clean) |
| **play** | 3900–6500ms | 0.15 | Playfulness gene (seek threshold) |

### Faction / Storage
| Action | Duration | Cost/sec | Genetics Impact |
|--------|----------|----------|----------------|
| **deposit** | 780–1300ms | 0 | Loyalty gene (when to deposit, how much to keep) |
| **withdraw** | 780–1300ms | 0 | — |
| **reproduce** | 5200–8320ms | 1.5 | Fertility gene (energy threshold, relationship threshold) |

---

## 4. Decision Tree — Full Priority Chain & Genetic Touch Points

```
TICK START
│
├─ [1] Baby? → eat/drink from inventory only, then roam
│   GENETIC: baby duration (currently 50–70s), baby metabolism
│
├─ [2] Energy < 20? → MANDATORY SLEEP
│   GENETIC: ★ sleep threshold, energy efficiency (drain rate)
│
├─ [3] Under attack? → Flee or retaliate
│   GENETIC: ★★ flee threshold (currently implicit — low HP reduces attack prob)
│          ★★ fight-or-flight ratio (aggression vs self-preservation)
│          Currently NO explicit flee — agents just become less likely to attack
│
├─ [4] Health < 30% max? → Seek faction flag
│   GENETIC: ★ health panic threshold (currently hardcoded 0.3)
│
├─ [5] Fullness < 20? → Urgent eat (inventory only)
│   GENETIC: ★ critical hunger threshold
│
├─ [6] Hygiene < 20? → Urgent drink (inventory only)
│   GENETIC: ★ critical hygiene threshold
│
├─ [7] Energy < 40? → Voluntary sleep (or attack if fails)
│   GENETIC: ★ energy conservation gene (when to rest proactively)
│
├─ [8] Age > 80% max? → Urgent reproduce
│   GENETIC: ★ reproduction urgency age, fertility
│
├─ [9] Fullness < 40? → Proactive food seek
│   GENETIC: ★ hunger awareness (when to start seeking)
│
├─ [10] Hygiene < 40? → Proactive water seek
│   GENETIC: ★ hygiene awareness
│
├─ [11] Adjacent partner + rel ≥ 0.4 + energy ≥ 90? → Reproduce
│   GENETIC: ★★ energy threshold for reproduction, relationship threshold
│
├─ [12] chooseAttack() → probability = aggression + modifiers
│   GENETIC: ★★★ aggression (exists), attack speed, damage, target selection
│   Formula: p = clamp(aggression + enemyBonus(0.25) - relPenalty - healthPenalty)
│
├─ [13] chooseShareHealTalk() → probability = cooperation + modifiers
│   GENETIC: ★★★ cooperation (exists), generosity, heal priority
│   Formula: p = clamp(cooperation + factionBonus(0.25))
│
└─ OPPORTUNISTIC (no priority, checked sequentially):
    ├─ Poop timer active? → 10% chance
    │   GENETIC: metabolism rate
    ├─ Near own flag + needs resources? → Withdraw
    ├─ Adjacent food? → 40% harvest chance
    │   GENETIC: ★ harvest eagerness
    ├─ Adjacent wood? → 30% harvest chance
    ├─ Loot bag nearby? → Pickup
    │   GENETIC: opportunism
    ├─ Adjacent poop + inspiration < 60? → Clean
    │   GENETIC: cleanliness threshold
    ├─ Adjacent interactable + inspiration < 40? → Play
    │   GENETIC: playfulness threshold
    ├─ Near own flag + inventory ≥ 3? → Deposit
    │   GENETIC: loyalty/hoarding gene
    ├─ Wood ≥ 3 + energy ≥ 6? → 3% build farm
    │   GENETIC: industriousness
    └─ Nothing? → biasedRoam()
        GENETIC: ★ roam distance preference (already documented, not implemented)
```

---

## 5. Naming System — Current State

- **Name**: 6-character random pronounceable string (e.g., "Baluko", "Temiga")
- **No family name, no surname, no lineage tracking**
- Generated via `generatePronounceableString(6)` at `agent-factory.ts:10` and `:33`
- Names are used in logs, UI inspector, and faction displays
- No relationship between parent names and child names

---

## 6. Current Inheritance (reproduction) — What Gets Passed Down

| Property | Inheritance Method | Genetics Opportunity |
|----------|-------------------|---------------------|
| Aggression | Average of parents | Add mutation, variance |
| Cooperation | Average of parents | Add mutation, variance |
| Faction | 50/50 from either parent | Keep as-is |
| Fullness | Donated (15–25 from each parent) | Genetic fertility cost |
| Everything else | Hardcoded defaults | **All should become genetic** |

**Critical gap**: Averaging with no mutation means traits converge to 0.5 over generations. There's no evolutionary pressure, no drift, no selection. The population homogenizes.

---

## 7. Key Hardcoded Values That Should Become Genetic

### Tier 1 — High Impact (directly shape agent identity)
| Value | Current | Where | Impact |
|-------|---------|-------|--------|
| Base max health | 100 | `agent.ts:93` | Survivability |
| Health per level | +8 | `agent.ts:194` | Late-game power |
| Base attack | 8.0 | `constants.ts:41` | Combat damage |
| Attack per level | +1.5 | `agent.ts:195` | Combat scaling |
| XP per level | `level × 25` | `agent.ts:183` | Learning speed |
| Max age range | 240k–360k ms | `constants.ts:54` | Lifespan |
| Flee threshold | Implicit (healthPenalty when HP < 50%) | `interaction-engine.ts:228` | Survival instinct |
| Reproduce energy threshold | 90 | `constants.ts:58` | Fertility |

### Tier 2 — Medium Impact (shape behavior preferences)
| Value | Current | Impact |
|-------|---------|--------|
| Energy passive drain | -0.0625/tick | Metabolism |
| Fullness passive decay | -0.03/tick | Hunger rate |
| Fullness critical threshold | 20 | When to panic about food |
| Fullness seek threshold | 40 | When to proactively seek food |
| Hygiene critical/seek thresholds | 20/40 | Cleanliness priority |
| Sleep mandatory threshold | 20 | Exhaustion tolerance |
| Inspiration seek threshold | 40 | Playfulness |
| Build farm chance | 3.125% | Industriousness |
| Movement energy cost | 0.12/cell | Travel efficiency |
| Roam distance | ±6 cells | Exploration tendency |

### Tier 3 — Flavor (add personality without major balance impact)
| Value | Current | Impact |
|-------|---------|--------|
| Share/heal relationship gain | +0.14 | Social bonding speed |
| Talk positive chance | 75% | Positivity |
| Attack same-faction leave chance | 30% | Loyalty |
| Deposit threshold (inventory ≥ 3) | 3 | Generosity vs hoarding |
| Harvest preference (food 40% / wood 30%) | Fixed | Resource specialization |

---

## 8. Structural Problems (the "patched together" issue)

1. **`simulation-engine.ts`** (~1300 lines) — The tick loop is a monolithic function with deeply nested conditionals. Food seeking alone is a ~80-line waterfall of `if/else if`.

2. **`interaction-engine.ts`** — The `consider()` method is a 175-line priority chain of `if` statements. Each priority level is inline rather than being a strategy/behavior object.

3. **`action-processor.ts`** — The `process()` method has a large switch-like structure for each action type's periodic and completion effects.

4. **All thresholds are global constants** — Good for global tuning, but genetics needs per-agent values. Currently every agent shares the same thresholds from `constants.ts`.

5. **No gene/chromosome abstraction** — Traits are just two flat numbers on the Agent class. No structure for grouping related genes, expressing them, or mutating them.

---

## 9. Notes & Open Questions for PRD

- **Mutation mechanics**: Simple random drift (±0.1)? Or bell-curve around parent average? Selection pressure needs mutation or population converges to mean.
- **Gene expression**: Do all genes express linearly? Or are some dominant/recessive? (probably too complex for this game)
- **Auto-balance mechanism**: User wants genetics to auto-balance. How? Natural selection — agents with bad gene combos die out faster. Needs enough generation turnover to work.
- **Family names**: Child takes the surname of the agent who *initiated* the reproduce action. Need to track `familyName` separately from `name`. Surname persists across generations; first name is still random.
- **Gene display in UI**: Inspector panel should show genome. What's readable without being overwhelming?
- **Gene caps**: Some genes need hard limits to prevent degenerate strategies (e.g., zero metabolism, infinite aggression).
- **Refactor scope**: To properly implement genetics, the threshold system needs to move from global constants to per-agent gene values. This is a significant refactor of `interaction-engine.ts` and `simulation-engine.ts`.
