declare global {
  interface Window {
    CrazyGames?: {
      SDK?: {
        init?: () => Promise<void>;
        game?: {
          gameplayStart?: () => void;
          gameplayStop?: () => void;
          sdkGameLoadingStart?: () => void;
          sdkGameLoadingStop?: () => void;
          inviteLink?: (params: Record<string, string>) => Promise<string>;
          getInviteParam?: (key: string) => string | null;
          inviteParams?: Record<string, string>;
          addJoinRoomListener?: (listener: (params: Record<string, string>) => void) => void;
          isInstantMultiplayer?: boolean;
        };
      };
    };
  }
}

export class CrazyGamesService {
  async initialize(): Promise<void> {
    await window.CrazyGames?.SDK?.init?.();
  }

  loadingStart(): void {
    window.CrazyGames?.SDK?.game?.sdkGameLoadingStart?.();
  }

  loadingStop(): void {
    window.CrazyGames?.SDK?.game?.sdkGameLoadingStop?.();
  }

  gameplayStart(): void {
    window.CrazyGames?.SDK?.game?.gameplayStart?.();
  }

  gameplayStop(): void {
    window.CrazyGames?.SDK?.game?.gameplayStop?.();
  }

  getInviteRoomId(): string | null {
    return (
      window.CrazyGames?.SDK?.game?.getInviteParam?.("roomId") ??
      window.CrazyGames?.SDK?.game?.inviteParams?.roomId ??
      new URLSearchParams(window.location.search).get("roomId")
    );
  }

  onJoinRoom(listener: (roomId: string) => void): void {
    window.CrazyGames?.SDK?.game?.addJoinRoomListener?.((params) => {
      if (params.roomId) {
        listener(params.roomId);
      }
    });
  }

  isInstantMultiplayer(): boolean {
    return Boolean(window.CrazyGames?.SDK?.game?.isInstantMultiplayer);
  }

  async buildInviteLink(roomId: string): Promise<string | null> {
    const build = window.CrazyGames?.SDK?.game?.inviteLink;
    return build ? build({ roomId }) : null;
  }
}
