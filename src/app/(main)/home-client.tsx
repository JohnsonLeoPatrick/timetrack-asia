'use client';

import { useEffect, useRef, type CSSProperties, type MouseEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowDown, ArrowRight, ArrowUpRight, Asterisk, CalendarDays, Check, Flag, MapPin, Radio, Trophy } from 'lucide-react';
import { useLanguage } from '@/providers/language-provider';
import type { Event } from '@/lib/types';
import styles from './home.module.css';

const homepageCopy = {
  EN: {
    eyebrow: 'MALAYSIA. MEET YOUR NEXT CHALLENGE.',
    description: 'From your first start line to your next personal best. Find your race. Make your mark. We’ll keep the time.',
    findRace: 'Find your next race', results: 'Explore race results',
    photoAlt: 'Athletes sprinting on a running track', photoLabel: 'THE MOMENT IS YOURS.', photoCaption: 'From the first stride to the finish line.',
    timingLabel: 'PRECISION IN EVERY MOMENT', timingCaption: 'Every millisecond matters.',
    heroFoot: 'YOUR AMBITION. OUR PRECISION.', explore: 'Explore the track',
    sports: ['ROAD RUNNING', 'TRAIL RUNNING', 'TRACK & FIELD', 'RACE-DAY TIMING'],
    calendar: '01 / FIND YOUR START LINE', eventTitle: ['Your next', 'challenge.'],
    eventDescription: 'A new distance. A new finish line. Find the event that moves you.',
    allEvents: 'Explore all events', openEvents: 'events to explore',
    emptyTitle: 'The next start line is taking shape.',
    emptyDescription: 'New events will appear here as they’re published. In the meantime, explore past results or talk to us about your next event.',
    viewResults: 'View race results', eventDate: 'Event date to be announced', venue: 'Location to be announced',
    from: 'From', free: 'Free entry', eventDetails: 'View event', register: 'Registration open', details: 'Event details',
    platform: '02 / EVERY STEP, CONNECTED', platformTitle: ['You bring', 'the drive.', 'We keep', 'the time.'],
    platformDescription: 'Less friction. More finish lines. Everything your race day needs, in one place.',
    platformLink: 'Get to know Time Track',
    services: [
      { title: 'A smooth start.', description: 'Discover events, choose your category, and get your place on the start line.', link: 'Explore events' },
      { title: 'Every split counts.', description: 'RFID timing built for the moments that matter, from the start to the final sprint.', link: 'Our timing services' },
      { title: 'Your effort. On record.', description: 'Find official rankings and race results. Your finish deserves to be remembered.', link: 'Find your results' },
    ],
    steps: ['FIND YOUR RACE', 'TAKE YOUR PLACE', 'OWN YOUR FINISH'],
    organizer: '03 / FOR THE PEOPLE BEHIND THE RACE', organizerTitle: ['Great races.', 'Start here.'],
    organizerDescription: 'You have the vision. We have the race-day tools. Let’s build an event your community will remember.',
    organizerCta: 'Let’s plan your event', organizerNote: 'Registration. Timing. Results. Connected.',
  },
  BM: {
    eyebrow: 'MALAYSIA. TEMUI CABARAN SETERUSNYA.',
    description: 'Dari garisan permulaan pertama ke rekod peribadi seterusnya. Temui perlumbaan anda. Cipta pencapaian. Kami catat masanya.',
    findRace: 'Cari perlumbaan anda', results: 'Lihat keputusan perlumbaan',
    photoAlt: 'Atlet memecut di atas balapan larian', photoLabel: 'INILAH SAAT ANDA.', photoCaption: 'Dari langkah pertama hingga garisan penamat.',
    timingLabel: 'KETEPATAN DALAM SETIAP DETIK', timingCaption: 'Setiap milisaat bermakna.',
    heroFoot: 'CITA-CITA ANDA. KETEPATAN KAMI.', explore: 'Terokai acara',
    sports: ['LARIAN JALAN RAYA', 'LARIAN DENAI', 'BALAPAN & PADANG', 'CATATAN MASA'],
    calendar: '01 / TEMUI GARISAN PERMULAAN ANDA', eventTitle: ['Cabaran', 'seterusnya.'],
    eventDescription: 'Jarak baharu. Garisan penamat baharu. Temui acara yang menggerakkan anda.',
    allEvents: 'Terokai semua acara', openEvents: 'acara untuk diterokai',
    emptyTitle: 'Garisan permulaan seterusnya sedang disediakan.',
    emptyDescription: 'Acara baharu akan dipaparkan setelah diterbitkan. Sementara itu, terokai keputusan lalu atau bincangkan acara anda dengan kami.',
    viewResults: 'Lihat keputusan', eventDate: 'Tarikh acara akan diumumkan', venue: 'Lokasi akan diumumkan',
    from: 'Dari', free: 'Penyertaan percuma', eventDetails: 'Lihat acara', register: 'Pendaftaran dibuka', details: 'Butiran acara',
    platform: '02 / SETIAP LANGKAH, TERHUBUNG', platformTitle: ['Anda bawa', 'semangat.', 'Kami catat', 'masanya.'],
    platformDescription: 'Lebih mudah. Lebih banyak garisan penamat. Semua keperluan hari perlumbaan, di satu tempat.',
    platformLink: 'Kenali Time Track',
    services: [
      { title: 'Permulaan yang lancar.', description: 'Temui acara, pilih kategori, dan dapatkan tempat anda di garisan permulaan.', link: 'Terokai acara' },
      { title: 'Setiap catatan bermakna.', description: 'Catatan masa RFID untuk setiap detik penting, dari permulaan hingga pecutan terakhir.', link: 'Perkhidmatan catatan masa' },
      { title: 'Usaha anda. Direkodkan.', description: 'Cari kedudukan rasmi dan keputusan perlumbaan. Pencapaian anda wajar dikenang.', link: 'Cari keputusan anda' },
    ],
    steps: ['CARI PERLUMBAAN', 'AMBIL TEMPAT ANDA', 'RAIKAN PENCAPAIAN'],
    organizer: '03 / UNTUK PENGANJUR PERLUMBAAN', organizerTitle: ['Acara hebat.', 'Bermula di sini.'],
    organizerDescription: 'Anda ada visi. Kami ada alat untuk hari perlumbaan. Mari bina acara yang akan dikenang komuniti anda.',
    organizerCta: 'Rancang acara anda', organizerNote: 'Pendaftaran. Catatan masa. Keputusan. Terhubung.',
  },
};

