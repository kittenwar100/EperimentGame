import { Client, Room, Callbacks } from "@colyseus/sdk";
import { ArenaState, ROOM_NAME, type InputState, type JoinOptions } from "@shared";

const PRODUCTION_SERVER_URL = "wss://experiment-game-multiplayer-production.up.railway.app";

function getServerUrl(): string {
  const envUrl = import.meta.env.VITE_SERVER_URL as string | undefined;
  if (envUrl) {
    return envUrl;
  }

  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") {
    return `ws://${host}:2567`;
  }

  return PRODUCTION_SERVER_URL;
}

function readRoomSessionId(room: Room<any, ArenaState>): string {
  const direct = room.sessionId;
  if (typeof direct === "string" && direct.length > 0) return direct.trim();
  const r = room as unknown as {
    sessionId?: string;
    connection?: { sessionId?: string; id?: string };
  };
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
  private playerCallbacksBound = false;

  getServerUrlForDisplay(): string {
    return getServerUrl();
  }

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
          .catch(() => {
            this.clearRoomIdFromUrl();
            return this.client.joinOrCreate<ArenaState>(ROOM_NAME, joinOptions, ArenaState);
          })
      : this.client.joinOrCreate<ArenaState>(ROOM_NAME, joinOptions, ArenaState);
    this.room = await withTimeout(joinPromise, 30000, "Joining arena");

    this.bindPlayerCallbacks(this.room);
    this.refreshLocalSessionId();
    await this.waitForPlayersMap(this.room, 15000);
    this.publishRoomIdToUrl(this.room.roomId);
    return this.room;
  }

  /** Colyseus may resolve `join()` before the first `ROOM_STATE` patch with `players`. */
  private waitForPlayersMap(room: Room<any, ArenaState>, timeoutMs: number): Promise<void> {
    const hasPlayers = (): boolean => {
      const players = room.state?.players;
      if (!players) return false;
      if (typeof players.size === "number") return players.size > 0;
      return [...players.values()].some(Boolean);
    };
    if (hasPlayers()) return Promise.resolve();

    return new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        room.onStateChange.remove(onState);
        reject(new Error("Timed out waiting for arena state"));
      }, timeoutMs);

      const onState = () => {
        if (!hasPlayers()) return;
        window.clearTimeout(timeout);
        room.onStateChange.remove(onState);
        resolve();
      };
      room.onStateChange(onState);
    });
  }

  /** Track our session id as soon as the server adds us to `state.players`. */
  private bindPlayerCallbacks(room: Room<any, ArenaState>): void {
    if (this.playerCallbacksBound) return;
    this.playerCallbacksBound = true;
    try {
      const callbacks = Callbacks.get(room);
      callbacks.onAdd("players", (_player, sessionId) => {
        const sid = typeof sessionId === "string" ? sessionId.trim() : "";
        if (!sid) return;
        const mine = readRoomSessionId(room);
        if (mine && sid === mine) {
          this.localSessionId = sid;
        }
      });
    } catch {
      // Callbacks optional — refreshLocalSessionId still runs after join.
    }
  }

  private clearRoomIdFromUrl(): void {
    if (typeof window === "undefined") return;
    try {
      const url = new URL(window.location.href);
      if (!url.searchParams.has("roomId")) return;
      url.searchParams.delete("roomId");
      window.history.replaceState({}, "", url.toString());
    } catch {
      // ignore
    }
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
    this.playerCallbacksBound = false;
  }
}
