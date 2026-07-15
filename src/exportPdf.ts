import type { Message } from './types';

/**
 * Export the conversation as a downloadable PDF by opening a print-friendly
 * window and calling the browser's print-to-PDF. This avoids bundling a heavy
 * PDF library and produces a clean, styled document.
 */
export function exportConversationPdf(messages: Message[], title = 'IAI System Projet') {
  const win = window.open('', '_blank', 'width=720,height=900');
  if (!win) return;

  const lines = messages.map((m) => {
    const who = m.role === 'user' ? 'Vous' : 'IAI System';
    const time = new Date(m.createdAt).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    const content = stripMarkdown(m.content);
    return `<div class="msg ${m.role}">
      <div class="meta">${escapeHtml(who)} · ${time}</div>
      <div class="body">${escapeHtml(content).replace(/\n/g, '<br/>')}</div>
    </div>`;
  });

  win.document.write(`<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)} — Conversation</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Inter', -apple-system, system-ui, sans-serif; margin: 0; padding: 40px; color: #0f172a; background: #fff; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .sub { color: #64748b; font-size: 13px; margin-bottom: 28px; }
  .msg { margin-bottom: 18px; padding: 14px 16px; border-radius: 12px; page-break-inside: avoid; }
  .msg.user { background: #eef6ff; border-left: 3px solid #38bdf8; }
  .msg.assistant { background: #f8fafc; border-left: 3px solid #a78bfa; }
  .meta { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
  .msg.user .meta { color: #0284c7; }
  .msg.assistant .meta { color: #7c3aed; }
  .body { font-size: 14px; line-height: 1.55; white-space: normal; word-wrap: break-word; }
  .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
  @media print { body { padding: 20px; } }
</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="sub">Exporté le ${new Date().toLocaleString('fr-FR')} · ${messages.length} messages</div>
  ${lines.join('\n')}
  <div class="footer">Généré par IAI System Projet</div>
  <script>
    window.onload = function() { setTimeout(function() { window.print(); }, 400); };
  </script>
</body>
</html>`);
  win.document.close();
}

function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```\w*\n?/g, '').replace(/```$/g, ''))
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    .replace(/^#{1,6}\s+/gm, '');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
