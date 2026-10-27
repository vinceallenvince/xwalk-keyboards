/** YouTube ID of the introduction video: https://www.youtube.com/watch?v=buOyciFqpY4 */
export const INTRO_VIDEO_ID = "buOyciFqpY4";

/**
 * The introduction video, embedded through YouTube's privacy-enhanced domain
 * so no YouTube cookies are set until the visitor plays it. The Figma frames
 * draw a mock player; the real player supplies its own title and controls.
 */
export function IntroVideo() {
  return (
    <div className="intro-video">
      <iframe
        allow="encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        src={`https://www.youtube-nocookie.com/embed/${INTRO_VIDEO_ID}?rel=0&playsinline=1`}
        title="XWALK KEYBOARDS — a crosswalk study"
      />
    </div>
  );
}
