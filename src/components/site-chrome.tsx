import Link from "next/link";
import type { ReactNode } from "react";

export function SiteHeader({ accessory, section }: { accessory?: ReactNode; section?: string }) {
  // The wordmark always links home. Its trailing "| SECTION" label is styled
  // as an underlined link-like affordance everywhere except on that section's
  // own page, where underlining it would read as a link back to itself.
  const onOwnPage = section === "CAMERA REGISTRY" || section === "ABOUT";
  return (
    <header className="site-header">
      {/* `accessory` is a sibling of the link, never a child: a control nested
          inside an anchor is not valid and would steal the wordmark's click. */}
      <span className="site-header__lead">
        <Link className="wordmark" href="/" aria-label="XWALK KEYBOARDS home">
          <span aria-hidden="true" className="wordmark-mark"><i /><i /><i /></span>
          <span>XWALK KEYBOARDS</span>
          {section && (
            <>
              <b aria-hidden="true"> | </b>
              {onOwnPage ? <span>{section}</span> : <u>{section}</u>}
            </>
          )}
        </Link>
        {accessory}
      </span>
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
  accessory,
  children,
  className,
  section,
}: {
  accessory?: ReactNode;
  children: ReactNode;
  className?: string;
  section: string;
}) {
  return (
    <main className={`app-shell${className ? ` ${className}` : ""}`}>
      <SiteHeader accessory={accessory} section={section} />
      {children}
      <SiteFooter onAboutPage={section === "ABOUT"} />
    </main>
  );
}
