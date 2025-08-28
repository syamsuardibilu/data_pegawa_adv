// server.js
require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const mysql = require("mysql2/promise");
const path = require("path");

const app = express();

// ——— Security & parser
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ——— Static (serve public/index.html → same-origin)
app.use(
  express.static(path.join(__dirname, "public"), { index: "index.html" })
);

// ——— Rate limit untuk endpoint API
const limiter = rateLimit({ windowMs: 60_000, max: 120 });
app.use("/api/", limiter);

// ——— Pool MySQL
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  connectionLimit: 10,
  waitForConnections: true,
});

// ——— Healthcheck optional
app.get("/api/health", async (_req, res) => {
  try {
    const [r] = await pool.query("SELECT 1 AS ok");
    res.json({ ok: r[0].ok === 1 });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ——— Util sederhana
const isEmail = (v) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());
const cleanPhone = (raw) => {
  const s = String(raw || "").replace(/\D/g, "");
  if (!s) return "";
  // normalisasi: 62 + nomor tanpa 0 di awal
  return s.startsWith("62") ? s : `62${s.replace(/^0/, "")}`;
};

// ——— POST /api/pegawai/add
app.post("/api/pegawai/add", async (req, res) => {
  try {
    let { nip, nama, bidang, no_telp, email, alamat } = req.body || {};

    // Validasi
    if (!nip || !nama || !bidang || !no_telp || !email) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Field wajib (NIP, NAMA, BIDANG, NO_TELP, EMAIL).",
        });
    }
    if (!isEmail(email)) {
      return res
        .status(400)
        .json({ success: false, message: "Format email tidak valid." });
    }

    const telp = cleanPhone(no_telp);
    if (!/^\d{8,15}$/.test(telp)) {
      return res
        .status(400)
        .json({ success: false, message: "No. telp tidak valid." });
    }

    // Insert (NIP unik)
    const sql = `
      INSERT INTO kontak_pegawai (nip, nama, bidang, no_telp, email, alamat)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const [result] = await pool.execute(sql, [
      String(nip).trim(),
      String(nama).trim(),
      String(bidang).trim(),
      telp,
      String(email).trim().toLowerCase(),
      alamat ? String(alamat).trim() : null,
    ]);

    res.json({ success: true, id: result.insertId });
  } catch (err) {
    // Tangani DUPLICATE NIP
    if (err && err.code === "ER_DUP_ENTRY") {
      return res
        .status(409)
        .json({ success: false, message: "NIP sudah terdaftar." });
    }
    console.error("add pegawai error:", err);
    res.status(500).json({ success: false, message: "Gagal menyimpan data." });
  }
});

// ——— GET /api/pegawai/list
// Query optional: ?q=kata&limit=50&offset=0
app.get("/api/pegawai/list", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const limit = Math.min(parseInt(req.query.limit || "100", 10), 500);
    const offset = Math.max(parseInt(req.query.offset || "0", 10), 0);

    let where = "";
    let params = [];
    if (q) {
      where = `WHERE (nip LIKE ? OR nama LIKE ? OR bidang LIKE ? OR email LIKE ? OR no_telp LIKE ?)`;
      const like = `%${q}%`;
      params = [like, like, like, like, like];
    }

    const sql = `
      SELECT id, nip, nama, bidang, no_telp, email, alamat, created_at
      FROM kontak_pegawai
      ${where}
      ORDER BY id DESC
      LIMIT ? OFFSET ?
    `;
    const [rows] = await pool.execute(sql, [...params, limit, offset]);

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("list pegawai error:", err);
    res.status(500).json({ success: false, message: "Gagal mengambil data." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
