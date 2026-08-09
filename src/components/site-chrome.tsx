import Link from "next/link";
import type { ReactNode } from "react";

export function SiteHeader({ section }: { section?: string }) {
  // The wordmark always links home. Its trailing "| SECTION" label is styled
  // as an underlined link-like affordance everywhere except on that section's
  // own page, where underlining it would read as a link back to itself.
  const onOwnPage = section === "CAMERA REGISTRY";
  return (
    <header className="site-header">
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
      <span className="header-status">LOC: REGION_01_NYC_DOT</span>
    </header>
  );
}

export function SiteFooter({ onRegistryPage }: { onRegistryPage?: boolean }) {
  return (
    <footer className="site-footer">
      <span>
        SOURCE: 511NY // {onRegistryPage ? "CAMERA REGISTRY" : <Link href="/camera-registry">CAMERA REGISTRY</Link>}
      </span>
      <span className="footer-pattern">PATTERN: MONUMENTAL_ISO <i aria-hidden="true" /> <b>STUDY NO. 042-B</b></span>
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
      <SiteFooter onRegistryPage={section === "CAMERA REGISTRY"} />
    </main>
  );
}
