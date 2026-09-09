import { useState, useEffect, type ReactNode } from 'react';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import { MarketingLayout, Eyebrow, StartButton , GradientBanner } from './MarketingLayout';
import { listPublishedBlogPosts } from '../../lib/db';
import { useTranslation } from 'react-i18next';

function setMetaDescription(content: string) {
  let m = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
  if (!m) { m = document.createElement('meta'); m.setAttribute('name', 'description'); document.head.appendChild(m); }
  m.setAttribute('content', content);
}
function setCanonical(href: string) {
  let l = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!l) { l = document.createElement('link'); l.setAttribute('rel', 'canonical'); document.head.appendChild(l); }
  l.setAttribute('href', href);
}
function setArticleJsonLd(obj: Record<string, unknown>) {
  document.getElementById('blog-jsonld')?.remove();
  const s = document.createElement('script');
  s.type = 'application/ld+json'; s.id = 'blog-jsonld';
  s.textContent = JSON.stringify(obj);
  document.head.appendChild(s);
}

/* ---- tiny formatting helpers so post bodies stay readable ---- */
const Lead = ({ children }: { children: ReactNode }) => (
  <p className="text-xl text-gray-600 font-serif-display leading-snug mb-8">{children}</p>
);
const H2 = ({ children }: { children: ReactNode }) => (
  <h2 className="text-2xl font-serif-display font-semibold text-[#37352F] mt-10 mb-4">{children}</h2>
);
const P = ({ children }: { children: ReactNode }) => (
  <p className="mb-5 leading-relaxed">{children}</p>
);
const UL = ({ items }: { items: ReactNode[] }) => (
  <ul className="mb-5 space-y-2 list-disc pl-5 marker:text-gray-300">
    {items.map((it, i) => <li key={i} className="leading-relaxed pl-1">{it}</li>)}
  </ul>
);

interface Post {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  readMins: number;
  tag: string;
  body: ReactNode;
}

