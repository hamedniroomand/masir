// Email clients strip <style> blocks and do not support flex or grid.
// Every rule must stay inline, and the layout must stay table based.
const FONT = `'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`;

const COLOR = {
  page: '#f5f6f9',
  card: '#ffffff',
  border: '#e7e9ef',
  primary: '#635bff',
  heading: '#242738',
  text: '#45495b',
  muted: '#707589',
};

export function layout(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
</head>
<body style="margin:0;padding:0;background-color:${COLOR.page};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${COLOR.page};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;">
<tr><td style="padding-bottom:20px;font-family:${FONT};font-size:17px;font-weight:600;color:${COLOR.heading};">Masir</td></tr>
<tr><td style="background-color:${COLOR.card};border:1px solid ${COLOR.border};border-radius:10px;padding:32px;font-family:${FONT};font-size:15px;line-height:24px;color:${COLOR.text};">${body}</td></tr>
<tr><td style="padding-top:20px;font-family:${FONT};font-size:12px;line-height:18px;color:${COLOR.muted};">Masir sent this message automatically. Do not reply to it.</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export function paragraph(html: string): string {
  return `<p style="margin:0 0 16px;">${html}</p>`;
}

// Some clients block the button. The plain link below it keeps the mail usable.
export function action(href: string, label: string): string {
  const url = Bun.escapeHTML(href);
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;"><tr><td bgcolor="${COLOR.primary}" style="border-radius:6px;">
<a href="${url}" style="display:inline-block;padding:12px 24px;font-family:${FONT};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:6px;">${Bun.escapeHTML(label)}</a>
</td></tr></table>
<p style="margin:0;font-size:13px;line-height:20px;color:${COLOR.muted};">If the button does not work, copy this link:<br><a href="${url}" style="color:${COLOR.primary};text-decoration:underline;word-break:break-all;">${url}</a></p>`;
}
