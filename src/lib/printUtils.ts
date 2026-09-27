/**
 * Reliable Isolated Print Utility
 * Creates a sandboxed hidden iframe with dedicated CSS to ensure 100% clean printing
 * without blank pages, CSS conflicts, or modal interference.
 */

export function printHtmlDirectly(htmlContent: string, title = 'Документ на печать', customCss = ''): void {
  // Remove any existing print iframes
  const oldIframe = document.getElementById('isolated-print-iframe');
  if (oldIframe) {
    oldIframe.remove();
  }

  const iframe = document.createElement('iframe');
  iframe.id = 'isolated-print-iframe';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';

  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    console.error('Failed to access print iframe document');
    window.print();
    return;
  }

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <title>${title}</title>
      <style>
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
          color: #000000;
          background: #ffffff;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        ${customCss}
      </style>
    </head>
    <body>
      ${htmlContent}
      <script>
        window.onload = function() {
          setTimeout(function() {
            window.focus();
            window.print();
          }, 150);
        };
      </script>
    </body>
    </html>
  `);
  doc.close();

  // Clean up iframe after print dialog completes (or after timeout)
  setTimeout(() => {
    try {
      iframe.remove();
    } catch {
      // ignore
    }
  }, 60000);
}
