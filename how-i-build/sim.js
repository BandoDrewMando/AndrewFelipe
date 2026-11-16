// Does a night shift start? The same questions, in the same order, as Ando's night.ready().
(() => {
  'use strict';
  const $ = (sel) => document.querySelector(sel);
  const hour = $('#s-hour');
  if (!hour) return;
  const out = $('#s-hour-out'), verdict = $('#s-verdict'), trace = $('#s-trace');
  const box = (id) => $(`#s-${id}`).checked;
  const clock = (h) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'AM' : 'PM'}`;

  function line(mark, text, more) {
    const li = document.createElement('li');
    const m = document.createElement('span');
    m.className = `mark-${mark}`;
    m.textContent = mark === 'ok' ? 'fine' : mark === 'no' ? 'stop' : 'skip';
    const t = document.createElement('span');
    t.textContent = text;
    if (more) { const s = document.createElement('small'); s.textContent = more; t.append(s); }
    li.append(m, t);
    trace.append(li);
  }

  function run() {
    const h = Number(hour.value);
    out.textContent = clock(h);
    const byHand = box('hand');
    // [the question, is it fine?, why not (Ando's own words), only asked when it starts by itself]
    const asks = [
      ['No night shift is running already', !box('current'), 'A night shift is on now'],
      ['Night shifts are switched on', box('on') || byHand, 'Night shifts are off'],
      ['Claude is not paused', !box('paused'), 'Claude\'s paused'],
      ['A passkey exists', box('passkey'), 'Waiting for Face ID: set it up on your phone first'],
      ['The plan is one I said yes to', box('plan'), 'Waiting for a plan you\'ve said yes to'],
      ['No game is on', !box('game'), 'A game\'s on'],
      ['It is between 1 and 7 in the morning', h >= 1 && h < 7, 'Ready for tonight: it starts after 1 AM, once your PC\'s been quiet for half an hour', true],
      ['It has not worked tonight already', !box('worked'), 'Already worked tonight', true],
      ['The PC has been quiet for half an hour', box('quiet'), 'Waiting until your PC\'s been quiet for half an hour', true],
      ['I have been away from my apps for half an hour', box('away'), 'Waiting until you\'ve been away from your apps for half an hour', true],
      ['The sandbox is installed', box('sandbox'), 'The sandbox isn\'t set up on this PC'],
    ];
    trace.replaceChildren();
    let stopped = null;
    for (const [text, fine, why, onlyByItself] of asks) {
      if (stopped) break;
      if (onlyByItself && byHand) { line('info', text, 'Not asked when I start one by hand.'); continue; }
      line(fine ? 'ok' : 'no', text);
      if (!fine) stopped = why;
    }
    if (stopped) {
      verdict.className = 'verdict wait';
      verdict.textContent = 'Not now';
      const s = document.createElement('small'); s.textContent = stopped; verdict.append(s);
    } else {
      verdict.className = 'verdict ok';
      verdict.textContent = 'A night shift starts';
      const s = document.createElement('small');
      s.textContent = 'First every wall of the sandbox is checked. If one is down, nothing runs.';
      verdict.append(s);
    }
  }

  document.querySelectorAll('#night input').forEach((el) => el.addEventListener('input', run));
  run();
})();
