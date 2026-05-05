import { Client, Room } from "colyseus";
import { SERVER_TICK_RATE, ROOM_NAME, type InputState, type JoinOptions } from "../../../shared/src/index";
import { GameSimulation } from "../simulation";
import { ArenaState } from "../state";

export class ArenaRoom extends Room<{ state: ArenaState }> {
  private readonly roomState = new ArenaState();
  private readonly simulation = new GameSimulation(this.roomState);
  override onCreate(): void {
    this.setState(this.roomState);
    this.autoDispose = false;
    this.patchRate = 1000 / 20;

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
    const humansBefore = [...this.roomState.players.values()].filter((p) => !p.isBot).length;
    if (humansBefore === 0) {
      this.roomState.gameMode = options.mode === "ffa" ? "ffa" : "sandbox";
    }
    this.simulation.addPlayer(client.sessionId, (options.name ?? "Runner").slice(0, 18), false);
    // First human: reset match, fill with bots, no join countdown. Extra humans: drop in mid-match.
    if (humansBefore === 0) {
      this.simulation.restartMatch();
    }
  }

  override onLeave(client: Client): void {
    this.simulation.removePlayer(client.sessionId);
  }
}

export const roomName = ROOM_NAME;
