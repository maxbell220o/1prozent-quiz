export function generateRoomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
}

export function normalizeAnswer(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function isCorrectAnswer(answer, question) {
  return normalizeAnswer(answer) === normalizeAnswer(question.correct_answer);
}

export function activePlayers(players) {
  return players.filter((player) => player.status === 'active');
}

export function getCurrentQuestion(room, questions) {
  return questions.find((question) => question.question_order === room.current_question_index) ?? questions[0] ?? null;
}
