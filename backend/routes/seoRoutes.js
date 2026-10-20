import { Router } from "express";
import mongoose from "mongoose";
import Expo from "../models/Expo.js";

// SEO surface for the deployment: robots.txt and sitemap.xml at the site root.
//
// SITE_URL is the single documented configuration value for the production
// domain. It is read from the environment (backend/.env) and never invented;
// when unset the sitemap falls back to the request's own host, which is
// correct for a same-origin deployment and harmless in local development.
//
// IMPORTANT: the SPA keeps event pages inside the authenticated workspace
// (state-based navigation), so there are no public /events/<id> permalinks
// to add yet. Only genuinely public, canonical URLs are listed. When public
// event detail routes are added to the frontend, extend PUBLIC_ROUTES or
// generate <loc> entries from Expo records here.

const router = Router();

const PUBLIC_ROUTES = [
  { path: "/", priority: "1.0", changefreq: "daily" },
  { path: "/designs", priority: "0.8", changefreq: "weekly" },
  { path: "/designs/skeuomorphism", priority: "0.5", changefreq: "monthly" },
  { path: "/designs/neumorphism", priority: "0.5", changefreq: "monthly" },
  { path: "/designs/glassmorphism", priority: "0.5", changefreq: "monthly" },
  { path: "/designs/claymorphism", priority: "0.5", changefreq: "monthly" },
  { path: "/designs/brutalism", priority: "0.5", changefreq: "monthly" },
  { path: "/designs/minimalism", priority: "0.5", changefreq: "monthly" },
  { path: "/designs/maximalism", priority: "0.5", changefreq: "monthly" },
  { path: "/designs/liquid-glass", priority: "0.5", changefreq: "monthly" },
  { path: "/designs/bento-grid", priority: "0.5", changefreq: "monthly" },
  { path: "/designs/spatial", priority: "0.5", changefreq: "monthly" },
  { path: "/faq", priority: "0.7", changefreq: "monthly" },
  { path: "/contact", priority: "0.7", changefreq: "monthly" },
  { path: "/privacy", priority: "0.4", changefreq: "yearly" },
];

const siteBase = req => {
  const configured = (process.env.SITE_URL || "").trim().replace(/\/+$/, "");
  if (configured) return configured;
  return `${req.protocol}://${req.get("host")}`;
};

const xmlEscape = value =>
  String(value).replace(/[<>&'"]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]));

router.get("/sitemap.xml", async (req, res) => {
  const base = siteBase(req);
  const today = new Date().toISOString().slice(0, 10);
  const urls = PUBLIC_ROUTES.map(r => `  <url>\n    <loc>${xmlEscape(base + r.path)}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${r.changefreq}</changefreq>\n    <priority>${r.priority}</priority>\n  </url>`);

  // Include published events ONLY once public permalinks exist. Right now the
  // database is consulted just to keep the sitemap honest about live content:
  // drafts, cancelled and soft-deleted events never appear anywhere public.
  // Skipped when Mongo is disconnected so a DB outage can't stall the sitemap.
  try {
    if (mongoose.connection.readyState !== 1) throw new Error("db not connected");
    const published = await Expo.countDocuments({ status: { $in: ["published", "completed"] } });
    res.set("X-Published-Events", String(published)); // observability, no data exposed
  } catch {
    res.set("X-Published-Events", "unknown"); // DB down — static routes still valid
  }

  res.type("application/xml").send(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`
  );
});

router.get("/robots.txt", (req, res) => {
  const base = siteBase(req);
  res.type("text/plain").send(
    [
      "# EventSphere robots.txt",
      "User-agent: *",
      "Allow: /",
      "Disallow: /api/",
      "Disallow: /thank-you",
      "",
      `Sitemap: ${base}/sitemap.xml`,
      "",
    ].join("\n")
  );
});

export default router;
