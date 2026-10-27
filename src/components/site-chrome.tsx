import Link from "next/link";
import type { ReactNode } from "react";

export function SiteHeader({ section }: { section?: string }) {
  // The wordmark always links home. Its trailing "| SECTION" label is plain
  // text: every section with a header (About, Camera Registry) shows it only
  // on its own page, where underlining it would read as a link back to itself.
  return (
    <header className="site-header">
      <Link className="wordmark" href="/" aria-label="XWALK KEYBOARDS home">
        <span aria-hidden="true" className="wordmark-mark"><i /><i /><i /></span>
        <span>XWALK KEYBOARDS</span>
        {section && (
          <>
            <b aria-hidden="true"> | </b>
            <span>{section}</span>
          </>
        )}
      </Link>
    </header>
  );
}

/**
 * "ABOUT // POWERED BY: Roboflow + Google Cloud Run" — identical at every
 * width. It deliberately credits no camera provider: live cameras come from
 * more than one, and the status line already names the intersection.
 */
export function FooterCredits({ onAboutPage }: { onAboutPage?: boolean }) {
  return (
    <span>
      {onAboutPage ? "ABOUT" : <Link href="/about">ABOUT</Link>}
      {" // POWERED BY: "}
      <a href="https://roboflow.com" target="_blank" rel="noopener noreferrer">Roboflow</a>
      {" + "}
      <a href="https://cloud.google.com/run" target="_blank" rel="noopener noreferrer">Google Cloud Run</a>
    </span>
  );
}

export function SiteFooter({ onAboutPage }: { onAboutPage?: boolean }) {
  return (
    <footer className="site-footer">
      <FooterCredits onAboutPage={onAboutPage} />
    </footer>
  );
}

export function StudyShell({
  children,
  className,
  section,
}: {
  children: ReactNode;
  className?: string;
  section: string;
}) {
  return (
    <main className={`app-shell${className ? ` ${className}` : ""}`}>
      <SiteHeader section={section} />
      {children}
      <SiteFooter onAboutPage={section === "ABOUT"} />
    </main>
  );
}
