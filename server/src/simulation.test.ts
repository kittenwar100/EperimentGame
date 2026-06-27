import test from "node:test";
import assert from "node:assert/strict";
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  BOOST_CHARGES_PER_LIFE,
  BOOST_COOLDOWN_MS,
  BOOST_DURATION_MS,
  BULLET_RECHARGE_MS,
  FLAG_STEAL_PROTECTION_MS,
  FFA_CORNER_BASE_ZONE_RADIUS,
  getTeamCtfBaseRects,
  PLAYER_MAX_BULLET_CHARGES,
  PLAYER_RADIUS,
  ROUND_COUNTDOWN_MS,
  SPIKE_SLOW_DURATION_MS,
} from "../../shared/src";
import { ffaTeamHomeCenter } from "../../shared/src/octagon";
import { ArenaState } from "./state";
import { GameSimulation } from "./simulation";

test("addPlayer creates a living player", () => {
  const simulation = new GameSimulation(new ArenaState());
  simulation.addPlayer("p1", "Pilot");
  const player = simulation["state"].players.get("p1");

  assert.ok(player);
  assert.equal(player.name, "Pilot");
  assert.equal(player.alive, true);
  assert.equal(player.x >= 0 && player.x <= ARENA_WIDTH, true);
  assert.equal(player.y >= 0 && player.y <= ARENA_HEIGHT, true);
});

test("fire input creates a server projectile", () => {
  const state = new ArenaState();
  const simulation = new GameSimulation(state);
  simulation.addPlayer("p1", "Shooter");
  simulation.update(ROUND_COUNTDOWN_MS);
  simulation.setInput("p1", { moveX: 0, moveY: 0, aimX: 1, aimY: 0, boost: false, fire: true });

  simulation.update(16);

  assert.equal(state.projectiles.size >= 1, true);
  const hasPlayerProjectile = [...state.projectiles.values()].some((projectile) => projectile.ownerId === "p1");
  assert.equal(hasPlayerProjectile, true);
});

test("players have five bullets and spent bullets recharge after 30s", () => {
  const state = new ArenaState();
  const simulation = new GameSimulation(state);
  simulation.addPlayer("p1", "Shooter");
  const player = state.players.get("p1")!;
  assert.equal(player.bulletCharges, PLAYER_MAX_BULLET_CHARGES);

  simulation.update(ROUND_COUNTDOWN_MS);
  state.phase = "live";
  state.countdownMs = 0;

  simulation.setInput("p1", { moveX: 0, moveY: 0, aimX: 1, aimY: 0, boost: false, fire: true });
  simulation.update(16);
  simulation.setInput("p1", { moveX: 0, moveY: 0, aimX: 1, aimY: 0, boost: false, fire: false });
  assert.equal(player.bulletCharges, PLAYER_MAX_BULLET_CHARGES - 1);

  simulation.update(BULLET_RECHARGE_MS - 1);
  assert.equal(player.bulletCharges, PLAYER_MAX_BULLET_CHARGES - 1);

  simulation.update(1);
  assert.equal(player.bulletCharges, PLAYER_MAX_BULLET_CHARGES);
});

test("projectiles persist until they hit arena bounds", () => {
  const state = new ArenaState();
  const simulation = new GameSimulation(state);
  simulation.addPlayer("p1", "Shooter");
  simulation.update(ROUND_COUNTDOWN_MS);
  simulation.setInput("p1", { moveX: 0, moveY: 0, aimX: 1, aimY: 0, boost: false, fire: true });
  simulation.update(16);
  assert.equal(state.projectiles.size, 1);

  simulation.setInput("p1", { moveX: 0, moveY: 0, aimX: 1, aimY: 0, boost: false, fire: false });
  // Long run until the shot leaves the arena (bots may delete it earlier if they intersect).
  simulation.update(10_000);

  assert.equal(state.projectiles.size, 0);
});

test("projectiles push bots and enemy players, not just humans", () => {
  const state = new ArenaState();
  const simulation = new GameSimulation(state);
  simulation.addPlayer("human", "Shooter");
  simulation.addPlayer("bot-target", "Bot", true);
  const shooter = state.players.get("human")!;
  const botTarget = state.players.get("bot-target")!;
  shooter.team = "red";
  botTarget.team = "blue";
  // Center of the arena so ensureBots perimeter spawns cannot sit on the shot line.
  shooter.x = 6000;
  shooter.y = 4000;
  shooter.vx = 0;
  shooter.vy = 0;
  botTarget.x = 6800;
  botTarget.y = 4000;
  botTarget.vx = 0;
  botTarget.vy = 0;
  botTarget.bulletCharges = 0;
  state.phase = "live";
  state.countdownMs = 0;
  state.projectiles.clear();

  for (const other of state.players.values()) {
    if (other.id === "human" || other.id === "bot-target") continue;
    other.alive = false;
  }

  simulation.setInput("human", { moveX: 0, moveY: 0, aimX: 1, aimY: 0, boost: false, fire: true });
  simulation.update(16);
  simulation.setInput("human", { moveX: 0, moveY: 0, aimX: 1, aimY: 0, boost: false, fire: false });
  simulation.update(220);

  assert.equal(state.projectiles.size, 0);
  assert.equal(Math.abs(botTarget.vx) > 1 || Math.abs(botTarget.vy) > 1, true);
});

