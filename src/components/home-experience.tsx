"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import { HomeVideoBackground, type HomeFeedStatus } from "@/components/home-video-background";

const feedLabels: Record<HomeFeedStatus, string> = {
  connecting: "CONNECTING // WEST STREET @ W34 ST",
  live: "FEED LIVE // WEST STREET @ W34 ST",
  reconnecting: "RECONNECTING // WEST STREET @ W34 ST",
  unavailable: "CAMERA UNAVAILABLE // WEST STREET @ W34 ST",
};

export function HomeExperience() {
  const [feedStatus, setFeedStatus] = useState<HomeFeedStatus>("connecting");
  const reportFeedStatus = useCallback((status: HomeFeedStatus) => setFeedStatus(status), []);

  return (
    <main className="home-shell">
      <HomeVideoBackground onStatusChange={reportFeedStatus} />
      <div className="home-video-wash" aria-hidden="true" />
      <div className="home-grid" aria-hidden="true"><i /><i /><i /></div>
      <p className="home-feed-status"><span className={feedStatus === "live" ? "" : "home-feed-status__dot--idle"} />{feedLabels[feedStatus]}</p>
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-title"><span aria-hidden="true"><i /><i /><i /></span><h1 id="home-title">XWALK KEYBOARDS</h1></div>
        <a className="scroll-cue" href="#studies">SCROLL <b aria-hidden="true">⌄</b></a>
      </section>
      <section className="home-studies" id="studies" aria-label="Choose a study">
        <nav className="study-selector">
          <Link href="/realtime">REALTIME</Link>
          <i aria-hidden="true" />
          <Link href="/orchestration">ORCHESTRATION</Link>
        </nav>
      </section>
      <footer className="home-footer">
        <span>SOURCE: NYC DOT // <Link href="/camera-registry">CAMERA REGISTRY</Link></span>
        <span className="footer-pattern">PATTERN: MONUMENTAL_ISO <i aria-hidden="true" /> <b>STUDY NO. 042-B</b></span>
      </footer>
    </main>
  );
}
