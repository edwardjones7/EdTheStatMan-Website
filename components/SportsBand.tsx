import Link from 'next/link'
import Image from 'next/image'

// Decorative sport navigation band. Static by design — not part of the
// editable site_content set.
const SPORTS = [
  { label: 'NFL',                short: 'Pro Football',    img: '/images/sports/nfl.jpg',       href: '/betting-systems?sport=NFL' },
  { label: 'College Football',   short: 'CFB',             img: '/images/sports/cfb.jpg',       href: '/betting-systems?sport=College+Football' },
  { label: 'NBA',                short: 'Pro Basketball',  img: '/images/sports/nba.jpg',       href: '/betting-systems?sport=NBA' },
  { label: 'College Basketball', short: 'CBB',             img: '/images/sports/cbb.jpg',       href: '/betting-systems?sport=College+Basketball' },
]

export default function SportsBand() {
  return (
    <section className="sports-band">
      <div className="container">
        <div className="sports-band__head">
          <span className="section-label">Coverage</span>
          <h2 className="section-title">Four Sports. <span className="text-gradient">One Edge.</span></h2>
        </div>

        <div className="sports-band__grid">
          {SPORTS.map(sport => (
            <Link key={sport.label} href={sport.href} className="sport-tile">
              <Image
                src={sport.img}
                alt=""
                fill
                sizes="(max-width: 768px) 50vw, 25vw"
                style={{ objectFit: 'cover' }}
              />
              <span className="sport-tile__scrim" />
              <span className="sport-tile__body">
                <span className="sport-tile__short">{sport.short}</span>
                <span className="sport-tile__label">{sport.label}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
