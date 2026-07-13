"use client";

import { useEffect, useState } from "react";
import { sim, hudBridge, SPIN_STAR, R_ISCO, BH_MASS_SOLAR, type Quality } from "@/lib/sim";

const QUALITIES: Quality[] = ["low", "med", "high"];

export default function Hud({
  quality,
  setQuality,
}: {
  quality: Quality;
  setQuality: (q: Quality) => void;
}) {
  const [stats, setStats] = useState({
    fps: 0,
    radius: 26,
    incl: 8,
    timeDilation: 1,
    localG: 0,
    tidalGPerM: 0,
    paused: sim.paused,
  });

  useEffect(() => {
    hudBridge.push = () =>
      setStats({
        fps: hudBridge.fps,
        radius: hudBridge.radius,
        incl: hudBridge.incl,
        timeDilation: hudBridge.timeDilation,
        localG: hudBridge.localG,
        tidalGPerM: hudBridge.tidalGPerM,
        paused: sim.paused,
      });
    return () => {
      hudBridge.push = undefined;
    };
  }, []);

  return (
    <>
      <div className="hud title">
        <h1>GARGANTUA</h1>
        <div className="sub">
          Kerr geodesics &middot; Novikov&ndash;Thorne disk &middot;{" "}
          <b>r&#8347; = 1</b> units
        </div>
      </div>

      <div className="hud note">
        Spin drags spacetime around with it, so the disk reaches the prograde
        ISCO at {R_ISCO.toFixed(2)}&nbsp;r&#8347; and hugs the shadow;
        blackbody color follows the observed shift, and{" "}
        <em>&delta;&#8308; beaming</em> makes the approaching limb dominate.
        The halo over the poles is the <em>far side of the disk</em>,
        gravitationally lensed. Time flow, gravity, and tidal pull below are
        computed live from your exact position, at Gargantua&rsquo;s scale
        (&sim;{(BH_MASS_SOLAR / 1e6).toFixed(0)} million M&#9737;).
      </div>

      <div className="hud readout">
        <div className="cell">
          <div className="k">Radius</div>
          <div className="v">
            {stats.radius.toFixed(1)} <small>r&#8347;</small>
          </div>
        </div>
        <div className="cell">
          <div className="k">Inclination</div>
          <div className="v">
            {stats.incl.toFixed(1)}
            <small>&deg;</small>
          </div>
        </div>
        <div className="cell">
          <div className="k">Spin a&#9733;</div>
          <div className="v">{SPIN_STAR.toFixed(2)}</div>
        </div>
        <div className="cell">
          <div className="k">Time flow</div>
          <div className="v">
            {stats.timeDilation.toFixed(3)}&times; <small>d&tau;/dt</small>
          </div>
        </div>
        <div className="cell">
          <div className="k">Local gravity</div>
          <div className="v">
            {Number.isFinite(stats.localG)
              ? Math.round(stats.localG).toLocaleString()
              : "—"}{" "}
            <small>g</small>
          </div>
        </div>
        <div className="cell">
          <div className="k">Tidal pull</div>
          <div className="v">
            {stats.tidalGPerM.toExponential(1)} <small>g/m</small>
          </div>
        </div>
        <div className="cell">
          <div className="k">Disk state</div>
          <div className="v">{stats.paused ? "frozen" : "rotating"}</div>
        </div>
        <div className="cell">
          <div className="k">Frame</div>
          <div className="v">
            {stats.fps || "—"} <small>fps</small>
          </div>
        </div>
      </div>

      <div className="hud controls">
        <div className="btnrow" role="group" aria-label="Render quality">
          {QUALITIES.map((q) => (
            <button
              key={q}
              className={q === quality ? "on" : ""}
              onClick={(e) => {
                setQuality(q);
                e.currentTarget.blur();
              }}
            >
              {q.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="hint">
          <span>drag</span> orbit &nbsp;&middot;&nbsp; <span>scroll</span> zoom
          &nbsp;&middot;&nbsp; <span>space</span> pause
        </div>
      </div>
    </>
  );
}
