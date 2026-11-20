// Automatische Prüfung des KI-Agenten im Browser (Playwright, Handy-Format Galaxy S9+).
// Gemini- und Claude-Antworten werden nachgespielt – es werden KEINE echten Schlüssel gebraucht
// und keine echten Anfragen verschickt. Start: bash werkzeuge/test/test-starten.sh
// Prüft u. a.: Gemini- und Claude-Entwurf, Dokumente gehen an Claude Sonnet, Warnung ohne
// Claude-Schlüssel, Einrichtung mit Rückmeldungen am Knopf, Modell-Auswahlfeld, Schutz (CSP),
// kein Laden von Tailwind aus dem Internet.
const { chromium, devices } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');
// Arbeitsordner für Test-Dateien und Bildschirmfotos (wird nicht ins Projekt geschrieben)
const S = fs.mkdtempSync(path.join(os.tmpdir(), 'ki-agent-test-'));
fs.writeFileSync(S + '/test.pdf', '%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
const PORT = process.env.PORT || 8765;
const draft = JSON.stringify({ empfaenger: 'anna@example.com', betreff: 'Treffen morgen', text: 'Hallo Anna,\n\nwir treffen uns morgen um 14 Uhr.\n\nViele Grüße' });
const results = [];
const check = (name, cond, extra = '') => { results.push(`${cond ? 'OK  ' : 'FEHLER'} ${name}${extra ? ' – ' + extra : ''}`); };

async function setup(cfg, initScript) {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['Galaxy S9+'] });
  if (initScript) await ctx.addInitScript(initScript);
  const log = { gemini: [], claude: [], csp: [], errors: [], dialogs: [] };
  await ctx.route('https://cdn.tailwindcss.com/**', r => { log.cdn = (log.cdn || 0) + 1; r.abort(); });
  await ctx.route('https://accounts.google.com/**', r => r.abort());
  await ctx.route('https://generativelanguage.googleapis.com/**', r => {
    const url = r.request().url();
    if (url.endsWith('/models')) return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ models: [{ name: 'models/gemini-3.5-flash-lite', supportedGenerationMethods: ['generateContent'] }, { name: 'models/gemini-3.5-flash', supportedGenerationMethods: ['generateContent'] }] }) });
    log.gemini.push({ url, body: r.request().postDataJSON() });
    const text = url.includes('stream') && JSON.stringify(r.request().postDataJSON()).includes('responseSchema') ? draft : 'Zusammenfassung von Gemini.';
    r.fulfill({ contentType: 'text/event-stream', body: 'data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }] }) + '\n\n' });
  });
  await ctx.route('https://api.anthropic.com/**', r => {
    const req = r.request(); const body = req.postDataJSON();
    log.claude.push({ headers: req.headers(), body });
    const text = body.output_config && body.output_config.format ? draft : 'Zusammenfassung von Claude.';
    const half = Math.floor(text.length / 2);
    const ev = (o) => `event: ${o.type}\ndata: ${JSON.stringify(o)}\n\n`;
    r.fulfill({ status: 200, contentType: 'text/event-stream', body:
      ev({ type: 'message_start', message: { id: 'msg_1', type: 'message', role: 'assistant', content: [] } }) +
      ev({ type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '' } }) +
      ev({ type: 'content_block_stop', index: 0 }) +
      ev({ type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } }) +
      ev({ type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: text.slice(0, half) } }) +
      ev({ type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: text.slice(half) } }) +
      ev({ type: 'content_block_stop', index: 1 }) +
      ev({ type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 20 } }) +
      ev({ type: 'message_stop' }) });
  });
  const p = await ctx.newPage();
  p.on('console', m => { if (/Content Security Policy/i.test(m.text())) log.csp.push(m.text()); else if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED/.test(m.text())) log.errors.push(m.text()); });
  p.on('pageerror', e => log.errors.push(e.message));
  p.on('dialog', d => { log.dialogs.push(d.message()); (log.dialogAnswer ? d.accept() : d.dismiss()); });
  await p.goto(`http://localhost:${PORT}/index.html`);
  await p.evaluate(c => { localStorage.clear(); localStorage.setItem('ki_agent_config_v1', JSON.stringify(c)); }, cfg);
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  return { b, p, log };
}

