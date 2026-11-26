// The text of an answer of the dev server that is not a success: the status
// and the text of the body, `404 no screen "a"`. The client of the file API
// and the client of the screen actions share it.
export async function failure(response: Response): Promise<string> {
  const text = (await response.text().catch(() => '')).trim()
  return `${response.status}${text === '' ? '' : ` ${text}`}`
}
