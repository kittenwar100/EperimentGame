import * as Phaser from "phaser";
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  BOOST_CHARGES_PER_LIFE,
  BOOST_COOLDOWN_MS,
  BOOST_DURATION_MS,
  FFA_CORNER_BASE_ZONE_RADIUS,
  FFA_OCTAGON_CENTER_X,
  FFA_OCTAGON_CENTER_Y,
  FFA_OCTAGON_RADIUS,
  INPUT_SEND_RATE_MS,
  PICKUP_RADIUS,
  PLAYER_RADIUS,
  PROJECTILE_EXPLOSION_RADIUS,
  PROJECTILE_RADIUS,
  RACE_FLAG_HOME_X,
  RACE_FLAG_HOME_Y,
  RACE_SPAWN_BAND_MAX_X,
  RACE_SPAWN_BAND_MIN_X,
  SAFE_ZONE_SIZE,
  ffaBaseCenters,
  getTeamCtfBaseRects,
  octagonVertices,
  type ArenaState,
  type FlagState,
  type InputState,
  type JoinOptions,
  type PickupState,
  type PlayerState,
  type ProjectileState,
  type SpikeState,
} from "@shared";
import { getModeLabel, getObjectiveWorldTarget, isInEnemySafeZone, objectiveScreenMarker } from "./matchHudHelpers";
import type { SfxController } from "../audio/SfxController";
import type { NetClient } from "../network/NetClient";
import type { CrazyGamesService } from "../sdk/CrazyGamesService";

const PICKUP_COLORS: Record<string, number> = {
  speed: 0xffdf63,
  ammo: 0xff67df,
  shield: 0x5cf0ff,
  magnet: 0xff9c5c,
  repel: 0xc07dff,
};
/** Short label drawn under each pickup in the world. */
const PICKUP_WORLD_LABELS: Record<string, string> = {
  speed: "SPEED UP",
  ammo: "+2 SHOTS",
  shield: "1-HIT BLOCK",
  magnet: "PULL LOOT",
  repel: "PUSH FOES",
};
type MapTheme = {
  bg1: number;
  bg2: number;
  bg3: number;
  bg4: number;
  hazeA: number;
  hazeB: number;
  grid: number;
  gridFine: number;
  lane: number;
  stars: number;
  ring: number;
  ringLine: number;
};
const MAP_THEMES: MapTheme[] = [
  {
    bg1: 0x17213b,
    bg2: 0x111b35,
    bg3: 0x070f24,
    bg4: 0x050a18,
    hazeA: 0x426dff,
    hazeB: 0x23e6ff,
    grid: 0x2f5b91,
    gridFine: 0x1d355d,
    lane: 0x63e5ff,
    stars: 0xbfd6ff,
    ring: 0x253d78,
    ringLine: 0xa3b2ff,
  },
  {
    bg1: 0x24183e,
    bg2: 0x191033,
    bg3: 0x0d0822,
    bg4: 0x070414,
    hazeA: 0xc07dff,
    hazeB: 0xff67df,
    grid: 0x5f4c94,
    gridFine: 0x352654,
    lane: 0xff79ec,
    stars: 0xf1d3ff,
    ring: 0x4a3a8a,
    ringLine: 0xd4b8ff,
  },
  {
    bg1: 0x10312f,
    bg2: 0x0d292b,
    bg3: 0x061a1e,
    bg4: 0x040f14,
    hazeA: 0x28ffc6,
    hazeB: 0x6dff7d,
    grid: 0x2d766d,
    gridFine: 0x1e4548,
    lane: 0x8cffea,
    stars: 0xc8fff3,
    ring: 0x2d7a70,
    ringLine: 0x8cffea,
  },
];
const TEAM_COLORS: Record<string, number> = {
  red: 0xff6a76,
  blue: 0x66a6ff,
  green: 0x79ff6d,
  yellow: 0xffd84f,
  ffa0: 0xff6a76,
  ffa1: 0x66a6ff,
  ffa2: 0x79ff6d,
  ffa3: 0xffd84f,
  ffa4: 0xc07dff,
  ffa5: 0xff9c5c,
  ffa6: 0x5cf0ff,
  ffa7: 0xb8ff8a,
};
/** Solo FFA octagon: one base per vertex, one player per base (ffa0..ffa7). Mirrors the server's OCTAGON_FFA_BASE_SLOTS. */
const OCTAGON_SOLO_FFA_SLOTS: readonly { team: string; vertexIndex: number }[] = [
  { team: "ffa0", vertexIndex: 0 },
  { team: "ffa1", vertexIndex: 1 },
  { team: "ffa2", vertexIndex: 2 },
  { team: "ffa3", vertexIndex: 3 },
  { team: "ffa4", vertexIndex: 4 },
  { team: "ffa5", vertexIndex: 5 },
  { team: "ffa6", vertexIndex: 6 },
  { team: "ffa7", vertexIndex: 7 },
];
const CAMERA_VIEW_WIDTH_WORLD = 1850 * 2;
const PLAYER_BODY_RADIUS_PX = 32;
const PLAYER_SIZE_MULTIPLIER = 2.5;
const LOCAL_PLAYER_SCALE_MULTIPLIER = 1.24;
const PROJECTILE_SIZE_MULTIPLIER = 0.5;
const VIEWPORT_BORDER_COLOR = 0xff0000;
const VIEWPORT_BORDER_ALPHA = 1;
const VIEWPORT_BORDER_WIDTH = 16;
const PROGRESSION_MILESTONES = [40, 90, 150];
/** Camera focus lerps toward arena center only while the local player is not available yet. */
const CAMERA_FOLLOW_SMOOTH_MS = 42;
const LOCAL_PLAYER_SMOOTH_MS = 24;
/** Remote entities are smoothed in world space so camera movement does not add screen-space jitter. */
const REMOTE_PLAYER_WORLD_SMOOTH_MS = 48;
const PROJECTILE_WORLD_SMOOTH_MS = 22;
const SPIKE_WORLD_SMOOTH_MS = 42;
const PLAYER_WORLD_SNAP_DISTANCE = 900;
const PROJECTILE_WORLD_SNAP_DISTANCE = 1_400;
const SPIKE_WORLD_SNAP_DISTANCE = 600;
type CameraViewWorld = { left: number; top: number; width: number; height: number; scale: number };
type VisualWorldPoint = { x: number; y: number };

export class GameScene extends Phaser.Scene {
  private readonly playerVisuals = new Map<string, Phaser.GameObjects.Container>();
  private readonly playerVisualWorld = new Map<string, VisualWorldPoint>();
  private readonly pickupVisuals = new Map<string, Phaser.GameObjects.Container>();
  private readonly projectileVisuals = new Map<string, Phaser.GameObjects.Arc>();
  private readonly projectileVisualWorld = new Map<string, VisualWorldPoint>();
  private readonly spikeVisuals = new Map<string, Phaser.GameObjects.Polygon>();
  private readonly spikeVisualWorld = new Map<string, VisualWorldPoint>();
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private pointerFire = false;
  private lastInputSentAt = 0;
  /** Full-screen gradient; only redrawn when theme, mode, or viewport size changes. */
  private arenaBackdropGraphics!: Phaser.GameObjects.Graphics;
  private lastArenaBackdropKey = "";
  private arenaGraphics!: Phaser.GameObjects.Graphics;
  private minimapGraphics!: Phaser.GameObjects.Graphics;
  private dangerOverlay!: Phaser.GameObjects.Graphics;
  private objectiveScreenGraphics!: Phaser.GameObjects.Graphics;
  private leaderboardPanel!: Phaser.GameObjects.Graphics;
  private objectiveFlagLabel!: Phaser.GameObjects.Text;
  private boostHud!: Phaser.GameObjects.Graphics;
  private boostHudTitle!: Phaser.GameObjects.Text;
  private boostHudText!: Phaser.GameObjects.Text;
  private powerupHudText!: Phaser.GameObjects.Text;
  private spikeSlowText!: Phaser.GameObjects.Text;
  private flagBannerText!: Phaser.GameObjects.Text;
  private carrierWorldLabel!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private positionText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private controlsText!: Phaser.GameObjects.Text;
  private objectiveText!: Phaser.GameObjects.Text;
  private leaderboardText!: Phaser.GameObjects.Text;
  private countdownText!: Phaser.GameObjects.Text;
  private restartButton!: Phaser.GameObjects.Text;
  private restarting = false;
  private cameraFocusX = ARENA_WIDTH * 0.5;
  private cameraFocusY = ARENA_HEIGHT * 0.5;
  private cameraViewWorld: CameraViewWorld = { left: 0, top: 0, width: CAMERA_VIEW_WIDTH_WORLD, height: CAMERA_VIEW_WIDTH_WORLD, scale: 1 };
  private flagCarrierId = "";
  private flagStealProtectionMs = 0;
  private boostHintShown = false;
  private lastTrailAtMs = new Map<string, number>();
  private readonly projectileSnapshot = new Map<string, { x: number; y: number; ownerId: string; radius: number }>();
  private prevFlagCarrierId = "";
  private prevPointerFire = false;
  /**
   * `main.ts` assigns this right before `new Phaser.Game()` so the first join runs only after this scene’s
   * `create()` has built HUD/graphics. Do not use `scene.events.once(CREATE, …)` for that: the scene is not
   * wired into Phaser until boot, so those listeners are unreliable.
   */
  pendingJoin: JoinOptions | null = null;

  constructor(private readonly netClient: NetClient, private readonly sdk: CrazyGamesService, private readonly sfx: SfxController) {
    super("game");
  }

