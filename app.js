// Boot sequence: plays once per visit, skips on any key, click, or scroll,
// and never runs when the visitor prefers reduced motion.
(function () {
  var root = document.documentElement;
  var boot = document.getElementById('boot');
  if (!boot) return;
  var lines = boot.textContent.split('\n');

  if (!root.classList.contains('booting')) return;

  var done = false;
  function finish() {
    if (done) return;
    done = true;
    boot.textContent = lines.join('\n');
    root.classList.remove('booting');
    root.classList.add('glitch');
    setTimeout(function () { root.classList.remove('glitch'); }, 700);
    try { sessionStorage.setItem('booted', '1'); } catch (e) {}
  }

  boot.textContent = '';
  var i = 0;
  (function next() {
    if (done) return;
    if (i < lines.length) {
      boot.textContent += (i ? '\n' : '') + lines[i++];
      setTimeout(next, 260);
    } else {
      setTimeout(finish, 220);
    }
  })();

  ['keydown', 'pointerdown', 'wheel', 'touchstart'].forEach(function (type) {
    window.addEventListener(type, finish, { once: true, passive: true });
  });
})();
