export function parseQuestionsCsv(text) {
  const rows = parseCsv(text).filter((row) => row.some((cell) => cell.trim()));
  const [header, ...data] = rows;
  if (!header) return [];

  const columns = header.map((value) => value.trim().toLowerCase());

  return data.map((row, index) => {
    const item = Object.fromEntries(columns.map((column, columnIndex) => [column, row[columnIndex]?.trim() ?? '']));
    const options = [item.a, item.b, item.c, item.d].filter(Boolean);

    return {
      question_order: Number(item.reihenfolge || item.order || index + 1),
      difficulty: item.schwierigkeit || item.difficulty || `${90 - index * 10}%`,
      type: normalizeType(item.typ || item.type || (options.length ? 'mc' : 'text')),
      question: item.frage || item.question,
      options: options.length ? options : null,
      correct_answer: item.antwort || item.correct_answer || item.richtig
    };
  }).filter((question) => question.question && question.correct_answer);
}

function normalizeType(type) {
  const value = type.toLowerCase();
  if (value.includes('text') || value.includes('frei')) return 'text';
  return 'mc';
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  row.push(cell);
  rows.push(row);
  return rows;
}
