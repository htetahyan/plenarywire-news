/* Theme toggle: the only script on the site. Runs in <head> before first paint so the saved theme never causes a flash or layout shift. */
(function () {
  var d = document.documentElement;
  try { var t = localStorage.getItem('theme'); if (t === 'light' || t === 'dark') d.setAttribute('data-theme', t); } catch (e) {}
  d.setAttribute('data-js', '');
  function current() { return d.getAttribute('data-theme') || (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); }
  document.addEventListener('DOMContentLoaded', function () {
    var b = document.querySelector('[data-theme-toggle]');
    if (!b) return;
    function sync() { var dark = current() === 'dark'; b.setAttribute('aria-pressed', String(dark)); b.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme'); }
    sync();
    b.addEventListener('click', function () { var n = current() === 'dark' ? 'light' : 'dark'; d.setAttribute('data-theme', n); try { localStorage.setItem('theme', n); } catch (e) {} sync(); });
  });
})();
