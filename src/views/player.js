import { supabase, isSupabaseConfigured } from '../supabaseClient.js';

let playerState = { room: null, player: null, questions: [], answers: [] };
let playerChannel;

export function renderPlayer(app) {
  app.innerHTML = `
    <main class="shell dashboard">
      <header class="topbar"><a href="#/" class="brand">1% Quiz</a><nav><a href="#/admin">Admin</a><a href="#/display">Anzeige</a></nav></header>
      ${isSupabaseConfigured ? '' : '<div class="notice">Supabase ist noch nicht konfiguriert.</div>'}
      <form id="join-form" class="panel join">
        <h1>Teilnehmen</h1>
        <label>Raumcode <input name="code" maxlength="8" required></label>
        <label>Name <input name="name" maxlength="40" required></label>
        <button class="button primary" type="submit">Beitreten</button>
      </form>
      <section id="player-game"></section>
    </main>
  `;

  app.querySelector('#join-form').addEventListener('submit', joinRoom);
}

async function joinRoom(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const code = String(form.get('code')).trim().toUpperCase();
  const name = String(form.get('name')).trim();
  const roomResult = await supabase.from('rooms').select('*').eq('code', code).single();

  if (roomResult.error) return alert('Raum nicht gefunden.');

  const playerResult = await supabase.from('players').insert({ room_id: roomResult.data.id, name }).select().single();
  if (playerResult.error) return alert(playerResult.error.message);

  playerState.room = roomResult.data;
  playerState.player = playerResult.data;
  document.querySelector('#join-form').hidden = true;
  await refreshPlayerData();
  subscribePlayer(roomResult.data.id);
}

async function refreshPlayerData() {
  const roomId = playerState.room.id;
  const [room, questions, answers, player] = await Promise.all([
    supabase.from('rooms').select('*').eq('id', roomId).single(),
    supabase.from('questions').select('*').eq('room_id', roomId).order('question_order'),
    supabase.from('answers').select('*').eq('room_id', roomId).eq('player_id', playerState.player.id),
    supabase.from('players').select('*').eq('id', playerState.player.id).single()
  ]);

  playerState.room = room.data ?? playerState.room;
  playerState.questions = questions.data ?? [];
  playerState.answers = answers.data ?? [];
  playerState.player = player.data ?? playerState.player;
  drawPlayerGame();
}

function subscribePlayer(roomId) {
  if (playerChannel) supabase.removeChannel(playerChannel);
  playerChannel = supabase.channel(`player-${roomId}-${playerState.player.id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, refreshPlayerData)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'questions', filter: `room_id=eq.${roomId}` }, refreshPlayerData)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `id=eq.${playerState.player.id}` }, refreshPlayerData)
    .subscribe();
}

function drawPlayerGame() {
  const target = document.querySelector('#player-game');
  const room = playerState.room;
  const player = playerState.player;
  const question = playerState.questions.find((item) => item.question_order === room.current_question_index);
  const answered = question && playerState.answers.some((answer) => answer.question_id === question.id);

  target.innerHTML = `
    <section class="panel status-panel">
      <span>Raum ${room.code}</span>
      <strong>${player.name}</strong>
      <span class="badge ${player.status === 'active' ? 'ok' : 'out'}">${player.status === 'active' ? 'aktiv' : 'ausgeschieden'}</span>
    </section>
    ${question ? questionTemplate(question, answered, player.status === 'active' && room.status === 'running') : '<section class="panel"><h2>Warten auf die erste Frage.</h2></section>'}
  `;

  const form = document.querySelector('#answer-form');
  if (form) form.addEventListener('submit', submitAnswer);
}

function questionTemplate(question, answered, canAnswer) {
  const options = question.options ?? [];
  const inputs = question.type === 'mc'
    ? options.map((option) => `<button class="option" name="answer" value="${escapeHtml(option)}" ${!canAnswer || answered ? 'disabled' : ''}>${escapeHtml(option)}</button>`).join('')
    : `<input name="answer" placeholder="Antwort" ${!canAnswer || answered ? 'disabled' : ''} required><button class="button primary" ${!canAnswer || answered ? 'disabled' : ''}>Senden</button>`;

  return `
    <section class="panel question-card">
      <p class="eyebrow">${question.difficulty}</p>
      <h1>${escapeHtml(question.question)}</h1>
      <form id="answer-form" class="answers">${inputs}</form>
      ${answered ? '<p class="notice success">Antwort gespeichert.</p>' : ''}
      ${!canAnswer && !answered ? '<p class="muted">Gerade ist keine Antwortabgabe aktiv.</p>' : ''}
    </section>
  `;
}

async function submitAnswer(event) {
  event.preventDefault();
  const question = playerState.questions.find((item) => item.question_order === playerState.room.current_question_index);
  const form = new FormData(event.currentTarget);
  const clicked = event.submitter?.value;
  const answer = clicked || form.get('answer');

  const { error } = await supabase.from('answers').insert({
    room_id: playerState.room.id,
    player_id: playerState.player.id,
    question_id: question.id,
    answer
  });

  if (error) return alert(error.message);
  await refreshPlayerData();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\'': '&#39;', '"': '&quot;' }[char]));
}
