/**
 * Seed achievements, level definitions, avatar templates, rewards.
 * Usage: node scripts/seed-gamification.mjs
 */
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL required");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url });

const achievements = [
  {
    achievement_id: "first-order",
    title: "First Order",
    description: "Complete your first execution order",
    trigger_condition: { type: "xp-milestone", value: 50 },
    xp_reward: 25,
    rarity: "common",
  },
  {
    achievement_id: "level-5",
    title: "Rising Executor",
    description: "Reach level 5",
    trigger_condition: { type: "level-reached", value: 5 },
    xp_reward: 50,
    rarity: "rare",
  },
  {
    achievement_id: "level-10",
    title: "Seasoned Builder",
    description: "Reach level 10",
    trigger_condition: { type: "level-reached", value: 10 },
    xp_reward: 100,
    rarity: "epic",
  },
  {
    achievement_id: "principle-7-streak",
    title: "Principle Streak",
    description: "7-day principles streak",
    trigger_condition: { type: "streak-milestone", value: 7, streakType: "principles" },
    xp_reward: 40,
    rarity: "rare",
  },
  {
    achievement_id: "execution-30-streak",
    title: "Unstoppable",
    description: "30-day execution streak",
    trigger_condition: { type: "streak-milestone", value: 30, streakType: "execution" },
    xp_reward: 150,
    rarity: "legendary",
  },
];

const avatarTemplates = [
  {
    avatar_name: "Executor I",
    base_asset_url: "/avatars/executor-1.svg",
    evolution_level: 1,
    customization_options: {
      colors: ["violet", "emerald", "sky", "amber"],
      accessories: ["badge"],
      poses: ["standing", "focused"],
    },
  },
  {
    avatar_name: "Executor II",
    base_asset_url: "/avatars/executor-2.svg",
    evolution_level: 5,
    customization_options: {
      colors: ["violet", "emerald", "sky", "amber", "rose"],
      accessories: ["badge", "aura"],
      poses: ["standing", "triumphant", "focused"],
    },
  },
  {
    avatar_name: "Executor III",
    base_asset_url: "/avatars/executor-3.svg",
    evolution_level: 10,
    customization_options: {
      colors: ["violet", "emerald", "sky", "amber", "rose", "gold"],
      accessories: ["badge", "aura", "crown"],
      poses: ["standing", "triumphant", "floating", "focused"],
    },
  },
];

const rewards = [
  {
    reward_id: "badge-500xp",
    reward_type: "badge",
    title: "500 XP Badge",
    description: "Earned at 500 total XP",
    unlock_requirement: "xp:500",
  },
  {
    reward_id: "cosmetic-cape",
    reward_type: "cosmetic",
    title: "Executor Cape",
    description: "Unlocked at level 5",
    unlock_requirement: "level:5",
  },
  {
    reward_id: "title-executor",
    reward_type: "title",
    title: "The Executor",
    description: "Unlocked at level 10",
    unlock_requirement: "level:10",
  },
];

async function upsertAchievement(a) {
  await pool.query(
    `INSERT INTO achievements (achievement_id, title, description, trigger_condition, xp_reward, rarity)
     VALUES ($1, $2, $3, $4::jsonb, $5, $6)
     ON CONFLICT (achievement_id) DO UPDATE SET
       title = EXCLUDED.title,
       description = EXCLUDED.description,
       trigger_condition = EXCLUDED.trigger_condition,
       xp_reward = EXCLUDED.xp_reward,
       rarity = EXCLUDED.rarity`,
    [
      a.achievement_id,
      a.title,
      a.description,
      JSON.stringify(a.trigger_condition),
      a.xp_reward,
      a.rarity,
    ],
  );
}

async function main() {
  for (let level = 1; level <= 20; level++) {
    let cumulative = 0;
    let xpForLevel = 100;
    for (let l = 1; l < level; l++) {
      cumulative += xpForLevel;
      xpForLevel += 50;
    }
    await pool.query(
      `INSERT INTO level_definitions (level, xp_required_total, milestone_title, milestone_description, avatar_evolution_unlocked, new_cosmetics_available)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       ON CONFLICT (level) DO UPDATE SET
         xp_required_total = EXCLUDED.xp_required_total,
         milestone_title = EXCLUDED.milestone_title,
         avatar_evolution_unlocked = EXCLUDED.avatar_evolution_unlocked`,
      [
        level,
        cumulative,
        `Level ${level}`,
        level % 5 === 0 ? `Major milestone at level ${level}` : null,
        level === 5 || level === 10,
        JSON.stringify(level >= 5 ? ["aura"] : []),
      ],
    );
  }

  for (const a of achievements) await upsertAchievement(a);

  for (const t of avatarTemplates) {
    await pool.query(
      `INSERT INTO avatar_templates (avatar_name, base_asset_url, customization_options, evolution_level)
       SELECT $1, $2, $3::jsonb, $4
       WHERE NOT EXISTS (SELECT 1 FROM avatar_templates WHERE avatar_name = $1)`,
      [t.avatar_name, t.base_asset_url, JSON.stringify(t.customization_options), t.evolution_level],
    );
  }

  for (const r of rewards) {
    await pool.query(
      `INSERT INTO rewards (reward_id, reward_type, title, description, unlock_requirement)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (reward_id) DO NOTHING`,
      [r.reward_id, r.reward_type, r.title, r.description, r.unlock_requirement],
    );
  }

  console.log("Gamification seed complete");
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
