var input  = document.getElementById('key-input');
var status = document.getElementById('status');

chrome.storage.local.get(['geminiKey'], function (r) {
  if (r.geminiKey) input.value = r.geminiKey;
});

document.getElementById('save-btn').onclick = function () {
  var key = input.value.trim();
  if (!key) { showStatus('Please enter a key.', false); return; }
  chrome.storage.local.set({ geminiKey: key }, function () {
    showStatus('Key saved! Start selecting text on any page.', true);
  });
};

document.getElementById('clear-btn').onclick = function () {
  chrome.storage.local.remove('geminiKey', function () {
    input.value = '';
    showStatus('Key removed.', true);
  });
};

function showStatus(msg, ok) {
  status.textContent = msg;
  status.className = 'status ' + (ok ? 'ok' : 'err');
}
