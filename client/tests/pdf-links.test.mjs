import test from 'node:test';
import assert from 'node:assert/strict';
import { pdfLinks } from '../src/shared/pdfLinks.js';

test('Drive sharing links have distinct preview, open and download URLs', () => {
  for (const source of ['https://drive.google.com/file/d/abc_123/view?usp=sharing', 'https://drive.google.com/open?id=abc_123', 'https://drive.google.com/uc?export=download&id=abc_123']) {
    const result = pdfLinks(source);
    assert.equal(result.preview, 'https://drive.google.com/file/d/abc_123/preview');
    assert.equal(result.open, 'https://drive.google.com/file/d/abc_123/view');
    assert.equal(new URL(result.download).searchParams.get('export'), 'download');
    assert.equal(new URL(result.download).searchParams.get('id'), 'abc_123');
  }
});
test('Drive resource keys are preserved in all actions', () => {
  for (const url of Object.values(pdfLinks('https://drive.google.com/file/d/abc/view?resourcekey=0-key'))) {
    assert.equal(new URL(url).searchParams.get('resourcekey'), '0-key');
  }
});
test('Other hosts, folder links and malformed values are not converted', () => {
  for (const value of ['https://example.org/book.pdf', '/uploads/book.pdf', 'https://drive.google.com/drive/folders/abc', 'https://drive.google.com.evil.test/file/d/abc/view', 'invalid']) {
    assert.deepEqual(pdfLinks(value), { preview: value, open: value, download: value });
  }
});