test("projectile colliding with spike destroys both instantly", () => {
  const state = new ArenaState();
  const simulation = new GameSimulation(state);
  simulation.addPlayer("human", "Shooter");
  const shooter = state.players.get("human")!;
  shooter.team = "red";
  shooter.x = 900;
  shooter.y = 900;
  shooter.vx = 0;
  shooter.vy = 0;
  state.phase = "live";
  state.countdownMs = 0;

  const firstSpike = state.spikes.values().next().value;
  assert.ok(firstSpike);
  firstSpike.x = 1060;
  firstSpike.y = 900;
  firstSpike.vx = 0;
  firstSpike.vy = 0;

  const initialSpikeCount = state.spikes.size;
  simulation.setInput("human", { moveX: 0, moveY: 0, aimX: 1, aimY: 0, boost: false, fire: true });
  simulation.update(16);
  simulation.setInput("human", { moveX: 0, moveY: 0, aimX: 1, aimY: 0, boost: false, fire: false });
  simulation.update(120);

  assert.equal(state.spikes.size, initialSpikeCount - 1);
  assert.equal(state.projectiles.size, 0);
});

test("bots collide with human players and separate", () => {
  const state = new ArenaState();
  const simulation = new GameSimulation(state);
  simulation.addPlayer("human", "Human");
  simulation.addPlayer("bot-a", "Bot A", true);
  const human = state.players.get("human")!;
  const bot = state.players.get("bot-a")!;
  human.x = 1200;
  human.y = 900;
  bot.x = 1210;
  bot.y = 900;
  human.vx = 0;
  human.vy = 0;
  bot.vx = 0;
  bot.vy = 0;
  state.phase = "live";
  state.countdownMs = 0;

  const beforeDistance = Math.hypot(human.x - bot.x, human.y - bot.y);
  simulation.update(16);
  const afterDistance = Math.hypot(human.x - bot.x, human.y - bot.y);

  assert.equal(afterDistance > beforeDistance, true);
});

test("match fills to three bots for balanced four-team matches", () => {
  const state = new ArenaState();
  const simulation = new GameSimulation(state);
  simulation.addPlayer("p1", "Pilot");
  simulation.update(16);
  const bots = [...state.players.values()].filter((player) => player.isBot);

  assert.equal(bots.length, 3);
  assert.equal(state.players.size, 4);
  const teamCounts = [...state.players.values()].reduce<Record<string, number>>((counts, player) => {
    counts[player.team] = (counts[player.team] ?? 0) + 1;
    return counts;
  }, {});
  assert.deepEqual(teamCounts, { red: 1, blue: 1, green: 1, yellow: 1 });
  for (const bot of bots) {
    const nearEdge = bot.x < 260 || bot.x > ARENA_WIDTH - 260 || bot.y < 260 || bot.y > ARENA_HEIGHT - 260;
    assert.equal(nearEdge, true);
  }
});

test("countdown prevents movement and firing", () => {
  const state = new ArenaState();
  const simulation = new GameSimulation(state);
  simulation.addPlayer("p1", "Frozen");
  const player = state.players.get("p1")!;
  const startX = player.x;
  const startY = player.y;
  simulation.setInput("p1", { moveX: 1, moveY: 0, aimX: 1, aimY: 0, boost: false, fire: true });

  simulation.update(500);

  assert.equal(player.x, startX);
  assert.equal(player.y, startY);
  assert.equal(state.projectiles.size, 0);
});

test("circle capture no longer awards a round point", () => {
  const state = new ArenaState();
  const simulation = new GameSimulation(state);
  simulation.addPlayer("p1", "Capturer");
  simulation.update(1);
  state.phase = "live";
  for (const player of state.players.values()) {
    player.team = "red";
    if (player.id === "p1") {
      player.x = state.captureX;
      player.y = state.captureY;
    } else {
      player.x = state.captureX + state.captureRadius + 400;
      player.y = state.captureY + state.captureRadius + 400;
    }
  }

  simulation.setInput("p1", { moveX: 0, moveY: 0, aimX: 1, aimY: 0, boost: false, fire: false });
  const step = 40;
  for (let t = 0; t < 8_000; t += step) {
    const p1 = state.players.get("p1")!;
    p1.x = state.captureX;
    p1.y = state.captureY;
    p1.vx = 200;
    p1.vy = 0;
    simulation.update(step);
  }

  assert.equal(state.redScore, 0);
  assert.equal(state.phase, "live");
  assert.equal(state.captureProgress, 0);
});

