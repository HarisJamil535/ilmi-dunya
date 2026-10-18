export function cleanCanonical(path, origin) {
  const base = new URL(origin);
  const url = new URL(path || '/', base);
  if (url.origin !== base.origin || !['http:', 'https:'].includes(url.protocol)) throw new Error('Canonical must belong to the website.');
  url.search = '';
  url.hash = '';
  return url.href;
}

const httpUrl = value => {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : undefined; } catch { return undefined; }
};
const isoDate = value => value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toISOString() : undefined;

// Supply only facts and question/answer pairs that are visible on this page.
export function educationalSchemas({ kind, title, summary, meta, educationalLevel, updatedAt, faqs = [], videos = [] }, origin) {
  const url = cleanCanonical(meta?.path || '/', origin);
  const schemas = [];
  if (['class', 'chapter', 'notes', 'book', 'topic', 'past-paper', 'mcqs'].includes(kind)) {
    schemas.push({ '@context': 'https://schema.org', '@type': ['class', 'chapter'].includes(kind) ? 'Course' : 'LearningResource',
      '@id': `${url}#learning-resource`, url, name: title, description: summary || meta?.description,
      educationalLevel, learningResourceType: kind === 'notes' ? 'Study notes' : kind === 'mcqs' ? 'Practice test' : kind,
      dateModified: isoDate(updatedAt), inLanguage: 'en',
    });
  }
  const answers = faqs.filter(item => typeof item.question === 'string' && item.question.trim() && typeof item.answer === 'string' && item.answer.trim());
  if (answers.length) schemas.push({ '@context': 'https://schema.org', '@type': 'FAQPage', '@id': `${url}#faq`, mainEntity: answers.map(item => ({ '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answer } })) });
  for (const [index, video] of videos.entries()) {
    const thumbnailUrl = httpUrl(video.thumbnailUrl);
    const embedUrl = httpUrl(video.embedUrl);
    const contentUrl = httpUrl(video.contentUrl);
    const uploadDate = isoDate(video.uploadDate);
    if (!video.name || !thumbnailUrl || !uploadDate || (!embedUrl && !contentUrl)) continue;
    schemas.push({ '@context': 'https://schema.org', '@type': 'VideoObject', '@id': `${url}#video-${index + 1}`, name: video.name, description: video.description, thumbnailUrl, uploadDate, embedUrl, contentUrl,
      ...(typeof video.duration === 'string' && /^PT(?:\d+H)?(?:\d+M)?(?:\d+(?:\.\d+)?S)?$/.test(video.duration) && video.duration !== 'PT' ? { duration: video.duration } : {}),
    });
  }
  return schemas;
}

export const schemaJson = value => JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