// Claude-Antwort als Datenstrom nachspielen (für einzelne Tests mit eigener Antwort)
function claudeSse(text) {
  const ev = (o) => `event: ${o.type}\ndata: ${JSON.stringify(o)}\n\n`;
  return ev({ type: 'message_start', message: { id: 'msg_2', type: 'message', role: 'assistant', content: [] } }) +
    ev({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }) +
    ev({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } }) +
    ev({ type: 'content_block_stop', index: 0 }) +
    ev({ type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 20 } }) +
    ev({ type: 'message_stop' });
}

// Nachgespielte Spracherkennung: liefert pro Runde einen Satz und endet dann (wie Chrome nach einer Pause).
const FAKE_SPEECH = `
  window.__srRounds = 0; window.__srPhrases = ['Hallo', 'Welt', 'wie geht es'];
  class FakeSR {
    start() {
      const n = window.__srRounds++; window.__srContinuous = this.continuous;
      const ph = window.__srPhrases[n];
      setTimeout(() => {
        if (this._stopped) return;
        if (ph) { this.onresult && this.onresult({ resultIndex: 0, results: [{ 0: { transcript: ph }, isFinal: true, length: 1 }] }); }
        else { this.onerror && this.onerror({ error: 'no-speech' }); }
        setTimeout(() => { if (!this._ended) { this._ended = true; this.onend && this.onend(); } }, 20);
      }, ph ? 60 : 1100);
    }
    stop() { this._stopped = true; setTimeout(() => { if (!this._ended) { this._ended = true; this.onend && this.onend(); } }, 10); }
    abort() { this.stop(); }
  }
  window.SpeechRecognition = FakeSR; window.webkitSpeechRecognition = FakeSR;
`;
const alertText = p => p.$eval('#globalAlertText', e => e.textContent).catch(() => '');

async function writeMail(p) {
  await p.click(`[onclick="switchTab('mail')"]`);
  await p.fill('#mailPrompt', 'Schreibe an Anna, dass wir uns morgen um 14 Uhr treffen');
  await p.click('#btnGenerateMail');
  await p.waitForFunction(() => document.getElementById('mailBody').value.includes('14 Uhr'), null, { timeout: 8000 }).catch(() => {});
  return { body: await p.inputValue('#mailBody'), to: await p.inputValue('#mailTo'), subject: await p.inputValue('#mailSubject') };
}
async function analyseDoc(p, file) {
  await p.click(`[onclick="switchTab('docs')"]`);
  if (file) { await p.setInputFiles('#docFileInput', file); await p.waitForTimeout(300); }
  await p.click('#btnProcessDoc');
  await p.waitForTimeout(1500);
  return p.$eval('#docResultOutput', e => e.textContent);
}