type HomeCopy = (typeof homepageCopy)['EN'];

function WordReveal({ text, delay = 0 }: { text: string; delay?: number }) {
  return (
    <span className={styles.wordGroup} data-reveal="">
      <span className={styles.screenReaderText}>{text}</span>
      {text.split(/\s+/).map((word, index, words) => (
        <span key={index} aria-hidden="true">
          <span className={styles.word} style={{ '--word-delay': (delay + Math.min(index, 12) * 35) + 'ms' } as CSSProperties}>{word}</span>
          {index < words.length - 1 ? ' ' : null}
        </span>
      ))}
    </span>
  );
}

function RunningTimer() {
  const startedRef = useRef<number | null>(null);
  const displayRef = useRef<HTMLSpanElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const millisecondsRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const display = displayRef.current;
    if (!display) return;
    const started = startedRef.current ?? performance.now();
    startedRef.current = started;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let visible = false;
    let previousUpdate = -Infinity;
    const tick = (now: number) => {
      if (now - previousUpdate >= (media.matches ? 250 : 33)) {
        const elapsed = Math.floor(now - started);
        const seconds = Math.floor(elapsed / 1000);
        const minutes = Math.floor(seconds / 60);
        if (timeRef.current) timeRef.current.textContent = String(minutes).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
        if (millisecondsRef.current) millisecondsRef.current.textContent = '.' + String(elapsed % 1000).padStart(3, '0');
        previousUpdate = now;
      }
      frame = requestAnimationFrame(tick);
    };
    const sync = () => {
      cancelAnimationFrame(frame);
      const running = visible && !document.hidden;
      display.dataset.running = String(running);
      if (running) frame = requestAnimationFrame(tick);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    observer.observe(display);
    document.addEventListener('visibilitychange', sync);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener('visibilitychange', sync);
    };
  }, []);

  return (
    <span ref={displayRef} className={styles.runningTimer} aria-hidden="true">
      <svg className={styles.clockFace} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <circle cx="12" cy="13" r="8" />
        <path d="M10 1h4M12 1v3M18.5 6.5l1.5-1.5" />
        <path className={styles.clockHand} d="M12 13V7.5" strokeLinecap="round" />
        <circle cx="12" cy="13" r="1" fill="currentColor" stroke="none" />
      </svg>
      <span className={styles.timerDisplay}><span ref={timeRef} className={styles.timerMain}>00:00</span><span ref={millisecondsRef}>.000</span></span>
    </span>
  );
}

