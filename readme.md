# Welcome to **Life of Factions**

A cozy-chaotic little world plays itself on a 62×62 grid. Tiny agents wander, chat, help, quarrel, build, farm, fall in love, have kids, form factions, and sometimes… start fights. Your role isn’t to micromanage—it's to **set the stage**, hit **Start**, and enjoy the story that unfolds.

Visit https://daryl-sen.github.io/life_of_factions/ to start now!

Note: This is a proof of concept for a bigger project later on. Stay tuned!

---

## 1) What You’ll See On Screen

**Canvas (middle):** The world. Each agent is a small circle with a colored border:

* **Border color** = the agent’s faction color (gray border if they don’t have one yet).
* **Green triangles** = crops (food!).
* **Yellow squares** = farms.
* **Purple-ish blocks** = walls.
* **Little flags** = faction spawn points.

**Over an agent’s head:**

* **Tiny red ▼** = low energy—this agent is hungry or tired.
* **Mini glyphs** show what they’re doing:

  * **+** healing, 🗨 chat/talk, ⚡ quarrel, ✖ attack, ❤ reproduce, 🪵 hammering walls, 🚩 attacking a flag (color matches the faction being targeted).
* **HP bar** (thin green bar) = health. When it empties, that agent dies.

**HUD (top-left of the canvas):** Tick counter, FPS, and totals for agents, factions, crops, farms, walls, flags.

**Event Log (right):** A live feed of what’s happening—talks, help, heals, fights, births, building, deaths, faction news.

**Inspector (right, above the log):** Click any agent on the canvas to see their name, faction, level, HP, energy, traits, and current action.

---

## 2) Your Controls (Left Panel)

**Start / Pause / Resume**

* **Start** initializes a fresh world with your chosen settings.
* **Pause** to freeze time. **Resume** to continue.

**Starting Agents**
Choose how many agents spawn at the beginning (20–300). Fewer agents = a calmer start.

**Speed**
Slow the world down to watch sweet moments unfold, or speed it up to see big stories develop.

**Crop Spawn Multiplier**
More crops means less famine and gentler politics; fewer crops means scarcity, stress, and fights.

**Spawn Crop**
Instantly add a random new crop.

**Save / Load**
Save a snapshot of your world to a file and load it later. Great for creating your favorite “world seeds.”

**(Auto-added) Pause When Unfocused**
A simple checkbox that stops the simulation when you switch tabs/windows, so you don’t miss the drama.

**Event Log Filters**
Toggle categories (talk, help, attack, etc.). Pick a specific **Agent** from the dropdown to follow their personal story.

---

## 3) How Agents Live

**Energy**
Energy slowly ticks down as time passes and when agents move or act. Eating crops restores energy. If someone stays at zero energy too long, they **starve**.

**Health (HP)**
Damaged in fights or when under attack. Heals near their faction’s flag (a gentle “aura”), or when another agent heals them. If HP hits zero, the agent dies.

**Levels**
Well-fed agents can level up: more max HP, stronger attacks. There’s a level cap to keep things fair.

**Personalities**
Every agent has a mix of **aggression** (more likely to attack) and **cooperation** (more likely to help or heal), plus a travel style (linger near base, roam far, or wander).

---

## 4) How They Interact

**Talking & Quarreling**
Hanging out boosts or bruises relationships. Friendly chats tend to warm things up; quarrels cool them down.

**Helping & Healing**
Kind agents share energy or patch up wounds—especially with faction mates nearby. Sometimes a helpful gesture persuades someone to **join a faction**.

**Attacking**
When tempers flare (or food is scarce), agents may attack those nearby—especially members of rival factions. Infighting can happen, too, and the weaker participant sometimes **quits the faction** in frustration.

**Walls & Farms**

* **Walls** block movement. Trapped agents will try to break a wall to escape.
* **Farms** make nearby crops more likely to appear. Building farms costs energy, so agents usually do it when they’re doing well.

**Reproduction**
When two compatible, well-fed, neighboring agents like each other enough, they may have a child. Kids inherit a blend of their parents’ tendencies.

---

## 5) Factions & Flags

**Founding a Faction**
Two unfactioned friends who get along really well may decide to found a new faction. A **flag** appears for them.

**Flags Matter**
The flag is home turf. Being near your own flag slowly heals you. Rival agents may try to damage or destroy a flag during conflict.

**Joining, Leaving, Switching**
Helpful acts can recruit outsiders. Infighting or bad blood can push members to leave. Whole factions can fade away if their members die.

---

## 6) Reading the Drama

**Signs of Prosperity**

* Lots of crops & farms
* Few red ▼ icons
* Healthy HP bars
* Friendly logs: talk / help / heal / reproduce

**Signs of Trouble**

* Many red ▼ icons and empty HP bars
* Frequent quarrels and attacks
* Agents clustering but not eating (increase crop spawn a bit!)

**Quick Fixes You Can Try**

* Tap **Spawn Crop** to break a famine.
* Lower **Speed** to follow a tense scene.
* Increase **Crop Spawn Multiplier** for a gentler world.
* Start with fewer agents to reduce early chaos.

---

## 7) A First-Run Mini Tour

1. Set **Starting Agents** to \~40.
2. Set **Speed** around 50–80% for a relaxed pace.
3. Keep **Crop Spawn** at 1.0× for a balanced ecosystem.
4. Click **Start** and watch.
5. Click an agent to open the **Inspector**—track their energy, HP, and current action.
6. In **Event Log**, select that agent in the **Agent** dropdown to follow their storyline.
7. When you spot the first **flag**, hover there to watch quiet healing and faction life.

Try nudging **Crop Spawn** up if you want cozier vibes, or down if you’re craving drama.

---

## 8) Frequently Asked Questions

**Do agents die?**
Yes—usually from starvation (long zero energy) or from losing too many fights.

**Can I make peace?**
You can’t order anyone around, but more crops mean fewer reasons to fight, and cooperative personalities tend to mellow things out.

**What makes new factions appear?**
Strong friendships between unfactioned agents. Watch for a celebratory log entry when a new flag pops up.

**How can I follow one character’s arc?**
Click them on the canvas, then choose them in the log’s **Agent** dropdown. You’ll see their conversations, assists, duels, and big life moments.

**My world got grim—what now?**
Slow it down, spawn a few crops, or start a fresh run with more starting food. You can always **Save** happy worlds and return later.

---

## 9) Little Legends to Watch For

* A soft-hearted healer keeping a faction alive near the flag.
* A restless wanderer who discovers new farmland and changes the food economy.
* Star-crossed neighbors who chat, help, heal… and eventually welcome a child.
* A faction torn by infighting, only to reform under a calmer banner.

Every run tells a different tale—some cozy, some chaotic, all emergent.

---

## 10) Quick Reference (Cheat Sheet)

* **Red ▼** = low energy (find crops!).
* **Green bar** = health.
* **Glyphs** = current action (✖ attack, + heal, ❤ reproduce, 🗨 talk, ⚡ quarrel, 🪵 wall work, 🚩 flag attack).
* **Flags** heal nearby allies; enemies sometimes target them.
* **More crops** → calmer world. **Scarcity** → conflict.
* **Save/Load** your favorite worlds. **Pause/Resume** anytime.

---

### Have fun—and tell me about the most dramatic run you witness! 👀
