var _cssaLastWord = '';

document.addEventListener('mouseup', function () {
  var sel = window.getSelection();
  if (!sel || sel.isCollapsed) return;

  var text = sel.toString().trim();
  if (!text || text.length > 80) return;

  var clean = text.toLowerCase().replace(/[^a-z\s']/g, '').trim();
  if (!clean || clean === _cssaLastWord) return;

  var rect;
  try { rect = sel.getRangeAt(0).getBoundingClientRect(); } catch(e) { return; }
  if (!rect) return;

  _cssaLastWord = clean;

  // Instant hit from local database
  if (SLANG_DATA[clean]) {
    showPopup(SLANG_DATA[clean], rect);
    return;
  }

  // Ask Gemini — background pushes result back via chrome.tabs.sendMessage
  var ctx = getSurroundingContext(sel);
  openSidebarLoading(text);
  try { chrome.runtime.sendMessage({ type: 'lookup', word: text, context: ctx }); } catch(e) {}
});

document.addEventListener('mousedown', function (e) {
  var p = document.getElementById('cssa-popup');
  // Keep loading popup alive until Gemini responds; dismiss result popups immediately
  if (p && !p.contains(e.target) && !p.getAttribute('data-loading')) p.remove();
  _cssaLastWord = '';
});

// ── Context extraction ────────────────────────────────────

function getSurroundingContext(sel) {
  try {
    var node = sel.anchorNode;
    var text = node ? (node.textContent || '') : '';
    // Grab up to 300 chars centred around the selection offset
    var start = Math.max(0, sel.anchorOffset - 150);
    return text.slice(start, start + 300).replace(/\s+/g, ' ').trim();
  } catch(e) { return ''; }
}

// ── Popup ─────────────────────────────────────────────────

function showLoadingPopup(word, rect) {
  var old = document.getElementById('cssa-popup');
  if (old) old.remove();
  var el = document.createElement('div');
  el.id = 'cssa-popup';
  el.setAttribute('data-loading', '1');
  el.className = 'cssa-tooltip cssa-tooltip--show';
  el.innerHTML =
    '<div class="cssa-tt-header"><div class="cssa-tt-wordrow">' +
      '<span class="cssa-tt-word">' + esc(word) + '</span>' +
    '</div></div>' +
    '<div class="cssa-tt-section"><div class="cssa-tt-def cssa-loading">Looking up&hellip;</div></div>';
  document.body.appendChild(el);
  positionEl(el, rect);
}

function removeLoadingPopup() {
  var p = document.getElementById('cssa-popup');
  if (p && p.getAttribute('data-loading')) p.remove();
}

function showNoKeyPopup(rect) {
  var old = document.getElementById('cssa-popup');
  if (old) old.remove();
  var el = document.createElement('div');
  el.id = 'cssa-popup';
  el.className = 'cssa-tooltip cssa-tooltip--show';
  el.innerHTML =
    '<div class="cssa-tt-section">' +
      '<div class="cssa-tt-def">Add a Gemini API key in extension options to look up any word.</div>' +
    '</div>' +
    '<div class="cssa-tt-footer">' +
      '<button class="cssa-btn-primary" id="cssa-opts">Open Options</button>' +
    '</div>';
  document.body.appendChild(el);
  positionEl(el, rect);
  el.querySelector('#cssa-opts').onclick = function () {
    try { chrome.runtime.sendMessage({ type: 'open_options' }); } catch(e) {}
  };
}

function showPopup(data, rect) {
  var old = document.getElementById('cssa-popup');
  if (old) old.remove();

  var el = document.createElement('div');
  el.id = 'cssa-popup';
  el.className = 'cssa-tooltip cssa-tooltip--show';
  el.innerHTML =
    '<div class="cssa-tt-header">' +
      '<div class="cssa-tt-wordrow">' +
        '<span class="cssa-tt-word">' + esc(data.word) + '</span>' +
        '<span class="cssa-tt-pos">' + esc(data.pos) + '</span>' +
      '</div>' +
    '</div>' +
    (data.synonyms && data.synonyms.length
      ? '<div class="cssa-chips">' + data.synonyms.slice(0,3).map(function(s){ return '<span class="cssa-chip">'+esc(s)+'</span>'; }).join('') + '</div>'
      : '') +
    '<div class="cssa-tt-section">' +
      '<div class="cssa-label">DEFINITION</div>' +
      '<div class="cssa-tt-def">' + esc(data.definition) + '</div>' +
    '</div>' +
    (data.example
      ? '<div class="cssa-tt-section"><div class="cssa-label">EXAMPLE</div><blockquote class="cssa-tt-example">&ldquo;' + esc(data.example) + '&rdquo;</blockquote></div>'
      : '') +
    '<div class="cssa-tt-footer">' +
      '<button class="cssa-btn-primary" id="cssa-det">Details</button>' +
      '<button class="cssa-btn-secondary" id="cssa-sav">Save</button>' +
    '</div>';

  document.body.appendChild(el);
  positionEl(el, rect);

  el.querySelector('#cssa-det').onclick = function () { openSidebar(data); };
  el.querySelector('#cssa-sav').onclick = function () {
    saveWord(data);
    this.textContent = 'Saved!';
    this.style.background = '#4CAF82';
    this.style.color = '#fff';
  };
}

function positionEl(el, rect) {
  var pw = el.offsetWidth || 320;
  var vw = window.innerWidth;
  var left = Math.min(rect.left, vw - pw - 8);
  if (left < 4) left = 4;
  var top = rect.bottom + window.scrollY + 8;
  if (rect.bottom + el.offsetHeight + 12 > window.innerHeight) {
    top = rect.top + window.scrollY - el.offsetHeight - 8;
  }
  el.style.left = left + 'px';
  el.style.top  = top  + 'px';
}

// ── Sidebar ──────────────────────────────────────────────

var sidebar = null;

function ensureSidebar() {
  if (!sidebar) {
    sidebar = document.createElement('div');
    sidebar.className = 'cssa-sidebar';
    sidebar.innerHTML =
      '<div class="cssa-sb-header">' +
        '<span class="cssa-sb-title">Slang Helper</span>' +
        '<button class="cssa-icon-btn" id="cssa-sb-x">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
        '</button>' +
      '</div>' +
      '<div id="cssa-sb-body" class="cssa-sb-body"></div>';
    sidebar.querySelector('#cssa-sb-x').onclick = function () {
      sidebar.classList.remove('cssa-sidebar--open');
    };
    document.body.appendChild(sidebar);
  }
  return sidebar;
}

function openSidebarLoading(word) {
  var sb = ensureSidebar();
  document.getElementById('cssa-sb-body').innerHTML =
    '<div class="cssa-sb-word-area">' +
      '<div class="cssa-sb-word-row"><h2 class="cssa-sb-word">' + esc(word) + '</h2></div>' +
      '<div class="cssa-sb-pos cssa-loading">Looking up&hellip;</div>' +
    '</div>';
  sb.classList.add('cssa-sidebar--open');
}

function updateSidebarError(word) {
  var body = document.getElementById('cssa-sb-body');
  if (body) body.innerHTML =
    '<div class="cssa-sb-word-area">' +
      '<div class="cssa-sb-word-row"><h2 class="cssa-sb-word">' + esc(word) + '</h2></div>' +
      '<div class="cssa-sb-pos" style="color:#C62828">Couldn\'t look up &ldquo;' + esc(word) + '&rdquo;. Check your API key or try again.</div>' +
    '</div>';
}

function openSidebar(data) {
  var old = document.getElementById('cssa-popup');
  if (old) old.remove();

  ensureSidebar();
  var body = document.getElementById('cssa-sb-body');
  var circles = '';
  for (var i = 0; i < 5; i++) circles += '<span class="cssa-circle' + (i < 3 ? ' cssa-circle--on' : '') + '"></span>';

  body.innerHTML =
    '<div class="cssa-sb-word-area">' +
      '<div class="cssa-sb-word-row">' +
        '<h2 class="cssa-sb-word">' + esc(data.word) + '</h2>' +
        (data.is_slang !== undefined
          ? '<span class="cssa-badge' + (data.is_slang ? ' cssa-badge--slang' : '') + '">' + (data.is_slang ? 'Slang' : 'Standard') + '</span>'
          : '') +
      '</div>' +
      '<div class="cssa-circles">' + circles + '</div>' +
      '<div class="cssa-sb-pos">' + esc(data.pos) + '</div>' +
      (data.synonyms && data.synonyms.length ? '<div class="cssa-chips">' + data.synonyms.map(function(s){ return '<span class="cssa-chip">'+esc(s)+'</span>'; }).join('') + '</div>' : '') +
      (data.antonyms && data.antonyms.length ? '<div class="cssa-chips">' + data.antonyms.map(function(s){ return '<span class="cssa-chip cssa-chip--antonym">'+esc(s)+'</span>'; }).join('') + '</div>' : '') +
    '</div>' +
    '<div class="cssa-sb-sections">' +
      sbSection('Definition', esc(data.definition), true) +
      sbSection('Example', data.example ? '<em>' + esc(data.example) + '</em>' : null, true) +
      sbSection('Cultural Usage', data.cultural_usage ? esc(data.cultural_usage) : null) +
      sbSection('Etymology', data.etymology ? esc(data.etymology) : null) +
    '</div>';

  body.querySelectorAll('.cssa-sb-sec-hdr').forEach(function (hdr) {
    hdr.onclick = function () { this.closest('.cssa-sb-section').classList.toggle('cssa-sb-section--open'); };
  });

  sidebar.classList.add('cssa-sidebar--open');
  saveWord(data);
}

function sbSection(title, html, open) {
  if (!html) return '';
  return '<div class="cssa-sb-section' + (open ? ' cssa-sb-section--open' : '') + '">' +
    '<button class="cssa-sb-sec-hdr"><span>' + title + '</span>' +
    '<svg class="cssa-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg></button>' +
    '<div class="cssa-sb-sec-body"><p>' + html + '</p></div></div>';
}

// ── FAB ──────────────────────────────────────────────────

var fab = document.createElement('button');
fab.className = 'cssa-fab';
fab.title = 'Slang Helper';
fab.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
fab.onclick = function () {
  if (sidebar && sidebar.classList.contains('cssa-sidebar--open')) {
    sidebar.classList.remove('cssa-sidebar--open');
  } else if (sidebar) {
    sidebar.classList.add('cssa-sidebar--open');
  }
};
document.body.appendChild(fab);

// ── Save word ─────────────────────────────────────────────

function saveWord(data) {
  try {
    if (!chrome || !chrome.runtime || !chrome.runtime.id) return;
    chrome.storage.local.get(['backlog'], function (r) {
      if (chrome.runtime.lastError) return;
      var list = r.backlog || [];
      if (!list.find(function(w){ return w.word === data.word; })) {
        list.unshift({ word: data.word, pos: data.pos, definition: data.definition, timestamp: Date.now() });
        if (list.length > 50) list.pop();
        chrome.storage.local.set({ backlog: list });
      }
    });
  } catch (e) {}
}

// ── Result listener (background pushes back via tabs.sendMessage) ────────────

chrome.runtime.onMessage.addListener(function (msg) {
  if (msg.type === 'lookup_result') openSidebar(msg.result);
  if (msg.type === 'lookup_error')  updateSidebarError(_cssaLastWord);
});

// ── Util ──────────────────────────────────────────────────

function esc(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