function focusHomeEvents(event: MouseEvent<HTMLAnchorElement>) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  document.getElementById('home-content')?.focus();
}

export default function HomeClient({ initialEvents }: { initialEvents: Event[] }) {
  const { language } = useLanguage();
  const copy = homepageCopy[language];
  const pageRef = useRef<HTMLDivElement>(null);
  const frameMarkerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const page = pageRef.current;
    const marker = frameMarkerRef.current;
    if (!page || !marker) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let revealObserver: IntersectionObserver | undefined;
    const syncMotion = () => {
      revealObserver?.disconnect();
      page.removeAttribute('data-motion-ready');
      if (media.matches) return;
      const targets = page.querySelectorAll('[data-reveal], [data-reveal-block]');
      targets.forEach(target => target.removeAttribute('data-revealed'));
      revealObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          entry.target.setAttribute('data-revealed', 'true');
          revealObserver?.unobserve(entry.target);
        });
      }, { rootMargin: '0px 0px -24px 0px', threshold: 0.05 });
      page.setAttribute('data-motion-ready', 'true');
      targets.forEach(target => revealObserver?.observe(target));
    };
    syncMotion();
    media.addEventListener('change', syncMotion);
    const frameObserver = new IntersectionObserver(([entry]) => {
      page.setAttribute('data-frame-expanded', String(entry.boundingClientRect.top < 0));
    });
    frameObserver.observe(marker);
    return () => {
      revealObserver?.disconnect();
      frameObserver.disconnect();
      media.removeEventListener('change', syncMotion);
      page.removeAttribute('data-motion-ready');
    };
  }, [language]);
  // Global Page Scroll for Ambient Light Beam is replaced by static accents to avoid scroll work.
  return (
    <div ref={pageRef} className={`${styles.page} ${language === 'BM' ? styles.malay : ''}`}>
      <span ref={frameMarkerRef} className={styles.frameMarker} aria-hidden="true" />
      <a className={styles.skipLink} href="#home-content" onClick={focusHomeEvents}>{language === 'BM' ? 'Langkau ke kandungan' : 'Skip to content'}</a>
      {/* Fixed Background Video that follows on scroll is replaced by a single optimized race photograph. */}
      {/* Dynamic Background Patterns are contained within the hero artwork. */}
      {/* High-end Ambient Glows are replaced by solid, high-contrast surfaces. */}
      {/* Scroll-Linked Vertical Ambient Light Beam is replaced by static race-lane detailing. */}
      <HeroSection copy={copy} />
      <StatsSection copy={copy} />
      <UpcomingEventsSection copy={copy} events={initialEvents} />
      <FeatureSection copy={copy} />
      <CTASection copy={copy} />
    </div>
  );
}

