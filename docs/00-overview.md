# Life of Factions - Agent Behavior Documentation

## Overview

Life of Factions is a zero-player, real-time 2D sandbox simulation where autonomous agents ("little people") live on a 62×62 grid world. Agents gather resources, interact socially, form factions, reproduce, build structures, and fight over territory.

## Key Concepts

- **Agents**: Autonomous entities with unique personalities, relationships, and goals
- **Traits**: Personality attributes (aggression, cooperation) that influence behavior
- **Energy System**: The core resource driving all agent decisions
- **Relationships**: Bidirectional bonds between agents that evolve through interactions
- **Factions**: Groups formed from strong relationships, complete with flags and healing auras

## Documentation Structure

| File | Description |
|------|-------------|
| `01-agent-structure.md` | Agent data model, properties, and lifecycle |
| `02-traits.md` | Personality traits and their behavioral effects |
| `03-decision-making.md` | How agents choose actions each tick |
| `04-actions.md` | All available actions: costs, durations, effects |
| `05-social-behavior.md` | Interactions, relationships, and social dynamics |
| `06-movement.md` | Pathfinding, roaming preferences, and navigation |
| `07-factions.md` | Faction formation, mechanics, and flag behavior |
| `08-resources.md` | Energy, food, crops, farms, and economy |
| `09-combat.md` | Attack mechanics, leveling, and combat behavior |
| `10-reproduction.md` | Breeding mechanics and inheritance |

## Quick Reference

### Energy Thresholds

| Threshold | Value | Behavior Trigger |
|-----------|-------|------------------|
| Critical | 0 | Starvation damage (1 HP/sec) |
| Low | 40 | Cancel non-attack actions, seek food |
| Well-fed | 70+ | Stop actively seeking food |
| High | 140+ | Level-up eligible |
| Cap | 200 | Maximum energy |

### Action Types

- **Social**: `talk`, `quarrel`, `heal`, `help`
- **Combat**: `attack`
- **Reproduction**: `reproduce`
- **Building**: `build_farm`

### World Objects

- **Crops**: Harvestable energy sources (🌿🌱🍀🌾🥕🍅🫛)
- **Farms**: Boost crop spawning in radius 3 (🌻)
- **Walls**: Destructible barriers (🧱)
- **Flags**: Faction spawn/healing points (🚩)
