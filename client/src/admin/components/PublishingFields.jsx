import { useId } from 'react';

export default function PublishingFields({ value, onChange, title, kind = 'resource', required = true, summaryKey = 'summary', lockSlug = false }) {
  const prefix = useId();
  const fields = [
    ['slug', 'Readable URL slug', 'fbise-class-10-physics-2026', 'Lowercase words separated by hyphens. This identifies the public page URL; keep it stable after sharing.', 100],
    [summaryKey, 'Student summary', 'Explain the chapters covered, who this resource is for, its edition or exam session, and how students can use it.', 'Visible on the public page and used for its search description. Write an original, specific summary; 80 characters is only a completeness check, not a ranking target.', summaryKey === 'excerpt' ? 320 : 2400],
    ['tags', 'Relevant tags', 'physics, class 10, fbise', 'Up to 8 useful tags, separated by commas. Academic filters still use the board, class, group and subject selected above.', 320],
    ['sourceName', 'Source / publisher', 'Federal Board of Intermediate and Secondary Education', 'Credit the original publisher, author or teacher.', 160],
    ['sourceUrl', 'Original source link', 'https://www.fbise.edu.pk/', 'Link to the original material or announcement, rather than an unrelated homepage when possible.', 1000],
    ...(kind === 'book' ? [['edition', 'Edition', '2026 edition', 'Visible to students; enter an edition only when it is known.', 80]] : []),
    ...(['book','notes','past-paper'].includes(kind) ? [['fileName', 'PDF filename', 'fbise-class-10-physics-2026.pdf', 'Use this descriptive name when preparing the actual PDF. This field documents it; it does not rename a remotely hosted file.', 160]] : []),
    ...(kind === 'news' ? [['imageAlt', 'Cover image description', 'Students reviewing the FBISE Class 10 exam timetable', 'Describe what the image conveys. Required when publishing an article with a cover image.', 240]] : []),
  ];
  const summary = value[summaryKey] || '';
  return <fieldset className="my-5 border-t border-slate-200 pt-5"><legend className="px-1 text-sm font-bold text-slate-800">Publishing details</legend><div className="grid gap-4 sm:grid-cols-2">
    {fields.map(([key,label,placeholder,help,max]) => <div key={key} className={key === summaryKey ? 'sm:col-span-2' : ''}>
      <label htmlFor={`${prefix}-${key}`} className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</label>
      {key === summaryKey ? <textarea id={`${prefix}-${key}`} aria-describedby={`${prefix}-${key}-help`} required={required} minLength={required ? 80 : undefined} maxLength={max} value={summary} onChange={e => onChange({ [key]: e.target.value })} placeholder={placeholder} className="min-h-28 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /> : <input id={`${prefix}-${key}`} aria-describedby={`${prefix}-${key}-help`} type={key === 'sourceUrl' ? 'url' : 'text'} maxLength={max} readOnly={key === 'slug' && lockSlug} value={Array.isArray(value[key]) ? value[key].join(', ') : value[key] || ''} onChange={e => onChange({ [key]: e.target.value })} placeholder={placeholder} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm read-only:bg-slate-100" />}
      <p id={`${prefix}-${key}-help`} className="mt-1 text-xs leading-5 text-slate-500">{help}</p>
    </div>)}
  </div><div className="mt-5 border-l-2 border-primary pl-4" aria-label="Search preview"><p className="text-xs text-slate-500">Search preview (search engines may use different text)</p><p className="mt-2 break-words text-lg font-semibold text-primary">{title || 'Your content title'} | IlmiDunya</p><p className="mt-1 break-words text-sm leading-6 text-slate-600">{summary ? summary.slice(0, 180) : 'Your original student summary will appear here.'}</p></div></fieldset>;
}