test("direct projectile hit steals neutral flag from an enemy carrier", () => {
  const state = new ArenaState();
  const simulation = new GameSimulation(state);
  simulation.addPlayer("human", "Shooter");
  simulation.addPlayer("victim", "Carrier");
  simulation.update(ROUND_COUNTDOWN_MS);

  const neutral = state.flags.get("flag-neutral");
  assert.ok(neutral);

  const shooter = state.players.get("human")!;
  const victim = state.players.get("victim")!;
  shooter.team = "red";
  victim.team = "blue";
  shooter.x = 800;
  shooter.y = 800;
  shooter.vx = 0;
  shooter.vy = 0;
  victim.x = 940;
  victim.y = 800;
  victim.vx = 0;
  victim.vy = 0;

  neutral.carrierId = victim.id;
  neutral.atBase = false;

  for (const other of state.players.values()) {
    if (other.id === "human" || other.id === "victim") continue;
    other.alive = false;
    other.x = 120;
    other.y = 120;
    other.vx = 0;
    other.vy = 0;
  }

  simulation.setInput("human", { moveX: 0, moveY: 0, aimX: 1, aimY: 0, boost: false, fire: true });
  simulation.update(16);
  simulation.setInput("human", { moveX: 0, moveY: 0, aimX: 1, aimY: 0, boost: false, fire: false });
  simulation.update(220);

  assert.equal(neutral.carrierId, "human");
});

test("spike hit explodes the obstacle and applies slowdown without stopping movement", () => {
  const state = new ArenaState();
  const simulation = new GameSimulation(state);
  simulation.addPlayer("p1", "Walker");
  simulation.update(ROUND_COUNTDOWN_MS);
  const player = state.players.get("p1")!;
  const firstSpike = state.spikes.values().next().value!;
  const initialSpikeCount = state.spikes.size;
  firstSpike.spikeKind = "standard";
  firstSpike.x = player.x;
  firstSpike.y = player.y;
  firstSpike.vx = 0;
  firstSpike.vy = 0;
  player.vx = 123;
  player.vy = -45;

  simulation.update(16);

  assert.equal(state.spikes.size, initialSpikeCount - 1, "hit spike should be consumed");
  assert.equal(state.slowZones.size > 0, true, "hit spike should leave a slowdown explosion zone");
  assert.equal(player.spikePermSlow, false, "spike slow should not apply a permanent penalty");
  assert.equal(player.spikeSlowMs > 0, true, "first spike hit should set the timed slow");
  assert.equal(player.spikeSlowMs <= SPIKE_SLOW_DURATION_MS, true);
  assert.equal(player.stunnedMs, 0, "new spike behavior must not stun");
  assert.equal(player.vx !== 0 || player.vy !== 0, true, "new spike behavior must not stop velocity");
});

test("boost requires a charge and starts a cooldown after the boost ends", () => {
  const state = new ArenaState();
  const simulation = new GameSimulation(state);
  simulation.addPlayer("p1", "Booster");
  simulation.update(ROUND_COUNTDOWN_MS);
  const player = state.players.get("p1")!;
  assert.equal(player.boostCharges, BOOST_CHARGES_PER_LIFE);

  simulation.setInput("p1", { moveX: 0, moveY: 0, aimX: 1, aimY: 0, boost: true, fire: false });
  simulation.update(16);
  assert.equal(player.boostCharges, BOOST_CHARGES_PER_LIFE - 1, "starting a boost consumes one charge");
  assert.equal(player.boostMs > 0, true, "boost timer should be running");

  // Hold boost through the full duration; cooldown should kick in after.
  simulation.update(BOOST_DURATION_MS + 32);
  assert.equal(player.boostMs, 0, "boost should be drained");
  assert.equal(player.boostCooldownMs > 0, true, "cooldown must start after boost ends");
  assert.equal(player.boostCooldownMs <= BOOST_COOLDOWN_MS, true);

  // Trying to boost again before cooldown expires must not consume a charge.
  const chargesBefore = player.boostCharges;
  simulation.setInput("p1", { moveX: 0, moveY: 0, aimX: 1, aimY: 0, boost: true, fire: false });
  simulation.update(16);
  assert.equal(player.boostCharges, chargesBefore, "boost must not start while cooldown is active");
});

test("releasing space mid-boost ends the boost immediately and starts the cooldown", () => {
  const state = new ArenaState();
  const simulation = new GameSimulation(state);
  simulation.addPlayer("p1", "Booster");
  simulation.update(ROUND_COUNTDOWN_MS);
  const player = state.players.get("p1")!;

  simulation.setInput("p1", { moveX: 0, moveY: 0, aimX: 1, aimY: 0, boost: true, fire: false });
  simulation.update(500);
  assert.equal(player.boostMs > 0, true);

  simulation.setInput("p1", { moveX: 0, moveY: 0, aimX: 1, aimY: 0, boost: false, fire: false });
  simulation.update(16);
  assert.equal(player.boostMs, 0, "releasing space must end the boost");
  assert.equal(player.boostCooldownMs > 0, true, "cooldown must engage when boost ends");
});

