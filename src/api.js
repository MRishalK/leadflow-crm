export async function api(path, options = {}) {
  const response = await fetch(path, {
    method: options.method ?? 'GET',
    headers: options.body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    credentials: 'same-origin',
  })
  const data = await response.json()
  if (!response.ok) {
    const error = new Error(data.error ?? `Request failed with status ${response.status}.`)
    error.status = response.status
    throw error
  }
  return data
}