const POSTS: Post[] = [
  {
    slug: 'end-of-paper-punch-card',
    title: 'The end of the paper punch card',
    excerpt: 'Why frictionless, wallet-native loyalty is the future for independent merchants — and the end of the crumpled card in your wallet.',
    date: 'July 2026',
    readMins: 5,
    tag: 'Manifesto',
    body: (
      <>
        <Lead>Customer loyalty is broken. It has become a choice between two bad options: paper cards that get lost in the wash, or clunky apps customers refuse to download.</Lead>
        <P>Look inside your wallet right now. Odds are there&rsquo;s a half-stamped paper card from a shop you visited three months ago. Maybe five of them. Now look at your phone — how many times has a cashier asked you to &ldquo;download our app&rdquo; just to earn a point, while your order went cold?</P>
        <P>Independent merchants desperately need a way to build loyalty and keep customers. But forcing a customer to jump through hoops is the fastest way to lose them. So we asked: what if loyalty required zero friction? Join, get a stamp, and save your progress in under five seconds — without ever opening the App Store.</P>
        <H2>You finally get customer data</H2>
        <P>When you hand out a paper card, the customer walks out a ghost. You don&rsquo;t know their name, how often they visit, or what they buy. Stampfix captures that from the first stamp, so you can see your best regulars and run promotions that land.</P>
        <H2>Zero friction means higher sign-ups</H2>
        <P>Ask 100 people to download an app and maybe 5 will. Ask them to scan a QR code and almost all of them will. Because Stampfix is a web tool, onboarding is instant — and more participation means a program that actually works.</P>
        <H2>The secret weapon: Apple &amp; Google Wallet</H2>
        <P>Once a customer scans your code, they get one button: Add to Apple Wallet or Google Wallet. This is where a cool web tool becomes a retention strategy:</P>
        <UL items={[
          <><strong>No downloads.</strong> Wallet is already on their phone for their bank cards and boarding passes.</>,
          <><strong>Always front and center.</strong> Your card sits next to their Apple Pay — impossible to lose.</>,
          <><strong>Location reminders.</strong> A gentle nudge on the lock screen when they&rsquo;re near your shop.</>,
          <><strong>Dynamic updates.</strong> A new stamp updates the card in real time.</>,
        ]} />
        <H2>It&rsquo;s time to ditch the paper</H2>
        <P>Loyalty is about making customers feel valued, not giving them homework. Skip the App Store, retire the punch card, and step into the future of retention.</P>
      </>
    ),
  },
  {
    slug: 'hidden-cost-of-paper-punch-cards',
    title: 'The hidden cost of paper punch cards',
    excerpt: 'Printing, lost cards, and fraud quietly add up. Here\u2019s the math most merchants never run.',
    date: 'July 2026',
    readMins: 4,
    tag: 'Retention',
    body: (
      <>
        <Lead>Paper punch cards feel free. They aren&rsquo;t — they just hide the bill across three line items you never total up.</Lead>
        <H2>1. Printing you reorder forever</H2>
        <P>Cards get handed out, tossed, and lost, so you reprint — hundreds at a time, again and again. It&rsquo;s a small recurring cost that never ends because the medium itself is disposable.</P>
        <H2>2. The &ldquo;ghost&rdquo; customer</H2>
        <P>Every paper card walks out the door anonymous. You can&rsquo;t see who&rsquo;s close to a reward, who&rsquo;s slipping away, or who your best regulars are — so you can&rsquo;t act. The lost revenue from customers you could have won back is invisible, which is exactly why it hurts.</P>
        <H2>3. Fraud you can&rsquo;t see</H2>
        <P>Custom hole-punchers are for sale online. A paper grid can&rsquo;t tell a real visit from a faked one, so some of the rewards you give away were never earned.</P>
        <H2>The digital alternative</H2>
        <P>A wallet-native card removes all three: nothing to reprint, every visit attached to a name in your dashboard, and stamps that are signed and server-verified so they can&rsquo;t be faked. The same loyalty loop — without the leaks.</P>
      </>
    ),
  },
  {
    slug: 'why-nobody-downloads-your-app',
    title: 'Why nobody wants to download your small-business app',
    excerpt: 'App fatigue is real. For a local shop, a web tool plus Apple Wallet beats a native app on every metric that matters.',
    date: 'July 2026',
    readMins: 4,
    tag: 'Frictionless',
    body: (
      <>
        <Lead>The install is the tax. Every screen between &ldquo;I&rsquo;d like a loyalty card&rdquo; and &ldquo;I have one&rdquo; is where customers quietly give up.</Lead>
        <P>People guard their home screens. Asking someone to visit the App Store, wait for a download, create an account, and grant permissions — just to earn a point on a sandwich — is a lot to ask at a register with a line behind them.</P>
        <H2>The math of friction</H2>
        <P>Roughly 5 in 100 people will download an app at the counter. Around 95 in 100 will scan a QR code with the camera already in their hand. Same customers, wildly different outcome — and it comes down entirely to how many steps stand in the way.</P>
        <H2>Web tool + Wallet wins</H2>
        <UL items={[
          'Nothing to install — a scan opens a branded page instantly.',
          'The card saves into Apple Wallet or Google Wallet, which customers already use.',
          'It updates in real time and can nudge them when they\u2019re nearby.',
          'No storefront listing, no reviews to manage, no update cycle for you.',
        ]} />
        <P>You don&rsquo;t need an app. You need to be on their phone with zero friction — and that&rsquo;s exactly what the wallet already gives you.</P>
      </>
    ),
  },
  {
    slug: 'apple-wallet-vs-native-apps',
    title: 'Apple Wallet vs. native apps: what local businesses need to know',
    excerpt: 'A plain-English look at why wallet passes beat a custom app for independent shops.',
    date: 'July 2026',
    readMins: 3,
    tag: 'Explainer',
    body: (
      <>
        <Lead>You don&rsquo;t have to choose between &ldquo;expensive app&rdquo; and &ldquo;paper.&rdquo; There&rsquo;s a third option most small businesses miss.</Lead>
        <H2>What a wallet pass actually is</H2>
        <P>Apple Wallet and Google Wallet already hold your customers&rsquo; boarding passes and bank cards. A loyalty pass is the same kind of object: a card that lives in an app they already trust and open. Adding one takes a single tap — no download, no account setup.</P>
        <H2>Why it beats a native app for a local shop</H2>
        <UL items={[
          <><strong>Adoption.</strong> A tap versus an install is the whole ballgame.</>,
          <><strong>Cost.</strong> No six-figure development, no two app stores to maintain.</>,
          <><strong>Presence.</strong> The card sits beside Apple Pay — seen constantly, never lost.</>,
          <><strong>Reminders.</strong> Location nudges bring people back without you lifting a finger.</>,
        ]} />
        <H2>Where a native app still makes sense</H2>
        <P>If you&rsquo;re a national chain building mobile ordering, delivery, and a rewards marketplace, an app earns its keep. For a café, salon, or food truck who just wants regulars to come back, a wallet pass gives you the part that matters — at a fraction of the cost.</P>
      </>
    ),
  },
];

function PostCard({ post }: { post: Post }) {
  const { t } = useTranslation();
  return (
    <a href={`/blog/${post.slug}`} className="group block border notion-border rounded-2xl p-7 hover:shadow-md transition">
      <div className="flex items-center gap-3 text-xs text-gray-400 mb-3">
        <span className="font-medium text-[#37352F] bg-[#F7F7F5] border notion-border rounded-full px-2.5 py-0.5">{post.tag}</span>
        <span>{post.date}</span>
        <span>&middot;</span>
        <span>{post.readMins} {t('blog.minRead', { defaultValue: 'min read' })}</span>
      </div>
      <h2 className="text-xl font-serif-display font-semibold mb-2 group-hover:text-[#37352F]">{post.title}</h2>
      <p className="text-sm text-gray-600 leading-relaxed mb-4">{post.excerpt}</p>
      <span className="inline-flex items-center gap-1 text-sm font-medium text-[#37352F]">{t('blog.read', { defaultValue: 'Read' })} <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition" /></span>
    </a>
  );
}

