function escapeHtml(raw: string): string {
  return (raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(raw: string): string {
  // Basic attribute escaping (we already escape HTML entities).
  return escapeHtml(raw).replace(/`/g, '&#96;');
}

export function markdownToSafeHtml(markdown: string): string {
  const md = (markdown || '').replace(/\r\n/g, '\n');
  if (!md.trim()) return '';

  // Extract fenced code blocks first.
  const codeBlocks: string[] = [];
  const withPlaceholders = md.replace(/```([\s\S]*?)```/g, (_, code: string) => {
    const escaped = escapeHtml(code.replace(/^\n/, '').replace(/\n$/, ''));
    const html = `<pre><code>${escaped}</code></pre>`;
    const idx = codeBlocks.push(html) - 1;
    return `@@CODE_BLOCK_${idx}@@`;
  });

  const lines = withPlaceholders.split('\n');
  const out: string[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? '';
    const trimmed = line.trimEnd();

    if (!trimmed.trim()) {
      i += 1;
      continue;
    }

    const h = trimmed.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const text = inlineFormat(escapeHtml(h[2]));
      out.push(`<h${level}>${text}</h${level}>`);
      i += 1;
      continue;
    }

    const ul = trimmed.match(/^[-*]\s+(.*)$/);
    if (ul) {
      const items: string[] = [];
      while (i < lines.length) {
        const m = (lines[i] || '').trimEnd().match(/^[-*]\s+(.*)$/);
        if (!m) break;
        items.push(`<li>${inlineFormat(escapeHtml(m[1]))}</li>`);
        i += 1;
      }
      out.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    const ol = trimmed.match(/^\d+\.\s+(.*)$/);
    if (ol) {
      const items: string[] = [];
      while (i < lines.length) {
        const m = (lines[i] || '').trimEnd().match(/^\d+\.\s+(.*)$/);
        if (!m) break;
        items.push(`<li>${inlineFormat(escapeHtml(m[1]))}</li>`);
        i += 1;
      }
      out.push(`<ol>${items.join('')}</ol>`);
      continue;
    }

    // Paragraph: collect until blank line.
    const para: string[] = [];
    while (i < lines.length) {
      const l = (lines[i] || '').trimEnd();
      if (!l.trim()) break;
      // Stop paragraph when we encounter a structural block.
      if (/^(#{1,3})\s+/.test(l) || /^[-*]\s+/.test(l) || /^\d+\.\s+/.test(l) || /^@@CODE_BLOCK_\d+@@$/.test(l.trim())) {
        break;
      }
      para.push(l);
      i += 1;
    }
    const text = inlineFormat(escapeHtml(para.join(' ')));
    out.push(`<p>${text}</p>`);
  }

  const html = out.join('\n')
    .replace(/@@CODE_BLOCK_(\d+)@@/g, (_, idx: string) => codeBlocks[Number(idx)] || '')
    .replace(/\n{3,}/g, '\n\n');

  return html;
}

function inlineFormat(text: string): string {
  // Inline code
  let out = text.replace(/`([^`]+)`/g, (_, code: string) => `<code>${escapeHtml(code)}</code>`);
  // Links: [text](url)
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label: string, url: string) => {
    const safeUrl = escapeAttr(url);
    const safeLabel = label;
    return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${safeLabel}</a>`;
  });
  // Bold and italic
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  // Code block placeholder line as-is
  return out;
}

