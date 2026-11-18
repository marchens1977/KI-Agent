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

async function setup(cfg) {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['Galaxy S9+'] });
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

  console.log(results.join('\n'));
  const fehler = results.filter(r => r.startsWith('FEHLER')).length;
  console.log(`\n${results.length - fehler} von ${results.length} Prüfungen bestanden. Bildschirmfotos: ${S}`);
  process.exit(fehler ? 1 : 0);
})();
