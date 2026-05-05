import { Client, Room } from "@colyseus/sdk";
import { ArenaState, ROOM_NAME, type InputState, type JoinOptions } from "@shared";

function getServerUrl(): string {
  const envUrl = import.meta.env.VITE_SERVER_URL as string | undefined;
  if (envUrl) {
    return envUrl;
  }

  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${window.location.hostname}:2567`;
}

export class NetClient {
  private readonly client = new Client(getServerUrl());
  room: Room<any, ArenaState> | null = null;

  async join(options: JoinOptions, inviteRoomId: string | null): Promise<Room<any, ArenaState>> {
    if (this.room) {
      return this.room;
    }

    this.room = inviteRoomId
      ? await this.client
          .joinById<ArenaState>(inviteRoomId, options, ArenaState)
          .catch(() => this.client.joinOrCreate<ArenaState>(ROOM_NAME, options, ArenaState))
      : await this.client.joinOrCreate<ArenaState>(ROOM_NAME, options, ArenaState);

    return this.room;
  }

  sendInput(input: InputState): void {
    this.room?.send("input", input);
  }

  requestRestart(): void {
    this.room?.send("restart");
  }

  leave(): void {
    this.room?.leave();
    this.room = null;
  }
}