(async () => {
  // A: Gemini wie bisher
  let { b, p, log } = await setup({ provider: 'gemini', geminiKey: 'gemini-test' });
  let opts = await p.$$eval('#modelSelect option', o => o.map(x => x.textContent));
  check('A Gemini: Modellliste zeigt Gemini', opts[0] && opts[0].includes('Gemini'), opts.join(', '));
  let m = await writeMail(p);
  check('A Gemini: E-Mail-Entwurf erstellt', m.body.includes('14 Uhr') && m.to === 'anna@example.com' && m.subject === 'Treffen morgen');
  check('A Gemini: Anfrage ging an Gemini, nicht an Claude', log.gemini.length === 1 && log.claude.length === 0);
  check('A Gemini: kein CSP-Fehler', log.csp.length === 0, log.csp.join(' | '));
  check('A Gemini: keine Programmfehler', log.errors.length === 0, log.errors.join(' | '));
  check('A Kein Abruf von Tailwind aus dem Internet', !log.cdn);
  check('A Aussehen geladen (Mets-Orange am aktiven Reiter)', (await p.$eval('[onclick="switchTab(\'mail\')"]', e => getComputedStyle(e).backgroundImage)).includes('255, 122, 58'));
  check('A Schutz verbietet fremde Skripte', await p.evaluate(() => new Promise(res => { const s = document.createElement('script'); s.src = 'https://cdn.tailwindcss.com/'; s.onerror = () => res(true); s.onload = () => res(false); document.head.appendChild(s); })));
  await b.close();

  // B: Claude für E-Mails
  ({ b, p, log } = await setup({ provider: 'claude', geminiKey: 'gemini-test', claudeKey: 'sk-ant-test' }));
  opts = await p.$$eval('#modelSelect option', o => o.map(x => x.textContent));
  check('B Claude: Modellliste mit beiden Gruppen', opts.join(', ') === 'Claude Haiku 5.5, Claude Sonnet 5.5, Gemini 3.5 Flash Lite, Gemini 3.5 Flash', opts.join(', '));
  check('B Claude: Haiku vorausgewählt', (await p.inputValue('#modelSelect')) === 'claude-haiku-5-5');
  m = await writeMail(p);
  check('B Claude: E-Mail-Entwurf erstellt', m.body.includes('14 Uhr') && m.to === 'anna@example.com');
  const cr = log.claude[0] || { headers: {}, body: {} };
  check('B Claude: Modell Haiku', cr.body.model === 'claude-haiku-5-5', cr.body.model);
  check('B Claude: Kopfzeilen', cr.headers['x-api-key'] === 'sk-ant-test' && cr.headers['anthropic-version'] === '2026-10-21' && cr.headers['anthropic-dangerous-direct-browser-access'] === 'true');
  check('B Claude: JSON-Format + Systemanweisung + Streaming', cr.body.output_config?.format?.type === 'json_schema' && cr.body.output_config.format.schema.type === 'object' && cr.body.output_config.format.schema.additionalProperties === false && typeof cr.body.system === 'string' && cr.body.stream === true, JSON.stringify(cr.body.output_config));
  check('B Claude: keine Gemini-Anfrage', log.gemini.length === 0);
  check('B Claude: kein CSP-Fehler', log.csp.length === 0, log.csp.join(' | '));
  check('B Claude: keine Programmfehler', log.errors.length === 0, log.errors.join(' | '));
  await b.close();

  // C: Dokument mit Claude-Schlüssel, Anbieter Gemini -> automatisch Claude Sonnet
  ({ b, p, log } = await setup({ provider: 'gemini', geminiKey: 'gemini-test', claudeKey: 'sk-ant-test' }));
  let hint = await p.$eval('#docProviderHint', e => e.textContent);
  let out = await analyseDoc(p, S + '/test.pdf');
  const dr = log.claude[0] || { body: {} };
  check('C Dokument: geht an Claude Sonnet', dr.body.model === 'claude-sonnet-5-5', dr.body.model);
  check('C Dokument: PDF als Dokument-Baustein vorne', dr.body.messages?.[0]?.content?.[0]?.type === 'document');
  check('C Dokument: Ergebnis angezeigt', out.includes('Claude'), out);
  check('C Dokument: nichts an Gemini', log.gemini.length === 0);
  check('C Dokument: Hinweistext', hint.includes('Claude Sonnet'), hint);
  check('C Dokument: kein CSP-Fehler / Programmfehler', log.csp.length === 0 && log.errors.length === 0, log.csp.concat(log.errors).join(' | '));
  await b.close();

  // D: Dokument ohne Claude-Schlüssel -> Warnung; Abbrechen = nichts verschickt; OK = Gemini
  ({ b, p, log } = await setup({ provider: 'gemini', geminiKey: 'gemini-test' }));
  hint = await p.$eval('#docProviderHint', e => e.textContent);
  out = await analyseDoc(p, S + '/test.pdf');
  check('D Ohne Claude: Warnung erscheint', log.dialogs.length === 1 && log.dialogs[0].includes('kein Claude-Schlüssel'), log.dialogs[0]);
  check('D Abbrechen: nichts verschickt', log.gemini.length === 0 && log.claude.length === 0);
  check('D Abbrechen: Hinweis angezeigt', (await alertText(p)).includes('nicht verschickt'), await alertText(p));
  log.dialogAnswer = true;
  out = await analyseDoc(p, null);
  check('D OK: geht an Gemini', log.gemini.length === 1 && log.claude.length === 0 && out.includes('Gemini'), out);
  check('D Hinweistext', hint.includes('nachgefragt'), hint);
  await b.close();

  // E: Einrichtung – Rückmeldungen direkt am Knopf
  ({ b, p, log } = await setup({ provider: 'gemini', geminiKey: 'gemini-test' }));
  await p.click(`[onclick="switchTab('setup')"]`);
  const st = id => p.$eval('#' + id, e => (e.classList.contains('hidden') ? '' : e.textContent)).catch(() => '');
  check('E Chips', (await p.$eval('#chipClaude', e => e.textContent)) === 'kein Schlüssel' && (await p.$eval('#chipGemini', e => e.textContent)) === '✓ gespeichert');
  await p.selectOption('#cfgProvider', 'claude');
  await p.click(`[onclick="saveSettings('statusSaveAi')"]`);
  check('E Speichern ohne Claude-Schlüssel: Fehler direkt am Knopf', (await st('statusSaveAi')).includes('Claude-Schlüssel'), await st('statusSaveAi'));
  await p.fill('#cfgClaudeKey', 'sk-ant-test');
  await p.click('#btnTestClaude'); await p.waitForTimeout(800);
  check('E Claude-Test: Erfolg direkt am Knopf + Speicher-Hinweis', (await st('statusClaude')).includes('Verbindung klappt') && (await st('statusClaude')).includes('speichern'), await st('statusClaude'));
  await p.click('#btnTestGemini'); await p.waitForTimeout(800);
  check('E Gemini-Test: Erfolg direkt am Knopf', (await st('statusGemini')).includes('Verbindung klappt'), await st('statusGemini'));
  await p.click(`[onclick="saveSettings('statusSaveAi')"]`); await p.waitForTimeout(300);
  check('E Speichern: Erfolg direkt am Knopf', (await st('statusSaveAi')).includes('Gespeichert') && (await st('statusSaveAi')).includes('Claude'), await st('statusSaveAi'));
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('ki_agent_config_v1')));
  check('E Gespeichert + Chip aktualisiert', saved.provider === 'claude' && saved.claudeKey === 'sk-ant-test' && (await p.$eval('#chipClaude', e => e.textContent)) === '✓ gespeichert');
  await p.click(`[onclick="saveSettings('statusSaveGmail')"]`); await p.waitForTimeout(200);
  check('E Gmail speichern: Rückmeldung am Gmail-Knopf', (await st('statusSaveGmail')).startsWith('✓ Gespeichert'), await st('statusSaveGmail'));
  await p.screenshot({ path: S + '/einrichtung.png', fullPage: true });
  // Allgemeine Meldung unten am Bildschirm
  await p.evaluate(() => showAlert('Testmeldung', 'success'));
  const box = await p.$eval('#globalAlert', e => { const r = e.getBoundingClientRect(); return { bottom: r.bottom, vh: window.innerHeight, pos: getComputedStyle(e).position }; });
  check('E Allgemeine Meldung unten sichtbar', box.pos === 'fixed' && box.bottom <= box.vh && box.bottom > box.vh - 80, JSON.stringify(box));
  await p.screenshot({ path: S + '/meldung.png' });
  check('E keine Programmfehler', log.errors.length === 0 && log.csp.length === 0, log.errors.concat(log.csp).join(' | '));
  await b.close();

  // F: Beide Schlüssel, Standard Gemini (Situation des Nutzers) – Claude im Auswahlfeld wählbar
  ({ b, p, log } = await setup({ provider: 'gemini', geminiKey: 'gemini-test', claudeKey: 'sk-ant-test' }));
  opts = await p.$$eval('#modelSelect option', o => o.map(x => x.textContent));
  const groups = await p.$$eval('#modelSelect optgroup', g => g.map(x => x.label));
  check('F Auswahlfeld zeigt Claude und Gemini', opts.includes('Claude Haiku 5.5') && opts.includes('Gemini 3.5 Flash Lite') && groups.join('|') === 'Claude (Anthropic)|Google Gemini', groups.join('|'));
  check('F Gemini vorausgewählt (Standard Gemini)', (await p.inputValue('#modelSelect')) === 'gemini-3.5-flash-lite');
  await p.selectOption('#modelSelect', 'claude-sonnet-5-5');
  m = await writeMail(p);
  check('F Auswahl Claude Sonnet: E-Mail geht an Claude Sonnet', log.claude.length === 1 && log.claude[0].body.model === 'claude-sonnet-5-5' && log.gemini.length === 0 && m.body.includes('14 Uhr'));
  const saved2 = await p.evaluate(() => JSON.parse(localStorage.getItem('ki_agent_config_v1')));
  check('F Standard-KI folgt der Auswahl', saved2.provider === 'claude' && (await p.inputValue('#cfgProvider')) === 'claude');
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(400);
  check('F Auswahl bleibt nach Neuladen', (await p.inputValue('#modelSelect')) === 'claude-sonnet-5-5');
  await b.close();

  // G: Feste Zeilenumbrüche mitten im Satz werden aus dem KI-Entwurf entfernt
  ({ b, p, log } = await setup({ provider: 'claude', claudeKey: 'sk-ant-test' }));
  const wrapped = 'Hallo Marc,\n\nich wollte dir mitteilen, dass die neue Version des KI-Assistenten\nwunderbar funktioniert.\n\nViele Grüße\n\nKI-Assistent\nMusterstraße 1\n\nDiese E-Mail wurde automatisiert erstellt, jedoch vor dem Absenden von\nMarc geprüft.\n\nWichtige Punkte für das Treffen am kommenden Dienstag in der Stadt:\n- Pünktlich sein\n- Unterlagen mitbringen';
  const body = await p.evaluate(t => { applyFinalJsonDraft(JSON.stringify({ empfaenger: '', betreff: 'x', text: t }), {}); return document.getElementById('mailBody').value; }, wrapped);
  check('G Umbruch mitten im Satz entfernt', body.includes('des KI-Assistenten wunderbar funktioniert.') && body.includes('vor dem Absenden von Marc geprüft.'));
  check('G Absätze, Signatur-Zeilen und Aufzählung bleiben', body.includes('Hallo Marc,\n\nich') && body.includes('Viele Grüße\n\nKI-Assistent\nMusterstraße 1') && body.includes('Stadt:\n- Pünktlich sein\n- Unterlagen mitbringen'), JSON.stringify(body));
  const sys = await p.evaluate(() => buildPersonaSystemInstruction());
  check('G KI-Anweisung: Absatz als durchgehende Zeile', sys.includes('jeden Absatz als eine durchgehende Zeile'));
  await b.close();

  // H: Versand – E-Mail enthält Text- und formatierte HTML-Fassung (fließt im Hochformat sauber)
  ({ b, p, log } = await setup({ provider: 'claude', claudeKey: 'sk-ant-test', agentEmail: 'agent@example.com', senderName: 'KI-Assistent' }));
  let sentRaw = null;
  await p.route('https://gmail.googleapis.com/**', r => {
    const u = r.request().url();
    if (u.includes('/messages/send')) { sentRaw = r.request().postDataJSON().raw; return r.fulfill({ contentType: 'application/json', body: '{"id":"1"}' }); }
    return r.fulfill({ contentType: 'application/json', body: '{"messages":[]}' });
  });
  const longPar = 'Dies ist ein langer Absatz, der auf dem Handy im Hochformat sauber umbrechen soll, ohne feste Zeilenumbrüche nach siebzig Zeichen und ohne Flattersatz.';
  await p.evaluate(t => { accessToken = 'test-token'; document.getElementById('mailTo').value = 'anna@example.com'; document.getElementById('mailSubject').value = 'Test Ü'; document.getElementById('mailBody').value = t; }, `Hallo Anna,\n\n${longPar}\n\nViele Grüße\n\nKI-Assistent\nvon Marc`);
  await p.evaluate(() => confirmAndSendGmailMessage());
  await p.waitForTimeout(800);
  const raw = sentRaw ? Buffer.from(sentRaw.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8') : '';
  check('H E-Mail an Gmail übergeben', Boolean(raw));
  check('H Text- und HTML-Fassung enthalten', raw.includes('multipart/alternative') && raw.includes('text/plain') && raw.includes('text/html'));
  const htmlB64 = (raw.split('Content-Type: text/html; charset="UTF-8"')[1] || '').split('\r\n\r\n')[1] || '';
  const html = Buffer.from(htmlB64.split('\r\n--')[0].replace(/\r\n/g, ''), 'base64').toString('utf8');
  check('H HTML: Absätze linksbündig, normaler Zeilenabstand, langer Absatz in einem Stück', html.includes(`>${longPar}</p>`) && html.includes('text-align:left') && !html.includes('justify') && !html.includes('line-height') && (html.match(/<p /g) || []).length === 4, html.slice(0, 120));
  check('H HTML: Signatur-Zeilen bleiben getrennt', html.includes('KI-Assistent<br>von Marc'));
  check('H Versand-Bestätigung angezeigt', !(await p.$eval('#sendConfirmationBox', e => e.classList.contains('hidden'))));
  require('fs').writeFileSync(S + '/gesendete-mail.eml', raw);
  await b.close();

  // I: Adressbuch im Reiter E-Mail (auswählen, Name ändern, neu, löschen, Hinweis beim Empfänger)
  ({ b, p, log } = await setup({ provider: 'claude', claudeKey: 'sk-ant-test', agentEmail: 'agent@example.com' }));
  await p.evaluate(() => { localStorage.setItem('ki_agent_contacts_v1', JSON.stringify([{ name: 'Falscher Name', email: 'xy123@example.com', used: 5 }, { name: 'Anna', email: 'anna@example.com', used: 9 }, { name: 'Bernd', email: 'b@example.com' }, { name: 'Carla', email: 'c@example.com' }, { name: 'Dora', email: 'd@example.com' }])); renderContactsUI(); });
  check('I Einrichtung hat keine Kontaktliste mehr', !(await p.$('#savedContactsList')) && !(await p.$('#newContactName')));
  const chips = await p.$$eval('#quickContactChips button', bs => bs.map(x => x.textContent));
  check('I Schnellauswahl: nur Namen, zuletzt benutzte zuerst, „Alle …“', chips[0] === 'Anna' && chips[1] === 'Falscher Name' && chips.length === 5 && chips[4] === 'Alle 5 …', chips.join(' | '));
  await p.click('#btnOpenAddressBook');
  check('I Adressbuch öffnet sich, alphabetisch', (await p.isVisible('#addressBookModal')) && (await p.$$eval('#addressBookList .contact-pick', bs => bs.map(x => x.textContent))).join(',').startsWith('AAnnaanna@'), '');
  await p.fill('#addressBookSearch', 'xy1');
  check('I Suche findet Kontakt über Adresse', (await p.$$('#addressBookList .contact-row')).length === 1);
  await p.click('#addressBookList .contact-edit-btn');
  await p.fill('#contactFormName', 'Erika Mustermann');
  await p.screenshot({ path: S + '/adressbuch.png' });
  await p.click('#contactFormSave');
  let cs = await p.evaluate(() => JSON.parse(localStorage.getItem('ki_agent_contacts_v1')));
  check('I Name geändert, Adresse unverändert', cs[0].name === 'Erika Mustermann' && cs[0].email === 'xy123@example.com' && cs.length === 5, JSON.stringify(cs[0]));
  await p.fill('#addressBookSearch', '');
  await p.click('#addressBookList .contact-edit-btn');
  await p.fill('#contactFormName', '   ');
  await p.click('#contactFormSave');
  cs = await p.evaluate(() => JSON.parse(localStorage.getItem('ki_agent_contacts_v1')));
  check('I Leerer Name wird nicht gespeichert', cs.every(c => c.name.trim()));
  await p.click('#contactForm button:has-text("Abbrechen")');
  await p.fill('#addressBookSearch', 'Erika');
  await p.click('#addressBookList .contact-pick');
  check('I Antippen übernimmt Empfänger und schließt', (await p.inputValue('#mailTo')) === 'xy123@example.com' && !(await p.isVisible('#addressBookModal')));
  await p.waitForTimeout(500);
  check('I Hinweis zeigt Namen zum Empfänger', (await p.textContent('#recipientHint')).includes('✓ Erika Mustermann'));
  await p.evaluate(() => { document.getElementById('mailTo').value = 'h.k-1977@example.de'; });
  await p.waitForTimeout(600);
  check('I Unbekannte Adresse: Hinweis mit vorgeschlagenem Namen', (await p.textContent('#recipientHint')).includes('„H K 1977“') && (await p.textContent('#recipientHint')).includes('Namen festlegen'));
  await p.click('#recipientHint button');
  check('I „Namen festlegen“ füllt Adresse im Formular vor', (await p.inputValue('#contactFormEmail')) === 'h.k-1977@example.de');
  await p.fill('#contactFormName', 'Hans Kunz');
  await p.click('#contactFormSave');
  await p.click('#addressBookModal button:has-text("Schließen")');
  await p.waitForTimeout(500);
  check('I Neuer Kontakt angelegt, Hinweis aktualisiert', (await p.textContent('#recipientHint')).includes('✓ Hans Kunz'));
  const match = await p.evaluate(() => (findBestContactMatch('Schreib eine Mail an Erika Mustermann') || {}).email);
  check('I Spracheingabe findet geänderten Namen', match === 'xy123@example.com', String(match));
  await p.click('#btnOpenAddressBook');
  await p.fill('#addressBookSearch', 'Dora');
  await p.click('#addressBookList .contact-edit-btn');
  log.dialogAnswer = true;
  await p.click('#contactFormDelete');
  cs = await p.evaluate(() => JSON.parse(localStorage.getItem('ki_agent_contacts_v1')));
  check('I Löschen mit Rückfrage', log.dialogs.some(d => d.includes('Dora')) && !cs.some(c => c.name === 'Dora') && cs.length === 5);
  await p.click('#addressBookModal button:has-text("Schließen")');
  // Versand an neue Adresse: Hinweis „Neu im Adressbuch … Name ändern“
  await p.route('https://gmail.googleapis.com/**', r => r.request().url().includes('/messages/send') ? r.fulfill({ contentType: 'application/json', body: '{"id":"1"}' }) : r.fulfill({ contentType: 'application/json', body: '{"messages":[]}' }));
  await p.evaluate(() => { accessToken = 'test-token'; document.getElementById('mailTo').value = 'zz9@example.com'; document.getElementById('mailSubject').value = 'x'; document.getElementById('mailBody').value = 'Hallo'; });
  await p.evaluate(() => confirmAndSendGmailMessage());
  await p.waitForTimeout(800);
  check('I Nach Versand: „Neu im Adressbuch“ mit Name-ändern-Knopf', (await p.textContent('#sendNewContactNote')).includes('Neu im Adressbuch als „Zz9“') && (await p.isVisible('#btnFixNewContact')));
  await p.click('#btnFixNewContact');
  check('I Name-ändern öffnet Formular des neuen Kontakts', (await p.inputValue('#contactFormEmail')) === 'zz9@example.com' && (await p.inputValue('#contactFormName')) === 'Zz9');
  check('I Keine Programmfehler', log.errors.length === 0, log.errors.join(' | '));
  await b.close();

  // J: Dokumente – deutscher Knopf zur Dateiauswahl
  ({ b, p, log } = await setup({ provider: 'claude', claudeKey: 'sk-ant-test' }));
  await p.click(`[onclick="switchTab('docs')"]`);
  check('J Datei-Knopf auf Deutsch, kein „Choose File“', (await p.isVisible('#btnPickDocFile')) && !(await p.isVisible('#docFileInput')) && (await p.textContent('#btnPickDocFile')).includes('Datei oder Foto auswählen'));
  await b.close();


  // K: Spracheingabe läuft weiter, bis "Stopp" getippt wird
  ({ b, p, log } = await setup({ provider: 'claude', claudeKey: 'sk-ant-test' }, FAKE_SPEECH));
  const micBtn = '#view-mail button[onclick*="mailPrompt"]';
  await p.click(micBtn);
  await p.waitForTimeout(700);
  check('K Text aus mehreren Sprechpausen wird aneinandergehängt', (await p.inputValue('#mailPrompt')) === 'Hallo Welt wie geht es', await p.inputValue('#mailPrompt'));
  const rounds1 = await p.evaluate(() => window.__srRounds);
  check('K Aufnahme läuft nach Pausen weiter (Knopf zeigt „Stopp“)', rounds1 >= 4 && (await p.textContent(micBtn)).includes('Stopp'), `Runden: ${rounds1}`);
  check('K Android-sichere Einstellung (continuous = false)', (await p.evaluate(() => window.__srContinuous)) === false);
  await p.click(micBtn);
  await p.waitForTimeout(1500);
  const rounds2 = await p.evaluate(() => window.__srRounds);
  await p.waitForTimeout(1500);
  check('K Nach „Stopp“ ist die Aufnahme wirklich beendet', (await p.evaluate(() => window.__srRounds)) === rounds2 && (await p.textContent(micBtn)).includes('Einsprechen'));
  check('K Keine Programmfehler', log.errors.length === 0, log.errors.join(' | '));
  await b.close();

  // L: Vorhandenen Entwurf per Kommando anpassen (nicht neu schreiben) + Rückgängig
  ({ b, p, log } = await setup({ provider: 'claude', claudeKey: 'sk-ant-test' }));
  check('L Anpassen-Kasten ohne Entwurf ausgeblendet', !(await p.isVisible('#reviseBox')));
  await writeMail(p);
  await p.waitForTimeout(500);
  check('L Anpassen-Kasten erscheint mit Entwurf', await p.isVisible('#reviseBox'));
  await (await p.$('#mailReviewCard')).screenshot({ path: S + '/entwurf-anpassen.png' });
  let reviseReq = null;
  const revised = JSON.stringify({ empfaenger: 'falsch@example.com', betreff: 'Treffen morgen', text: 'Hallo Anna,\n\nwir treffen uns morgen um 15 Uhr.\n\nViele Grüße' });
  await p.route('https://api.anthropic.com/**', r => { reviseReq = JSON.stringify(r.request().postDataJSON()); r.fulfill({ status: 200, contentType: 'text/event-stream', body: claudeSse(revised) }); });
  await p.fill('#revisePrompt', 'Ändere die Uhrzeit auf 15 Uhr');
  await p.click('#btnReviseMail');
  await p.waitForFunction(() => document.getElementById('mailBody').value.includes('15 Uhr'), null, { timeout: 8000 }).catch(() => {});
  check('L Entwurf angepasst', (await p.inputValue('#mailBody')).includes('15 Uhr'));
  check('L KI bekommt bisherigen Entwurf + Änderungswunsch + „nicht neu schreiben“', Boolean(reviseReq) && reviseReq.includes('<aktueller_entwurf>') && reviseReq.includes('14 Uhr') && reviseReq.includes('Änderungswunsch des Nutzers: Ändere die Uhrzeit auf 15 Uhr') && reviseReq.includes('KEIN Neuschreiben'));
  check('L Empfänger und Betreff bleiben', (await p.inputValue('#mailTo')) === 'anna@example.com' && (await p.inputValue('#mailSubject')) === 'Treffen morgen', await p.inputValue('#mailTo'));
  check('L Eingabefeld für Änderungswunsch geleert', (await p.inputValue('#revisePrompt')) === '');
  check('L „Rückgängig“ sichtbar', await p.isVisible('#btnUndoDraft'));
  await p.click('#btnUndoDraft');
  check('L „Rückgängig“ stellt vorherige Fassung her', (await p.inputValue('#mailBody')).includes('14 Uhr') && !(await p.isVisible('#btnUndoDraft')));
  reviseReq = null;
  await p.click('.revise-chip:has-text("Kürzer")');
  await p.waitForTimeout(800);
  check('L Schnellknopf „Kürzer“ schickt passenden Wunsch', Boolean(reviseReq) && reviseReq.includes('kürzer'));
  await p.fill('#revisePrompt', '');
  await p.click('#btnReviseMail');
  check('L Leerer Wunsch: Hinweis statt Anfrage', (await alertText(p)).includes('was geändert werden soll'));
  await p.evaluate(() => startNewEmail());
  await p.waitForTimeout(500);
  check('L Neue E-Mail: Kasten und Rückgängig weg', !(await p.isVisible('#reviseBox')) && !(await p.isVisible('#btnUndoDraft')));
  check('L Keine Programmfehler', log.errors.length === 0, log.errors.join(' | '));
  await b.close();

  console.log(results.join('\n'));
  const fehler = results.filter(r => r.startsWith('FEHLER')).length;
  console.log(`\n${results.length - fehler} von ${results.length} Prüfungen bestanden. Bildschirmfotos: ${S}`);
  process.exit(fehler ? 1 : 0);
})();