test("team_ctf assigns a second human to the opposite team and keeps four-vs-four", () => {
  const state = new ArenaState();
  const simulation = new GameSimulation(state);
  state.gameMode = "team_ctf";
  simulation.addPlayer("h1", "Pilot");
  simulation.update(16);
  const botBefore = [...state.players.values()].find((p) => p.isBot && p.team === "blue")!;
  const botX = botBefore.x;
  const botY = botBefore.y;
  simulation.addHumanReplacingBot("h2", "Friend");
  simulation.update(16);

  const h1 = state.players.get("h1")!;
  const h2 = state.players.get("h2")!;
  assert.notEqual(h1.team, h2.team, "humans should be on opposite teams in team CTF");
  assert.equal(h2.team, "blue", "second human should take the blue bot slot");
  assert.equal(Math.hypot(h2.x - botX, h2.y - botY) < 1, true, "human should spawn where the bot was");
  assert.equal(state.players.size, 8, "team_ctf must stay at 8 players (humans replace bots)");

  const redCount = [...state.players.values()].filter((p) => p.team === "red").length;
  const blueCount = [...state.players.values()].filter((p) => p.team === "blue").length;
  assert.equal(redCount, 4);
  assert.equal(blueCount, 4);
});

test("team_ctf only balances red/blue and fills bots to four-vs-four", () => {
  const state = new ArenaState();
  const simulation = new GameSimulation(state);
  state.gameMode = "team_ctf";
  simulation.addPlayer("h1", "Pilot");
  simulation.update(16);
  const teams = new Set([...state.players.values()].map((p) => p.team));
  for (const team of teams) {
    assert.equal(team === "red" || team === "blue", true, `team_ctf must not assign ${team}`);
  }
  assert.equal(state.players.size, 8, "team_ctf must backfill to 8 players (4v4)");
});

test("team_ctf bases are full-height left and right side strips", () => {
  const bases = getTeamCtfBaseRects();
  assert.equal(bases.red.minY, PLAYER_RADIUS);
  assert.equal(bases.red.maxY, ARENA_HEIGHT - PLAYER_RADIUS);
  assert.equal(bases.blue.minY, PLAYER_RADIUS);
  assert.equal(bases.blue.maxY, ARENA_HEIGHT - PLAYER_RADIUS);
  assert.equal(bases.red.minX < bases.blue.minX, true);
  assert.equal(bases.red.maxX < ARENA_WIDTH * 0.2, true);
  assert.equal(bases.blue.minX > ARENA_WIDTH * 0.8, true);
});

test("solo FFA with one human replaces a bot and keeps seven fillers", () => {
  const state = new ArenaState();
  const simulation = new GameSimulation(state);
  state.gameMode = "ffa";
  simulation.prepareSoloFfaForHumanJoin();
  simulation.addHumanReplacingBot("h1", "Pilot");
  simulation.update(16);
  assert.equal(state.players.size, 8, "solo FFA stays at 8 players (1 human + 7 bots)");
  assert.equal([...state.players.values()].filter((p) => !p.isBot).length, 1);
  assert.equal([...state.players.values()].filter((p) => p.isBot).length, 7);
  assert.equal(state.players.get("h1")!.team.startsWith("ffa"), true);
});

test("solo FFA two humans replace bots on unique teams with six fillers", () => {
  const state = new ArenaState();
  const simulation = new GameSimulation(state);
  state.gameMode = "ffa";
  simulation.prepareSoloFfaForHumanJoin();
  simulation.addHumanReplacingBot("h1", "Pilot");
  simulation.update(16);
  simulation.addHumanReplacingBot("h2", "Friend");
  simulation.update(16);

  const h1 = state.players.get("h1")!;
  const h2 = state.players.get("h2")!;
  assert.notEqual(h1.team, h2.team, "solo FFA humans must never share a team");
  assert.equal(state.players.size, 8, "solo FFA stays at 8 players (2 humans + 6 bots)");
  assert.equal([...state.players.values()].filter((p) => p.isBot).length, 6);

  const humanTeams = [...state.players.values()].filter((p) => !p.isBot).map((p) => p.team);
  assert.equal(new Set(humanTeams).size, 2, "each human must occupy a distinct solo team slot");
});

test("reconcile evicts duplicate humans from the same ffa base", () => {
  const state = new ArenaState();
  const simulation = new GameSimulation(state);
  state.gameMode = "ffa";
  simulation.prepareSoloFfaForHumanJoin();
  simulation.joinSoloFfaHuman("h1", "One", 0);
  simulation.joinSoloFfaHuman("h2", "Two", 0);
  simulation.reconcileSoloFfaHumanTeamsNow();

  assert.equal(state.players.get("h1")!.team, "ffa0");
  assert.equal(state.players.get("h2")!.team, "ffa1");
});

