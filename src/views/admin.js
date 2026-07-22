import { supabase, isSupabaseConfigured } from '../supabaseClient.js';
import { parseQuestionsCsv } from '../game/csvImport.js';
import { calculateJackpot, generateRoomCode, getNextQuestionNumber, isCorrectAnswer, winners } from '../game/state.js';

let adminChannel;
let adminState = { room: null, players: [], questions: [], answers: [] };

export function renderAdmin(app) {
  app.innerHTML = `
    <main class="shell dashboard">
      <header class="topbar">
        <a href="#/" class="brand">1% Quiz</a>
        <nav><a href="#/player">Teilnehmer</a><a href="#/display">Anzeige</a></nav>
      </header>
      ${configWarning()}
      <section class="admin-setup">
        <form id="create-room" class="panel setup-card">
          <p class="eyebrow">Neues Spiel</p>
          <h1>Raum erstellen</h1>
          <label>Admin-PIN <input name="pin" type="password" minlength="4" value="1234" required></label>
          <label>Maximaler Jackpot <input name="maxJackpot" type="number" min="1" value="100" required></label>
          <button class="button primary" type="submit">Raum erstellen</button>
        </form>
        <form id="load-room" class="panel setup-card">
          <p class="eyebrow">Weiterarbeiten</p>
          <h2>Raum laden</h2>
          <label>Raumcode <input name="code" maxlength="8" required></label>
          <label>Admin-PIN <input name="pin" type="password" required></label>
          <button class="button" type="submit">Raum laden</button>
        </form>
      </section>
      <section id="admin-game"></section>
    </main>
  `;

  app.querySelector('#create-room').addEventListener('submit', createRoom);
  app.querySelector('#load-room').addEventListener('submit', loadRoom);
}

function configWarning() {
  return isSupabaseConfigured ? '' : '<div class="notice">Supabase ist noch nicht konfiguriert. Trage URL und anon key in <code>src/supabaseClient.js</code> ein.</div>';
}

async function createRoom(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const maxJackpot = Number(form.get('maxJackpot'));
  const { data, error } = await supabase.from('rooms').insert({
    code: generateRoomCode(),
    admin_pin: form.get('pin'),
    jackpot: 0,
    max_jackpot: maxJackpot
  }).select().single();

  if (error) return alert(error.message);
  await openRoom(data);
}

async function loadRoom(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const { data, error } = await supabase.from('rooms').select('*').eq('code', String(form.get('code')).toUpperCase()).eq('admin_pin', form.get('pin')).single();

  if (error) return alert('Raum oder PIN nicht gefunden.');
  await openRoom(data);
}

async function openRoom(room) {
  adminState.room = room;
  await refreshAdminData();
  subscribeAdmin(room.id);
}

async function refreshAdminData() {
  const roomId = adminState.room.id;
  const [room, players, questions, answers] = await Promise.all([
    supabase.from('rooms').select('*').eq('id', roomId).single(),
    supabase.from('players').select('*').eq('room_id', roomId).order('joined_at'),
    supabase.from('questions').select('*').eq('room_id', roomId).order('question_order'),
    supabase.from('answers').select('*').eq('room_id', roomId)
  ]);

  adminState.room = room.data ?? adminState.room;
  adminState.players = players.data ?? [];
  adminState.questions = questions.data ?? [];
  adminState.answers = answers.data ?? [];
  drawAdminGame();
}

function subscribeAdmin(roomId) {
  if (adminChannel) supabase.removeChannel(adminChannel);
  adminChannel = supabase.channel(`admin-${roomId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` }, refreshAdminData)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'answers', filter: `room_id=eq.${roomId}` }, refreshAdminData)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, refreshAdminData)
    .subscribe();
}