function HeroSection({ copy }: { copy: HomeCopy }) {
  const { t } = useLanguage();
  // Local Scroll Tracking for Hero Parallax Exit is omitted to keep the heading and controls stable.
  return (
    <section className={styles.hero} aria-labelledby="home-title">
      {/* High-Tech Background Lines */}
      <div className={styles.heroGrid} aria-hidden="true" />
      <div className={styles.heroContent}>
        {/* Sleek Action Badge */}
        <p className={styles.eyebrow}><span className={styles.statusDot} />{copy.eyebrow}</p>
        {/* Large Premium Headers */}
        <h1 id="home-title" className={styles.heroTitle}>
          <span><WordReveal text={t('hero.title1')} /></span>
          <span className={styles.limeText}><WordReveal text={t('hero.title2')} delay={100} /></span>
          <span><WordReveal text={t('hero.title3')} delay={200} /><span className={styles.limeText}>.</span></span>
        </h1>
        {/* Modern Subtext */}
        <p className={styles.heroDescription}><WordReveal text={copy.description} /></p>
        {/* Action Button Grid */}
        <div className={styles.heroActions} data-reveal-block="">
          <Link href="/events" className={styles.primaryButton}>{copy.findRace}<ArrowUpRight size={20} aria-hidden="true" /></Link>
          <Link href="/results" className={styles.heroResults}>{copy.results}<ArrowRight size={18} aria-hidden="true" /></Link>
        </div>
      </div>
      <div className={styles.heroVisual} data-reveal-block="">
        <Image src="/images/home-race.jpg" alt={copy.photoAlt} fill preload sizes="(max-width: 760px) 100vw, 52vw" className={styles.heroImage} />
        <div className={styles.photoShade} aria-hidden="true" />
        <span className={styles.photoIndex} aria-hidden="true">TT / 001</span>
        <div className={styles.photoCaption}><span><WordReveal text={copy.photoLabel} /></span><p><WordReveal text={copy.photoCaption} /></p></div>
        <div className={styles.timingCard} data-reveal-block="">
          <div><span>{copy.timingLabel}</span><span className={styles.timingDot} aria-hidden="true" /></div>
          <RunningTimer />
          <p>{copy.timingCaption}</p>
        </div>
      </div>
      {/* Modern Scroll Indicator */}
      <div className={styles.heroFooter}><span>{copy.heroFoot}</span><a href="#home-content" onClick={focusHomeEvents}>{copy.explore}<ArrowDown size={16} aria-hidden="true" /></a></div>
    </section>
  );
}

function StatsSection({ copy }: { copy: HomeCopy }) {
  // Parallax scroll drag-upward effect is replaced by a stable, non-animated discipline strip.
  return (
    <div className={styles.disciplines}>
      {/* Subtle inside glow is replaced by simple separators. */}
      {copy.sports.map((sport, index) => <span key={sport}>{index > 0 && <Asterisk className={styles.disciplineMark} size={23} aria-hidden="true" />}{sport}</span>)}
    </div>
  );
}

function UpcomingEventsSection({ events, copy }: { events: Event[]; copy: HomeCopy }) {
  // Parallax scroll drag-upward effect is omitted so that event links never move beneath the pointer.
  return (
    <section id="home-content" tabIndex={-1} className={styles.events} aria-labelledby="events-heading">
      <div className={styles.sectionHeading}>
        <div><p className={styles.sectionLabel}>{copy.calendar}</p><h2 id="events-heading" className={styles.sectionTitle}><WordReveal text={copy.eventTitle[0]} /><br /><span><WordReveal text={copy.eventTitle[1]} delay={70} /></span></h2></div>
        <div className={styles.sectionAside}><p><WordReveal text={copy.eventDescription} /></p><Link href="/events" className={styles.textLink}>{copy.allEvents}<span className={styles.circleArrow}><ArrowUpRight size={20} aria-hidden="true" /></span></Link></div>
      </div>
      {events.length > 0 ? (
        <>
          <p className={styles.eventCount}><span className={styles.statusDot} />{events.length} {copy.openEvents}</p>
          <div className={styles.eventGrid}>{events.slice(0, 3).map(event => <HomeEventCard key={event.id} event={event} copy={copy} />)}</div>
        </>
      ) : (
        <div className={styles.emptyEvents}>
          <div className={styles.emptyIcon}><Flag size={30} strokeWidth={1.5} aria-hidden="true" /></div>
          <div><h3><WordReveal text={copy.emptyTitle} /></h3><p><WordReveal text={copy.emptyDescription} /></p></div>
          <Link href="/results" className={styles.textLink}>{copy.viewResults}<ArrowUpRight size={20} aria-hidden="true" /></Link>
        </div>
      )}
    </section>
  );
}

