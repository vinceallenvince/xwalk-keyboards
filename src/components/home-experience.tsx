"use client";

import Link from "next/link";
import { Fragment, useCallback, useState } from "react";

import { HomeVideoBackground, type HomeFeedStatus } from "@/components/home-video-background";
import { useCameraLinks } from "@/lib/use-camera-links";

const feedLabels: Record<HomeFeedStatus, string> = {
  connecting: "CONNECTING // WEST STREET @ W23 ST",
  live: "FEED LIVE // WEST STREET @ W23 ST",
  reconnecting: "RECONNECTING // WEST STREET @ W23 ST",
  unavailable: "CAMERA UNAVAILABLE // WEST STREET @ W23 ST",
};

export function HomeExperience() {
  const [feedStatus, setFeedStatus] = useState<HomeFeedStatus>("connecting");
  const reportFeedStatus = useCallback((status: HomeFeedStatus) => setFeedStatus(status), []);
  const { cameras } = useCameraLinks();

  return (
    <main className="home-shell">
      <HomeVideoBackground cameraId={5059} onStatusChange={reportFeedStatus} />
      <div className="home-video-wash" aria-hidden="true" />
      <div className="home-grid" aria-hidden="true"><i /><i /><i /></div>
      <p className="home-feed-status"><span className={feedStatus === "live" ? "" : "home-feed-status__dot--idle"} />{feedLabels[feedStatus]}</p>
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
        <nav className="study-selector">
          {cameras.map((cam, i) => (
            <Fragment key={cam.cameraId}>
              {i > 0 && <i aria-hidden="true" />}
              <Link href={`/realtime/${cam.cameraId}`}>CAM {cam.cameraId}</Link>
            </Fragment>
          ))}
        </nav>
      </section>
      <footer className="home-footer">
        <span>
          <Link href="/about">ABOUT</Link>
          <span className="footer-sep footer-sep--double">{" // "}</span>
          <span className="footer-sep footer-sep--single"> / </span>
          <span className="footer-label footer-label--desktop">CAM SOURCE: </span>
          <span className="footer-label footer-label--mobile">CAMS: </span>
          <a href="https://511ny.org" target="_blank" rel="noopener noreferrer">511NY</a>
          <span className="footer-sep footer-sep--double">{" // "}</span>
          <span className="footer-sep footer-sep--single"> / </span>
          <span className="footer-label footer-label--desktop">POWERED BY: </span>
          <span className="footer-label footer-label--mobile">TOOLS: </span>
          <a href="https://roboflow.com" target="_blank" rel="noopener noreferrer">Roboflow</a>
          {" + "}
          <a href="https://cloud.google.com/run" target="_blank" rel="noopener noreferrer">
            <span className="footer-label footer-label--desktop">Google Cloud Run</span>
            <span className="footer-label footer-label--mobile">Cloud Run</span>
          </a>
        </span>
      </footer>
    </main>
  );
}
