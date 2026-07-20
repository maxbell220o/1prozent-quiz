import { supabase, isSupabaseConfigured } from '../supabaseClient.js';

let displayState = { room: null, players: [], questions: [], answers: [] };
let displayChannel;

export function renderDisplay(app) {
  app.innerHTML = `
    <main class="display">
      <header class="display-head">
        <a href="#/" class="brand">1% Quiz</a>
        <form id="display-form">
          <input name="code" placeholder="Raumcode" maxlength="8" required>
          <button class="button">Verbinden</button>
        </form>
      </header>
      ${isSupabaseConfigured ? '' : '<div class="notice">Supabase ist noch nicht konfiguriert.</div>'}
      <section id="display-game" class="stage empty">
        <h1>Anzeige bereit</h1>
      </section>
    </main>
  `;

  app.querySelector('#display-form').addEventListener('submit', loadDisplayRoom);
}

async function loadDisplayRoom(event) {
  event.preventDefault();
  const code = String(new FormData(event.currentTarget).get('code')).trim().toUpperCase();
  const { data, error } = await supabase.from('rooms').select('*').eq('code', code).single();
  if (error) return alert('Raum nicht gefunden.');

  displayState.room = data;
  await refreshDisplayData();
  subscribeDisplay(data.id);
}

async function refreshDisplayData() {
  const roomId = displayState.room.id;
  const [room, players, questions, answers] = await Promise.all([
    supabase.from('rooms').select('*').eq('id', roomId).single(),
    supabase.from('players').select('*').eq('room_id', roomId).order('joined_at'),
    supabase.from('questions').select('*').eq('room_id', roomId).order('question_order'),
    supabase.from('answers').select('*').eq('room_id', roomId)
  ]);

  displayState.room = room.data ?? displayState.room;
  displayState.players = players.data ?? [];
  displayState.questions = questions.data ?? [];
  displayState.answers = answers.data ?? [];
  drawDisplay();
}

function subscribeDisplay(roomId) {
  if (displayChannel) supabase.removeChannel(displayChannel);
  displayChannel = supabase.channel(`display-${roomId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, refreshDisplayData)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` }, refreshDisplayData)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'answers', filter: `room_id=eq.${roomId}` }, refreshDisplayData)
    .subscribe();
}

function drawDisplay() {
  const target = document.querySelector('#display-game');
  const room = displayState.room;
  const question = displayState.questions.find((item) => item.question_order === room.current_question_index);
  const active = displayState.players.filter((player) => player.status === 'active');
  const answeredCount = question ? displayState.answers.filter((answer) => answer.question_id === question.id).length : 0;

  target.className = 'stage';
  target.innerHTML = `
    <section class="score-strip">
      <div><span>Raum</span><strong>${room.code}</strong></div>
      <div><span>Jackpot</span><strong>${room.jackpot}</strong></div>
      <div><span>Aktiv</span><strong>${active.length}/${displayState.players.length}</strong></div>
      <div><span>Status</span><strong>${labelStatus(room.status)}</strong></div>
    </section>
    <section class="show-question">
      ${question ? `<p>${question.difficulty}</p><h1>${escapeHtml(question.question)}</h1>${options(question)}` : '<h1>Warten auf Fragen</h1>'}
    </section>
    <section class="players-band">
      <div class="meter"><span style="width:${displayState.players.length ? (active.length / displayState.players.length) * 100 : 0}%"></span></div>
      <p>${answeredCount} Antworten eingegangen</p>
      <div class="player-cloud">${displayState.players.map(playerPill).join('')}</div>
    </section>
  `;
}

function options(question) {
  if (question.type !== 'mc' || !question.options?.length) return '';
  return `<div class="display-options">${question.options.map((option) => `<span>${escapeHtml(option)}</span>`).join('')}</div>`;
}

function playerPill(player) {
  return `<span class="player-pill ${player.status === 'active' ? 'active' : 'out'}">${escapeHtml(player.name)}</span>`;
}

function labelStatus(status) {
  return { lobby: 'Lobby', running: 'Laeuft', revealing: 'Auswertung', finished: 'Fertig' }[status] ?? status;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\'': '&#39;', '"': '&quot;' }[char]));
}
