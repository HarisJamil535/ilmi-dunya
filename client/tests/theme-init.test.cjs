const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const script = fs.readFileSync(require('node:path').join(__dirname, '../public/theme-init.js'), 'utf8');

function initialize(pathname, preferences = {}, blocked = false) {
  const root = { dataset: {}, classList: { toggle(name, value) { root[name] = value; } } };
  vm.runInNewContext(script, {
    window: { location: { pathname }, matchMedia: () => ({ matches: true }), localStorage: { getItem(key) { if (blocked) throw new Error('Blocked'); return preferences[key]; } } },
    document: { documentElement: root, querySelector: () => null },
  });
  return root;
}
test('First visits are light even on a dark device', () => {
  for (const path of ['/', '/login', '/admin/dashboard']) assert.equal(initialize(path).dataset.theme, 'light');
});
test('Client and admin remember independent choices', () => {
  const preferences = { 'ilmidunya-client-theme': 'dark', 'ilmidunya-admin-theme': 'light' };
  assert.equal(initialize('/', preferences).dataset.theme, 'dark');
  assert.equal(initialize('/admin/dashboard', preferences).dataset.theme, 'light');
});
test('Unavailable storage and old system preferences fall back to light', () => {
  assert.equal(initialize('/', {}, true).dataset.theme, 'light');
  assert.equal(initialize('/', { 'ilmidunya-client-theme': 'system' }).dataset.theme, 'light');
});
