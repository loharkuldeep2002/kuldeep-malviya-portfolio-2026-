/* Help visitors who open index.html directly instead of starting the server. */
(() => {
  if (location.protocol !== 'file:') return;
  const origin = 'http://127.0.0.1:3000';
  document.querySelectorAll('a[href^="/"]').forEach(link => {
    link.href = origin + link.getAttribute('href');
  });
  const notice = document.createElement('aside');
  notice.setAttribute('role', 'note');
  notice.className = 'local-preview-notice';
  notice.append(document.createTextNode('Local preview · Full website ke liye folder mein start_preview.bat open karein. '));
  const link = document.createElement('a');
  link.href = origin;
  link.textContent = 'Open running website ↗';
  notice.append(link);
  document.body.append(notice);
})();