  create(): void {
    this.drawStage();
    this.input.mouse?.disableContextMenu();
    this.keys = this.input.keyboard!.addKeys("W,A,S,D,LEFT,RIGHT,UP,DOWN,SPACE") as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.on("pointerdown", () => this.sfx.resume());
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => { if (pointer.leftButtonDown()) this.pointerFire = true; });
    this.input.on("pointerup", () => { this.pointerFire = false; });
    this.scale.on("resize", () => this.applyResponsiveCamera());
    this.applyResponsiveCamera();
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, this.postUpdateNeutralizeMainCamera, this);
    this.sdk.loadingStop();
    const firstJoin = this.pendingJoin;
    this.pendingJoin = null;
    if (firstJoin) {
      void this.startMatch(firstJoin);
    }
  }

  async startMatch(options: JoinOptions): Promise<void> {
    this.restarting = false;
    this.hideRestartButton();
    try {
      this.statusText.setText("Joining…");
      await this.netClient.join(options, this.sdk.getInviteRoomId());
      const hasLocalPlayer = await this.waitForLocalPlayer(3500);
      if (!hasLocalPlayer) {
        throw new Error("Joined room but local player did not appear in state");
      }
      this.statusText.setText("");
      this.sdk.gameplayStart();
    } catch (error) {
      console.error("Failed to join tunnel race", error);
      this.netClient.leave();
      this.statusText.setText("Reconnecting...");
      this.time.delayedCall(900, () => {
        void this.startMatch(options);
      });
    }
  }

  private async waitForLocalPlayer(timeoutMs: number): Promise<boolean> {
    const deadline = performance.now() + timeoutMs;
    while (performance.now() < deadline) {
      if (this.getLocalPlayer()) return true;
      await new Promise<void>((resolve) => {
        this.time.delayedCall(100, resolve);
      });
    }
    return Boolean(this.getLocalPlayer());
  }

  override update(time: number, delta: number): void {
    const room = this.netClient.room;
    const state = room?.state;
    if (!state?.players) {
      return;
    }

    const input = this.captureInput();
    if (input.fire && !this.prevPointerFire) {
      this.sfx.fire();
    }
    this.prevPointerFire = input.fire;
    if (time - this.lastInputSentAt >= INPUT_SEND_RATE_MS) {
      this.netClient.sendInput(input);
      this.lastInputSentAt = time;
    }

    this.syncWorld(state, delta);
    this.drawScreenObjectiveOverlay(state);
    this.updateHud(state);
  }

  /** Scale / shake can move the main camera; world draws in screen space so scroll must stay neutral. */
  private postUpdateNeutralizeMainCamera(): void {
    if (!this.netClient.room?.state?.players) {
      return;
    }
    const cam = this.cameras.main;
    cam.setScroll(0, 0);
    if (typeof cam.zoom === "number" && cam.zoom !== 1) {
      cam.setZoom(1);
    }
  }

  private syncWorld(state: ArenaState, delta: number): void {
    this.checkLocalProjectileBlasts(state);
    const localPlayer = this.getLocalPlayer();
    this.updateCameraViewWorld(delta, localPlayer);
    const neutralFlag = this.getNeutralFlag(state);
    this.flagCarrierId = neutralFlag?.carrierId ?? "";
    this.flagStealProtectionMs = neutralFlag?.stealProtectionMs ?? 0;
    this.updateCarrierWorldLabel(state);
    this.drawArena(state);
    const seenPlayers = new Set<string>();
    const seenPickups = new Set<string>();
    const seenProjectiles = new Set<string>();
    const seenSpikes = new Set<string>();
    for (const [id, player] of state.players.entries()) {
      if (!player) continue;
      seenPlayers.add(id);
      this.syncPlayerVisual(id, player, delta, localPlayer);
    }
    if (state.pickups) {
      for (const [id, pickup] of state.pickups.entries()) {
        if (!pickup) continue;
        seenPickups.add(id);
        this.syncPickupVisual(id, pickup);
      }
    }
    if (state.projectiles) {
      for (const [id, projectile] of state.projectiles.entries()) {
        if (!projectile) continue;
        seenProjectiles.add(id);
      this.syncProjectileVisual(id, projectile, delta);
      }
    }
    if (state.spikes) {
      for (const [id, spike] of state.spikes.entries()) {
        if (!spike) continue;
        seenSpikes.add(id);
      this.syncSpikeVisual(id, spike, delta);
      }
    }
    this.pruneMap(this.playerVisuals, seenPlayers, (v) => v.destroy(true));
    this.pruneMap(this.playerVisualWorld, seenPlayers, () => undefined);
    this.pruneMap(this.pickupVisuals, seenPickups, (v) => v.destroy(true));
    this.pruneMap(this.projectileVisuals, seenProjectiles, (v) => v.destroy());
    this.pruneMap(this.projectileVisualWorld, seenProjectiles, () => undefined);
    this.pruneMap(this.spikeVisuals, seenSpikes, (v) => v.destroy());
    this.pruneMap(this.spikeVisualWorld, seenSpikes, () => undefined);
    this.drawMinimap(state);
    this.refreshProjectileSnapshot(state);
  }

  private syncPlayerVisual(id: string, player: PlayerState, delta: number, localPlayer: PlayerState | undefined): void {
    const visual = this.playerVisuals.get(id) ?? this.createPlayerVisual(player.color);
    const isLocalPlayer = localPlayer !== undefined && player.id === localPlayer.id;
    const basePlayerScale = (this.toScreenRadius(PLAYER_RADIUS) / PLAYER_BODY_RADIUS_PX) * PLAYER_SIZE_MULTIPLIER;
    const visualWorld = isLocalPlayer
      ? this.getSmoothedWorldPoint(
          this.playerVisualWorld,
          id,
          player.x,
          player.y,
          delta,
          LOCAL_PLAYER_SMOOTH_MS,
          PLAYER_WORLD_SNAP_DISTANCE * 1.35,
        )
      : this.getSmoothedWorldPoint(this.playerVisualWorld, id, player.x, player.y, delta, REMOTE_PLAYER_WORLD_SMOOTH_MS, PLAYER_WORLD_SNAP_DISTANCE);
    const targetScreenX = this.toScreenX(visualWorld.x);
    const targetScreenY = this.toScreenY(visualWorld.y);
    visual.setPosition(targetScreenX, targetScreenY);
    const rotAlpha = Math.min(1, delta / (isLocalPlayer ? 45 : 65));
    const rotDelta = Phaser.Math.Angle.ShortestBetween(visual.rotation, player.rotation);
    visual.rotation += rotDelta * rotAlpha;
    const body = visual.getAt(0) as Phaser.GameObjects.Arc;
    const nose = visual.getAt(1) as Phaser.GameObjects.Triangle;
    const carrierRing = visual.getAt(2) as Phaser.GameObjects.Arc;
    body.fillColor = TEAM_COLORS[player.team] ?? 0xffffff;
    if (isLocalPlayer) {
      const cosmeticTier = this.getCosmeticTier(player.score);
      const accent = cosmeticTier >= 3 ? 0xff79ec : cosmeticTier >= 2 ? 0x71ffed : cosmeticTier >= 1 ? 0xfff46b : 0xffd46b;
      const strokeColor =
        player.shieldHits > 0 ? 0x5cf0ff : player.repelMs > 0 ? 0xc07dff : player.magnetMs > 0 ? 0xff9c5c : accent;
      const strokeW = player.shieldHits > 0 ? 6 : 5;
      body.setStrokeStyle(strokeW, strokeColor, 1);
      nose.setFillStyle(accent, 1);
      visual.setScale(basePlayerScale * LOCAL_PLAYER_SCALE_MULTIPLIER);
    } else {
      const strokeColor =
        player.shieldHits > 0 ? 0x5cf0ff : player.repelMs > 0 ? 0xc07dff : player.magnetMs > 0 ? 0xff9c5c : 0xffffff;
      body.setStrokeStyle(player.shieldHits > 0 ? 4 : player.repelMs > 0 || player.magnetMs > 0 ? 4 : 3, strokeColor, 0.95);
      nose.setFillStyle(0xffffff, 0.95);
      visual.setScale(basePlayerScale);
    }
    const isFlagCarrier = id === this.flagCarrierId;
    const flagShielded = isFlagCarrier && this.flagStealProtectionMs > 0;
    carrierRing.setVisible(isFlagCarrier);
    if (isFlagCarrier) {
      const shieldPulse = flagShielded ? 0.75 + 0.25 * Math.sin(this.time.now * 0.01) : 1;
      const ringColor = flagShielded ? 0x5cf0ff : 0xfff46b;
      carrierRing.setStrokeStyle(flagShielded ? 6 : 5, ringColor, shieldPulse);
      carrierRing.setFillStyle(ringColor, flagShielded ? 0.2 : 0.14);
      const ringScale = flagShielded ? 1.12 + 0.06 * Math.sin(this.time.now * 0.012) : 1.08;
      carrierRing.setScale(ringScale);
      this.emitFlagTrail(player, TEAM_COLORS[player.team] ?? 0xfff46b);
    } else {
      carrierRing.setScale(1);
    }
    visual.alpha = player.alive ? 1 : 0.32;
    visual.setDepth(isLocalPlayer ? 45 : 40);
    this.playerVisuals.set(id, visual);
  }

  private syncPickupVisual(id: string, pickup: PickupState): void {
    const visual = this.pickupVisuals.get(id) ?? this.createPickupVisual(pickup.kind);
    const outerGlow = visual.getAt(0) as Phaser.GameObjects.Arc;
    const core = visual.getAt(1) as Phaser.GameObjects.Arc;
    const label = visual.getAt(3) as Phaser.GameObjects.Text;
    const color = PICKUP_COLORS[pickup.kind] ?? 0xffffff;
    visual.x = this.toScreenX(pickup.x);
    visual.y = this.toScreenY(pickup.y);
    visual.setDepth(30);
    outerGlow.fillColor = color;
    core.fillColor = color;
    label.setText(PICKUP_WORLD_LABELS[pickup.kind] ?? pickup.kind.toUpperCase());
    label.setColor(pickup.active ? "#ffffff" : "#8899aa");
    label.setStroke("#0f1432", 4);
    const pulse = 0.92 + 0.08 * Math.sin(this.time.now * 0.006 + pickup.x * 0.005);
    visual.alpha = pickup.active ? 0.98 : 0.2;
    const pickupScale = (this.toScreenRadius(PICKUP_RADIUS) / 18) * pulse;
    visual.setScale(pickup.active ? pickupScale : pickupScale * 0.85);
    // Icon (child index 2) is a Graphics object, no rotation. Container itself stays upright for icon readability.
    this.pickupVisuals.set(id, visual);
  }

  private syncProjectileVisual(id: string, projectile: ProjectileState, delta: number): void {
    const color = TEAM_COLORS[projectile.team] ?? 0x9fd7ff;
    const visualWorld = this.getSmoothedWorldPoint(
      this.projectileVisualWorld,
      id,
      projectile.x,
      projectile.y,
      delta,
      PROJECTILE_WORLD_SMOOTH_MS,
      PROJECTILE_WORLD_SNAP_DISTANCE,
    );
    const visual =
      this.projectileVisuals.get(id) ??
      this.add.circle(0, 0, this.toScreenRadius(PROJECTILE_RADIUS) * PROJECTILE_SIZE_MULTIPLIER, color, 0.98).setDepth(36);
    visual.x = this.toScreenX(visualWorld.x);
    visual.y = this.toScreenY(visualWorld.y);
    visual.fillColor = color;
    visual.setRadius(this.toScreenRadius(projectile.radius) * PROJECTILE_SIZE_MULTIPLIER);
    visual.setStrokeStyle(2, 0xffffff, 0.72);
    this.projectileVisuals.set(id, visual);
  }

  private syncSpikeVisual(id: string, spike: SpikeState, delta: number): void {
    const size = this.toScreenRadius(spike.radius);
    const points = [0, -1, 1, 0, 0, 1, -1, 0];
    const pulse = 0.55 + 0.45 * Math.sin(this.time.now * 0.004 + id.length * 0.31);
    const isPull = spike.spikeKind === "pull";
    const fill = isPull ? 0xa855f7 : 0xf55c5c;
    const stroke = isPull ? 0xe9d5ff : 0xfff1b8;
    const visualWorld = this.getSmoothedWorldPoint(
      this.spikeVisualWorld,
      id,
      spike.x,
      spike.y,
      delta,
      SPIKE_WORLD_SMOOTH_MS,
      SPIKE_WORLD_SNAP_DISTANCE,
    );
    const visual =
      this.spikeVisuals.get(id) ??
      this.add.polygon(this.toScreenX(visualWorld.x), this.toScreenY(visualWorld.y), points, fill, 0.95).setStrokeStyle(2, stroke, 0.9).setDepth(28);
    visual.x = this.toScreenX(visualWorld.x);
    visual.y = this.toScreenY(visualWorld.y);
    visual.setScale(size);
    visual.setFillStyle(fill, 0.95);
    visual.setStrokeStyle(2 + pulse * 1.5, stroke, 0.55 + 0.4 * pulse);
    if (Math.hypot(spike.vx, spike.vy) > 0.1) visual.angle = Phaser.Math.RadToDeg(Math.atan2(spike.vy, spike.vx)) + 45;
    this.spikeVisuals.set(id, visual);
  }

  private drawStage(): void {
    this.arenaBackdropGraphics = this.add.graphics().setDepth(-1);
    this.arenaGraphics = this.add.graphics().setDepth(0);
    this.minimapGraphics = this.add.graphics().setDepth(120);
    this.dangerOverlay = this.add.graphics().setScrollFactor(0).setDepth(118);
    this.objectiveScreenGraphics = this.add.graphics().setScrollFactor(0).setDepth(119);
    this.leaderboardPanel = this.add.graphics().setScrollFactor(0).setDepth(81);
    this.objectiveFlagLabel = this.add
      .text(0, 0, "FLAG", this.textStyle(24, "#ffee66"))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(121)
      .setStroke("#1a0f28", 7)
      .setVisible(false);
    this.timerText = this.add.text(24, 18, "TIME 0", this.textStyle(22, "#ffe95c"));
    this.controlsText = this.add
      .text(24, 48, "SPACE TO BOOST\nLEFT CLICK TO SHOOT", {
        color: "#bfe7ff",
        fontFamily: "Segoe UI, system-ui, sans-serif",
        fontSize: "18px",
        fontStyle: "700",
        letterSpacing: 2,
      })
      .setShadow(0, 0, 10, "#000000", 0.55, true, true);
    this.statusText = this.add.text(24, 136, "", this.textStyle(15, "#b8c4d8"));
    this.boostHud = this.add.graphics();
    this.boostHudTitle = this.add.text(24, 88, "BOOST", this.textStyle(13, "#ffe95c"));
    this.boostHudText = this.add.text(24, 104, "", this.textStyle(13, "#9fd7ff"));
    this.powerupHudText = this.add.text(24, 178, "", this.textStyle(13, "#d8f7ff"));
    this.spikeSlowText = this.add.text(24, 156, "", this.textStyle(14, "#ff9f7a"));
    this.flagBannerText = this.add
      .text(0, 56, "YOU HAVE THE FLAG", {
        color: "#fff46b",
        fontFamily: "Segoe UI, system-ui, sans-serif",
        fontSize: "22px",
        fontStyle: "800",
        letterSpacing: 3,
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(122)
      .setStroke("#1a0f28", 6)
      .setShadow(0, 0, 14, "#000000", 0.6, true, true)
      .setVisible(false);
    this.carrierWorldLabel = this.add
      .text(0, 0, "FLAG", this.textStyle(22, "#ffee66"))
      .setOrigin(0.5)
      .setDepth(46)
      .setStroke("#1a0f28", 6)
      .setVisible(false);
    this.positionText = this.add.text(-2000, -2000, "", this.textStyle(1, "#000000")).setVisible(false);
    this.objectiveText = this.add.text(-2000, -2000, "", this.textStyle(1, "#000000")).setVisible(false);
    this.leaderboardText = this.add
      .text(0, 22, "", {
        color: "#f2f7ff",
        fontFamily: "Consolas, ui-monospace, monospace",
        fontSize: "13px",
        fontStyle: "700",
        align: "right",
      })
      .setOrigin(1, 0)
      .setShadow(0, 2, "#000000", 6, true, true);
    this.countdownText = this.add
      .text(this.scale.width * 0.5, this.scale.height * 0.42, "", this.textStyle(92, "#ffffff"))
      .setOrigin(0.5)
      .setStroke("#142047", 8)
      .setDepth(130);
    this.restartButton = this.add
      .text(this.scale.width * 0.5, this.scale.height * 0.62, "RESTART", this.textStyle(34, "#ffffff"))
      .setOrigin(0.5)
      .setPadding(22, 10, 22, 10)
      .setBackgroundColor("#b01f3b")
      .setStroke("#ffffff", 3)
      .setInteractive({ useHandCursor: true })
      .setVisible(false)
      .setAlpha(0)
      .setDepth(100);
    this.restartButton.on("pointerdown", () => {
      void this.restartSession();
    });

    for (const text of [
      this.statusText,
      this.positionText,
      this.timerText,
      this.controlsText,
      this.objectiveText,
      this.leaderboardText,
      this.countdownText,
      this.restartButton,
      this.boostHudTitle,
      this.boostHudText,
      this.powerupHudText,
      this.spikeSlowText,
    ]) {
      text.setScrollFactor(0).setDepth(80);
    }
    this.boostHud.setScrollFactor(0).setDepth(80);
    this.flagBannerText.setScrollFactor(0);
    this.countdownText.setDepth(130);
    this.leaderboardText.setDepth(83);
  }

  private drawArena(state: ArenaState): void {
    const graphics = this.arenaGraphics;
    const width = this.scale.width;
    const height = this.scale.height;
    const rawMapTheme = Number.isFinite(state.mapTheme) ? Math.floor(state.mapTheme) : 0;
    const themeIndex = Math.min(MAP_THEMES.length - 1, Math.max(0, rawMapTheme));
    const theme = MAP_THEMES[themeIndex];
    if (!theme) return;
    const backdropKey = `${themeIndex}|${state.gameMode ?? ""}|${Math.round(width)}x${Math.round(height)}`;
    if (backdropKey !== this.lastArenaBackdropKey) {
      this.lastArenaBackdropKey = backdropKey;
      const bg = this.arenaBackdropGraphics;
      bg.clear();
      bg.fillGradientStyle(theme.bg1, theme.bg2, theme.bg3, theme.bg4, 1);
      bg.fillRect(0, 0, width, height);
      this.drawArenaBackdropEffects(bg, theme, width, height, state.gameMode);
    }
    graphics.clear();
    this.drawParallaxArenaField(graphics, theme, state.gameMode, width, height);
    const baseMinX = PLAYER_RADIUS;
    const baseMinY = PLAYER_RADIUS;
    const baseMaxX = ARENA_WIDTH - PLAYER_RADIUS;
    const baseMaxY = ARENA_HEIGHT - PLAYER_RADIUS;
    const pulseT = this.time.now;
    if (state.gameMode === "ffa") {
      const insetBases = ffaBaseCenters(FFA_OCTAGON_CENTER_X, FFA_OCTAGON_CENTER_Y, FFA_OCTAGON_RADIUS, 0.11);
      OCTAGON_SOLO_FFA_SLOTS.forEach(({ team, vertexIndex }, i) => {
        const c = insetBases[vertexIndex];
        if (!c) return;
        const sx = this.toScreenX(c.x);
        const sy = this.toScreenY(c.y);
        const sr = this.toScreenRadius(FFA_CORNER_BASE_ZONE_RADIUS);
        const col = TEAM_COLORS[team] ?? 0xffffff;
        graphics.fillStyle(col, 0.14);
        graphics.fillCircle(sx, sy, sr);
        graphics.lineStyle(3, col, 0.55 + 0.25 * Math.sin(pulseT * 0.0025 + i));
        graphics.strokeCircle(sx, sy, sr);
      });
      const playR = FFA_OCTAGON_RADIUS - PLAYER_RADIUS;
      const ov = octagonVertices(FFA_OCTAGON_CENTER_X, FFA_OCTAGON_CENTER_Y, playR);
      graphics.lineStyle(5, theme.ringLine, 0.85);
      const ox0 = this.toScreenX(ov[0]!.x);
      const oy0 = this.toScreenY(ov[0]!.y);
      graphics.beginPath();
      graphics.moveTo(ox0, oy0);
      for (let i = 1; i < ov.length; i += 1) {
        const p = ov[i]!;
        graphics.lineTo(this.toScreenX(p.x), this.toScreenY(p.y));
      }
      graphics.closePath();
      graphics.strokePath();
    } else if (state.gameMode === "team_ctf") {
      const ctf = getTeamCtfBaseRects();
      this.drawSafeZoneRect(graphics, ctf.red.minX, ctf.red.minY, ctf.red.maxX - ctf.red.minX, ctf.red.maxY - ctf.red.minY, "red", pulseT);
      this.drawSafeZoneRect(graphics, ctf.blue.minX, ctf.blue.minY, ctf.blue.maxX - ctf.blue.minX, ctf.blue.maxY - ctf.blue.minY, "blue", pulseT);
    } else if (state.gameMode === "race") {
      // Shared spawn band on the left; flag base on the right.
      const bandX = this.toScreenX(RACE_SPAWN_BAND_MIN_X);
      const bandWidth = this.toScreenRadius(RACE_SPAWN_BAND_MAX_X - RACE_SPAWN_BAND_MIN_X);
      const bandY = this.toScreenY(baseMinY);
      const bandHeight = this.toScreenRadius(ARENA_HEIGHT - PLAYER_RADIUS * 2);
      graphics.fillStyle(0x5cf0ff, 0.12);
      graphics.fillRect(bandX, bandY, bandWidth, bandHeight);
      graphics.lineStyle(3, 0x5cf0ff, 0.55 + 0.2 * Math.sin(pulseT * 0.003));
      graphics.strokeRect(bandX, bandY, bandWidth, bandHeight);
      const flagSx = this.toScreenX(RACE_FLAG_HOME_X);
      const flagSy = this.toScreenY(RACE_FLAG_HOME_Y);
      const flagSr = this.toScreenRadius(FFA_CORNER_BASE_ZONE_RADIUS * 0.7);
      graphics.fillStyle(0xfff46b, 0.14);
      graphics.fillCircle(flagSx, flagSy, flagSr);
      graphics.lineStyle(3, 0xfff46b, 0.6 + 0.25 * Math.sin(pulseT * 0.0035));
      graphics.strokeCircle(flagSx, flagSy, flagSr);
    } else {
      // Sandbox fallback: 4-corner team zones.
      this.drawSafeZoneRect(graphics, baseMinX, baseMinY, SAFE_ZONE_SIZE, SAFE_ZONE_SIZE, "red", pulseT);
      this.drawSafeZoneRect(graphics, baseMaxX - SAFE_ZONE_SIZE, baseMinY, SAFE_ZONE_SIZE, SAFE_ZONE_SIZE, "blue", pulseT);
      this.drawSafeZoneRect(graphics, baseMinX, baseMaxY - SAFE_ZONE_SIZE, SAFE_ZONE_SIZE, SAFE_ZONE_SIZE, "green", pulseT);
      this.drawSafeZoneRect(graphics, baseMaxX - SAFE_ZONE_SIZE, baseMaxY - SAFE_ZONE_SIZE, SAFE_ZONE_SIZE, SAFE_ZONE_SIZE, "yellow", pulseT);
    }
    const centerX = this.toScreenX(state.captureX);
    const centerY = this.toScreenY(state.captureY);
    graphics.fillStyle(theme.ring, 1);
    graphics.fillCircle(centerX, centerY, this.toScreenRadius(state.captureRadius));
    graphics.lineStyle(4, theme.ringLine, 1);
    graphics.strokeCircle(centerX, centerY, this.toScreenRadius(state.captureRadius));
    if (state.captureProgress > 0) {
      graphics.lineStyle(9, TEAM_COLORS[state.captureTeam] ?? 0xffffff, 0.9);
      graphics.beginPath();
      graphics.arc(
        centerX,
        centerY,
        this.toScreenRadius(state.captureRadius) + 11,
        -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * state.captureProgress,
      );
      graphics.strokePath();
    }
    const neutralFlag = this.getNeutralFlag(state);
    if (neutralFlag && !neutralFlag.carrierId) {
      const flagX = this.toScreenX(neutralFlag.x);
      const flagY = this.toScreenY(neutralFlag.y);
      graphics.fillStyle(0xfff46b, 0.95);
      graphics.fillTriangle(flagX, flagY - 18, flagX + 22, flagY, flagX, flagY + 18);
      graphics.lineStyle(3, 0xffffff, 0.95);
      graphics.lineBetween(flagX - 10, flagY - 24, flagX - 10, flagY + 26);
    }
    if (state.slowZones) {
      for (const zone of state.slowZones.values()) {
        if (!zone) continue;
        const zx = this.toScreenX(zone.x);
        const zy = this.toScreenY(zone.y);
        const zr = this.toScreenRadius(zone.radius);
        graphics.fillStyle(0x44cfff, 0.12);
        graphics.fillCircle(zx, zy, zr);
        graphics.lineStyle(2, 0x44cfff, 0.35);
        graphics.strokeCircle(zx, zy, zr);
      }
    }

    graphics.lineStyle(2, theme.grid, 0.86);
    const view = this.cameraViewWorld;
    const gridStep = 320;
    const startX = Math.floor(view.left / gridStep) * gridStep;
    const endX = view.left + view.width;
    for (let x = startX; x <= endX; x += gridStep) {
      const sx = this.toScreenX(x);
      graphics.lineBetween(sx, 0, sx, height);
    }
    const startY = Math.floor(view.top / gridStep) * gridStep;
    const endY = view.top + view.height;
    for (let y = startY; y <= endY; y += gridStep) {
      const sy = this.toScreenY(y);
      graphics.lineBetween(0, sy, width, sy);
    }
    graphics.lineStyle(1, theme.gridFine, 0.26);
    const fineGridStep = 80;
    const fineStartX = Math.floor(view.left / fineGridStep) * fineGridStep;
    const fineEndX = view.left + view.width;
    for (let x = fineStartX; x <= fineEndX; x += fineGridStep) {
      const sx = this.toScreenX(x);
      graphics.lineBetween(sx, 0, sx, height);
    }
    const fineStartY = Math.floor(view.top / fineGridStep) * fineGridStep;
    const fineEndY = view.top + view.height;
    for (let y = fineStartY; y <= fineEndY; y += fineGridStep) {
      const sy = this.toScreenY(y);
      graphics.lineBetween(0, sy, width, sy);
    }
    this.drawVisibleArenaBorder(graphics, width, height, state);
  }

  private drawArenaBackdropEffects(graphics: Phaser.GameObjects.Graphics, theme: MapTheme, width: number, height: number, gameMode: string): void {
    const cx = width * 0.5;
    const cy = height * 0.48;
    const maxR = Math.max(width, height) * 0.82;
    graphics.fillStyle(theme.hazeA, 0.09);
    graphics.fillCircle(cx - width * 0.18, cy - height * 0.16, maxR * 0.55);
    graphics.fillStyle(theme.hazeB, 0.075);
    graphics.fillCircle(cx + width * 0.24, cy + height * 0.12, maxR * 0.48);
    graphics.fillStyle(0xffffff, 0.035);
    graphics.fillCircle(cx, cy, maxR * (gameMode === "ffa" ? 0.66 : 0.52));

    for (let i = 0; i < 90; i += 1) {
      const x = (i * 197.13) % width;
      const y = (i * 113.57) % height;
      const radius = 0.8 + ((i * 7) % 5) * 0.35;
      const alpha = 0.15 + ((i * 11) % 7) * 0.025;
      graphics.fillStyle(theme.stars, alpha);
      graphics.fillCircle(x, y, radius);
    }
  }

  private drawParallaxArenaField(graphics: Phaser.GameObjects.Graphics, theme: MapTheme, gameMode: string, width: number, height: number): void {
    const view = this.cameraViewWorld;
    const driftX = -((view.left * 0.045) % 360);
    const driftY = -((view.top * 0.035) % 280);
    graphics.lineStyle(1, theme.lane, 0.13);
    for (let i = -1; i <= Math.ceil(width / 360) + 1; i += 1) {
      const x = driftX + i * 360;
      graphics.lineBetween(x, 0, x + height * 0.18, height);
    }
    for (let i = -1; i <= Math.ceil(height / 280) + 1; i += 1) {
      const y = driftY + i * 280;
      graphics.lineBetween(0, y, width, y + width * 0.08);
    }

    const pulse = 0.5 + 0.5 * Math.sin(this.time.now * 0.0012);
    graphics.lineStyle(2, theme.hazeA, 0.08 + pulse * 0.04);
    const ringCount = gameMode === "ffa" ? 5 : 4;
    for (let i = 1; i <= ringCount; i += 1) {
      const radius = (Math.min(width, height) * (0.14 + i * 0.105)) % (Math.max(width, height) * 0.58);
      graphics.strokeCircle(width * 0.5, height * 0.5, radius + pulse * 7);
    }
  }

  private drawVisibleArenaBorder(
    graphics: Phaser.GameObjects.Graphics,
    screenWidth: number,
    screenHeight: number,
    state: ArenaState,
  ): void {
    if (state.gameMode === "ffa") {
      const playR = FFA_OCTAGON_RADIUS - PLAYER_RADIUS;
      const ov = octagonVertices(FFA_OCTAGON_CENTER_X, FFA_OCTAGON_CENTER_Y, playR);
      graphics.lineStyle(VIEWPORT_BORDER_WIDTH, VIEWPORT_BORDER_COLOR, VIEWPORT_BORDER_ALPHA);
      const ix0 = this.toScreenX(ov[0]!.x);
      const iy0 = this.toScreenY(ov[0]!.y);
      graphics.beginPath();
      graphics.moveTo(ix0, iy0);
      for (let i = 1; i < ov.length; i += 1) {
        const p = ov[i]!;
        graphics.lineTo(this.toScreenX(p.x), this.toScreenY(p.y));
      }
      graphics.closePath();
      graphics.strokePath();
      return;
    }
    const worldMinX = PLAYER_RADIUS;
    const worldMinY = PLAYER_RADIUS;
    const worldMaxX = ARENA_WIDTH - PLAYER_RADIUS;
    const worldMaxY = ARENA_HEIGHT - PLAYER_RADIUS;

    const left = this.toScreenX(worldMinX);
    const top = this.toScreenY(worldMinY);
    const right = this.toScreenX(worldMaxX);
    const bottom = this.toScreenY(worldMaxY);

    const borderWidth = VIEWPORT_BORDER_WIDTH;
    graphics.fillStyle(VIEWPORT_BORDER_COLOR, VIEWPORT_BORDER_ALPHA);

    const visibleYTop = Phaser.Math.Clamp(top, 0, screenHeight);
    const visibleYBottom = Phaser.Math.Clamp(bottom, 0, screenHeight);
    const visibleXLeft = Phaser.Math.Clamp(left, 0, screenWidth);
    const visibleXRight = Phaser.Math.Clamp(right, 0, screenWidth);
    const visibleHeight = visibleYBottom - visibleYTop;
    const visibleWidth = visibleXRight - visibleXLeft;

    // Draw only the map edges that are currently visible in camera view.
    if (left >= 0 && left <= screenWidth && visibleHeight > 0) {
      graphics.fillRect(left - borderWidth * 0.5, visibleYTop, borderWidth, visibleHeight);
    }
    if (right >= 0 && right <= screenWidth && visibleHeight > 0) {
      graphics.fillRect(right - borderWidth * 0.5, visibleYTop, borderWidth, visibleHeight);
    }
    if (top >= 0 && top <= screenHeight && visibleWidth > 0) {
      graphics.fillRect(visibleXLeft, top - borderWidth * 0.5, visibleWidth, borderWidth);
    }
    if (bottom >= 0 && bottom <= screenHeight && visibleWidth > 0) {
      graphics.fillRect(visibleXLeft, bottom - borderWidth * 0.5, visibleWidth, borderWidth);
    }
  }

  private applyResponsiveCamera(): void {
    this.lastArenaBackdropKey = "";
    this.cameras.main.setViewport(0, 0, this.scale.width, this.scale.height);
    if (this.restartButton) {
      this.restartButton.setPosition(this.scale.width * 0.5, this.scale.height * 0.62);
    }
    if (this.countdownText) {
      this.countdownText.setPosition(this.scale.width * 0.5, this.scale.height * 0.42);
    }
    if (this.leaderboardText) {
      this.leaderboardText.setPosition(this.scale.width - 18, 22);
    }
  }

  private pruneMap<T>(map: Map<string, T>, seen: Set<string>, destroy: (value: T) => void): void {
    for (const [id, value] of map.entries()) {
      if (!seen.has(id)) {
        destroy(value);
        map.delete(id);
      }
    }
  }

  private getSmoothedWorldPoint(
    map: Map<string, VisualWorldPoint>,
    id: string,
    targetX: number,
    targetY: number,
    delta: number,
    smoothingMs: number,
    snapDistance: number,
  ): VisualWorldPoint {
    const current = map.get(id);
    if (!current) {
      const created = { x: targetX, y: targetY };
      map.set(id, created);
      return created;
    }

    const safeDelta = Number.isFinite(delta) && delta > 0 ? delta : 16;
    const distance = Math.hypot(targetX - current.x, targetY - current.y);
    if (distance > snapDistance) {
      current.x = targetX;
      current.y = targetY;
      return current;
    }

    const alpha = 1 - Math.exp(-safeDelta / smoothingMs);
    current.x = Phaser.Math.Linear(current.x, targetX, alpha);
    current.y = Phaser.Math.Linear(current.y, targetY, alpha);
    return current;
  }

  private getLocalPlayer(): PlayerState | undefined {
    const room = this.netClient.room;
    if (!room?.state?.players) {
      return undefined;
    }

    const players = room.state.players;
    const sid = this.netClient.getLocalSessionId().trim();

    if (sid.length > 0) {
      const direct = players.get(sid);
      if (direct) {
        return direct;
      }
      for (const [mapKey, p] of players.entries()) {
        if (!p) continue;
        if (p.id === sid || mapKey === sid) {
          return p;
        }
      }
    }

    const all = [...players.values()].filter((p): p is PlayerState => Boolean(p));
    const humans = all.filter((p) => p.isBot !== true);
    if (humans.length === 1) {
      return humans[0];
    }

    const wantName = this.netClient.getJoinDisplayName().trim();
    if (wantName.length > 0 && humans.length > 0) {
      const named = humans.filter((h) => (h.name || "").trim() === wantName);
      if (named.length === 1) {
        return named[0];
      }
    }

    return undefined;
  }

  private captureInput(): InputState {
    const moveX = Number(this.keys.D.isDown || this.keys.RIGHT.isDown) - Number(this.keys.A.isDown || this.keys.LEFT.isDown);
    const moveY = Number(this.keys.S.isDown || this.keys.DOWN.isDown) - Number(this.keys.W.isDown || this.keys.UP.isDown);
    const localPlayer = this.getLocalPlayer();
    const pointer = this.input.activePointer;
    const aimX = localPlayer ? pointer.x - this.toScreenX(localPlayer.x) : 1;
    const aimY = localPlayer ? pointer.y - this.toScreenY(localPlayer.y) : 0;
    const aimLength = Math.hypot(aimX, aimY) || 1;
    return {
      moveX: Phaser.Math.Clamp(moveX, -1, 1),
      moveY: Phaser.Math.Clamp(moveY, -1, 1),
      aimX: aimX / aimLength,
      aimY: aimY / aimLength,
      boost: this.keys.SPACE.isDown,
      fire: this.pointerFire,
    };
  }

  private updateHud(state: ArenaState): void {
    const localPlayer = this.getLocalPlayer();
    const remainingMs = Math.max(0, state.matchDurationMs - state.elapsedMs);
    const modeLabel = getModeLabel(state.gameMode ?? "ffa");
    this.timerText.setText(`${modeLabel} · ${Math.ceil(remainingMs / 1000)}s`);
    this.updateCountdownText(state);

    if (!localPlayer) {
      this.statusText.setText("Joining…");
      this.leaderboardText.setText("");
      this.leaderboardPanel.clear();
      this.boostHud.clear();
      this.boostHudText.setText("");
      this.powerupHudText.setText("");
      return;
    }
    const { hint } = getObjectiveWorldTarget(state, localPlayer);
    this.drawBoostHud(localPlayer);
    this.drawPowerupHud(localPlayer);

    const neutral = this.getNeutralFlag(state);
    const carrierId = neutral?.carrierId ?? "";
    if (carrierId === localPlayer.id && !this.prevFlagCarrierId) {
      this.sfx.flagPickup();
    }
    if (this.prevFlagCarrierId && carrierId === localPlayer.id && this.prevFlagCarrierId !== localPlayer.id) {
      this.sfx.flagStolen();
    }
    this.prevFlagCarrierId = carrierId;

    if (localPlayer.spikeSlowMs > 0) {
      this.spikeSlowText.setText(`SPIKE SLOW ${(localPlayer.spikeSlowMs / 1000).toFixed(1)}s`);
    } else {
      this.spikeSlowText.setText("");
    }

    const protectionMs = neutral?.stealProtectionMs ?? 0;
    if (carrierId === localPlayer.id) {
      this.flagBannerText.setVisible(true);
      this.flagBannerText.setX(this.scale.width * 0.5);
      this.flagBannerText.setText(
        protectionMs > 0 ? `YOU HAVE THE FLAG — SECURED ${Math.ceil(protectionMs / 1000)}s` : "YOU HAVE THE FLAG",
      );
    } else {
      this.flagBannerText.setVisible(false);
    }

    if (state.roundNumber === 1 && state.phase === "live" && !this.boostHintShown && state.elapsedMs < 2500) {
      this.statusText.setText("Hold SPACE for a speed burst");
    } else if (hint) {
      this.statusText.setText(hint);
    }

    const sorted = [...state.players.values()].sort((a, b) => b.wins - a.wins || b.score - a.score);
    const lines: string[] = ["#  Name           W"];
    const maxRows = Math.min(10, sorted.length);
    for (let i = 0; i < maxRows; i += 1) {
      const p = sorted[i]!;
      const rank = i + 1;
      const mark = p.id === localPlayer.id ? "›" : " ";
      const raw = (p.name || "—").trim() || "—";
      const name = raw.length > 13 ? `${raw.slice(0, 12)}…` : raw.padEnd(13, " ");
      const w = Number.isFinite(p.wins) ? p.wins : 0;
      lines.push(`${mark}${rank}  ${name} ${w}`);
    }
    this.leaderboardText.setText(lines.join("\n"));

    const pad = 11;
    const b = this.leaderboardText.getBounds();
    const panel = this.leaderboardPanel;
    panel.clear();
    panel.fillStyle(0x0a1328, 0.94);
    panel.fillRoundedRect(b.x - pad, b.y - pad, b.width + pad * 2, b.height + pad * 2, 10);
    panel.lineStyle(2.2, 0x7ec8ff, 0.65);
    panel.strokeRoundedRect(b.x - pad, b.y - pad, b.width + pad * 2, b.height + pad * 2, 10);
    panel.lineStyle(1, 0xffe8a3, 0.22);
    panel.strokeRoundedRect(b.x - pad + 2, b.y - pad + 2, b.width + pad * 2 - 4, b.height + pad * 2 - 4, 8);

    const sortedByScore = [...state.players.values()].sort((a, b) => b.score - a.score);
    const rank = Math.max(1, sortedByScore.findIndex((player) => player.id === localPlayer.id) + 1);
    if (state.phase === "live" && state.elapsedMs >= 2500) {
      this.boostHintShown = true;
    }

    if (state.phase === "results" || remainingMs <= 0) {
      if (rank <= 3) {
        this.hideRestartButton();
      } else {
        this.showRestartButton();
      }
    } else {
      this.hideRestartButton();
    }
  }

  private toScreenX(worldX: number): number { return (worldX - this.cameraViewWorld.left) * this.cameraViewWorld.scale; }

  private toScreenY(worldY: number): number { return (worldY - this.cameraViewWorld.top) * this.cameraViewWorld.scale; }

  private toScreenRadius(worldRadius: number): number { return worldRadius * this.cameraViewWorld.scale; }

  private drawMinimap(state: ArenaState): void {
    const g = this.minimapGraphics;
    const pad = 18;
    const baseMinX = PLAYER_RADIUS;
    const baseMinY = PLAYER_RADIUS;
    const baseMaxX = ARENA_WIDTH - PLAYER_RADIUS;
    const baseMaxY = ARENA_HEIGHT - PLAYER_RADIUS;

    if (state.gameMode === "ffa") {
      const mapWidth = 276;
      const mapHeight = 212;
      const x = this.scale.width - mapWidth - pad;
      const y = this.scale.height - mapHeight - pad;
      const cx = x + mapWidth * 0.5;
      const cy = y + mapHeight * 0.5;
      const rScreen = Math.min(mapWidth, mapHeight) * 0.48 - 6;
      const wx = (worldX: number) => cx + ((worldX - FFA_OCTAGON_CENTER_X) / FFA_OCTAGON_RADIUS) * rScreen;
      const wy = (worldY: number) => cy + ((worldY - FFA_OCTAGON_CENTER_Y) / FFA_OCTAGON_RADIUS) * rScreen;
      g.clear();
      const playR = FFA_OCTAGON_RADIUS - PLAYER_RADIUS * 2;
      const ovWorld = octagonVertices(FFA_OCTAGON_CENTER_X, FFA_OCTAGON_CENTER_Y, playR);
      g.fillStyle(0x0a1128, 0.82);
      g.beginPath();
      g.moveTo(wx(ovWorld[0]!.x), wy(ovWorld[0]!.y));
      for (let i = 1; i < ovWorld.length; i += 1) {
        const p = ovWorld[i]!;
        g.lineTo(wx(p.x), wy(p.y));
      }
      g.closePath();
      g.fillPath();
      g.lineStyle(2.4, 0xc6ceff, 0.48);
      g.beginPath();
      g.moveTo(wx(ovWorld[0]!.x), wy(ovWorld[0]!.y));
      for (let i = 1; i < ovWorld.length; i += 1) {
        const p = ovWorld[i]!;
        g.lineTo(wx(p.x), wy(p.y));
      }
      g.closePath();
      g.strokePath();
      const bases = ffaBaseCenters(FFA_OCTAGON_CENTER_X, FFA_OCTAGON_CENTER_Y, FFA_OCTAGON_RADIUS, 0.11);
      OCTAGON_SOLO_FFA_SLOTS.forEach(({ team, vertexIndex }) => {
        const c = bases[vertexIndex];
        if (!c) return;
        g.fillStyle(TEAM_COLORS[team] ?? 0xffffff, 0.55);
        g.fillCircle(wx(c.x), wy(c.y), 4.5);
      });
      for (const player of state.players.values()) {
        const px = wx(player.x);
        const py = wy(player.y);
        const color = TEAM_COLORS[player.team] ?? 0xffffff;
        g.fillStyle(color, player.alive ? 0.95 : 0.35);
        g.fillCircle(px, py, 2.8);
      }
      g.lineStyle(1.5, 0xc6ceff, 0.45);
      g.strokeCircle(wx(state.captureX), wy(state.captureY), (state.captureRadius / FFA_OCTAGON_RADIUS) * rScreen);
      const neutral = this.getNeutralFlag(state);
      if (neutral && !neutral.carrierId) {
        const fx = wx(neutral.x);
        const fy = wy(neutral.y);
        g.fillStyle(0xfff46b, 0.95);
        g.fillTriangle(fx, fy - 4, fx + 5, fy + 3, fx - 5, fy + 3);
      } else if (neutral?.carrierId) {
        const carrier = state.players.get(neutral.carrierId);
        if (carrier?.alive) {
          const fx = wx(carrier.x);
          const fy = wy(carrier.y);
          const ping = state.neutralCarrierPing;
          const pulse = ping ? 1 + 0.35 * Math.sin(this.time.now * 0.012) : 1;
          const half = (ping ? 5.5 : 3) * pulse;
          g.fillStyle(0xfff46b, 1);
          g.fillRect(fx - half, fy - half, half * 2, half * 2);
          g.lineStyle(ping ? 2 : 1, 0xff4444, ping ? 1 : 1);
          g.strokeRect(fx - half, fy - half, half * 2, half * 2);
        }
      }
      return;
    }

    const mapWidth = 220;
    const mapHeight = 150;
    const x = this.scale.width - mapWidth - pad;
    const y = this.scale.height - mapHeight - pad;
    g.clear();
    g.fillStyle(0x0a1128, 0.75);
    g.fillRect(x, y, mapWidth, mapHeight);
    g.lineStyle(2, 0xffffff, 0.25);
    g.strokeRect(x, y, mapWidth, mapHeight);
    if (state.gameMode === "team_ctf") {
      const ctf = getTeamCtfBaseRects();
      this.drawMinimapZone(g, x, y, mapWidth, mapHeight, ctf.red.minX, ctf.red.minY, ctf.red.maxX - ctf.red.minX, ctf.red.maxY - ctf.red.minY, TEAM_COLORS["red"]);
      this.drawMinimapZone(g, x, y, mapWidth, mapHeight, ctf.blue.minX, ctf.blue.minY, ctf.blue.maxX - ctf.blue.minX, ctf.blue.maxY - ctf.blue.minY, TEAM_COLORS["blue"]);
    } else if (state.gameMode === "race") {
      this.drawMinimapZone(
        g,
        x,
        y,
        mapWidth,
        mapHeight,
        RACE_SPAWN_BAND_MIN_X,
        baseMinY,
        RACE_SPAWN_BAND_MAX_X - RACE_SPAWN_BAND_MIN_X,
        ARENA_HEIGHT - PLAYER_RADIUS * 2,
        0x5cf0ff,
      );
      const fxw = x + (RACE_FLAG_HOME_X / ARENA_WIDTH) * mapWidth;
      const fyw = y + (RACE_FLAG_HOME_Y / ARENA_HEIGHT) * mapHeight;
      g.fillStyle(0xfff46b, 0.35);
      g.fillCircle(fxw, fyw, 5);
    } else {
      this.drawMinimapZone(g, x, y, mapWidth, mapHeight, baseMinX, baseMinY, SAFE_ZONE_SIZE, SAFE_ZONE_SIZE, TEAM_COLORS["red"]);
      this.drawMinimapZone(g, x, y, mapWidth, mapHeight, baseMaxX - SAFE_ZONE_SIZE, baseMinY, SAFE_ZONE_SIZE, SAFE_ZONE_SIZE, TEAM_COLORS["blue"]);
      this.drawMinimapZone(g, x, y, mapWidth, mapHeight, baseMinX, baseMaxY - SAFE_ZONE_SIZE, SAFE_ZONE_SIZE, SAFE_ZONE_SIZE, TEAM_COLORS["green"]);
      this.drawMinimapZone(
        g,
        x,
        y,
        mapWidth,
        mapHeight,
        baseMaxX - SAFE_ZONE_SIZE,
        baseMaxY - SAFE_ZONE_SIZE,
        SAFE_ZONE_SIZE,
        SAFE_ZONE_SIZE,
        TEAM_COLORS["yellow"],
      );
    }

    for (const player of state.players.values()) {
      const px = x + (player.x / ARENA_WIDTH) * mapWidth;
      const py = y + (player.y / ARENA_HEIGHT) * mapHeight;
      const color = TEAM_COLORS[player.team] ?? 0xffffff;
      g.fillStyle(color, player.alive ? 0.95 : 0.35);
      g.fillCircle(px, py, 2.5);
    }
    g.lineStyle(1.5, 0xc6ceff, 0.45);
    g.strokeCircle(
      x + (state.captureX / ARENA_WIDTH) * mapWidth,
      y + (state.captureY / ARENA_HEIGHT) * mapHeight,
      (state.captureRadius / ARENA_WIDTH) * mapWidth,
    );

    const neutral = this.getNeutralFlag(state);
    if (neutral && !neutral.carrierId) {
      const fx = x + (neutral.x / ARENA_WIDTH) * mapWidth;
      const fy = y + (neutral.y / ARENA_HEIGHT) * mapHeight;
      g.fillStyle(0xfff46b, 0.95);
      g.fillTriangle(fx, fy - 4, fx + 5, fy + 3, fx - 5, fy + 3);
    } else if (neutral?.carrierId) {
      const carrier = state.players.get(neutral.carrierId);
      if (carrier?.alive) {
        const fx = x + (carrier.x / ARENA_WIDTH) * mapWidth;
        const fy = y + (carrier.y / ARENA_HEIGHT) * mapHeight;
        const ping = state.neutralCarrierPing;
        const pulse = ping ? 1 + 0.35 * Math.sin(this.time.now * 0.012) : 1;
        const half = (ping ? 5.5 : 3) * pulse;
        g.fillStyle(0xfff46b, 1);
        g.fillRect(fx - half, fy - half, half * 2, half * 2);
        g.lineStyle(ping ? 2 : 1, 0xff4444, ping ? 1 : 1);
        g.strokeRect(fx - half, fy - half, half * 2, half * 2);
      }
    }
  }

  private drawMinimapZone(
    g: Phaser.GameObjects.Graphics,
    mapX: number,
    mapY: number,
    mapW: number,
    mapH: number,
    worldX: number,
    worldY: number,
    worldW: number,
    worldH: number,
    color: number,
  ): void {
    const x = mapX + (worldX / ARENA_WIDTH) * mapW;
    const y = mapY + (worldY / ARENA_HEIGHT) * mapH;
    const w = (worldW / ARENA_WIDTH) * mapW;
    const h = (worldH / ARENA_HEIGHT) * mapH;
    g.fillStyle(color, 0.18);
    g.fillRect(x, y, w, h);
    g.lineStyle(1.2, color, 0.7);
    g.strokeRect(x, y, w, h);
  }

  private getNeutralFlag(state: ArenaState): FlagState | undefined {
    return state.flags.get("flag-neutral");
  }

  private checkLocalProjectileBlasts(state: ArenaState): void {
    const local = this.getLocalPlayer();
    if (!local?.alive) return;
    const current = state.projectiles;
    for (const [id, snap] of this.projectileSnapshot.entries()) {
      if (current.has(id)) continue;
      const d = Math.hypot(local.x - snap.x, local.y - snap.y);
      if (d > PROJECTILE_EXPLOSION_RADIUS) continue;
      const directRadius = PLAYER_RADIUS + snap.radius;
      this.onLocalBlastFeedback(d <= directRadius);
    }
  }

  private onLocalBlastFeedback(direct: boolean): void {
    const local = this.getLocalPlayer();
    if (direct) {
      this.sfx.blastDirect();
      this.cameras.main.shake(90, 0.0018);
    } else {
      this.sfx.blastNear();
    }
    const cx = this.toScreenX(local?.x ?? 0);
    const cy = this.toScreenY(local?.y ?? 0);
    const color = direct ? 0xff9a6a : 0xa3c4ff;
    const ring = this.add.circle(cx, cy, direct ? 48 : 28, color, 0.35).setDepth(125);
    this.tweens.add({
      targets: ring,
      alpha: 0,
      scaleX: direct ? 2.4 : 2.9,
      scaleY: direct ? 2.4 : 2.9,
      duration: direct ? 220 : 280,
      onComplete: () => ring.destroy(),
    });
  }

  private refreshProjectileSnapshot(state: ArenaState): void {
    this.projectileSnapshot.clear();
    for (const [id, projectile] of state.projectiles.entries()) {
      if (!projectile) continue;
      this.projectileSnapshot.set(id, {
        x: projectile.x,
        y: projectile.y,
        ownerId: projectile.ownerId,
        radius: projectile.radius,
      });
    }
  }

  private drawScreenObjectiveOverlay(state: ArenaState): void {
    this.dangerOverlay.clear();
    this.objectiveScreenGraphics.clear();
    const local = this.getLocalPlayer();
    if (!local?.alive || state.phase !== "live") {
      this.objectiveFlagLabel.setVisible(false);
      return;
    }

    const w = this.scale.width;
    const h = this.scale.height;
    if (isInEnemySafeZone(local.x, local.y, local.team, state)) {
      const dangerPulse = 0.07 + 0.06 * Math.sin(this.time.now * 0.005);
      this.dangerOverlay.fillStyle(0xff1c3a, dangerPulse);
      this.dangerOverlay.fillRect(0, 0, w, h);
    }

    const { x: tx, y: ty, hint } = getObjectiveWorldTarget(state, local);
    const tsx = this.toScreenX(tx);
    const tsy = this.toScreenY(ty);
    const marker = objectiveScreenMarker(w, h, tsx, tsy, 32);
    const cx = w * 0.5;
    const cy = h * 0.5;
    const angle = Math.atan2(tsy - cy, tsx - cx);
    const g = this.objectiveScreenGraphics;
    const arrowPulse = 1 + 0.08 * Math.sin(this.time.now * 0.006);
    const baseR = marker.offScreen ? 34 : 26;
    const r = baseR * arrowPulse;
    const ax = marker.drawX + Math.cos(angle) * r;
    const ay = marker.drawY + Math.sin(angle) * r;
    const wing = r * 0.72;
    const bx = marker.drawX + Math.cos(angle + 2.35) * wing;
    const by = marker.drawY + Math.sin(angle + 2.35) * wing;
    const cx2 = marker.drawX + Math.cos(angle - 2.35) * wing;
    const cy2 = marker.drawY + Math.sin(angle - 2.35) * wing;

    const glowR = r * 1.35;
    const gax = marker.drawX + Math.cos(angle) * glowR;
    const gay = marker.drawY + Math.sin(angle) * glowR;
    const gwing = glowR * 0.72;
    const gbx = marker.drawX + Math.cos(angle + 2.35) * gwing;
    const gby = marker.drawY + Math.sin(angle + 2.35) * gwing;
    const gcx2 = marker.drawX + Math.cos(angle - 2.35) * gwing;
    const gcy2 = marker.drawY + Math.sin(angle - 2.35) * gwing;
    g.fillStyle(0xff9500, 0.45);
    g.fillTriangle(gax, gay, gbx, gby, gcx2, gcy2);

    g.fillStyle(0xffee66, marker.offScreen ? 1 : 0.92);
    g.fillTriangle(ax, ay, bx, by, cx2, cy2);
    g.lineStyle(4, 0x1a0f28, 0.92);
    g.beginPath();
    g.moveTo(ax, ay);
    g.lineTo(bx, by);
    g.lineTo(cx2, cy2);
    g.closePath();
    g.strokePath();
    g.lineStyle(2, 0xffffff, 0.88);
    g.beginPath();
    g.moveTo(ax, ay);
    g.lineTo(bx, by);
    g.lineTo(cx2, cy2);
    g.closePath();
    g.strokePath();

    const triCenterX = (ax + bx + cx2) / 3;
    const triBottomY = Math.max(ay, by, cy2);
    const triTopY = Math.min(ay, by, cy2);
    const gap = 10;
    const edgePad = 14;
    const halfW = Math.max(this.objectiveFlagLabel.displayWidth * 0.5, 28);
    const halfH = Math.max(this.objectiveFlagLabel.displayHeight * 0.5, 12);

    let lx = triCenterX;
    let ly = triBottomY + gap + halfH * 0.35;
    if (ly + halfH > h - edgePad) {
      ly = triTopY - gap - halfH * 0.35;
    }
    lx = Phaser.Math.Clamp(lx, edgePad + halfW, w - edgePad - halfW);
    ly = Phaser.Math.Clamp(ly, edgePad + halfH, h - edgePad - halfH);

    this.objectiveFlagLabel.setPosition(lx, ly);
    this.objectiveFlagLabel.setText(hint && hint.length < 28 ? hint.toUpperCase() : "FLAG");
    this.objectiveFlagLabel.setVisible(true);
  }

  private drawSafeZoneRect(
    graphics: Phaser.GameObjects.Graphics,
    worldX: number,
    worldY: number,
    worldW: number,
    worldH: number,
    team: "red" | "blue" | "green" | "yellow",
    pulseMs: number,
  ): void {
    const sx = this.toScreenX(worldX);
    const sy = this.toScreenY(worldY);
    const sw = worldW * this.cameraViewWorld.scale;
    const sh = worldH * this.cameraViewWorld.scale;
    graphics.fillStyle(TEAM_COLORS[team], 0.16);
    graphics.fillRect(sx, sy, sw, sh);
    const edgePulse = 0.62 + 0.38 * Math.sin(pulseMs * 0.003 + worldX * 0.0004 + worldY * 0.0003);
    graphics.lineStyle(4, TEAM_COLORS[team], edgePulse);
    graphics.strokeRect(sx, sy, sw, sh);
    graphics.lineStyle(2, 0xffffff, 0.22 + 0.2 * edgePulse);
    graphics.strokeRect(sx + 3 * this.cameraViewWorld.scale, sy + 3 * this.cameraViewWorld.scale, sw - 6 * this.cameraViewWorld.scale, sh - 6 * this.cameraViewWorld.scale);
  }

  private updateCameraViewWorld(delta: number, localPlayer: PlayerState | undefined): void {
    const targetX = localPlayer ? localPlayer.x : ARENA_WIDTH * 0.5;
    const targetY = localPlayer ? localPlayer.y : ARENA_HEIGHT * 0.5;
    const scale = this.scale.width / CAMERA_VIEW_WIDTH_WORLD;
    const viewWidth = this.scale.width / scale;
    const viewHeight = this.scale.height / scale;
    const smoothed = localPlayer ? this.playerVisualWorld.get(localPlayer.id) : undefined;
    const idealFocusX = smoothed?.x ?? targetX;
    const idealFocusY = smoothed?.y ?? targetY;

    const followAlpha = 1 - Math.exp(-Math.max(delta, 1) / CAMERA_FOLLOW_SMOOTH_MS);
    this.cameraFocusX = Phaser.Math.Linear(this.cameraFocusX, idealFocusX, followAlpha);
    this.cameraFocusY = Phaser.Math.Linear(this.cameraFocusY, idealFocusY, followAlpha);

    // This is the dedicated player camera: never clamp to arena bounds. The local
    // player stays centered even on FFA bases, corners, or beyond world edges.
    const left = this.cameraFocusX - viewWidth * 0.5;
    const top = this.cameraFocusY - viewHeight * 0.5;
    this.cameraViewWorld = { left, top, width: viewWidth, height: viewHeight, scale };

    // World positions are converted to screen manually; Phaser camera scroll/zoom must stay neutral
    // or the ship and our math disagree and the view "doesn't follow" the player.
    const cam = this.cameras.main;
    cam.setScroll(0, 0);
    if (typeof cam.zoom === "number" && cam.zoom !== 1) {
      cam.setZoom(1);
    }
  }

  private updateCarrierWorldLabel(state: ArenaState): void {
    const carrierId = this.getNeutralFlag(state)?.carrierId;
    if (!carrierId) {
      this.carrierWorldLabel.setVisible(false);
      return;
    }
    const carrier = state.players.get(carrierId);
    if (!carrier?.alive) {
      this.carrierWorldLabel.setVisible(false);
      return;
    }
    const labelY = carrier.y - PLAYER_RADIUS * 4.2;
    this.carrierWorldLabel.setVisible(true);
    this.carrierWorldLabel.setPosition(this.toScreenX(carrier.x), this.toScreenY(labelY));
    this.carrierWorldLabel.setText(this.flagStealProtectionMs > 0 ? "FLAG ✦" : "FLAG");
  }

  private drawBoostHud(player: PlayerState): void {
    const dotR = 7;
    const gap = 6;
    const startX = 24;
    const y = 118;
    const g = this.boostHud;
    g.clear();
    this.boostHudTitle.setText(`BOOST ${player.boostCharges}/${BOOST_CHARGES_PER_LIFE}`);
    const readyPulse =
      player.boostCharges > 0 && player.boostCooldownMs <= 0 && player.boostMs <= 0
        ? 0.65 + 0.35 * Math.sin(this.time.now * 0.008)
        : 1;
    for (let i = 0; i < BOOST_CHARGES_PER_LIFE; i += 1) {
      const cx = startX + dotR + i * (dotR * 2 + gap);
      const filled = i < player.boostCharges;
      if (filled) {
        g.fillStyle(0xffe95c, 0.96 * readyPulse);
        g.fillCircle(cx, y, dotR);
        g.lineStyle(2, 0xffffff, 0.85);
        g.strokeCircle(cx, y, dotR);
      } else {
        g.lineStyle(2, 0xffe95c, 0.35);
        g.strokeCircle(cx, y, dotR);
      }
    }
    const barW = BOOST_CHARGES_PER_LIFE * (dotR * 2 + gap) - gap;
    const barH = 5;
    const barX = startX;
    const barY = y + dotR + 8;
    if (player.boostMs > 0) {
      const ratio = Math.min(1, player.boostMs / BOOST_DURATION_MS);
      g.fillStyle(0x2a3458, 0.85);
      g.fillRect(barX, barY, barW, barH);
      g.fillStyle(0xffe95c, 0.95);
      g.fillRect(barX, barY, barW * ratio, barH);
      this.boostHudText.setText("BOOSTING");
    } else if (player.boostCooldownMs > 0) {
      const ratio = Math.min(1, player.boostCooldownMs / BOOST_COOLDOWN_MS);
      g.fillStyle(0x2a3458, 0.85);
      g.fillRect(barX, barY, barW, barH);
      g.fillStyle(0x66a6ff, 0.95);
      g.fillRect(barX, barY, barW * (1 - ratio), barH);
      this.boostHudText.setText(`Recharging ${(player.boostCooldownMs / 1000).toFixed(1)}s`);
    } else if (player.boostCharges === 0) {
      this.boostHudText.setText("No boosts — respawn to refill");
    } else {
      this.boostHudText.setText("Hold SPACE");
    }
  }

  private drawPowerupHud(player: PlayerState): void {
    const buffs: string[] = [];
    if (player.speedBoostMs > 0) {
      buffs.push(`Speed Up ${(player.speedBoostMs / 1000).toFixed(1)}s`);
    }
    if (player.shieldHits > 0) {
      buffs.push("Shield (blocks 1 hit)");
    }
    if (player.magnetMs > 0) {
      buffs.push(`Magnet ${(player.magnetMs / 1000).toFixed(1)}s`);
    }
    if (player.repelMs > 0) {
      buffs.push(`Repel ${(player.repelMs / 1000).toFixed(1)}s`);
    }
    this.powerupHudText.setText(buffs.length > 0 ? buffs.join(" · ") : "");
  }

  private createPlayerVisual(color: number): Phaser.GameObjects.Container {
    const body = this.add.circle(0, 0, PLAYER_BODY_RADIUS_PX, color, 0.96).setStrokeStyle(3, 0xffffff, 0.95);
    const nose = this.add.triangle(36, 0, 0, 0, -24, -14, -24, 14, 0xffffff, 0.95);
    const carrierRing = this.add.circle(0, 0, 58, 0xfff46b, 0.14).setStrokeStyle(4, 0xfff46b, 0.95).setVisible(false);
    return this.add.container(0, 0, [body, nose, carrierRing]).setDepth(40);
  }

  private createPickupVisual(kind: PickupState["kind"]): Phaser.GameObjects.Container {
    const color = PICKUP_COLORS[kind] ?? 0xffffff;
    const outerGlow = this.add.circle(0, 0, 18, color, 0.2).setStrokeStyle(2, color, 0.65);
    const core = this.add.circle(0, 0, 11, color, 0.95).setStrokeStyle(2, 0xffffff, 0.95);
    const icon = this.add.graphics();
    this.drawPickupIcon(icon, kind);
    icon.setDepth(1);
    const label = this.add
      .text(0, 24, PICKUP_WORLD_LABELS[kind] ?? kind.toUpperCase(), {
        color: "#ffffff",
        fontFamily: "Segoe UI, system-ui, sans-serif",
        fontSize: "11px",
        fontStyle: "700",
        letterSpacing: 1,
      })
      .setOrigin(0.5, 0);
    return this.add.container(0, 0, [outerGlow, core, icon, label]).setDepth(30);
  }

  /** Vector icons inside the pickup core. All drawn at radius ~7 around (0,0) so they sit inside the 11px core. */
  private drawPickupIcon(g: Phaser.GameObjects.Graphics, kind: PickupState["kind"]): void {
    g.clear();
    g.lineStyle(1.8, 0x0f1432, 1);
    g.fillStyle(0x0f1432, 1);
    if (kind === "speed") {
      // Lightning bolt: simple zig.
      g.fillTriangle(-2, -7, 4, -1, -1, -1);
      g.fillTriangle(1, 1, 4, 7, -3, 1);
    } else if (kind === "ammo") {
      // Bullet/cartridge: rounded rect with tip.
      g.fillRoundedRect(-4, -5, 8, 7, 1.5);
      g.fillTriangle(-4, -5, 4, -5, 0, -8);
    } else if (kind === "shield") {
      // Shield outline with center cross.
      g.beginPath();
      g.moveTo(0, -7);
      g.lineTo(6, -4);
      g.lineTo(6, 2);
      g.lineTo(0, 7);
      g.lineTo(-6, 2);
      g.lineTo(-6, -4);
      g.closePath();
      g.strokePath();
      g.lineBetween(0, -3, 0, 4);
      g.lineBetween(-3, 0, 3, 0);
    } else if (kind === "magnet") {
      // Horseshoe magnet: U-shape with stubby ends.
      g.lineStyle(2.2, 0x0f1432, 1);
      g.beginPath();
      g.arc(0, 1, 5.5, Math.PI, 0, true);
      g.strokePath();
      g.lineBetween(-5.5, 1, -5.5, 6);
      g.lineBetween(5.5, 1, 5.5, 6);
    } else if (kind === "repel") {
      // Outward-radiating arrows: four short arrows from center.
      g.lineStyle(1.8, 0x0f1432, 1);
      const arrow = (dx: number, dy: number) => {
        g.lineBetween(0, 0, dx, dy);
        const perpX = -dy * 0.35;
        const perpY = dx * 0.35;
        g.lineBetween(dx, dy, dx - dx * 0.35 + perpX, dy - dy * 0.35 + perpY);
        g.lineBetween(dx, dy, dx - dx * 0.35 - perpX, dy - dy * 0.35 - perpY);
      };
      arrow(0, -6);
      arrow(0, 6);
      arrow(-6, 0);
      arrow(6, 0);
    } else {
      g.fillCircle(0, 0, 3);
    }
  }

  private updateCountdownText(state: ArenaState): void {
    if (state.phase !== "countdown") {
      this.countdownText.setStyle(this.textStyle(92, "#ffffff"));
      this.countdownText.setText("");
      return;
    }
    const seconds = Math.ceil(state.countdownMs / 1000);
    this.countdownText.setStyle(this.textStyle(92, "#ffffff"));
    this.countdownText.setText(seconds > 0 ? `${seconds}` : "GO");
  }

  private emitFlagTrail(player: PlayerState, color: number): void {
    const lastAt = this.lastTrailAtMs.get(player.id) ?? 0;
    if (this.time.now - lastAt < 88) return;
    this.lastTrailAtMs.set(player.id, this.time.now);
    const trail = this.add.circle(this.toScreenX(player.x), this.toScreenY(player.y), 10, color, 0.45).setDepth(22);
    this.tweens.add({
      targets: trail,
      alpha: 0,
      scaleX: 0.5,
      scaleY: 0.5,
      duration: 320,
      onComplete: () => trail.destroy(),
    });
  }

  private getCosmeticTier(score: number): number {
    if (score >= PROGRESSION_MILESTONES[2]) return 3;
    if (score >= PROGRESSION_MILESTONES[1]) return 2;
    if (score >= PROGRESSION_MILESTONES[0]) return 1;
    return 0;
  }

  private textStyle(size: number, color: string): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      color,
      fontFamily: "Arial",
      fontSize: `${size}px`,
      fontStyle: "700",
    };
  }

  private showRestartButton(): void {
    if (!this.restartButton || this.restarting) {
      return;
    }
    this.restartButton.setVisible(true).setAlpha(1).setText("RESTART");
    this.restartButton.setInteractive({ useHandCursor: true });
  }

  private hideRestartButton(): void {
    if (!this.restartButton) {
      return;
    }
    this.restartButton.setVisible(false).setAlpha(0);
    this.restartButton.disableInteractive();
  }

  private async restartSession(): Promise<void> {
    if (this.restarting) {
      return;
    }
    this.restarting = true;
    this.restartButton.setText("RESTARTING...").disableInteractive();
    this.statusText.setText("Restarting…");
    this.countdownText.setText("3");
    // Reset local input throttle so post-restart countdown/input sync starts cleanly.
    this.lastInputSentAt = 0;
    this.netClient.requestRestart();
    this.time.delayedCall(400, () => {
      this.restarting = false;
      this.hideRestartButton();
      this.statusText.setText("");
    });
  }
}
