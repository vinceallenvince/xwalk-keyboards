"use client";

import Link from "next/link";
import { Fragment, useCallback, useState } from "react";

import { HomeVideoBackground, homeFeedLabel, type HomeFeedStatus } from "@/components/home-video-background";
import { FooterCredits } from "@/components/site-chrome";
import { DEFAULT_LIVE_CAMERA } from "@/data/cameras";
import { useCameraLinks } from "@/lib/use-camera-links";

export function HomeExperience() {
  const [feedStatus, setFeedStatus] = useState<HomeFeedStatus>("connecting");
  const reportFeedStatus = useCallback((status: HomeFeedStatus) => setFeedStatus(status), []);
  const { cameras, loading } = useCameraLinks();

  return (
    <main className="home-shell">
      <HomeVideoBackground cameraId={DEFAULT_LIVE_CAMERA.cameraId} onStatusChange={reportFeedStatus} />
      <div className="home-video-wash" aria-hidden="true" />
      <div className="home-grid" aria-hidden="true"><i /><i /><i /></div>
      <p className="home-feed-status"><span className={feedStatus === "live" ? "" : "home-feed-status__dot--idle"} />{homeFeedLabel(feedStatus, DEFAULT_LIVE_CAMERA.statusLabel)}</p>
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-title"><span aria-hidden="true"><i /><i /><i /></span><h1 id="home-title">XWALK KEYBOARDS</h1></div>
        <div className="home-cue">
          <p className="home-speaker-note">FOR BEST EXPERIENCE, TURN ON YOUR SPEAKERS</p>
          <a className="scroll-cue" href="#studies">
            SCROLL
            <svg aria-hidden="true" viewBox="0 0 20 8" width="20" height="8" focusable="false">
              <path d="M1 1 10 7 19 1" fill="none" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </a>
        </div>
      </section>
      <section className="home-studies" id="studies" aria-label="Choose a camera">
        <nav className="study-selector" aria-busy={loading}>
          {cameras.map((cam, i) => (
            <Fragment key={cam.cameraId}>
              {i > 0 && <i aria-hidden="true" />}
              <Link className="study-selector__link" href={`/realtime/${cam.cameraId}`}>CAM {cam.cameraId}</Link>
            </Fragment>
          ))}
        </nav>
      </section>
      <footer className="home-footer">
        <FooterCredits />
      </footer>
    </main>
  );
}