test("joinSoloFfaHuman forces slot index to team mapping", () => {
  const state = new ArenaState();
  const simulation = new GameSimulation(state);
  state.gameMode = "ffa";
  simulation.prepareSoloFfaForHumanJoin();
  simulation.joinSoloFfaHuman("h1", "One", 0);
  simulation.joinSoloFfaHuman("h2", "Two", 1);
  simulation.reconcileSoloFfaHumanTeamsNow();

  assert.equal(state.players.get("h1")!.team, "ffa0");
  assert.equal(state.players.get("h2")!.team, "ffa1");
});

test("second human never shares ffa0 when both joins request slot 0", () => {
  const state = new ArenaState();
  const simulation = new GameSimulation(state);
  state.gameMode = "ffa";
  simulation.prepareSoloFfaForHumanJoin();
  simulation.addHumanReplacingBot("h1", "Pilot", 0);
  simulation.finalizeSoloFfaHumanPlacement("h1", 0);
  simulation.addHumanReplacingBot("h2", "Friend", 0);
  simulation.finalizeSoloFfaHumanPlacement("h2", 0);
  simulation.reconcileSoloFfaHumanTeamsNow();

  const h1 = state.players.get("h1")!;
  const h2 = state.players.get("h2")!;
  assert.equal(h1.team, "ffa0");
  assert.equal(h2.team, "ffa1", "second human must not reuse ffa0/red when slot 0 is taken");
});

test("solo FFA second human gets ffa1 even when first human team field is wrong", () => {
  const state = new ArenaState();
  const simulation = new GameSimulation(state);
  state.gameMode = "ffa";
  simulation.prepareSoloFfaForHumanJoin();
  simulation.addHumanReplacingBot("h1", "Pilot", 0);
  simulation.finalizeSoloFfaHumanPlacement("h1", 0);
  state.players.get("h1")!.team = "red";
  simulation.addHumanReplacingBot("h2", "Friend", 1);
  simulation.finalizeSoloFfaHumanPlacement("h2", 1);
  simulation.update(16);

  const h1 = state.players.get("h1")!;
  const h2 = state.players.get("h2")!;
  assert.equal(h1.team, "ffa0", "first human slot must stay on ffa0");
  assert.equal(h2.team, "ffa1", "second human slot must stay on ffa1, not red/ffa0");
});

test("solo FFA enforces one player per base when duplicate teams appear", () => {
  const state = new ArenaState();
  const simulation = new GameSimulation(state);
  state.gameMode = "ffa";
  simulation.prepareSoloFfaForHumanJoin();
  simulation.addHumanReplacingBot("h1", "Pilot", 0);
  simulation.addHumanReplacingBot("h2", "Friend", 1);
  state.players.get("h2")!.team = state.players.get("h1")!.team;
  simulation.update(16);

  assert.equal(state.players.size, 8, "solo FFA keeps eight players total");
  const teams = [...state.players.values()].map((p) => p.team);
  assert.equal(new Set(teams).size, teams.length, "duplicate solo teams must be reassigned to open bases");
  assert.equal([...state.players.values()].filter((p) => p.isBot).length, 6);
});

test("solo FFA mid-match join places human on a unique base", () => {
  const state = new ArenaState();
  const simulation = new GameSimulation(state);
  state.gameMode = "ffa";
  simulation.prepareSoloFfaForHumanJoin();
  simulation.addHumanReplacingBot("h1", "Pilot", 0);
  simulation.finalizeSoloFfaHumanPlacement("h1", 0);
  simulation.update(ROUND_COUNTDOWN_MS + 16);
  simulation.addHumanReplacingBot("h2", "Friend", 1);
  simulation.finalizeSoloFfaHumanPlacement("h2", 1);

  const h1 = state.players.get("h1")!;
  const h2 = state.players.get("h2")!;
  assert.notEqual(h1.team, h2.team, "second human must not share the first human's team");
  const h2Home = ffaTeamHomeCenter(h2.team);
  assert.ok(h2Home);
  assert.ok(
    Math.hypot(h2.x - h2Home!.x, h2.y - h2Home!.y) < FFA_CORNER_BASE_ZONE_RADIUS + 48,
    "late joiner should spawn at their octagon base",
  );
  assert.equal(state.players.size, 8, "solo FFA stays at 8 after mid-match join");
  assert.equal([...state.players.values()].filter((p) => p.isBot).length, 6);
});

