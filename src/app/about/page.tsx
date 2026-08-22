"use client";

import { useCallback, useState } from "react";

import { HomeVideoBackground, type HomeFeedStatus } from "@/components/home-video-background";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";

const feedLabels: Record<HomeFeedStatus, string> = {
  connecting: "CONNECTING // WEST STREET @ CHAMBERS ST",
  live: "FEED LIVE // WEST STREET @ CHAMBERS ST",
  reconnecting: "RECONNECTING // WEST STREET @ CHAMBERS ST",
  unavailable: "CAMERA UNAVAILABLE // WEST STREET @ CHAMBERS ST",
};

export default function AboutPage() {
  const [feedStatus, setFeedStatus] = useState<HomeFeedStatus>("connecting");
  const reportFeedStatus = useCallback((status: HomeFeedStatus) => setFeedStatus(status), []);

  return (
    <main className="app-shell about-shell">
      <HomeVideoBackground cameraId={5072} onStatusChange={reportFeedStatus} />
      <div className="about-video-wash" aria-hidden="true" />
      <SiteHeader section="ABOUT" />
      <section className="about-page">
        <h1 className="visually-hidden">About</h1>
        <span className={`about-feed-status about-feed-status--${feedStatus}`}>
          <i className={`status-dot status-dot--${feedStatus}`} />
          {feedLabels[feedStatus]}
        </span>
        <div className="about-viewport">
          <p>
            XWalk Keyboards uses video feeds from NYC&apos;s network of traffic
            cameras to transform crosswalks into piano keyboards. As pedestrians
            step on the white stripes of the crosswalk, the app plays the
            corresponding notes.
          </p>
        </div>
      </section>
      <SiteFooter onAboutPage />
    </main>
  );
}
