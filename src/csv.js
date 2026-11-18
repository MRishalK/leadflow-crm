export function parseLeadCsv(text) {
  const input = text.replace(/^\uFEFF/, '')
  const rows = []
  let row = []
  let field = ''
  let quoted = false

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index]
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        field += '"'
        index += 1
      } else if (character === '"') {
        quoted = false
      } else {
        field += character
      }
    } else if (character === '"' && field.length === 0) {
      quoted = true
    } else if (character === ',') {
      row.push(field.trim())
      field = ''
    } else if (character === '\n') {
      row.push(field.trim())
      rows.push(row)
      row = []
      field = ''
    } else if (character !== '\r') {
      field += character
    }
  }

  if (quoted) throw new Error('The CSV has an unclosed quoted field.')
  if (field.length || row.length) {
    row.push(field.trim())
    rows.push(row)
  }

  const nonEmptyRows = rows.filter(values => values.some(value => value.length))
  if (nonEmptyRows.length < 2) throw new Error('The CSV must include a header and at least one lead.')

  const headers = nonEmptyRows[0].map(value => value.toLowerCase())
  const required = ['name', 'phone', 'loan', 'amount']
  const missing = required.filter(header => !headers.includes(header))
  if (missing.length) throw new Error(`Missing required CSV columns: ${missing.join(', ')}.`)
  if (new Set(headers).size !== headers.length) throw new Error('The CSV contains duplicate column names.')

  return nonEmptyRows.slice(1).map(values => {
    const record = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']))
    return {
      name: record.name,
      phone: record.phone,
      loan: record.loan,
      amount: record.amount,
      source: record.source || 'CSV import',
      notes: record.notes || '',
    }
  })
}