function HomeEventCard({ event, copy }: { event: Event; copy: HomeCopy }) {
  const { language } = useLanguage();
  const date = new Date(event.event_date);
  const validDate = !Number.isNaN(date.getTime());
  const prices = (event.event_categories ?? []).map(category => Number(category.base_price)).filter(Number.isFinite);
  const price = prices.length ? Math.min(...prices) : null;
  const open = event.status === 'LIVE';
  return (
    <Link href={`/events/${event.id}`} className={styles.eventCard} data-reveal-block="">
      <div className={styles.eventImageWrap}>
        {event.cover_image ? <Image src={event.cover_image} alt="" fill unoptimized sizes="(max-width: 760px) 100vw, 33vw" className={styles.eventImage} /> : <div className={styles.eventPlaceholder} aria-hidden="true"><Flag size={42} strokeWidth={1} /><span>TIME TRACK</span></div>}
        <span className={styles.eventStatus}>{open ? copy.register : copy.details}</span>
        {validDate && <div className={styles.dateBadge}><span>{date.toLocaleDateString(language === 'BM' ? 'ms-MY' : 'en-GB', { month: 'short' })}</span><strong>{date.getDate().toString().padStart(2, '0')}</strong></div>}
      </div>
      <div className={styles.eventBody}>
        <h3>{event.title}</h3>
        <p><MapPin size={15} aria-hidden="true" />{event.venue_name || event.city || copy.venue}</p>
        <p><CalendarDays size={15} aria-hidden="true" />{validDate ? date.toLocaleDateString(language === 'BM' ? 'ms-MY' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : copy.eventDate}</p>
        <div className={styles.eventBottom}><span>{price === null ? copy.eventDetails : price === 0 ? copy.free : `${copy.from} RM ${price.toLocaleString(language === 'BM' ? 'ms-MY' : 'en-MY')}`}</span><span className={styles.circleArrow}><ArrowUpRight size={19} aria-hidden="true" /></span></div>
      </div>
    </Link>
  );
}

function FeatureSection({ copy }: { copy: HomeCopy }) {
  // Parallax scroll drag-upward effect is replaced by a static layout with small, independent hover feedback.
  const icons = [Flag, Radio, Trophy];
  const destinations = ['/events', '/about', '/results'];
  return (
    <section className={styles.platform} data-reveal-frame="" aria-labelledby="platform-heading">
      <div className={styles.platformInner}>
        <div className={styles.platformIntro}>
          <p className={styles.sectionLabel}>{copy.platform}</p>
          <h2 id="platform-heading" className={styles.platformTitle}>{copy.platformTitle.map((line, index) => <span key={line} className={index > 1 ? styles.limeText : undefined}><WordReveal text={line} delay={index * 65} /></span>)}</h2>
          <p className={styles.platformDescription}><WordReveal text={copy.platformDescription} /></p>
          <Link href="/about" className={styles.darkTextLink}>{copy.platformLink}<ArrowUpRight size={19} aria-hidden="true" /></Link>
        </div>
        <div className={styles.serviceList}>
          {copy.services.map((service, index) => {
            const Icon = icons[index];
            return (
              <Link key={service.title} href={destinations[index]} className={styles.service} data-reveal-block="">
                {/* Feature Icon Container */}
                <div className={styles.serviceTop}><span className={styles.serviceNumber}>0{index + 1}</span><Icon size={26} strokeWidth={1.5} aria-hidden="true" /></div>
                {/* Feature Text */}
                <h3><WordReveal text={service.title} /></h3><p><WordReveal text={service.description} /></p>
                <span className={styles.serviceLink}>{service.link}<ArrowUpRight size={18} aria-hidden="true" /></span>
              </Link>
            );
          })}
        </div>
      </div>
      <ol className={styles.steps}>{copy.steps.map((step, index) => <li key={step}><span>0{index + 1}</span>{step}<Check size={16} aria-hidden="true" /></li>)}</ol>
    </section>
  );
}

function CTASection({ copy }: { copy: HomeCopy }) {
  // local parallax scroll offset is omitted to keep the call to action immediately reachable.
  return (
    <section className={styles.organizer} aria-labelledby="organizer-heading">
      {/* Decorative Radial Grid is replaced by static track-lane curves. */}
      <div className={styles.trackLines} aria-hidden="true"><span /><span /><span /><span /></div>
      <div className={styles.organizerContent}><p className={styles.sectionLabel}>{copy.organizer}</p><h2 id="organizer-heading"><WordReveal text={copy.organizerTitle[0]} /><br /><WordReveal text={copy.organizerTitle[1]} delay={70} /></h2><p className={styles.organizerDescription}><WordReveal text={copy.organizerDescription} /></p><Link href="/contact" className={styles.inkButton}>{copy.organizerCta}<ArrowUpRight size={21} aria-hidden="true" /></Link><p className={styles.organizerNote}>{copy.organizerNote}</p></div>
      {/* Animated Icon is rendered statically to respect the page's restrained motion direction. */}
      <div className={styles.organizerStamp} aria-hidden="true"><Flag size={44} strokeWidth={1.3} /><span>TIME TRACK</span></div>
    </section>
  );
}
