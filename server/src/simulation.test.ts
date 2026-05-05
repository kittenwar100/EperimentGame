import test from "node:test";
import assert from "node:assert/strict";
import { ARENA_HEIGHT, ARENA_WIDTH, CAPTURE_DURATION_MS, ROUND_COUNTDOWN_MS } from "../../shared/src";
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
  shooter.x = 800;
  shooter.y = 800;
  shooter.vx = 0;
  shooter.vy = 0;
  botTarget.x = 940;
  botTarget.y = 800;
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

test("circle capture awards a round point and resets countdown", () => {
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

  simulation.update(CAPTURE_DURATION_MS + 200);

  assert.equal(state.redScore, 1);
  assert.equal(state.phase, "countdown");
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
