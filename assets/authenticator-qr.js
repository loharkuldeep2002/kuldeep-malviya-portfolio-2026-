/* Render the private enrollment URI locally. No external QR service is used. */
(() => {
  'use strict';
  window.createAuthenticatorQr = function (uri) {
    const figure = document.createElement('figure');
    figure.className = 'auth-qr';
    try {
      if (typeof uri !== 'string' || !uri.startsWith('otpauth://totp/')) throw new Error('Invalid enrollment URI');
      const qr = window.qrcode(0, 'M');
      qr.addData(uri, 'Byte');
      qr.make();
      const count = qr.getModuleCount();
      const quiet = 4;
      const scale = Math.max(4, Math.ceil(280 / (count + quiet * 2)));
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = (count + quiet * 2) * scale;
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', 'Authenticator setup QR code. Scan with your authenticator app, or use the setup key below.');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas unavailable');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#000000';
      for (let row = 0; row < count; row++) {
        for (let col = 0; col < count; col++) {
          if (qr.isDark(row, col)) ctx.fillRect((col + quiet) * scale, (row + quiet) * scale, scale, scale);
        }
      }
      const caption = document.createElement('figcaption');
      caption.textContent = 'Scan this QR code in Google Authenticator, Microsoft Authenticator or another authenticator app.';
      figure.append(canvas, caption);
    } catch {
      figure.textContent = 'QR preview is unavailable. Use the manual setup key below.';
    }
    return figure;
  };
})();
