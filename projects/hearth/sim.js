// Two simulations for the Hearth page, following the rules of the real (private) Python with invented data.
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);

  // answer: 'ok' (yes), 'no' or 'info' (a note). tone: how it bears on the outcome, 'good', 'bad' or 'plain'.
  function line(list, answer, text, more, tone) {
    const li = document.createElement('li');
    const m = document.createElement('span');
    const colour = tone || (answer === 'info' ? 'info' : 'plain');
    m.className = colour === 'good' ? 'mark-ok' : colour === 'bad' ? 'mark-no' : colour === 'info' ? 'mark-info' : 'mark-plain';
    m.textContent = answer === 'ok' ? 'yes' : answer === 'no' ? 'no' : 'note';
    const t = document.createElement('span');
    t.textContent = text;
    if (more) { const s = document.createElement('small'); s.textContent = more; t.append(s); }
    li.append(m, t);
    list.append(li);
  }
  function say(el, kind, text, more) {
    el.className = `verdict ${kind}`;
    el.textContent = text;
    if (more) { const s = document.createElement('small'); s.textContent = more; el.append(s); }
  }

  /* ------------------------------------------------------------------------------------------------------------
     Who gets the graphics card.
     Right before a request goes to the model server, Hearth asks the model stack next door for its state and
     decides: the card, the processor, or wait. (Hearth's cardshare.place and the stack's card_share.)
     ------------------------------------------------------------------------------------------------------------ */
  const card = { job: $('#c-job'), state: $('#c-state'), room: $('#c-room'), roomOut: $('#c-room-out'), roomHint: $('#c-room-hint'),
    held: $('#c-held'), ram: $('#c-ram'), game: $('#c-game'), bar: $('#c-bar'), verdict: $('#c-verdict'), trace: $('#c-trace') };

  if (card.job) {
    const TOTAL = 24;            // GB on the card
    const WINDOWS = 3.5;         // what the desktop itself keeps there
    const HELD = 16.5;           // Hearth's own model, when it is still loaded
    const JOBS = {
      describe: { need: 18, waitsForGames: true, what: 'The sentence' },
      ask: { need: 20.8, waitsForGames: false, what: 'The answer' },
    };
    const WHY = {
      busy: 'the model stack is busy with a job',
      settling: 'the model stack is loading its models again',
      awake: 'the model stack keeps the card nearly full for itself',
    };

    // The stack's own answer: {state, wait, room}. It says "wait" while a job, a wake or a reload has the card.
    function stackSays(state, roomGb) {
      if (state === 'off') return null;
      const wait = state === 'busy' || state === 'settling';
      return { state, wait, room: wait ? 0 : roomGb };
    }

    // cardshare._place, a branch at a time. Each step is noted so the page can show it.
    function place(job, stack, opts, note) {
      if (opts.game) {
        note('ok', 'A game is running');
        return job.waitsForGames ? ['wait', 'a game is running'] : ['gpu', 'a game is running, and this one answers anyway and lets go at once'];
      }
      note('no', 'A game is running');
      if (!stack) {
        note('no', 'The model stack is running', 'Then the card is Hearth\'s, as always.');
        return ['gpu', ''];
      }
      note('ok', 'The model stack is running', 'Hearth asks it now, never from a remembered answer: a model loads the moment a request arrives.');
      let room = 0;
      if (!stack.wait) {
        note('no', 'It says to keep off the card');
        room = stack.room;
        if (stack.state === 'asleep') {
          note('ok', 'It is asleep', 'Asleep, it has nothing on the card and clears the card itself before it wakes.');
          return ['gpu', ''];
        }
        note('no', 'It is asleep');
        if (room < job.need && opts.held) {
          room += HELD;
          note('info', `What Hearth already holds on the card counts as room: ${room.toFixed(1)} GB`);
        }
        if (room >= job.need) {
          note('ok', `There is room for ${job.need} GB`, `${room.toFixed(1)} GB to use`);
          return ['gpu', ''];
        }
        note('no', `There is room for ${job.need} GB`, `${room.toFixed(1)} GB to use`);
      } else {
        note('ok', 'It says to keep off the card', WHY[stack.state]);
      }
      const why = WHY[stack.state] || WHY.awake;
      if (!opts.ram) {
        note('no', 'The PC\'s memory has room for a copy on the processor', 'A model on the processor must leave 6 GB of memory free.');
        return ['wait', `${why}, and the PC's memory is too full to answer on the processor`];
      }
      note('ok', 'The PC\'s memory has room for a copy on the processor');
      return ['cpu', why];
    }

    function run() {
      const job = JOBS[card.job.querySelector('input:checked').value];
      const state = card.state.querySelector('input:checked').value;
      const room = Number(card.room.value);
      const awake = state === 'awake';
      card.room.disabled = !awake;
      card.roomOut.textContent = `${room} GB`;
      card.roomHint.textContent = awake ? 'What is free on the card after its own models and a safety margin.' : 'Only counts while it is awake and idle.';
      const opts = { held: card.held.checked, ram: card.ram.checked, game: card.game.checked };
      card.trace.replaceChildren();
      const [where, why] = place(job, stackSays(state, room), opts, (mark, text, more) => line(card.trace, mark, text, more));

      if (where === 'gpu') say(card.verdict, 'ok', `${job.what} is made on the graphics card`, why ? `Even though ${why}.` : 'The quick path.');
      else if (where === 'cpu') say(card.verdict, 'wait', `${job.what} is made on the processor`, `Because ${why}. Slower, and nobody is in anybody's way. A second model server with the card hidden from it does the work.`);
      else say(card.verdict, 'no', `${job.what} waits`, `Because ${why}. Nothing leaves the queue, and Hearth looks again in 20 seconds.`);

      // The bar is a picture of the decision, not a measurement.
      const gameGb = opts.game ? 10 : 0;
      const stackGb = opts.game || state === 'off' || state === 'asleep' ? 0 : state === 'awake' ? Math.max(0, TOTAL - WINDOWS - 1 - room) : state === 'busy' ? 19.5 : 16;
      const left = Math.max(0, TOTAL - WINDOWS - gameGb - stackGb);
      const hearthGb = where === 'gpu' ? Math.min(job.need, left) : (opts.held && !opts.game ? Math.min(HELD, left) : 0);
      const [pc, game, stack, hearth] = card.bar.children;
      pc.style.flexBasis = `${(WINDOWS / TOTAL) * 100}%`;
      game.style.flexBasis = `${(gameGb / TOTAL) * 100}%`;
      stack.style.flexBasis = `${(stackGb / TOTAL) * 100}%`;
      hearth.style.flexBasis = `${(hearthGb / TOTAL) * 100}%`;
      card.bar.setAttribute('aria-label', `The 24 GB graphics card, roughly: Windows ${WINDOWS} GB, ${opts.game ? `a game ${gameGb} GB, ` : ''}model stack ${stackGb.toFixed(1)} GB, Hearth ${hearthGb.toFixed(1)} GB`);
    }

    [card.job, card.state, card.room, card.held, card.ram, card.game].forEach((el) => el.addEventListener('input', run));
    run();
  }

  /* ------------------------------------------------------------------------------------------------------------
     What a guest link opens.
     Every guest has lights, speakers and the light bridge's own scenes. A link can add extras. Some things are
     never a guest's, whatever the link says. (Hearth's guests.may_act, shown, out_of_reach, extra_may, admin_may.)
     ------------------------------------------------------------------------------------------------------------ */
  const guest = { level: $('#u-level'), extras: $('#u-extras'), pick: $('#u-try'), verdict: $('#u-verdict'), trace: $('#u-trace') };

  if (guest.pick) {
    const GUEST_DOMAINS = ['light', 'media_player', 'scene'];
    const EXTRA_DOMAINS = { cameras: ['camera'], remote: ['remote'], devices: ['switch', 'fan', 'humidifier', 'vacuum', 'climate'] };
    const WATCH_ONLY = ['camera'];
    const LIGHT_SCENES = ['hue'];
    const GUEST_ACTIONS = {
      light: ['turn_on', 'turn_off', 'toggle', 'set_brightness', 'set_color', 'set_color_temp', 'set_effect'],
      scene: ['activate'],
      media_player: ['turn_on', 'turn_off', 'play', 'pause', 'play_pause', 'stop', 'next', 'previous', 'set_volume', 'volume_up',
        'volume_down', 'mute', 'unmute', 'play_favorite', 'set_night_mode', 'set_speech_enhancement', 'switch_to_tv', 'join', 'unjoin', 'group_all'],
    };
    const REMOTE_PAIRING = ['/pair', '/pair/finish', '/unpair', '/sound/pair', '/sound/pair/finish'];
    const KIND = { light: 'lights', media_player: 'speakers', scene: 'scenes', lock: 'locks', switch: 'plugs and switches', vacuum: 'robot vacuums' };

    const TRIES = [
      { label: 'Turn a light on', domain: 'light', action: 'turn_on', from: 'hue' },
      { label: 'Change a light\'s colour', domain: 'light', action: 'set_color', from: 'hue' },
      { label: 'Pause a speaker', domain: 'media_player', action: 'pause', from: 'sonos' },
      { label: 'Talk through a speaker', domain: 'media_player', action: 'announce', from: 'sonos' },
      { label: 'Run a lighting scene from the light bridge', domain: 'scene', action: 'activate', from: 'hue' },
      { label: 'Run a scene from another system', domain: 'scene', action: 'activate', from: 'homeassistant' },
      { label: 'Unlock the front door', domain: 'lock', action: 'unlock', from: 'homeassistant' },
      { label: 'Turn a smart plug on', domain: 'switch', action: 'turn_on', from: 'vesync', actions: ['turn_on', 'turn_off'] },
      { label: 'Press a button-pusher', domain: 'switch', action: 'press', from: 'switchbot', actions: ['press'] },
      { label: 'Start the robot vacuum', domain: 'vacuum', action: 'start', from: 'roomba' },
      { label: 'Watch a camera live', method: 'GET', path: '/api/cams/front-door/live' },
      { label: 'Delete a camera clip', method: 'DELETE', path: '/api/cams/events/1042' },
      { label: 'Press a key on the TV remote', method: 'POST', path: '/api/googletv/living-room/key' },
      { label: 'Pair the remote with a TV', method: 'POST', path: '/api/googletv/living-room/pair' },
      { label: 'Ask the assistant a question', method: 'POST', path: '/api/assistant/chat' },
      { label: 'Pair a new device with the hub', method: 'POST', path: '/api/pairing' },
    ];
    TRIES.forEach((t, i) => { const o = document.createElement('option'); o.value = String(i); o.textContent = t.label; guest.pick.append(o); });

    const domainsFor = (extras) => GUEST_DOMAINS.concat(...extras.map((e) => EXTRA_DOMAINS[e] || []));
    const pressing = (t) => t.domain === 'switch' && (t.from === 'homeassistant' || (t.actions || []).includes('press'));
    const outOfReach = (t) => pressing(t) || (t.domain === 'scene' && !LIGHT_SCENES.includes(t.from));

    function extraMay(method, path, extras) {
      const reading = method === 'GET' || method === 'HEAD';
      if (extras.includes('ask') && ((reading && path === '/api/assistant') || (method === 'POST' && ['/api/assistant/chat', '/api/assistant/reset'].includes(path)))) return true;
      if (extras.includes('cameras') && reading && (path === '/api/cams' || path.startsWith('/api/cams/'))) return true;
      if (extras.includes('remote') && ['GET', 'HEAD', 'POST'].includes(method) && (path.startsWith('/api/googletv') || path.startsWith('/api/appletv'))) {
        return !REMOTE_PAIRING.some((end) => path.endsWith(end)) && path !== '/api/appletv/link';
      }
      return false;
    }
    function adminMay(method, path) {
      if (path === '/pair' || path.startsWith('/pair/') || ['/api/pairing', '/api/pair', '/api/remote/https'].includes(path)) return false;
      if (path.startsWith('/api/tokens')) return false;
      if (path.startsWith('/api/integrations/') && !['GET', 'HEAD'].includes(method) && !path.endsWith('/reload')) return false;
      if (path.startsWith('/api/nest/')) return false;
      if (path.startsWith('/api/googletv/') && ['/pair', '/pair/finish', '/unpair'].some((end) => path.endsWith(end))) return false;
      if (['/api/appletv/pair', '/api/appletv/pair/finish', '/api/appletv/link'].includes(path)) return false;
      return true;
    }

    function run() {
      const admin = guest.level.querySelector('input:checked').value === 'admin';
      const boxes = Array.from(guest.extras.querySelectorAll('input'));
      boxes.forEach((b) => { b.disabled = admin; });
      const extras = admin ? [] : boxes.filter((b) => b.checked).map((b) => b.value);
      const t = TRIES[Number(guest.pick.value)];
      guest.trace.replaceChildren();
      const note = (mark, text, more, tone) => line(guest.trace, mark, text, more, tone || (mark === 'ok' ? 'good' : mark === 'no' ? 'bad' : 'info'));

      if (t.path) {
        note('info', `${t.method} ${t.path}`);
        if (admin) {
          const ok = adminMay(t.method, t.path);
          note(ok ? 'no' : 'ok', 'It is pairing, remote access or a stored key', ok ? undefined : 'Those happen at the PC, never through a link.', ok ? 'good' : 'bad');
          return ok ? say(guest.verdict, 'ok', 'Allowed', 'An admin guest uses the dashboard as I do, short of pairing, remote access and keys.')
            : say(guest.verdict, 'no', 'Refused: 403', 'Even an admin guest cannot pair devices.');
        }
        const ok = extraMay(t.method, t.path, extras);
        if (ok) { note('ok', 'One of the link\'s extras opens this request'); return say(guest.verdict, 'ok', 'Allowed'); }
        const pairing = REMOTE_PAIRING.some((end) => t.path.endsWith(end)) || t.path === '/api/pairing';
        const writing = t.path.startsWith('/api/cams') && t.method !== 'GET';
        note('no', 'One of the link\'s extras opens this request',
          pairing ? 'Extras are for using things, never for setting them up.'
            : writing ? 'The cameras extra is for watching: every request it opens is a read.'
              : 'Tick the matching extra on the left to open it.');
        return say(guest.verdict, 'no', 'Refused: 403');
      }

      note('info', `${t.action} on a ${t.domain} from ${t.from}`);
      if (admin) {
        note('info', 'Admin guests are not held to the guest list of devices');
        return say(guest.verdict, 'ok', 'Allowed', 'An admin guest uses the dashboard as I do, short of pairing, remote access and keys.');
      }
      const seen = domainsFor(extras).includes(t.domain);
      note(seen ? 'ok' : 'no', `The link includes ${KIND[t.domain] || t.domain}`,
        seen ? undefined : (EXTRA_DOMAINS.devices.includes(t.domain) ? 'The "More devices" extra adds them.' : 'No link adds these. Locks, alarms, doors and sensors are never a guest\'s.'));
      if (!seen) return say(guest.verdict, 'no', 'Refused: 403');
      if (outOfReach(t)) {
        note('no', 'It is safe to hand over', pressing(t)
          ? 'A switch that presses a real button could be wired to a garage door. Never a guest\'s, whatever the link opens.'
          : 'Only the light bridge\'s own scenes, which can only set lights. A scene from another system could do anything.');
        return say(guest.verdict, 'no', 'Refused: 403');
      }
      note('ok', 'It is safe to hand over');
      if (WATCH_ONLY.includes(t.domain)) { note('no', 'It can be changed, not only looked at'); return say(guest.verdict, 'no', 'Refused: 403'); }
      if (GUEST_ACTIONS[t.domain]) {
        const ok = GUEST_ACTIONS[t.domain].includes(t.action);
        note(ok ? 'ok' : 'no', `"${t.action}" is on the list for ${KIND[t.domain]}`,
          ok ? undefined : 'Speakers play, pause, group and change volume for a guest. They do not speak for one, or play an address a guest hands them.');
        return ok ? say(guest.verdict, 'ok', 'Allowed') : say(guest.verdict, 'no', 'Refused: 403');
      }
      note('ok', 'A kind the link added, used in its own ways');
      return say(guest.verdict, 'ok', 'Allowed');
    }

    guest.level.addEventListener('change', run);
    guest.extras.addEventListener('change', run);
    guest.pick.addEventListener('change', run);
    run();
  }
})();
