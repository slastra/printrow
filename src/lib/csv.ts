export interface CsvData {
	columns: string[];
	rows: Record<string, string>[];
}

/**
 * RFC 4180-ish CSV: quoted fields, escaped double quotes, CR/LF line ends.
 * Empty header cells become column1, column2…; duplicate headers get a
 * numeric suffix so every column stays individually addressable.
 */
export function parseCsv(text: string): CsvData {
	if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // BOM

	const records: string[][] = [];
	let record: string[] = [];
	let field = '';
	let inQuotes = false;

	const endField = () => {
		record.push(field);
		field = '';
	};
	const endRecord = () => {
		endField();
		// a lone newline produces one empty field — not a data row
		if (record.length > 1 || record[0] !== '') records.push(record);
		record = [];
	};

	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (inQuotes) {
			if (c === '"') {
				if (text[i + 1] === '"') {
					field += '"';
					i++;
				} else {
					inQuotes = false;
				}
			} else {
				field += c;
			}
		} else if (c === '"') {
			inQuotes = true;
		} else if (c === ',') {
			endField();
		} else if (c === '\n') {
			endRecord();
		} else if (c !== '\r') {
			field += c;
		}
	}
	if (field !== '' || record.length) endRecord();

	if (!records.length) return { columns: [], rows: [] };

	const seen = new Map<string, number>();
	const columns = records[0].map((h, i) => {
		let name = h.trim() || `column${i + 1}`;
		const n = seen.get(name) ?? 0;
		seen.set(name, n + 1);
		if (n) name = `${name} (${n + 1})`;
		return name;
	});

	const rows = records.slice(1).map((rec) => {
		const row: Record<string, string> = {};
		columns.forEach((col, i) => (row[col] = rec[i] ?? ''));
		return row;
	});

	return { columns, rows };
}