function drawAdminGame() {
  const target = document.querySelector('#admin-game');
  const room = adminState.room;
  const current = adminState.questions.find((q) => q.question_order === room.current_question_index) ?? adminState.questions[0];
  const active = adminState.players.filter((player) => player.status === 'active');
  const out = adminState.players.length - active.length;
  const jackpot = calculateJackpot(adminState.players, room.max_jackpot ?? room.jackpot);
  const answered = current ? adminState.answers.filter((answer) => answer.question_id === current.id).length : 0;
  const next = getNextQuestionNumber(room, adminState.questions);
  const gameOver = room.status === 'finished';

  target.innerHTML = `
    <section class="admin-command panel">
      <div>
        <p class="eyebrow">Raumcode</p>
        <strong class="code-large">${escapeHtml(room.code)}</strong>
      </div>
      <div class="admin-next">${nextActionText(room, current, active.length, next)}</div>
    </section>

    <section class="stat-grid">
      <div class="stat"><span>Status</span><strong>${labelStatus(room.status)}</strong></div>
      <div class="stat"><span>Jackpot</span><strong>${jackpot}/${room.max_jackpot ?? room.jackpot}</strong></div>
      <div class="stat"><span>Spieler aktiv</span><strong>${active.length}/${adminState.players.length}</strong></div>
      <div class="stat"><span>Antworten</span><strong>${answered}</strong></div>
    </section>

    <section class="grid two">
      <div class="panel control-panel">
        <h2>Spielsteuerung</h2>
        <div class="controls vertical">
          <button class="button primary" id="start-game" ${!adminState.questions.length || gameOver ? 'disabled' : ''}>Spiel starten</button>
          <button class="button danger" id="evaluate" ${room.status !== 'running' || !current ? 'disabled' : ''}>Antworten auswerten</button>
          <button class="button" id="next-question" ${room.status !== 'revealing' || gameOver ? 'disabled' : ''}>${next ? 'Naechste Frage zeigen' : 'Spiel beenden und Gewinner zeigen'}</button>
        </div>
        ${current ? currentQuestionTemplate(room, current) : '<p class="muted">Importiere zuerst Fragen, dann kann das Spiel starten.</p>'}
      </div>
      <form id="import-form" class="panel">
        <h2>Fragen</h2>
        <p class="muted">CSV-Spalten: frage, typ, a, b, c, d, antwort, schwierigkeit</p>
        <input name="file" type="file" accept=".csv,text/csv" required>
        <button class="button" type="submit">CSV importieren</button>
        <p class="muted">${adminState.questions.length} Fragen geladen</p>
      </form>
    </section>

    ${endSummary(room, active)}

    <section class="grid two">
      <div class="panel"><h2>Spieler</h2>${adminState.players.map(playerRow).join('') || '<p>Warten auf Spieler.</p>'}</div>
      <div class="panel"><h2>Antworten zur aktuellen Frage</h2>${currentAnswers(current).map(answerRow).join('') || '<p>Noch keine Antworten.</p>'}</div>
    </section>
  `;

  document.querySelector('#start-game').addEventListener('click', startGame);
  document.querySelector('#next-question').addEventListener('click', nextQuestion);
  document.querySelector('#evaluate').addEventListener('click', evaluateCurrentQuestion);
  document.querySelector('#import-form').addEventListener('submit', importCsv);
  document.querySelectorAll('[data-remove]').forEach((button) => button.addEventListener('click', removePlayer));
}

function nextActionText(room, current, activeCount, next) {
  if (!adminState.questions.length) return '1. CSV importieren, 2. Spieler beitreten lassen, 3. Spiel starten.';
  if (room.status === 'lobby') return 'Warte auf Spieler. Wenn alle drin sind: Spiel starten.';
  if (room.status === 'running') return current ? 'Frage laeuft. Nach Ablauf: Antworten auswerten.' : 'Keine aktuelle Frage gefunden.';
  if (room.status === 'revealing' && activeCount === 0) return 'Alle sind ausgeschieden. Beende das Spiel fuer die Abschlussanzeige.';
  if (room.status === 'revealing') return next ? 'Richtige Antwort ist sichtbar. Danach naechste Frage zeigen.' : 'Letzte Frage geschafft. Jetzt Gewinner anzeigen.';
  return 'Spiel beendet.';
}

function currentQuestionTemplate(room, current) {
  return `
    <div class="current-question">
      <p class="eyebrow">Aktuelle Frage</p>
      <h3>${escapeHtml(current.difficulty)}: ${escapeHtml(current.question)}</h3>
      ${room.status === 'revealing' ? `<div class="correct-answer compact"><span>Richtige Antwort</span><strong>${escapeHtml(current.correct_answer)}</strong></div>` : ''}
    </div>
  `;
}

