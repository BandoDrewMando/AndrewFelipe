// Shared by every page.

// Boot sequence (home page only): plays once per visit, skips on any key, click, or scroll,
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

// The header marks the section you're reading.
(function () {
  if (!('IntersectionObserver' in window)) return;
  var links = {};
  Array.prototype.forEach.call(document.querySelectorAll('.nav ul a[href^="#"]'), function (a) {
    links[a.getAttribute('href').slice(1)] = a;
  });
  var ids = Object.keys(links);
  if (!ids.length) return;
  var seen = {};
  function mark() {
    var current = null;
    ids.forEach(function (id) { if (seen[id]) current = current || id; });
    ids.forEach(function (id) {
      if (id === current) links[id].setAttribute('aria-current', 'true');
      else links[id].removeAttribute('aria-current');
    });
  }
  var watch = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { seen[e.target.id] = e.isIntersecting; });
    mark();
  }, { rootMargin: '-45% 0px -50% 0px' });
  ids.forEach(function (id) {
    var el = document.getElementById(id);
    if (el) watch.observe(el);
  });
})();
