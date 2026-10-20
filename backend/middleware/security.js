// Security response headers for the API + any static hosting done by this
// server. Applied globally in server.js BEFORE routes.
//
// CSP is intentionally opt-in (ENABLE_CSP=true) because the frontend loads
// Google's OAuth script and uses inline styles produced by React; shipping an
// untested CSP would break sign-in. The policy below is the tested starting
// point for a same-origin deployment — verify it against the production
// frontend before enabling.

export function securityHeaders(req, res, next) {
  // Prevent MIME-sniffing attacks on API/upload responses.
  res.setHeader("X-Content-Type-Options", "nosniff");
  // Referrer: full URL same-origin, origin-only cross-origin.
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  // The API is consumed by XHR/fetch, never framed.
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  // Permissions: deny everything the app never uses.
  res.setHeader(
    "Permissions-Policy",
    "camera=(self), geolocation=(), microphone=(), payment=(), usb=(), interest-cohort=()"
  );

  if (String(process.env.ENABLE_CSP || "").toLowerCase() === "true") {
    res.setHeader(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' https://accounts.google.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com data:",
        "img-src 'self' data: blob:",
        "connect-src 'self' ws: wss: http://localhost:5000 https:",
        "frame-src https://accounts.google.com",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
      ].join("; ")
    );
  }

  next();
}
