export interface PlayOptions {
  name: string;
}

export interface HudController {
  bindPlay(handler: (options: PlayOptions) => void | Promise<void>): void;
  setStatus(message: string): void;
  setPlaying(playing: boolean): void;
  updateBars(hpText: string, scoreText: string, topText: string): void;
}

export function createHud(): HudController {
  const nameInput = document.querySelector<HTMLInputElement>("#nameInput")!;
  const playButton = document.querySelector<HTMLButtonElement>("#playButton")!;
  const statusText = document.querySelector<HTMLParagraphElement>("#statusText")!;
  const menu = document.querySelector<HTMLElement>("#menu")!;
  const hud = document.querySelector<HTMLElement>("#hud")!;
  const healthText = document.querySelector<HTMLElement>("#healthText")!;
  const scoreText = document.querySelector<HTMLElement>("#scoreText")!;
  const leaderboardText = document.querySelector<HTMLElement>("#leaderboardText")!;

  return {
    bindPlay(handler) {
      playButton.addEventListener("click", () => {
        void handler({
          name: nameInput.value.trim() || "Pilot",
        });
      });
    },
    setStatus(message) {
      statusText.textContent = message;
      statusText.classList.toggle("hidden", !message);
    },
    setPlaying(playing) {
      menu.classList.toggle("hidden", playing);
      hud.classList.toggle("hidden", !playing);
    },
    updateBars(hp, score, top) {
      healthText.textContent = hp;
      scoreText.textContent = score;
      leaderboardText.textContent = top;
    },
  };
}
