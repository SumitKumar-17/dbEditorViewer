function escapeCSVValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = typeof value === 'object' ? JSON.stringify(value) : String(value)
  // Wrap in double-quotes if contains comma, double-quote, or newline
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"'
  }
  return str
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

export function exportCSV(
  filename: string,
  columns: string[],
  rows: Record<string, unknown>[]
): void {
  const headerRow = columns.map(escapeCSVValue).join(',')
  const dataRows = rows.map((row) =>
    columns.map((col) => escapeCSVValue(row[col])).join(',')
  )
  const csvContent = [headerRow, ...dataRows].join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  triggerDownload(blob, filename.endsWith('.csv') ? filename : `${filename}.csv`)
}

export function exportJSON(filename: string, rows: Record<string, unknown>[]): void {
  const jsonContent = JSON.stringify(rows, null, 2)
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' })
  triggerDownload(blob, filename.endsWith('.json') ? filename : `${filename}.json`)
}
