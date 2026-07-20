import { supabase, isSupabaseConfigured } from '../supabaseClient.js';
import { parseQuestionsCsv } from '../game/csvImport.js';
import { generateRoomCode, isCorrectAnswer } from '../game/state.js';

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
      <section class="grid two">
        <form id="create-room" class="panel">
          <h1>Admin</h1>
          <label>Admin-PIN <input name="pin" type="password" minlength="4" value="1234" required></label>
          <label>Jackpot <input name="jackpot" type="number" min="1" value="100" required></label>
          <button class="button primary" type="submit">Raum erstellen</button>
        </form>
        <form id="load-room" class="panel">
          <h2>Raum laden</h2>
          <label>Raumcode <input name="code" maxlength="8" required></label>
          <label>Admin-PIN <input name="pin" type="password" required></label>
          <button class="button" type="submit">Laden</button>
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
  const { data, error } = await supabase.from('rooms').insert({
    code: generateRoomCode(),
    admin_pin: form.get('pin'),
    jackpot: Number(form.get('jackpot'))
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
  const [players, questions, answers] = await Promise.all([
    supabase.from('players').select('*').eq('room_id', roomId).order('joined_at'),
    supabase.from('questions').select('*').eq('room_id', roomId).order('question_order'),
    supabase.from('answers').select('*').eq('room_id', roomId)
  ]);

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
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, async (payload) => { adminState.room = payload.new; await refreshAdminData(); })
    .subscribe();
}

function drawAdminGame() {
  const target = document.querySelector('#admin-game');
  const room = adminState.room;
  const current = adminState.questions.find((q) => q.question_order === room.current_question_index) ?? adminState.questions[0];

  target.innerHTML = `
    <section class="panel room-code"><span>Raumcode</span><strong>${room.code}</strong></section>
    <section class="grid two">
      <div class="panel">
        <h2>Spielsteuerung</h2>
        <div class="controls">
          <button class="button primary" id="start-game">Start</button>
          <button class="button" id="next-question">Naechste Frage</button>
          <button class="button danger" id="evaluate">Auswerten</button>
        </div>
        <p class="muted">Status: ${room.status} · Frage: ${room.current_question_index || '-'}</p>
        ${current ? `<h3>${current.difficulty}: ${current.question}</h3>` : '<p>Noch keine Fragen importiert.</p>'}
      </div>
      <form id="import-form" class="panel">
        <h2>CSV importieren</h2>
        <p class="muted">Spalten: frage, typ, a, b, c, d, antwort, schwierigkeit</p>
        <input name="file" type="file" accept=".csv,text/csv" required>
        <button class="button" type="submit">Importieren</button>
      </form>
    </section>
    <section class="grid two">
      <div class="panel"><h2>Spieler</h2>${adminState.players.map(playerRow).join('') || '<p>Warten auf Spieler.</p>'}</div>
      <div class="panel"><h2>Antworten</h2>${adminState.answers.map(answerRow).join('') || '<p>Noch keine Antworten.</p>'}</div>
    </section>
  `;

  document.querySelector('#start-game').addEventListener('click', () => updateRoom({ status: 'running', current_question_index: adminState.questions[0]?.question_order ?? 1 }));
  document.querySelector('#next-question').addEventListener('click', nextQuestion);
  document.querySelector('#evaluate').addEventListener('click', evaluateCurrentQuestion);
  document.querySelector('#import-form').addEventListener('submit', importCsv);
  document.querySelectorAll('[data-remove]').forEach((button) => button.addEventListener('click', removePlayer));
}

function playerRow(player) {
  return `<div class="row"><span>${player.name}</span><strong>${player.status}</strong><button class="small" data-remove="${player.id}">Entfernen</button></div>`;
}

function answerRow(answer) {
  const player = adminState.players.find((item) => item.id === answer.player_id);
  return `<div class="row"><span>${player?.name ?? 'Spieler'}</span><strong>${answer.answer}</strong></div>`;
}

async function updateRoom(values) {
  const { data, error } = await supabase.from('rooms').update(values).eq('id', adminState.room.id).select().single();
  if (error) return alert(error.message);
  adminState.room = data;
  await refreshAdminData();
}

async function nextQuestion() {
  const orders = adminState.questions.map((question) => question.question_order).sort((a, b) => a - b);
  const currentIndex = orders.indexOf(adminState.room.current_question_index);
  const next = orders[currentIndex + 1];
  await updateRoom(next ? { current_question_index: next, status: 'running' } : { status: 'finished' });
}

async function evaluateCurrentQuestion() {
  const question = adminState.questions.find((item) => item.question_order === adminState.room.current_question_index);
  if (!question) return;

  const active = adminState.players.filter((player) => player.status === 'active');
  const updates = active.map((player) => {
    const answer = adminState.answers.find((item) => item.player_id === player.id && item.question_id === question.id);
    const survived = answer && isCorrectAnswer(answer.answer, question);
    return supabase.from('players').update({ status: survived ? 'active' : 'out' }).eq('id', player.id);
  });

  await Promise.all(updates);
  await updateRoom({ status: 'revealing' });
}

async function removePlayer(event) {
  const { error } = await supabase.from('players').update({ status: 'out' }).eq('id', event.currentTarget.dataset.remove);
  if (error) return alert(error.message);
  await refreshAdminData();
}

async function importCsv(event) {
  event.preventDefault();
  const file = new FormData(event.currentTarget).get('file');
  const questions = parseQuestionsCsv(await file.text()).map((question) => ({ ...question, room_id: adminState.room.id }));
  const { error } = await supabase.from('questions').insert(questions);
  if (error) return alert(error.message);
  await refreshAdminData();
}