export function BlogPage() {
  const { t } = useTranslation();
  const path = window.location.pathname;
  const slug = path.startsWith('/blog/') ? path.slice('/blog/'.length).replace(/\/$/, '') : '';
  const [dbPosts, setDbPosts] = useState<Post[] | null>(null);
  useEffect(() => {
    listPublishedBlogPosts()
      .then((rows) => setDbPosts(rows.map((r) => ({
        slug: r.slug, title: r.title, excerpt: r.excerpt, tag: r.tag,
        date: new Date(r.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        readMins: r.read_mins,
        body: <div className="blog-html" dangerouslySetInnerHTML={{ __html: r.content }} />,
      }))))
      .catch(() => setDbPosts([]));
  }, []);
  const allPosts = [...(dbPosts ?? []), ...POSTS.map((p) => ({ ...p, title: t(`blog.p.${p.slug}.title`, { defaultValue: p.title }), excerpt: t(`blog.p.${p.slug}.excerpt`, { defaultValue: p.excerpt }), tag: t(`blog.p.${p.slug}.tag`, { defaultValue: p.tag }) }))];
  const post = slug ? allPosts.find((p) => p.slug === slug) : undefined;
  useEffect(() => {
    if (!post) return;
    const prev = document.title;
    const canonical = `https://stampfix.app/blog/${post.slug}`;
    document.title = `${post.title} \u2014 Stampfix`;
    setMetaDescription(post.excerpt);
    setCanonical(canonical);
    setArticleJsonLd({ '@context': 'https://schema.org', '@type': 'BlogPosting', headline: post.title, description: post.excerpt, datePublished: post.date, dateModified: post.date, url: canonical, mainEntityOfPage: { '@type': 'WebPage', '@id': canonical }, author: { '@type': 'Organization', name: 'Stampfix', url: 'https://stampfix.app' }, publisher: { '@type': 'Organization', name: 'Stampfix', url: 'https://stampfix.app' } });
    return () => { document.title = prev; document.getElementById('blog-jsonld')?.remove(); };
  }, [post]);
  if (slug && !post && dbPosts === null) {
    return <MarketingLayout active="/blog"><div className="py-32 text-center text-gray-400">{t('blog.loading', { defaultValue: 'Loading…' })}</div></MarketingLayout>;
  }

  // Individual post
  if (post) {
    return (
      <MarketingLayout active="/blog">
        <article className="max-w-2xl mx-auto px-6 pt-16 pb-8">
          <a href="/blog" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[#37352F] mb-8 transition">
            <ArrowLeft className="w-4 h-4" /> {t('blog.allPosts', { defaultValue: 'All posts' })}
          </a>
          <div className="flex items-center gap-3 text-xs text-gray-400 mb-4">
            <span className="font-medium text-[#37352F] bg-[#F7F7F5] border notion-border rounded-full px-2.5 py-0.5">{post.tag}</span>
            <span>{post.date}</span><span>&middot;</span><span>{post.readMins} {t('blog.minRead', { defaultValue: 'min read' })}</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-serif-display font-medium leading-[1.1] tracking-tight mb-8">{post.title}</h1>
          <div className="text-[16px] text-gray-700">{post.body}</div>
        </article>
        <GradientBanner title={t('blog.bannerTitle', { defaultValue: 'Ready to retire the paper card?' })} buttonLabel={t('blog.bannerCta', { defaultValue: 'Start your free trial' })} />
      </MarketingLayout>
    );
  }

  // Index
  return (
    <MarketingLayout active="/blog">
      <section className="max-w-3xl mx-auto px-6 pt-20 pb-10 text-center">
        <Eyebrow>{t('blog.eyebrow', { defaultValue: 'The Merchant Academy' })}</Eyebrow>
        <h1 className="text-4xl md:text-6xl font-serif-display font-medium mt-6 mb-5 leading-[1.1] tracking-tight">
          {t('blog.h1', { defaultValue: 'Notes on loyalty, retention, and running a modern local shop.' })}
        </h1>
        <p className="text-lg text-gray-500">{t('blog.sub', { defaultValue: 'Short, practical reads for independent merchants.' })}</p>
      </section>
      <section className="max-w-4xl mx-auto px-6 py-8">
        <div className="grid md:grid-cols-2 gap-5">
          {allPosts.map((p) => <PostCard key={p.slug} post={p} />)}
        </div>
      </section>
    </MarketingLayout>
  );
}
