import express from "express";
import cors from "cors";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { ArenaRoom, roomName } from "./rooms/ArenaRoom";

const port = Number(process.env.PORT ?? 2567);
const gameServer = new Server({
  transport: new WebSocketTransport(),
  express: (app: express.Application) => {
    app.use(
      cors({
        origin: true,
        credentials: true,
      }),
    );

    app.get("/health", (_req, res) => {
      res.json({ ok: true, service: "core-surge-server", build: "solo-ffa-v6" });
    });
  },
});

gameServer.define(roomName, ArenaRoom).filterBy(["mode"]);

void gameServer.listen(port).then(() => {
  console.log(`Core Surge server listening on http://localhost:${port}`);
});