test("solo FFA ArenaRoom join flow assigns each human a distinct base", () => {
  const state = new ArenaState();
  const simulation = new GameSimulation(state);
  state.gameMode = "ffa";
  simulation.prepareSoloFfaForHumanJoin();
  simulation.addHumanReplacingBot("h1", "Pilot", 0);
  simulation.restartMatch();
  simulation.finalizeSoloFfaHumanPlacement("h1", 0);
  simulation.addHumanReplacingBot("h2", "Friend", 1);
  simulation.finalizeSoloFfaHumanPlacement("h2", 1);
  simulation.addHumanReplacingBot("h3", "Guest", 2);
  simulation.finalizeSoloFfaHumanPlacement("h3", 2);

  const humans = [...state.players.values()].filter((p) => !p.isBot);
  assert.equal(humans.length, 3);
  const teams = humans.map((p) => p.team);
  assert.equal(new Set(teams).size, 3, "each human must occupy a unique ffa team slot");
  for (const human of humans) {
    const home = ffaTeamHomeCenter(human.team);
    assert.ok(home);
    assert.ok(
      Math.hypot(human.x - home!.x, human.y - home!.y) < FFA_CORNER_BASE_ZONE_RADIUS + 48,
      `${human.id} should spawn at team base ${human.team}`,
    );
  }
});

test("solo FFA second human gets ffa1 when first human occupies ffa0", () => {
  const state = new ArenaState();
  const simulation = new GameSimulation(state);
  state.gameMode = "ffa";
  simulation.prepareSoloFfaForHumanJoin();
  simulation.addHumanReplacingBot("h1", "Pilot", 0);
  simulation.finalizeSoloFfaHumanPlacement("h1", 0);
  state.players.get("h1")!.team = "ffa0";
  simulation.addHumanReplacingBot("h2", "Friend", 1);
  simulation.finalizeSoloFfaHumanPlacement("h2", 1);

  const h1 = state.players.get("h1")!;
  const h2 = state.players.get("h2")!;
  assert.equal(h1.team, "ffa0");
  assert.equal(h2.team, "ffa1", "second human must take the next open ffa slot, not ffa0");
});

test("solo FFA second human replaces a bot on a unique team at base", () => {
  const state = new ArenaState();
  const simulation = new GameSimulation(state);
  state.gameMode = "ffa";
  simulation.addPlayer("h1", "Pilot");
  simulation.finalizeSoloFfaHumanPlacement("h1", 0);
  simulation.addPlayer("bot-1", "", true);
  state.players.get("bot-1")!.team = "ffa1";
  simulation.addHumanReplacingBot("h2", "Friend", 1);
  simulation.finalizeSoloFfaHumanPlacement("h2", 1);

  const h1 = state.players.get("h1")!;
  const h2 = state.players.get("h2")!;
  assert.notEqual(h1.team, h2.team);
  assert.equal(h2.team, "ffa1");
  const home = ffaTeamHomeCenter(h2.team);
  assert.ok(home);
  assert.ok(Math.hypot(h2.x - home!.x, h2.y - home!.y) < FFA_CORNER_BASE_ZONE_RADIUS + 48);
});

test("neutral flag cannot be scored from the center capture circle", () => {
  const state = new ArenaState();
  const simulation = new GameSimulation(state);
  state.gameMode = "ffa";
  simulation.addPlayer("p1", "Carrier");
  simulation.update(ROUND_COUNTDOWN_MS);
  const player = state.players.get("p1")!;
  player.team = "ffa0";
  const neutral = state.flags.get("flag-neutral");
  assert.ok(neutral);
  neutral.carrierId = player.id;
  neutral.atBase = false;
  player.x = state.captureX;
  player.y = state.captureY;

  simulation.update(500);

  assert.equal(player.wins, 0);
  assert.equal(state.ffa0Score ?? 0, 0);
});

test("solo FFA bots respawn at their octagon bases after round start", () => {
  const state = new ArenaState();
  const simulation = new GameSimulation(state);
  state.gameMode = "ffa";
  simulation.prepareSoloFfaForHumanJoin();
  simulation.addHumanReplacingBot("h1", "Pilot");
  simulation.restartMatch();

  for (const player of state.players.values()) {
    if (!player.isBot) continue;
    const home = ffaTeamHomeCenter(player.team);
    assert.ok(home, `bot team ${player.team} should have a base`);
    assert.ok(
      Math.hypot(player.x - home!.x, player.y - home!.y) < FFA_CORNER_BASE_ZONE_RADIUS + 48,
      `bot on ${player.team} should spawn at its base`,
    );
  }
});

