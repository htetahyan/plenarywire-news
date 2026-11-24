// Offline unit checks for the pipeline helpers and fail-closed config validation.
import assert from 'node:assert/strict';
import { canonicalUrl, eventFingerprint, parseFeed } from './lib.mjs';
import { getProvider } from './providers/index.mjs';

assert.equal(canonicalUrl('http://WWW.Example.org/a/b/?utm_source=x&b=2&a=1#frag'), 'https://example.org/a/b?a=1&b=2');
assert.equal(eventFingerprint('The Council adopts Sample Act', '2026-11-09T10:00:00Z'), eventFingerprint('Sample Act: council adopts', 'Mon, 09 Nov 2026 18:00:00 GMT'));
assert.notEqual(eventFingerprint('Sample Act adopted', '2026-11-09'), eventFingerprint('Sample Act adopted', '2026-11-10'));
const items = parseFeed('<rss><channel><item><title><![CDATA[A &amp; B]]></title><link>https://example.org/x</link><pubDate>Mon, 09 Nov 2026 10:00:00 GMT</pubDate><description>&lt;p&gt;Hi&lt;/p&gt;</description></item></channel></rss>');
assert.equal(items.length, 1); assert.equal(items[0].title, 'A & B'); assert.equal(items[0].summary, 'Hi');
assert.equal(getProvider('stub').name, 'stub');
assert.throws(() => getProvider('openai'), /not available/);
console.log('Pipeline unit checks passed.');
