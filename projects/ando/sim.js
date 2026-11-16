// Two simulations for the Ando page. Both follow the rules of the real (private) Python, with invented data.
// Nothing here talks to a server: the "gate" and the "door" below are functions on this page.
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const enc = new TextEncoder();
  const hex = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
  const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const sha256 = async (bytes) => new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const short = (h) => h.slice(0, 12);
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const beat = (ms = 170) => (calm ? Promise.resolve() : new Promise((done) => setTimeout(done, ms)));

  function concat(...parts) {
    const all = parts.map((p) => (p instanceof Uint8Array ? p : new Uint8Array(p)));
    const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
    let at = 0;
    for (const p of all) { out.set(p, at); at += p.length; }
    return out;
  }
  const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

  function line(list, mark, text, more) {
    const li = document.createElement('li');
    const m = document.createElement('span');
    m.className = `mark-${mark}`;
    m.textContent = mark === 'ok' ? 'pass' : mark === 'no' ? 'refuse' : 'note';
    const t = document.createElement('span');
    t.textContent = text;
    if (more) { const s = document.createElement('small'); s.textContent = more; t.append(s); }
    li.append(m, t);
    list.append(li);
    return li;
  }
  function say(el, kind, text, more) {
    el.className = `verdict ${kind}`;
    el.textContent = text;
    if (more) { const s = document.createElement('small'); s.textContent = more; el.append(s); }
  }

  /* ------------------------------------------------------------------------------------------------------------
     The approval gate.
     A yes is bound to exactly what was shown:
       content hash = SHA-256 of the proposal as canonical JSON (keys sorted, no spaces)
       challenge    = SHA-256("ando-claude-v1" 00 <32 random bytes> 00 "approve:<id>:<content hash>")
     and the passkey's signature covers that challenge. The checks then run in the order the real verifier runs them.
     ------------------------------------------------------------------------------------------------------------ */
  const TAG = enc.encode('ando-claude-v1');
  const SITE = 'ando.example';
  const ORIGIN = `https://${SITE}`;
  const FIRST = {
    id: 'sunset-lights', app: 'hearth', kind: 'feature',
    title: 'The porch light fades on at sunset',
    why: 'You asked for the porch to glow when it gets dark, without you thinking about it.',
    what: ['A sunset routine for the porch light', 'It fades on over ten minutes'],
    files: ['hearth/automations/sunset.py', 'frontend/home/Buttons.js'],
    branch: 'claude/sunset-lights',
    commit: '4f1c9a2e7b3d5068a1c2e3f4a5b6c7d8e9f00112',
  };
  // The same words on the screen, a different commit underneath, and one more file: the gate's own.
  const SWAPPED = { ...FIRST, files: [...FIRST.files, 'ando/passkey.py'], commit: '9d0e1f2a3b4c5d6e7f8091a2b3c4d5e6f7089abc' };

  // Python: json.dumps(fields, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
  const canonical = (p) => JSON.stringify({
    app: p.app, branch: p.branch || '', commit: p.commit || '', files: p.files, id: p.id, kind: p.kind,
    plan: '', preview: '', title: p.title, v: 1, what: p.what, why: p.why,
  });
  const contentHash = async (p) => hex(await sha256(enc.encode(canonical(p))));
  const challengeFor = (nonce, action) => sha256(concat(TAG, [0], nonce, [0], enc.encode(action)));

  // What the Python gives for the same proposal and for the nonce 00 01 02 ... 1f (checked when this page is tested).
  const KNOWN = {
    hash: '2021504bdbd65f60144efe2125d987d7bc8c2a8c1f0bd22e49785bd70533c2da',
    challenge: 'a4ec1a22753ce6a12ab14d06c18d77a3f6f4b42dabbfacd57e2db78ef4eb7782',
  };
  window.andoSelfTest = async () => {
    const h = await contentHash(FIRST);
    const c = hex(await challengeFor(Uint8Array.from({ length: 32 }, (_, i) => i), `approve:${FIRST.id}:${h}`));
    return { hash: h === KNOWN.hash, challenge: c === KNOWN.challenge };
  };

  const gate = { ticket: $('#g-ticket'), hash: $('#g-hash'), note: $('#g-note'), trace: $('#g-trace'), verdict: $('#g-verdict'),
    approve: $('#g-approve'), swap: $('#g-swap'), reset: $('#g-reset'),
    origin: $('#g-origin'), nouv: $('#g-nouv'), replay: $('#g-replay') };

  if (gate.ticket && window.crypto && crypto.subtle) {
    let passkey = null;        // made here, thrown away with the page
    let credential = null;
    let siteHash = null;
    let server = null;         // what is waiting on the "PC", and the challenges it has given out
    let shown = null;          // what the "phone" showed, and its hash
    let last = null;           // the last answer sent, for the replay
    let approved = false;
    let busy = false;

    function draw(p, changed = []) {
      const mark = (key, text) => (changed.includes(key) ? `<span class="changed">${text}</span>` : text);
      const safe = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
      gate.ticket.innerHTML = `<h4>${safe(p.title)}</h4><p>${safe(p.why)}</p>`
        + `<ul>${p.what.map((w) => `<li>${safe(w)}</li>`).join('')}</ul>`
        + `<p class="meta">${mark('files', `files: ${p.files.map(safe).join(', ')}`)}<br>branch: ${safe(p.branch)}<br>${mark('commit', `commit: ${safe(p.commit)}`)}</p>`;
    }

    async function open(p, changed) {
      shown = { proposal: p, hash: await contentHash(p) };
      draw(p, changed);
      gate.hash.textContent = shown.hash;
    }

    async function start() {
      server = { proposal: FIRST, issued: new Map() };
      last = null; approved = false;
      gate.origin.checked = gate.nouv.checked = gate.replay.checked = false;
      gate.swap.disabled = false;
      gate.trace.replaceChildren();
      line(gate.trace, 'info', 'Press Approve to run the checks.');
      gate.verdict.className = 'verdict'; gate.verdict.textContent = '';
      await open(FIRST);
      gate.note.textContent = 'A passkey was made in your browser for this demo. It never leaves the page.';
    }

    async function approve() {
      if (busy) return;
      busy = true; gate.approve.disabled = true;
      gate.trace.replaceChildren();
      gate.verdict.className = 'verdict'; gate.verdict.textContent = '';
      try {
        let answer;
        if (gate.replay.checked) {
          if (!last) {
            line(gate.trace, 'info', 'There is no earlier answer to send again.');
            say(gate.verdict, 'wait', 'Nothing to replay yet', 'Approve once first, then tick this box and press Approve again.');
            return;
          }
          line(gate.trace, 'info', 'The last answer is sent a second time, byte for byte.');
          answer = last;
        } else {
          if (approved) {
            line(gate.trace, 'info', 'This proposal already has its yes.');
            say(gate.verdict, 'wait', 'Already approved', 'Press Start over to run it again, or tick "Send the last answer again" to watch a replay get refused.');
            return;
          }
          // The page asks for a challenge, naming the version it showed.
          const waiting = await contentHash(server.proposal);
          await beat();
          if (waiting !== shown.hash) {
            line(gate.trace, 'no', 'Is the proposal still the version the phone showed?',
              `No. Shown ${short(shown.hash)}, waiting ${short(waiting)}. The gate answers 409 and gives no challenge.`);
            say(gate.verdict, 'no', 'Nothing was approved', 'The phone now shows the new version, with what changed marked. Read it, then decide.');
            const changed = ['files', 'commit'].filter((k) => JSON.stringify(server.proposal[k]) !== JSON.stringify(shown.proposal[k]));
            await open(server.proposal, changed);
            return;
          }
          line(gate.trace, 'ok', 'The proposal is still the version the phone showed', `content hash ${short(waiting)}`);
          const nonce = crypto.getRandomValues(new Uint8Array(32));
          const action = `approve:${shown.proposal.id}:${shown.hash}`;
          const challenge = await challengeFor(nonce, action);
          server.issued.set(hex(challenge), { action, used: false });
          await beat();
          line(gate.trace, 'ok', 'A fresh challenge, made for this one action',
            `SHA-256(tag, 32 random bytes, "approve:${shown.proposal.id}:${short(shown.hash)}") = ${short(hex(challenge))}`);
          // The phone: client data, authenticator data, and a signature over both.
          const clientData = enc.encode(JSON.stringify({ type: 'webauthn.get', challenge: b64url(challenge),
            origin: gate.origin.checked ? 'https://some-other-site.example' : ORIGIN, crossOrigin: false }));
          const flags = gate.nouv.checked ? 0x01 : 0x05;        // 0x01 someone is there, 0x04 they were verified
          const authData = concat(siteHash, [flags], [0, 0, 0, 0]);
          const signature = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, passkey.privateKey,
            concat(authData, await sha256(clientData))));
          await beat();
          line(gate.trace, 'info', gate.nouv.checked ? 'The phone signs without asking for Face ID' : 'Face ID, and the phone signs',
            'one signature over the authenticator data and the hash of the client data');
          answer = { id: credential, challenge, clientData, authData, signature };
          last = answer;
        }
        await check(answer);
      } finally {
        busy = false; gate.approve.disabled = false;
      }
    }

    // The checks, in the order the Python runs them. The first one that fails ends it.
    async function check(a) {
      const client = JSON.parse(new TextDecoder().decode(a.clientData));
      const checks = [
        ['The challenge is one the gate gave out, and nobody has answered it yet', async () => {
          const given = server.issued.get(hex(a.challenge));
          if (!given || given.used) return false;
          given.used = true;     // used up by its first answer, whatever the rest of the checks say
          return true;
        }, 'A challenge is used up by its first answer. A copy of a good answer is worth nothing.'],
        ['The passkey is one the gate knows', async () => same(a.id, credential)],
        ['It is an answer to a sign-in request', async () => client.type === 'webauthn.get'],
        ['It answers this exact challenge', async () => client.challenge === b64url(a.challenge)],
        ['It came from Ando\'s own address', async () => client.origin === ORIGIN,
          `The answer says it came from ${client.origin}. A real browser would not even offer the passkey there; the gate checks anyway.`],
        ['It was not made inside another site\'s frame', async () => client.crossOrigin === false && !('topOrigin' in client)],
        ['The authenticator data names this site', async () => same(a.authData.slice(0, 32), siteHash)],
        ['Someone was there', async () => (a.authData[32] & 0x01) !== 0],
        ['They were verified with Face ID', async () => (a.authData[32] & 0x04) !== 0,
          'A touch is not enough: the answer must say the person was verified.'],
        ['The signature is this passkey\'s', async () => crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, passkey.publicKey,
          a.signature, concat(a.authData, await sha256(a.clientData)))],
      ];
      for (const [text, test, why] of checks) {
        await beat(120);
        if (!(await test())) {
          line(gate.trace, 'no', text, why);
          say(gate.verdict, 'no', 'Refused', 'Nothing was approved, and that challenge is spent.');
          return;
        }
        line(gate.trace, 'ok', text);
      }
      approved = true;
      gate.swap.disabled = true;
      say(gate.verdict, 'ok', `Approved: commit ${short(shown.proposal.commit)}, and nothing else`,
        'The audit log keeps the random bytes, the action and the signed bytes, so this yes can be checked again from scratch.');
    }

    gate.approve.addEventListener('click', approve);
    gate.reset.addEventListener('click', start);
    gate.swap.addEventListener('click', () => {
      if (approved) return;
      server.proposal = SWAPPED;
      gate.swap.disabled = true;
      gate.trace.replaceChildren();
      line(gate.trace, 'info', 'A different commit is now waiting on the PC. The phone still shows the first one.',
        'Same title, same words. One more file: the gate\'s own.');
      gate.verdict.className = 'verdict'; gate.verdict.textContent = '';
    });

    (async () => {
      try {
        passkey = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
        credential = crypto.getRandomValues(new Uint8Array(16));
        siteHash = await sha256(enc.encode(SITE));
        await start();
        gate.approve.disabled = false;
      } catch (err) {
        gate.note.textContent = 'This browser could not make a key for the demo, so the gate simulation is off here.';
      }
    })();
  } else if (gate.note) {
    gate.note.textContent = 'This simulation needs a secure page (https) and a current browser.';
  }

  /* ------------------------------------------------------------------------------------------------------------
     Who gets through the door.
     classify(): who is asking? This PC, or a request Tailscale forwarded for my own login. Anyone else: no.
     same_site_post(): a button press needs the header, a same-origin fetch, an allowed origin and the page key.
     ------------------------------------------------------------------------------------------------------------ */
  const door = { who: $('#d-who'), what: $('#d-what'), request: $('#d-request'), trace: $('#d-trace'), verdict: $('#d-verdict') };

  if (door.who) {
    const HOST = 'my-pc.tailnet.example';
    const ME = 'me@example.com';
    const KEY = 'k7Qm2x';                         // new every time Ando starts
    const LOCAL_NAMES = new Set(['localhost', '127.0.0.1', '[::1]']);
    const ORIGINS = new Set(['http://localhost:8700', 'http://127.0.0.1:8700', 'http://[::1]:8700',
      `https://${HOST}`, `https://${HOST}:443`, `https://${HOST}:8443`]);

    const CALLERS = {
      page: { ip: '127.0.0.1', note: 'Tailscale hands the request to Ando on the PC, with my login attached.',
        headers: { Host: HOST, 'Tailscale-User-Login': ME, 'X-Forwarded-For': '100.64.0.7' },
        post: { 'X-Ando': '1', 'Sec-Fetch-Site': 'same-origin', Origin: `https://${HOST}`, Cookie: `__Host-ando_page=${KEY}` } },
      other: { ip: '127.0.0.1', note: 'It is my browser, so Tailscale forwards it under my login. The browser says where the request really started, and leaves the SameSite=Strict key at home.',
        headers: { Host: HOST, 'Tailscale-User-Login': ME, 'X-Forwarded-For': '100.64.0.7' },
        get: { 'Sec-Fetch-Site': 'cross-site', 'Sec-Fetch-Mode': 'navigate' },
        post: { 'Sec-Fetch-Site': 'cross-site', Origin: 'https://some-other-site.example' } },
      script: { ip: '127.0.0.1', note: 'It runs on the PC and was given every header to copy. It was never handed the page key.',
        headers: { Host: '127.0.0.1:8700' },
        post: { 'X-Ando': '1', 'Sec-Fetch-Site': 'same-origin', Origin: 'http://127.0.0.1:8700' } },
      tailnet: { ip: '127.0.0.1', note: 'Tailscale forwards it too, with their login attached.',
        headers: { Host: HOST, 'Tailscale-User-Login': 'someone-else@example.com', 'X-Forwarded-For': '100.64.0.22' },
        post: { 'X-Ando': '1', 'Sec-Fetch-Site': 'same-origin', Origin: `https://${HOST}` } },
      wifi: { ip: '10.0.0.50', unreachable: true, note: 'Ando and every app listen on the PC\'s own loopback address only.',
        headers: { Host: '10.0.0.20:8700' }, post: {} },
    };

    const hostName = (h) => { const v = (h || '').trim().toLowerCase(); return v.startsWith('[') ? v.slice(0, v.indexOf(']') + 1) : v.split(':')[0]; };

    function classify(headers, ip) {
      const name = hostName(headers.Host);
      if (!(LOCAL_NAMES.has(name) || name === HOST)) return [null, 'The Host is not one of Ando\'s own names'];
      const forwarded = headers['X-Forwarded-For'] || headers['Tailscale-User-Login'] || name === HOST;
      if (forwarded) {
        const login = (headers['Tailscale-User-Login'] || '').trim().toLowerCase();
        return login === ME ? ['remote', 'Tailscale forwarded it for my own login'] : [null, 'Tailscale forwarded it, and the login is not mine'];
      }
      if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip)) return [null, 'It did not come from this PC'];
      return ['local', 'It came from this PC itself'];
    }

    function pressChecks(headers) {
      const origin = (headers.Origin || '').trim().toLowerCase().replace(/\/$/, '');
      const cookie = headers.Cookie || '';
      return [
        ['It carries Ando\'s own header', headers['X-Ando'] === '1'],
        ['The browser says the fetch began on this same site', headers['Sec-Fetch-Site'] === 'same-origin'],
        ['Its origin, if it names one, is one of Ando\'s', !origin || ORIGINS.has(origin)],
        ['It carries the page key', cookie.split(';').some((part) => { const [k, v] = part.trim().split('='); return (k === 'ando_page' || k === '__Host-ando_page') && v === KEY; })],
      ];
    }

    function run() {
      const who = door.who.querySelector('input:checked').value;
      const what = door.what.querySelector('input:checked').value;
      const caller = CALLERS[who];
      const headers = { ...caller.headers, ...(what === 'post' ? caller.post : caller.get || {}) };
      const first = what === 'post' ? 'POST /api/apps/hearth/restart' : 'GET /';
      door.request.replaceChildren();
      const b = document.createElement('b'); b.textContent = first;
      door.request.append(b, '\n' + Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join('\n') + `\n\n(arrives from ${caller.ip})`);
      door.trace.replaceChildren();
      line(door.trace, 'info', caller.note);

      if (caller.unreachable) {
        line(door.trace, 'no', 'Nothing answers on the Wi-Fi address', 'The connection is never made, so there is no request to judge.');
        say(door.verdict, 'no', 'Never arrives');
        return;
      }
      const [as, why] = classify(headers, caller.ip);
      if (!as) {
        line(door.trace, 'no', 'Who is asking?', why);
        say(door.verdict, 'no', 'Refused: 403', 'Nobody Ando knows. The request stops at the front door.');
        return;
      }
      line(door.trace, 'ok', 'Who is asking?', why);
      if (what === 'get') {
        if (who === 'other') {
          line(door.trace, 'ok', 'A plain link from anywhere may open a page');
          say(door.verdict, 'ok', 'The page opens', 'That is all a link can do. Try "Restart an app" from the same website.');
        } else if (who === 'script') {
          say(door.verdict, 'ok', 'The page is served', 'The PC is trusted to look. Acting is another matter: try "Restart an app".');
        } else {
          say(door.verdict, 'ok', 'The page opens', 'Its answer also carries the page key, as a cookie scripts cannot read.');
        }
        return;
      }
      let failed = null;
      for (const [text, ok] of pressChecks(headers)) {
        line(door.trace, ok ? 'ok' : 'no', text);
        if (!ok && !failed) failed = text;
      }
      if (failed) {
        const first403 = who === 'script'
          ? 'Every header was right. The key was missing, because only Ando\'s own page is ever handed it.'
          : 'A page on another site cannot set the header without asking first, and the browser will not send the key across sites.';
        say(door.verdict, 'no', 'Refused: 403', first403);
      } else {
        say(door.verdict, 'ok', 'The app restarts', 'Ando\'s own page, in my own browser, on my own login.');
      }
    }

    door.who.addEventListener('change', run);
    door.what.addEventListener('change', run);
    run();
  }
})();