test("direct projectile hit does not steal flag from a teammate", () => {
  const state = new ArenaState();
  const simulation = new GameSimulation(state);
  simulation.addPlayer("human", "Shooter");
  simulation.addPlayer("victim", "Carrier");
  simulation.update(ROUND_COUNTDOWN_MS);

  const neutral = state.flags.get("flag-neutral");
  assert.ok(neutral);

  const shooter = state.players.get("human")!;
  const victim = state.players.get("victim")!;
  shooter.team = "red";
  victim.team = "red";
  shooter.x = 800;
  shooter.y = 800;
  shooter.vx = 0;
  shooter.vy = 0;
  victim.x = 940;
  victim.y = 800;
  victim.vx = 0;
  victim.vy = 0;

  neutral.carrierId = victim.id;
  neutral.atBase = false;

  for (const other of state.players.values()) {
    if (other.id === "human" || other.id === "victim") continue;
    other.alive = false;
    other.x = 120;
    other.y = 120;
    other.vx = 0;
    other.vy = 0;
  }

  simulation.setInput("human", { moveX: 0, moveY: 0, aimX: 1, aimY: 0, boost: false, fire: true });
  simulation.update(16);
  simulation.setInput("human", { moveX: 0, moveY: 0, aimX: 1, aimY: 0, boost: false, fire: false });
  simulation.update(220);

  assert.equal(neutral.carrierId, "victim");
});

test("bumping an enemy carrier steals their flag", () => {
  const state = new ArenaState();
  const simulation = new GameSimulation(state);
  simulation.addPlayer("thief", "Thief");
  simulation.addPlayer("carrier", "Carrier");
  simulation.update(ROUND_COUNTDOWN_MS);

  const neutral = state.flags.get("flag-neutral");
  assert.ok(neutral);

  const thief = state.players.get("thief")!;
  const carrier = state.players.get("carrier")!;
  thief.team = "red";
  carrier.team = "blue";
  thief.x = 2000;
  thief.y = 2000;
  thief.vx = 280;
  thief.vy = 0;
  carrier.x = 2000 + 10;
  carrier.y = 2000;
  carrier.vx = 0;
  carrier.vy = 0;
  neutral.carrierId = carrier.id;
  neutral.atBase = false;

  for (const other of state.players.values()) {
    if (other.id === "thief" || other.id === "carrier") continue;
    other.alive = false;
  }

  simulation.update(16);

  assert.equal(neutral.carrierId, "thief");
});

test("bot bumping a human carrier steals their flag", () => {
  const state = new ArenaState();
  const simulation = new GameSimulation(state);
  simulation.addPlayer("human-carrier", "Carrier");
  simulation.addPlayer("bot-thief", "Bot", true);
  simulation.update(ROUND_COUNTDOWN_MS);

  const neutral = state.flags.get("flag-neutral");
  assert.ok(neutral);

  const humanCarrier = state.players.get("human-carrier")!;
  const botThief = state.players.get("bot-thief")!;
  humanCarrier.team = "red";
  botThief.team = "blue";
  humanCarrier.x = 2400;
  humanCarrier.y = 2400;
  humanCarrier.vx = 0;
  humanCarrier.vy = 0;
  botThief.x = 2410;
  botThief.y = 2400;
  botThief.vx = 260;
  botThief.vy = 0;
  neutral.carrierId = humanCarrier.id;
  neutral.atBase = false;

  for (const other of state.players.values()) {
    if (other.id === "human-carrier" || other.id === "bot-thief") continue;
    other.alive = false;
  }

  simulation.update(16);

  assert.equal(neutral.carrierId, "bot-thief");
});

test("faster carrier wins an enemy carrier bump interception", () => {
  const state = new ArenaState();
  const simulation = new GameSimulation(state);
  state.gameMode = "team_ctf";
  simulation.addPlayer("red-carrier", "Red");
  simulation.addPlayer("blue-carrier", "Blue");
  simulation.restartMatch();

  const redFlag = state.flags.get("flag-red");
  const blueFlag = state.flags.get("flag-blue");
  assert.ok(redFlag);
  assert.ok(blueFlag);

  const redCarrier = state.players.get("red-carrier")!;
  const blueCarrier = state.players.get("blue-carrier")!;
  redCarrier.team = "red";
  blueCarrier.team = "blue";
  redCarrier.x = 2200;
  redCarrier.y = 2200;
  redCarrier.vx = 420;
  redCarrier.vy = 0;
  blueCarrier.x = 2210;
  blueCarrier.y = 2200;
  blueCarrier.vx = 40;
  blueCarrier.vy = 0;
  redFlag.carrierId = blueCarrier.id;
  blueFlag.carrierId = redCarrier.id;
  redFlag.atBase = false;
  blueFlag.atBase = false;

  for (const other of state.players.values()) {
    if (other.id === "red-carrier" || other.id === "blue-carrier") continue;
    other.alive = false;
  }

  simulation.update(16);

  assert.equal(redFlag.carrierId, "red-carrier");
  assert.equal(blueFlag.carrierId, "red-carrier");
});

