// A very small markdown renderer for EdTheStatBot's replies.
//
// WHY NOT react-markdown: the panel mounts in the ROOT LAYOUT, so it is on every
// page of the site. react-markdown + remark-gfm is ~40KB gzipped on every page
// load to format a panel most visits never open. This covers the six things the
// system prompt actually asks the bot to produce and costs nothing.
//
// SECURITY: escape() runs FIRST, over the whole input, before a single tag is
// produced. Everything after that operates on already-escaped text, so no
// sequence in the model's output can introduce an element or an attribute. This
// matters more than it looks: tool results are Vault rows written by admins into
// Supabase, so model output is downstream of stored user input, and the result
// goes through dangerouslySetInnerHTML.
//
// Deliberately NOT supported: links and images. The bot has no reason to emit
// either, and both are the parts of markdown that carry a URL -- which is the
// part worth attacking. Anything unrecognised degrades to escaped plain text.

/** HTML-escape. Runs over everything before any markup is generated. */
function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Inline spans: code first, so ** inside `code` stays literal. */
function inline(s: string): string {
  return s
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>')
}

/** A `| a | b |` row split into cells, with the outer pipes dropped. */
function cells(line: string): string[] {
  return line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(c => c.trim())
}

const isTableRow = (l: string) => /^\s*\|.*\|\s*$/.test(l)
/** The `|---|:--:|` separator that turns two stacked rows into a real table. */
const isTableRule = (l: string) => /^\s*\|[\s|:-]+\|\s*$/.test(l)

/**
 * Render markdown to a safe HTML string.
 *
 * Block-level: paragraphs, headings (flattened to a bold lead line), bullet
 * lists, numbered lists and pipe tables.
 */
export function renderMarkdown(input: string): string {
  const lines = escape(input).split('\n')
  const out: string[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // --- table ---------------------------------------------------------
    if (isTableRow(line) && i + 1 < lines.length && isTableRule(lines[i + 1])) {
      const head = cells(line)
      i += 2
      const body: string[][] = []
      while (i < lines.length && isTableRow(lines[i])) {
        body.push(cells(lines[i]))
        i++
      }
      out.push(
        '<table class="analyst-md-table"><thead><tr>' +
          head.map(c => `<th>${inline(c)}</th>`).join('') +
          '</tr></thead><tbody>' +
          body
            .map(r => '<tr>' + r.map(c => `<td>${inline(c)}</td>`).join('') + '</tr>')
            .join('') +
          '</tbody></table>'
      )
      continue
    }

    // --- heading --------------------------------------------------------
    // Rendered as a bold lead line rather than an <h*>: a 380px panel has no
    // use for a heading hierarchy, but leaving them unhandled printed the
    // literal "###" in front of every section the model wrote.
    const heading = line.match(/^\s*#{1,6}\s+(.*)$/)
    if (heading) {
      out.push(`<p class="analyst-md-h">${inline(heading[1].replace(/\s*#+\s*$/, ''))}</p>`)
      i++
      continue
    }

    // --- bullet list ---------------------------------------------------
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(/^\s*[-*]\s+/, ''))}</li>`)
        i++
      }
      out.push(`<ul>${items.join('')}</ul>`)
      continue
    }

    // --- numbered list -------------------------------------------------
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(/^\s*\d+\.\s+/, ''))}</li>`)
        i++
      }
      out.push(`<ol>${items.join('')}</ol>`)
      continue
    }

    // --- blank ---------------------------------------------------------
    if (!line.trim()) {
      i++
      continue
    }

    // --- paragraph: consecutive non-blank, non-block lines --------------
    const para: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^\s*#{1,6}\s+/.test(lines[i]) &&
      !isTableRow(lines[i])
    ) {
      para.push(lines[i].trim())
      i++
    }
    out.push(`<p>${inline(para.join(' '))}</p>`)
  }

  return out.join('')
}
