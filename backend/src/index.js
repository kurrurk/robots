const bcrypt = require("bcrypt");
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const pool = require("./db");
const authMiddleware = require("./authMiddleware");

const app = express();
app.use(cors());
app.use(express.json());

/* ===== INIT DB ===== */
async function waitForDB(retries = 10) {
  while (retries) {
    try {
      await pool.query("SELECT 1");
      console.log("DB ready");
      return;
    } catch (err) {
      console.log("Waiting for DB...");
      await new Promise((res) => setTimeout(res, 2000));
      retries--;
    }
  }
  throw new Error("DB not available");
}

async function initDB() {
  const hash = await bcrypt.hash("test123", 10);

  await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            email TEXT UNIQUE,
            password_hash TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        )
    `);

  await pool.query(`
    INSERT INTO users (email, password_hash)
        VALUES ('admin@test.com', '${hash}')
        ON CONFLICT (email) DO NOTHING
    `);

  await pool.query(`
        CREATE TABLE IF NOT EXISTS robots (
            id SERIAL PRIMARY KEY,
            name TEXT,
            status TEXT,
            lat FLOAT,
            lon FLOAT,
            created_at TIMESTAMP DEFAULT NOW()
        )
    `);

  const check = await pool.query("SELECT COUNT(*) FROM robots");
  if (check.rows[0].count == 0) {
    await pool.query(`
            INSERT INTO robots (name, status, lat, lon)
            VALUES
            ('R2D2', 'idle', 50, 10),
            ('C3PO', 'moving', 51, 11)
        `);
  }
}
/* ===== LOGIN ===== */
app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;

  const result = await pool.query("SELECT * FROM users WHERE email=$1", [
    email,
  ]);

  const user = result.rows[0];

  if (!user) return res.sendStatus(401);

  const valid = await bcrypt.compare(password, user.password_hash);

  if (!valid) return res.sendStatus(401);

  const token = jwt.sign({ id: user.id }, "secret");

  res.json({ token });
});

/* ===== GET ROBOTS ===== */
app.get("/robots", authMiddleware, async (req, res) => {
  const cached = await redis.get("robots");

  if (cached) {
    console.log("FROM CACHE");
    return res.json(JSON.parse(cached));
  }
  const result = await pool.query("SELECT * FROM robots");
  await redis.set("robots", JSON.stringify(result.rows), "EX", 100);

  res.json(result.rows);
});

(async () => {
  await waitForDB();
  await initDB();
})();
