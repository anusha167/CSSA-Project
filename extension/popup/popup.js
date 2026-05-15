document.addEventListener('DOMContentLoaded', () => {
  const wordList = document.getElementById('wordList');
  const wordCount = document.getElementById('wordCount');
  const searchInput = document.getElementById('searchInput');
  const clearBtn = document.getElementById('clearBtn');

  let allWords = [];

  function render(words) {
    wordCount.textContent = allWords.length;

    if (words.length === 0) {
      wordList.innerHTML = `
        <div class="p-empty">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#C4B8DC" stroke-width="1.5">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <p>${allWords.length === 0
            ? 'No words saved yet.<br>Hover over slang to get started!'
            : 'No matches found.'
          }</p>
        </div>`;
      return;
    }

    wordList.innerHTML = words.map((item, idx) => `
      <div class="p-word-card" data-word="${esc(item.word)}" data-real-idx="${item._idx}">
        <div class="p-word-card-left">
          <div class="p-word-name">${esc(item.word)}</div>
          <div class="p-word-snippet">${esc(snippet(item.definition))}</div>
        </div>
        <span class="p-word-pos">${esc(item.pos || '')}</span>
        <button class="p-word-remove" data-real-idx="${item._idx}" title="Remove">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    `).join('');

    // Click card → open sidebar on active tab
    wordList.querySelectorAll('.p-word-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.p-word-remove')) return;
        const word = card.dataset.word;
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { action: 'openSidebar', word });
            window.close();
          }
        });
      });
    });

    // Remove buttons
    wordList.querySelectorAll('.p-word-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const realIdx = parseInt(btn.dataset.realIdx);
        chrome.storage.local.get(['backlog'], (result) => {
          const backlog = result.backlog || [];
          backlog.splice(realIdx, 1);
          chrome.storage.local.set({ backlog }, loadBacklog);
        });
      });
    });
  }

  function loadBacklog() {
    chrome.storage.local.get(['backlog'], (result) => {
      allWords = (result.backlog || []).map((w, i) => ({ ...w, _idx: i }));
      const q = searchInput.value.trim().toLowerCase();
      const filtered = q ? allWords.filter(w => w.word.toLowerCase().includes(q)) : allWords;
      render(filtered);
    });
  }

  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim().toLowerCase();
    const filtered = q ? allWords.filter(w => w.word.toLowerCase().includes(q)) : allWords;
    render(filtered);
  });

  clearBtn.addEventListener('click', () => {
    if (allWords.length === 0) return;
    clearBtn.textContent = 'Are you sure?';
    clearBtn.style.borderColor = '#C85A5A';
    clearBtn.style.color = '#C85A5A';
    clearBtn.addEventListener('click', () => {
      chrome.storage.local.set({ backlog: [] }, loadBacklog);
    }, { once: true });
    setTimeout(() => {
      clearBtn.textContent = 'Clear all';
      clearBtn.style.borderColor = '';
      clearBtn.style.color = '';
    }, 2500);
  });

  function snippet(def) {
    if (!def) return '';
    return def.length > 52 ? def.slice(0, 52) + '…' : def;
  }

  function esc(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  loadBacklog();
});
