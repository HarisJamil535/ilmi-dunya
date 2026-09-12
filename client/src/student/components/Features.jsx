import React from 'react'

const features = [
  {
    num: '01', cardClass: 'c1',
    title: 'Chapter Notes',
    desc: 'Topic-wise notes, short & long questions and official textbook PDFs — organized chapter by chapter for your exact board syllabus.',
    pill: 'Free Access',
    icon: (
      <svg fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
    ),
  },
  {
    num: '02', cardClass: 'c2',
    title: 'Video Lectures',
    desc: 'Topic-by-topic videos by experienced teachers. Watch, pause and rewatch at your own pace — anytime, anywhere.',
    pill: 'Login Required',
    icon: (
      <svg fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <polygon points="23 7 16 12 23 17 23 7"/>
        <rect x="1" y="5" width="15" height="14" rx="2"/>
      </svg>
    ),
  },
  {
    num: '03', cardClass: 'c3',
    title: 'Practice Tests',
    desc: 'Chapter-wise MCQ tests with instant results, score history and detailed answer explanations to strengthen your weak areas.',
    pill: 'Login Required',
    icon: (
      <svg fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M9 11l3 3L22 4"/>
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
      </svg>
    ),
  },
  {
    num: '04', cardClass: 'c4',
    title: 'Past Papers',
    desc: 'Last 10 years of board exam papers sorted by year and subject — the most effective way to prepare for exams in Pakistan.',
    pill: 'Free Access',
    icon: (
      <svg fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
  {
    num: '05', cardClass: 'c5',
    title: 'Board Specific',
    desc: 'Content matched precisely to Federal, Lahore, Gujranwala, Faisalabad and 4 more boards across Pakistan.',
    pill: '8 Boards',
    icon: (
      <svg fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10"/>
        <line x1="2" y1="12" x2="22" y2="12"/>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
      </svg>
    ),
  },
  {
    num: '06', cardClass: 'c6',
    title: 'Track Progress',
    desc: 'Personal dashboard with test scores, completed chapters and study streaks to keep you motivated every day.',
    pill: 'Dashboard',
    icon: (
      <svg fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <line x1="18" y1="20" x2="18" y2="10"/>
        <line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
  },
]

const ArrowIcon = () => (
  <svg fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" width="14" height="14">
    <line x1="5" y1="12" x2="19" y2="12"/>
    <polyline points="12 5 19 12 12 19"/>
  </svg>
)

const Features = () => {
  return (
    <section className='fw'>

      {/* Header */}
      <div className='fh-wrap'>
        <div className='fh-pill'>
          <span className='fh-dot' />
          Why IlmiDunya
        </div>
        <h2 className='fh-title'>
          Everything you need to <em>succeed</em>
        </h2>
        <p className='fh-sub'>
          All study resources in one place — matched exactly to your board, class, and subject.
        </p>
      </div>

      {/* Grid */}
      <div className='fg'>
        {features.map((f) => (
          <div key={f.num} className={`fc ${f.cardClass}`}>
            <span className='fc-num'>{f.num}</span>
            <div className='fc-icon'>{f.icon}</div>
            <p className='fc-title'>{f.title}</p>
            <p className='fc-desc'>{f.desc}</p>
            <div className='fc-footer'>
              <span className='fc-pill'>{f.pill}</span>
              <span className='fc-arrow'><ArrowIcon /></span>
            </div>
          </div>
        ))}
      </div>

    </section>
  )
}

export default Features