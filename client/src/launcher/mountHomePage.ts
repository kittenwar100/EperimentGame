import type { GameModeId } from "@shared";

export type HomeLaunchPayload = { name: string; mode: GameModeId };

/** Minimal launcher aligned with in-game HUD (dark arena, cyan accents). */
export function mountHomePage(root: HTMLElement): Promise<HomeLaunchPayload> {
  root.innerHTML = `
  <div class="hub">
    <div class="hub__panel">
      <h1 class="hub__title">Flag Surge</h1>
      <label class="hub__label">Name</label>
      <input id="hub-name" class="hub__input" maxlength="18" placeholder="unnamed" autocomplete="off" />
      <div class="hub__modes">
        <button type="button" class="hub__mode hub__mode--active" data-mode="ffa">Solo FFA</button>
        <button type="button" class="hub__mode" data-mode="team_ctf">Team CTF</button>
        <button type="button" class="hub__mode" data-mode="race">Race</button>
      </div>
      <div class="hub__controls" aria-label="Controls">
        <p class="hub__controls-line">SPACE TO BOOST</p>
        <p class="hub__controls-line">LEFT CLICK TO SHOOT</p>
        <p class="hub__controls-hint">Hold SPACE — 4 boosts per life</p>
      </div>
      <button type="button" id="hub-play" class="hub__play">Play</button>
    </div>
  </div>`;

  return new Promise((resolve) => {
    let mode: GameModeId = "ffa";
    const nameInput = root.querySelector<HTMLInputElement>("#hub-name");
    const play = root.querySelector<HTMLButtonElement>("#hub-play");
    root.querySelectorAll<HTMLButtonElement>(".hub__mode[data-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        root.querySelectorAll(".hub__mode[data-mode]").forEach((b) => b.classList.remove("hub__mode--active"));
        btn.classList.add("hub__mode--active");
        mode = (btn.dataset.mode as GameModeId) ?? "ffa";
      });
    });
    const submit = () => {
      if (play?.disabled) return;
      if (play) {
        play.disabled = true;
        play.textContent = "Starting…";
      }
      nameInput?.blur();
      const name = (nameInput?.value || "unnamed").trim().slice(0, 18) || "unnamed";
      resolve({ name, mode });
    };
    play?.addEventListener("click", submit);
    nameInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submit();
    });
    queueMicrotask(() => nameInput?.focus());
  });
}
