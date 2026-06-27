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

function readRoomSessionId(room: Room<any, ArenaState>): string {
  const r = room as unknown as {
    sessionId?: string;
    connection?: { sessionId?: string; id?: string };
  };
  const direct = r.sessionId;
  if (typeof direct === "string" && direct.length > 0) return direct.trim();
  const nested = r.connection?.sessionId;
  if (typeof nested === "string" && nested.length > 0) return nested.trim();
  const connId = r.connection?.id;
  if (typeof connId === "string" && connId.length > 0 && connId.length < 128) return connId.trim();
  return "";
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    promise.then(
      (value) => {
        window.clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

export class NetClient {
  private readonly client = new Client(getServerUrl());
  room: Room<any, ArenaState> | null = null;

  /** Cached from the Colyseus room once available; used to find `PlayerState` in maps. */
  private localSessionId = "";
  /** From the last `join()` options — disambiguates the local human when several are in the room. */
  private joinDisplayName = "";

  getLocalSessionId(): string {
    if (!this.room) {
      return "";
    }
    const live = readRoomSessionId(this.room);
    if (live.length > 0) {
      this.localSessionId = live;
      return live;
    }
    return this.localSessionId;
  }

  /** Normalized display name from the last join (matches server slice). */
  getJoinDisplayName(): string {
    return this.joinDisplayName;
  }

  async join(options: JoinOptions, inviteRoomId: string | null): Promise<Room<any, ArenaState>> {
    const joinOptions: JoinOptions = {
      mode: options.mode ?? "ffa",
      name: (options.name ?? "Runner").trim().slice(0, 18),
    };
    this.joinDisplayName = joinOptions.name ?? "Runner";
    if (this.room) {
      this.refreshLocalSessionId();
      return this.room;
    }

    const joinPromise = inviteRoomId
      ? this.client
          .joinById<ArenaState>(inviteRoomId, joinOptions, ArenaState)
          .catch(() => this.client.joinOrCreate<ArenaState>(ROOM_NAME, joinOptions, ArenaState))
      : this.client.joinOrCreate<ArenaState>(ROOM_NAME, joinOptions, ArenaState);
    this.room = await withTimeout(joinPromise, 8000, "Joining arena");

    this.refreshLocalSessionId();
    this.publishRoomIdToUrl(this.room.roomId);
    return this.room;
  }

  /** Writes ?roomId= so a second browser tab can join the same Colyseus room. */
  private publishRoomIdToUrl(roomId: string): void {
    if (!roomId || typeof window === "undefined") return;
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get("roomId") === roomId) return;
      url.searchParams.set("roomId", roomId);
      window.history.replaceState({}, "", url.toString());
    } catch {
      // ignore
    }
  }

  private refreshLocalSessionId(): void {
    if (!this.room) {
      this.localSessionId = "";
      return;
    }
    const sid = readRoomSessionId(this.room);
    if (sid.length > 0) this.localSessionId = sid;
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
    this.localSessionId = "";
    this.joinDisplayName = "";
  }
}