function endSummary(room, active) {
  if (room.status !== 'finished') return '';
  if (!active.length) return '<section class="panel final-summary lost"><p class="eyebrow">Ende</p><h2>Alle sind ausgeschieden.</h2><p>Der Jackpot ist voll, aber niemand hat ihn gewonnen.</p></section>';
  return `<section class="panel final-summary won"><p class="eyebrow">Gewinner</p><h2>${winners(adminState.players).map((player) => escapeHtml(player.name)).join(', ')}</h2><p>Hat/haben alle Fragen geschafft.</p></section>`;
}

function playerRow(player) {
  return `<div class="row"><span>${escapeHtml(player.name)}</span><strong>${player.status === 'active' ? 'aktiv' : 'raus'}</strong><button class="small" data-remove="${player.id}" ${player.status === 'out' ? 'disabled' : ''}>Rausnehmen</button></div>`;
}

function currentAnswers(current) {
  if (!current) return [];
  return adminState.answers.filter((answer) => answer.question_id === current.id);
}

function answerRow(answer) {
  const player = adminState.players.find((item) => item.id === answer.player_id);
  return `<div class="row"><span>${escapeHtml(player?.name ?? 'Spieler')}</span><strong>${escapeHtml(answer.answer)}</strong></div>`;
}

async function updateRoom(values) {
  const { data, error } = await supabase.from('rooms').update(values).eq('id', adminState.room.id).select().single();
  if (error) return alert(error.message);
  adminState.room = data;
  await refreshAdminData();
}

async function syncJackpot(status = adminState.room.status, players = adminState.players) {
  const jackpot = calculateJackpot(players, adminState.room.max_jackpot ?? adminState.room.jackpot);
  await updateRoom({ jackpot, status });
}

async function startGame() {
  await updateRoom({ status: 'running', current_question_index: adminState.questions[0]?.question_order ?? 1, jackpot: calculateJackpot(adminState.players, adminState.room.max_jackpot ?? adminState.room.jackpot) });
}

async function nextQuestion() {
  const active = adminState.players.filter((player) => player.status === 'active');
  const next = getNextQuestionNumber(adminState.room, adminState.questions);
  if (!active.length || !next) return syncJackpot('finished');
  await updateRoom({ current_question_index: next, status: 'running' });
}

async function evaluateCurrentQuestion() {
  const question = adminState.questions.find((item) => item.question_order === adminState.room.current_question_index);
  if (!question) return;

  const active = adminState.players.filter((player) => player.status === 'active');
  const survivors = [];
  const updates = active.map((player) => {
    const answer = adminState.answers.find((item) => item.player_id === player.id && item.question_id === question.id);
    const survived = answer && isCorrectAnswer(answer.answer, question);
    if (survived) survivors.push(player.id);
    return supabase.from('players').update({ status: survived ? 'active' : 'out' }).eq('id', player.id);
  });

  await Promise.all(updates);
  const updatedPlayers = adminState.players.map((player) => active.some((item) => item.id === player.id) ? { ...player, status: survivors.includes(player.id) ? 'active' : 'out' } : player);
  const status = updatedPlayers.some((player) => player.status === 'active') ? 'revealing' : 'finished';
  const jackpot = calculateJackpot(updatedPlayers, adminState.room.max_jackpot ?? adminState.room.jackpot);
  await updateRoom({ status, jackpot });
}

async function removePlayer(event) {
  const { error } = await supabase.from('players').update({ status: 'out' }).eq('id', event.currentTarget.dataset.remove);
  if (error) return alert(error.message);
  const updatedPlayers = adminState.players.map((player) => player.id === event.currentTarget.dataset.remove ? { ...player, status: 'out' } : player);
  const status = updatedPlayers.some((player) => player.status === 'active') ? adminState.room.status : 'finished';
  await syncJackpot(status, updatedPlayers);
}

async function importCsv(event) {
  event.preventDefault();
  const file = new FormData(event.currentTarget).get('file');
  const questions = parseQuestionsCsv(await file.text()).map((question) => ({ ...question, room_id: adminState.room.id }));
  const { error } = await supabase.from('questions').insert(questions);
  if (error) return alert(error.message);
  await refreshAdminData();
}

function labelStatus(status) {
  return { lobby: 'Lobby', running: 'Frage laeuft', revealing: 'Antwort sichtbar', finished: 'Beendet' }[status] ?? status;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\'': '&#39;', '"': '&quot;' }[char]));
}
