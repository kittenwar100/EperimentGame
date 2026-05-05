import * as Phaser from "phaser";
import { CrazyGamesService } from "./sdk/CrazyGamesService";
import { NetClient } from "./network/NetClient";
import { GameScene } from "./game/GameScene";
import { SfxController } from "./audio/SfxController";
import { mountHomePage } from "./launcher/mountHomePage";
import "./styles.css";

const sdk = new CrazyGamesService();
const netClient = new NetClient();
const sfx = new SfxController();
const scene = new GameScene(netClient, sdk, sfx);

async function bootstrap(): Promise<void> {
  sdk.loadingStart();
  await sdk.initialize().catch(() => undefined);

  const launcherRoot = document.getElementById("launcher");
  if (!launcherRoot) {
    throw new Error("Missing #launcher");
  }
  const launch = await mountHomePage(launcherRoot);
  launcherRoot.style.display = "none";

  scene.pendingJoin = { name: launch.name, mode: launch.mode };

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "app",
    transparent: false,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: "#071018",
    autoFocus: true,
    fps: {
      target: 60,
      smoothStep: false,
    },
    render: {
      antialias: false,
      powerPreference: "high-performance",
    },
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [scene],
  });

  sdk.onJoinRoom(async () => {
    if (!netClient.room && sdk.isInstantMultiplayer()) {
      await scene.startMatch({ name: launch.name, mode: launch.mode });
    }
  });

  window.addEventListener("beforeunload", () => {
    sdk.gameplayStop();
    netClient.leave();
    game.destroy(true);
  });
}

void bootstrap();
