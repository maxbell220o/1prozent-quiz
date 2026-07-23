import csv

INPUT_FILE = "fragen.csv"
OUTPUT_FILE = "fragen_clean.csv"
EXPECTED_COLUMNS = 8

def clean_mc_options(row):
    frage, typ, a, b, c, d, antwort, schwierigkeit = row

    if typ != "mc":
        return row

    options = [a, b, c, d]

    # Entferne leere Optionen
    options = [opt for opt in options if opt.strip() != ""]

    # Wenn weniger als 2 Optionen → unbrauchbar → skip
    if len(options) < 2:
        return None

    # Wieder auf 4 Felder auffüllen (Parser erwartet feste Struktur)
    while len(options) < 4:
        options.append("")

    a, b, c, d = options[:4]

    return [frage, typ, a, b, c, d, antwort, schwierigkeit]


def fix_quotes(text):
    # Wenn Komma enthalten → in Anführungszeichen setzen
    if "," in text and not (text.startswith('"') and text.endswith('"')):
        return f'"{text}"'
    return text


def process_csv():
    cleaned_rows = []
    removed_rows = []

    with open(INPUT_FILE, encoding="utf-8") as f:
        reader = csv.reader(f)

        for line_num, row in enumerate(reader, start=1):

            # Skip komplett kaputte Zeilen
            if len(row) != EXPECTED_COLUMNS:
                print(f"Zeile {line_num} entfernt (Spaltenfehler: {len(row)})")
                removed_rows.append(line_num)
                continue

            frage = fix_quotes(row[0])
            row[0] = frage

            row = clean_mc_options(row)

            if row is None:
                print(f"Zeile {line_num} entfernt (zu wenige MC-Optionen)")
                removed_rows.append(line_num)
                continue

            cleaned_rows.append(row)

    # Neue Datei schreiben
    with open(OUTPUT_FILE, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerows(cleaned_rows)

    print("\nFertig.")
    print(f"✔ Bereinigte Datei: {OUTPUT_FILE}")
    print(f"❌ Entfernte Zeilen: {removed_rows}")


if __name__ == "__main__":
    process_csv()