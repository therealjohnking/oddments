import type { Metadata } from 'next';
import Link from 'next/link';
import { toolPath, TOOLS } from '@/lib/site/tools';
import styles from './not-found.module.css';

export const metadata: Metadata = {
  title: 'Page not found',
  description: 'There is no page at this address.',
};

// The static export emits this as 404.html, which Cloudflare Pages (and most
// static hosts) serve — with a real 404 status — for any unknown path.
export default function NotFound() {
  return (
    <div className="container">
      <section className={styles.wrap}>
        <p className={styles.code} aria-hidden="true">
          404
        </p>
        <h1 className={styles.title}>Not on the bench</h1>
        <p className={styles.lede}>
          There&rsquo;s no page at this address — it may have been mistyped, moved, or never built.
          Nothing was lost: everything Oddments does happens in your browser, so there was nothing
          here to lose.
        </p>
        <p className={styles.homeLink}>
          <Link href="/">
            Back to all the instruments <span aria-hidden="true">→</span>
          </Link>
        </p>

        <h2 className={styles.listHeading}>Or jump straight to one</h2>
        <ul className={styles.toolList}>
          {TOOLS.map((tool) => (
            <li key={tool.slug}>
              <Link href={toolPath(tool)}>{tool.name}</Link>
              <span className={styles.hook}> — {tool.hook}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
