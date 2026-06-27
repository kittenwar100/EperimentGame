import { Client, Room } from "colyseus";
import {
  MAX_PLAYERS_PER_ROOM,
  NETWORK_UPDATE_RATE,
  SERVER_TICK_RATE,
  ROOM_NAME,
  type GameModeId,
  type InputState,
  type JoinOptions,
} from "../../../shared/src/index";
import { GameSimulation } from "../simulation";
import { ArenaState } from "../state";

function resolveMode(mode: GameModeId | undefined): GameModeId {
  if (mode === "ffa" || mode === "team_ctf" || mode === "race" || mode === "sandbox") return mode;
  return "ffa";
}

export class ArenaRoom extends Room<{ state: ArenaState }> {
  override maxClients = MAX_PLAYERS_PER_ROOM;

  private readonly roomState = new ArenaState();
  private readonly simulation = new GameSimulation(this.roomState);
  /** Monotonic solo FFA join index: 0 = first human (red), 1 = second (blue), … */
  private soloFfaHumanJoinCounter = 0;
  override onCreate(options: JoinOptions = {}): void {
    this.setState(this.roomState);
    this.roomState.gameMode = resolveMode(options.mode);
    this.autoDispose = false;
    this.patchRate = 1000 / NETWORK_UPDATE_RATE;

    this.onMessage("input", (client, input: InputState) => {
      this.simulation.setInput(client.sessionId, input);
    });
    this.onMessage("restart", (client) => {
      if (this.roomState.players.has(client.sessionId)) {
        this.simulation.restartMatch();
      }
    });

    this.setSimulationInterval((deltaTime) => {
      this.simulation.update(deltaTime);
    }, 1000 / SERVER_TICK_RATE);
  }

  override onJoin(client: Client, options: JoinOptions): void {
    const humansBefore = this.simulation.countHumanPlayers();
    if (humansBefore === 0) {
      this.roomState.gameMode = resolveMode(options.mode);
    }
    const displayName = (options.name ?? "Runner").slice(0, 18);
    const mode = this.roomState.gameMode === "ffa" || humansBefore === 0 ? resolveMode(options.mode) : this.roomState.gameMode;

    if (mode === "ffa") {
      const slotIndex = this.soloFfaHumanJoinCounter;
      this.soloFfaHumanJoinCounter += 1;
      if (humansBefore === 0) {
        this.roomState.gameMode = "ffa";
        this.simulation.prepareSoloFfaForHumanJoin();
      }
      this.simulation.joinSoloFfaHuman(client.sessionId, displayName, slotIndex);
      if (humansBefore === 0) {
        this.simulation.restartMatch();
      }
      this.simulation.finalizeSoloFfaHumanPlacement(client.sessionId, slotIndex);
      this.simulation.reconcileSoloFfaHumanTeamsNow();
      return;
    }

    if (humansBefore === 0) {
      this.roomState.gameMode = resolveMode(options.mode);
      this.simulation.addPlayer(client.sessionId, displayName, false);
      this.simulation.restartMatch();
    } else {
      this.simulation.addHumanReplacingBot(client.sessionId, displayName);
    }
  }

  override onLeave(client: Client): void {
    this.simulation.removePlayer(client.sessionId);
  }
}

export const roomName = ROOM_NAME;
