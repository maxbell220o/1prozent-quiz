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

export function outPlayers(players) {
  return players.filter((player) => player.status === 'out');
}

export function getCurrentQuestion(room, questions) {
  return questions.find((question) => question.question_order === room.current_question_index) ?? questions[0] ?? null;
}

export function getOrderedQuestionNumbers(questions) {
  return questions.map((question) => question.question_order).sort((a, b) => a - b);
}

export function getNextQuestionNumber(room, questions) {
  const orders = getOrderedQuestionNumbers(questions);
  const currentIndex = orders.indexOf(room.current_question_index);
  return orders[currentIndex + 1] ?? null;
}

export function calculateJackpot(players, maxJackpot) {
  if (!players.length) return 0;
  const eliminated = outPlayers(players).length;
  return Math.round((Number(maxJackpot || 0) * eliminated) / players.length);
}

export function winners(players) {
  return activePlayers(players);
}
