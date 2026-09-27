"use client";

import { useCallback, useState } from "react";

import { HomeVideoBackground, homeFeedLabel, type HomeFeedStatus } from "@/components/home-video-background";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { DEFAULT_LIVE_CAMERA } from "@/data/cameras";

export default function AboutPage() {
  const [feedStatus, setFeedStatus] = useState<HomeFeedStatus>("connecting");
  const reportFeedStatus = useCallback((status: HomeFeedStatus) => setFeedStatus(status), []);

  return (
    <main className="app-shell about-shell">
      <HomeVideoBackground cameraId={DEFAULT_LIVE_CAMERA.cameraId} onStatusChange={reportFeedStatus} />
      <div className="about-video-wash" aria-hidden="true" />
      <SiteHeader section="ABOUT" />
      <section className="about-page">
        <h1 className="visually-hidden">About</h1>
        <span className={`about-feed-status about-feed-status--${feedStatus}`}>
          <i className={`status-dot status-dot--${feedStatus}`} />
          {homeFeedLabel(feedStatus, DEFAULT_LIVE_CAMERA.statusLabel)}
        </span>
        <div className="about-viewport">
          <p>
            XWalk Keyboards uses traffic camera video feeds to transform
            crosswalks into piano keyboards. As pedestrians
            step on the white stripes of the crosswalk, the app plays the
            corresponding notes.
          </p>
          <h2>HOW IT STARTED</h2>
          <p>
            This project won first place at AI Tinkerers&apos; <a href="https://nyc.aitinkerers.org/hackathons/h_zvqhzy3dMEY" target="_blank" rel="noreferrer" aria-label="Open link to NYC Vision Hack v.2">NYC Vision Hack v.2</a> in Aug 2026.
            The challenge: leverage AI, computer vision via <a href="https://roboflow.com/" target="_blank" rel="noreferrer" aria-label="Open link to Roboflow">Roboflow</a>,
            and deploy via <a href="https://cloud.google.com/run" target="_blank" rel="noreferrer" aria-label="Open link to Google Cloud Run">Google Cloud Run</a> to transform raw NYC data into intelligent vision agents.
          </p>
          <h2>HOW IT WORKS</h2>
          <p>
            The web app uses Roboflow to detect pedestrians in a traffic cam
            video in real time. An AI agent running on Cloud Run orchestrates a
            calibration cycle and uses Roboflow to detect crosswalk stripes on
            regular intervals. When the web app detects a pedestrian inside
            a crosswalk stripe boundary, it plays the note corresponding to the stripe&apos;s
            position on a piano keyboard.
          </p>
          <h2>MORE DETAILS</h2>
          <p>
            Get more details on how the app works
            at <a href="https://vinceallen.com" target="_blank" rel="noreferrer" aria-label="Open link to vinceallen.com">vinceallen.com</a>!
          </p>
        </div>
      </section>
      <SiteFooter onAboutPage />
    </main>
  );
}