test("bots close on an enemy neutral flag carrier instead of standing off", () => {
  const state = new ArenaState();
  const simulation = new GameSimulation(state);
  simulation.addPlayer("human", "Carrier");
  simulation.addPlayer("bot-hunter", "Bot", true);
  simulation.update(ROUND_COUNTDOWN_MS);

  const neutral = state.flags.get("flag-neutral");
  assert.ok(neutral);

  const human = state.players.get("human")!;
  const bot = state.players.get("bot-hunter")!;
  human.team = "red";
  bot.team = "blue";
  human.x = 3200;
  human.y = 4000;
  human.vx = 0;
  human.vy = 0;
  bot.x = 5200;
  bot.y = 4000;
  bot.vx = 0;
  bot.vy = 0;
  bot.bulletCharges = 0;
  neutral.carrierId = human.id;
  neutral.atBase = false;

  for (const id of [...state.players.keys()]) {
    if (id === "human" || id === "bot-hunter") continue;
    simulation.removePlayer(id);
  }

  const distanceBefore = Math.hypot(bot.x - human.x, bot.y - human.y);
  simulation.update(800);
  const distanceAfter = Math.hypot(bot.x - human.x, bot.y - human.y);
  assert.equal(neutral.carrierId, human.id);
  assert.ok(distanceAfter < distanceBefore, "bot should close distance to the flag carrier");
});

test("bots pace shots instead of dumping full magazines instantly", () => {
  const state = new ArenaState();
  const simulation = new GameSimulation(state);
  simulation.addPlayer("human", "Target");
  simulation.addPlayer("bot-shooter", "Bot", true);
  simulation.update(ROUND_COUNTDOWN_MS);

  const human = state.players.get("human")!;
  const bot = state.players.get("bot-shooter")!;
  human.team = "red";
  bot.team = "blue";
  human.x = 5000;
  human.y = 4000;
  bot.x = 5400;
  bot.y = 4000;
  bot.bulletCharges = PLAYER_MAX_BULLET_CHARGES;
  bot.pushCooldownMs = 0;

  for (const other of state.players.values()) {
    if (other.id === "human" || other.id === "bot-shooter") continue;
    other.alive = false;
  }

  state.projectiles.clear();
  simulation.update(700);

  const botShots = [...state.projectiles.values()].filter((p) => p.ownerId === "bot-shooter").length;
  assert.ok(botShots <= 1, `expected at most one bot shot in 700ms, got ${botShots}`);
});

test("stolen flag cannot be taken back until steal protection expires", () => {
  const state = new ArenaState();
  const simulation = new GameSimulation(state);
  simulation.addPlayer("thief", "Thief");
  simulation.addPlayer("carrier", "Carrier");
  simulation.addPlayer("chaser", "Chaser");
  simulation.update(ROUND_COUNTDOWN_MS);

  const neutral = state.flags.get("flag-neutral");
  assert.ok(neutral);

  const thief = state.players.get("thief")!;
  const carrier = state.players.get("carrier")!;
  const chaser = state.players.get("chaser")!;
  thief.team = "red";
  carrier.team = "blue";
  chaser.team = "green";
  carrier.x = 3000;
  carrier.y = 4000;
  carrier.vx = 280;
  carrier.vy = 0;
  thief.x = 3010;
  thief.y = 4000;
  thief.vx = 300;
  thief.vy = 0;
  chaser.x = 3020;
  chaser.y = 4000;
  chaser.vx = 300;
  chaser.vy = 0;
  neutral.carrierId = carrier.id;
  neutral.atBase = false;

  for (const other of state.players.values()) {
    if (other.id === "thief" || other.id === "carrier" || other.id === "chaser") continue;
    other.alive = false;
  }

  simulation.update(16);
  assert.equal(neutral.carrierId, "thief");
  assert.ok(neutral.stealProtectionMs > FLAG_STEAL_PROTECTION_MS - 50);

  chaser.x = thief.x + 8;
  chaser.y = thief.y;
  chaser.vx = 300;
  simulation.update(16);
  assert.equal(neutral.carrierId, "thief", "immediate re-steal should be blocked");

  simulation.update(FLAG_STEAL_PROTECTION_MS + 50);
  chaser.x = thief.x + 8;
  chaser.vx = 320;
  simulation.update(16);
  assert.equal(neutral.carrierId, "chaser", "steal should succeed after protection ends");
});

test("spike slow clears on round restart", () => {
  const state = new ArenaState();
  const simulation = new GameSimulation(state);
  simulation.addPlayer("p1", "Walker");
  simulation.update(ROUND_COUNTDOWN_MS);
  const player = state.players.get("p1")!;
  const firstSpike = state.spikes.values().next().value!;
  firstSpike.x = player.x;
  firstSpike.y = player.y;
  firstSpike.vx = 0;
  firstSpike.vy = 0;
  simulation.update(16);
  assert.equal(player.spikeSlowMs > 0, true);

  simulation.restartMatch();
  const after = state.players.get("p1")!;
  assert.equal(after.spikeSlowMs, 0);
  assert.equal(after.spikePermSlow, false);
});
