"use client";

import { useCallback, useState } from "react";

import { HomeVideoBackground, homeFeedLabel, type HomeFeedStatus } from "@/components/home-video-background";
import { IntroVideo } from "@/components/intro-video";
import { FooterCredits } from "@/components/site-chrome";
import { DEFAULT_LIVE_CAMERA } from "@/data/cameras";

export function HomeExperience() {
  const [feedStatus, setFeedStatus] = useState<HomeFeedStatus>("connecting");
  const reportFeedStatus = useCallback((status: HomeFeedStatus) => setFeedStatus(status), []);

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
      <section className="home-watch" id="studies" aria-labelledby="home-watch-title">
        <div className="home-watch__band">
          <div className="home-watch__intro">
            <p className="home-watch__label">XWALK KEYBOARDS // WATCH</p>
            <h2 className="home-watch__title" id="home-watch-title">CROSSWALKS.<br />KEYBOARDS.</h2>
            <i className="home-watch__rule" aria-hidden="true" />
            <p className="home-watch__description">
              XWalkKeyboards was created at an{" "}
              <a href="https://nyc.aitinkerers.org/hackathons/h_zvqhzy3dMEY" target="_blank" rel="noreferrer">AI Tinkerers hackathon</a>
              {" "}and used NYC DOT traffic cam video and{" "}
              <a href="https://roboflow.com/" target="_blank" rel="noreferrer">Roboflow</a>
              {" "}computer vision to transform crosswalks into piano keyboards.
            </p>
          </div>
          <IntroVideo />
        </div>
      </section>
      <footer className="home-footer">
        <FooterCredits />
      </footer>
    </main>
  );
}
