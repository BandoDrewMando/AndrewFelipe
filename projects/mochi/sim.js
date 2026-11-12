// The Mochi page: the island through a day (real captures), and the name-tag routine as a small simulation.
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);

  /* ---- The island by the clock: five captures of the real page, cross-faded by a dial ---- */
  const frames = $('#day-frames');
  const dial = $('#day-dial');
  const out = $('#day-out');
  if (frames && dial) {
    // In dial order: dawn, noon, golden hour, dusk, night. (The markup starts on noon, so it shows without script.)
    const STOPS = [
      ['island-0637', '6:37 AM, just after sunrise'],
      ['island-1231', '12:31 PM, midday'],
      ['island-1807', '6:07 PM, golden hour'],
      ['island-1925', '7:25 PM, dusk'],
      ['island-2131', '9:31 PM, night'],
    ];
    const images = Array.from(frames.querySelectorAll('img'));
    const byName = (name) => images.find((img) => (img.getAttribute('src') || '').includes(name));
    const show = () => {
      const [name, words] = STOPS[Number(dial.value)];
      const target = byName(name);
      target.loading = 'eager';                       // (asked for by hand: fetch it now if it hasn't been)
      const flip = () => images.forEach((img) => img.classList.toggle('on', img === target));
      if (target.complete && target.naturalWidth) flip();
      else target.addEventListener('load', flip, { once: true });
      out.textContent = words;
    };
    dial.addEventListener('input', show);
  }

  /* ---- Names over heads ----
     The routine from the island's people.js, on plain elements: nearest first; a name that would cover one already
     placed moves up to sit just above it; repeat until nothing moves. Sizes are measured once, never in the loop. */
  const plaza = $('#plaza');
  if (plaza) {
    const stackBox = $('#n-stack');
    const count = $('#n-count');
    const NAMES = ['Aiko', 'Ren', 'Mia', 'Kai', 'Nora', 'Rosa', 'Marcus'];
    const TINTS = ['#FF3FA4', '#45F3FF', '#FFB547', '#6BF5A8', '#B79CFF', '#FF6B7F', '#7FB2FF'];
    const HEAD = 21;       // from a resident's middle up to where their name sits
    const people = NAMES.map((name, i) => {
      const dot = document.createElement('div');
      dot.className = 'dot';
      dot.tabIndex = 0;
      dot.setAttribute('role', 'button');
      dot.setAttribute('aria-label', `${name}. Drag, or use the arrow keys.`);
      dot.style.background = TINTS[i];
      const stem = document.createElement('div');
      stem.className = 'stem';
      const tag = document.createElement('div');
      tag.className = 'tag';
      tag.textContent = name;
      plaza.append(stem, dot, tag);
      return { name, dot, stem, tag, x: 0, y: 0, tagY: 0, w: 0, h: 0 };
    });
    const measure = () => people.forEach((p) => { p.w = p.tag.offsetWidth; p.h = p.tag.offsetHeight; });   // once, not per frame

    const size = () => ({ w: plaza.clientWidth, h: plaza.clientHeight });
    const clamp = (p) => { const s = size(); p.x = Math.max(16, Math.min(s.w - 16, p.x)); p.y = Math.max(70, Math.min(s.h - 18, p.y)); };

    function unstack(shown) {
      shown.sort((a, b) => b.y - a.y);                    // nearest the camera first (lower on the screen)
      for (let i = 0; i < shown.length; i++) {
        const f = shown[i];
        for (let tries = 0; tries < shown.length; tries++) {
          let moved = false;
          for (let j = 0; j < i; j++) {
            const o = shown[j];
            if (Math.abs(f.x - o.x) < (f.w + o.w) / 2 + 2 && Math.abs(f.tagY - o.tagY) < (f.h + o.h) / 2 + 2) {
              f.tagY = o.tagY - (f.h + o.h) / 2 - 2;
              moved = true;
            }
          }
          if (!moved) break;
        }
      }
    }

    function draw() {
      people.forEach((p) => { p.tagY = p.y - HEAD - p.h / 2; });
      if (stackBox.checked) unstack(people.slice());
      let covered = 0;
      people.forEach((p) => {
        const hit = people.some((o) => o !== p && Math.abs(p.x - o.x) < (p.w + o.w) / 2 - 1 && Math.abs(p.tagY - o.tagY) < (p.h + o.h) / 2 - 1);
        if (hit) covered++;
        p.tag.classList.toggle('hit', hit);
        p.dot.style.transform = `translate(${p.x}px, ${p.y}px)`;
        p.dot.style.zIndex = String(Math.round(p.y));
        p.tag.style.transform = `translate(${(p.x - p.w / 2).toFixed(1)}px, ${(p.tagY - p.h / 2).toFixed(1)}px)`;
        p.tag.style.zIndex = String(1000 + Math.round(p.y));
        const top = p.tagY + p.h / 2, len = Math.max(0, p.y - 15 - top);
        p.stem.style.transform = `translate(${p.x - 1}px, ${top}px)`;
        p.stem.style.height = `${len}px`;
      });
      count.textContent = covered ? `${covered} of ${people.length} names are covering another` : `All ${people.length} names can be read`;
      count.style.color = covered ? 'var(--no)' : 'var(--ok)';
    }

    function gather() {
      const s = size();
      const spots = [[0, 0], [-26, -14], [30, -10], [-8, -30], [16, 18], [-34, 14], [44, 12]];
      people.forEach((p, i) => { p.x = s.w / 2 + spots[i][0]; p.y = s.h * 0.66 + spots[i][1]; clamp(p); });
      draw();
    }
    function scatter() {
      const s = size();
      people.forEach((p, i) => { p.x = ((i + 0.5) / people.length) * s.w; p.y = s.h * (0.5 + 0.34 * Math.sin(i * 2.4)); clamp(p); });
      draw();
    }

    // Dragging: the dot's left/top stay 0, and its transform carries where it is.
    people.forEach((p) => {
      p.dot.style.left = '0'; p.dot.style.top = '0';
      let grab = null;
      p.dot.addEventListener('pointerdown', (e) => { grab = { dx: e.clientX - p.x, dy: e.clientY - p.y }; p.dot.setPointerCapture(e.pointerId); e.preventDefault(); });
      p.dot.addEventListener('pointermove', (e) => { if (!grab) return; p.x = e.clientX - grab.dx; p.y = e.clientY - grab.dy; clamp(p); draw(); });
      const drop = () => { grab = null; };
      p.dot.addEventListener('pointerup', drop);
      p.dot.addEventListener('pointercancel', drop);
      p.dot.addEventListener('keydown', (e) => {
        const step = e.shiftKey ? 24 : 8;
        const move = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
        if (!move) return;
        e.preventDefault();
        p.x += move[0]; p.y += move[1]; clamp(p); draw();
      });
    });

    stackBox.addEventListener('change', draw);
    $('#n-gather').addEventListener('click', gather);
    $('#n-scatter').addEventListener('click', scatter);
    addEventListener('resize', () => { people.forEach(clamp); draw(); }, { passive: true });

    const begin = () => { measure(); gather(); };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(begin); else begin();
  }
})();
