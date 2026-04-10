- Add a reset button that replaces the "Start" button once a simulation has started
  - Button should be red to distinguish it from the Start button
  - Show confirmation dialog before resetting
  - Reset clears everything: simulation, all agents, world state, UI (inspector, logs)

- Trees should deplete faster when not near a water block
  - Trees currently die from old age (maxAgeMs) and can be harvested for wood
  - Add water proximity check to increase depletion rate or reduce maxAgeMs

- Water blocks should be passable, and trees can grow on it
  - Currently water blocks are marked as occupied/impassable in grid.ts
  - This prevents water blocks from spawning when there is no other space available

- Make salt water bodies bigger, and introduce fish
  - Current size: 60-150 tiles, target: 90-225 tiles (50% bigger)
  - Add fish as a harvestable resource in salt water

- Agents should wake up from sleep when attacked
  - Sleep is already marked as interruptible by attack
  - Verify the interrupt mechanism works correctly via _underAttack flag
