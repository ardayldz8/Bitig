/**
 * Küçük, güvenli Markdown → HTML dönüştürücü.
 *
 * Güvenlik yaklaşımı: ÖNCE tüm HTML kaçışlanır, SONRA yalnızca izin verilen
 * biçimlendirmeler geri eklenir. Böylece kullanıcı içeriğindeki hiçbir etiket
 * (script, img onerror, iframe …) HTML olarak çalışamaz — XSS yüzeyi kalmaz.
 * Harici bir sanitizer'a bağımlılık yoktur.
 */

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Yalnızca http/https bağlantılara izin verilir (javascript: engellenir). */
function safeHref(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : null;
  } catch {
    return null;
  }
}

function inline(text: string): string {
  let output = text;

  // `kod`
  output = output.replace(/`([^`]+)`/g, (_match, code: string) => `<code>${code}</code>`);
  // **kalın**
  output = output.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  // *italik*
  output = output.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
  // [metin](url)
  output = output.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    (_match: string, label: string, rawUrl: string) => {
      const href = safeHref(rawUrl.replace(/&amp;/g, "&"));
      if (!href) return label;
      return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    },
  );

  return output;
}

export function renderMarkdown(source: string): string {
  const escaped = escapeHtml(source);
  const lines = escaped.split("\n");

  const html: string[] = [];
  let listOpen = false;

  const closeList = () => {
    if (listOpen) {
      html.push("</ul>");
      listOpen = false;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      closeList();
      continue;
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(trimmed);
    if (heading) {
      closeList();
      const level = heading[1].length + 2; // h3..h5
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }

    const listItem = /^[-*]\s+(.*)$/.exec(trimmed);
    if (listItem) {
      if (!listOpen) {
        html.push("<ul>");
        listOpen = true;
      }
      html.push(`<li>${inline(listItem[1])}</li>`);
      continue;
    }

    closeList();
    html.push(`<p>${inline(trimmed)}</p>`);
  }

  closeList();
  return html.join("");
}
