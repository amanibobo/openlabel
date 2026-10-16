import { existsSync } from "node:fs";
import path from "node:path";
import { checkSession } from "../content";
import { Window } from "./Terminal";
import { TypedTerminal } from "./TypedTerminal";

const demoDir = path.join(process.cwd(), "public", "demo");

export function DemoWindow() {
  if (!existsSync(path.join(demoDir, "check.mp4"))) {
    return <TypedTerminal session={checkSession} />;
  }

  return (
    <Window title="openlabel check, built with OpenTUI">
      <video
        className="demo-video"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster="/demo/check-poster.png"
        aria-label="A terminal app reviewing the Lorvexa print ad: the ad renders inside the terminal while each claim gets a verdict and a label citation"
      >
        <source src="/demo/check.webm" type="video/webm" />
        <source src="/demo/check.mp4" type="video/mp4" />
      </video>
    </Window>
  );
}
