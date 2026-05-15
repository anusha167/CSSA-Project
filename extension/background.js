// Read the API key from config.js at runtime
let GEMINI_KEY = '';
fetch(chrome.runtime.getURL('config.js'))
  .then(r => r.text())
  .then(src => {
    const m = src.match(/GEMINI_KEY\s*=\s*['"]([^'"]+)['"]/);
    if (m) GEMINI_KEY = m[1];
  })
  .catch(() => {});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['backlog'], (r) => {
    if (!r.backlog) chrome.storage.local.set({ backlog: [] });
  });
  chrome.alarms.create('keepalive', { periodInMinutes: 0.4 });
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create('keepalive', { periodInMinutes: 0.4 });
});

chrome.alarms.onAlarm.addListener(() => {});

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type !== 'lookup') return false;

  const tabId = sender.tab?.id;
  if (!tabId) return false;

  handleLookup(msg.word, msg.context)
    .then(result => {
      chrome.tabs.sendMessage(tabId, { type: 'lookup_result', result });
    })
    .catch(err => {
      console.error('[CSSA] lookup failed:', err.message);
      chrome.tabs.sendMessage(tabId, { type: 'lookup_error' });
    });

  return false; // no async sendResponse needed
});

async function handleLookup(word, context) {
  if (!GEMINI_KEY) {
    const src = await fetch(chrome.runtime.getURL('config.js')).then(r => r.text()).catch(() => '');
    const m = src.match(/GEMINI_KEY\s*=\s*['"]([^'"]+)['"]/);
    if (m) GEMINI_KEY = m[1];
  }
  if (!GEMINI_KEY) throw new Error('no_key');

  const prompt =
    'Return ONLY a raw JSON object (no markdown, no code fences, no extra text).\n' +
    'A user selected: "' + word + '"\n' +
    'Surrounding context: "' + context + '"\n\n' +
    'JSON shape (fill in the values, keeping exact key names):\n' +
    '{"word":"' + word + '","pos":"noun","is_slang":true,"definition":"...","example":"...","synonyms":["..."],"cultural_usage":"...","etymology":"..."}';

  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + GEMINI_KEY,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1024,
          thinkingConfig: { thinkingBudget: 0 }
        }
      })
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error('Gemini ' + res.status + ': ' + body.slice(0, 120));
  }

  const json = await res.json();
  console.log('[CSSA] full response:', JSON.stringify(json).slice(0, 500));
  const raw = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
  console.log('[CSSA] raw text:', raw.slice(0, 400));
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON in response: ' + JSON.stringify(json).slice(0, 200));
  return JSON.parse(match[0]);
}
