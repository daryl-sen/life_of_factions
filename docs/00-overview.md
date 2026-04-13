# Emoji Life - Agent Behavior Documentation (v4.2)

## Overview

Emoji Life is a zero-player, real-time 2D sandbox simulation where autonomous agents ("little people") live on a 62×62 grid world. Agents gather resources, interact socially, form factions, reproduce, build structures, and fight over territory.

## What's New in v4.2

- **Three gestation paths** via the `AG` gene: transfer mechanic (gradual need-transfer), instant birth (zero starting needs), or v4 countdown fallback
- **Volatility-driven mutation** via the `AP` gene: each agent's offspring mutation rate is genetic
- **Sociality gene** (`AD`): replaces Gregariousness (`OO`) as the canonical social decay gene
- **Action energy costs** are now per-agent and level-scaled via cost functions
- **AnimationRunner**: action- and event-based per-agent animations (shake, bob, bounce, etc.)
- **IndicatorRenderer**: configurable 3-slot indicators above each agent (faction flag, pregnancy, health, mood, level)
- **ToolRenderer**: generalised tool-line rendering for all targeted actions
- **WorldGenerator**: Voronoi-style isolation barriers create semi-separated population pockets
- **Indicator config UI**: runtime-configurable indicator slots in the Interaction Tools panel

## Key Concepts

- **Agents**: Autonomous entities with unique genomes, relationships, and goals
- **Genetics**: DNA-based trait system — each agent's stats and behaviors derive from a `Genome` parsed at birth. Traits are continuous (no hard upper ceiling) so genetic specialization is possible.
- **Entity Classes**: Baby → Adult → Elder lifecycle with different capabilities
- **Needs**: Four survival needs (fullness, hygiene, social, inspiration) that drive decision-making
- **Energy System**: Core resource — recovered only via sleep, drained by actions (scaled by traits and level) and movement
- **Relationships**: Bidirectional bonds between agents that evolve through interactions
- **Factions**: Groups formed from strong relationships, complete with flags and healing auras
- **Autosave**: World state is automatically saved to localStorage every 60 seconds and restored on page load (v4.2 save format; v4 saves are backward compatible)

## Documentation Structure

| File | Description |
|------|-------------|
| `01-agent-structure.md` | Agent data model, properties, and lifecycle |
| `02-traits.md` | Genetics system and all trait categories (v4.2) |
| `03-decision-making.md` | How agents choose actions each tick |
| `04-actions.md` | All available actions: costs, durations, effects |
| `05-social-behavior.md` | Interactions, relationships, and social dynamics |
| `06-movement.md` | Pathfinding, roaming preferences, and navigation |
| `07-factions.md` | Faction formation, mechanics, and flag behavior |
| `08-resources.md` | Energy, food, crops, farms, and economy |
| `09-combat.md` | Attack mechanics, leveling, and combat behavior |
| `10-reproduction.md` | Breeding mechanics, gestation paths, and inheritance (v4.2) |

## Quick Reference

### Energy Thresholds

| Threshold | Value | Behavior Trigger |
|-----------|-------|------------------|
| Mandatory sleep | < 20 | Force sleep action |
| Voluntary sleep | < 40 | May choose to sleep |
| Normal | 40+ | Normal behavior |
| Cap | genetic (maxEnergy) | Maximum energy |

### Action Types

- **Social**: `talk`, `quarrel`, `heal`, `share`
- **Combat**: `attack`
- **Survival**: `sleep`, `eat`, `wash`
- **Resource**: `harvest`, `deposit`, `withdraw`, `pickup`
- **Hygiene**: `poop`, `clean`
- **Leisure**: `play`
- **Build**: `build_farm`
- **Reproduction**: `reproduce`, `seek_mate`, `await_mate`

### World Objects

- **Food blocks**: Harvestable food sources — HQ (🥔🍎🍑🌽🍅) and LQ (🌿🥬🥦🍀)
- **Water blocks**: Small (1-cell) and Large (2×2) harvestable water sources
- **Trees**: Wood sources (🌲🌳🌴🎄), spawn seedlings and food
- **Farms**: Produce HQ food on a timer (🌻)
- **Obstacles**: Destructible barriers (🪨) — placed randomly and as Voronoi isolation barriers
- **Flags**: Faction storage/healing points (🚩)
- **Loot bags**: Temporary resource containers from death/flag destruction (👝)
- **Poop blocks**: Hygiene hazards (💩)
- **Seedlings**: Growing into trees (🌱)
- **Eggs**: Hatchable agent spawns (🥚)
