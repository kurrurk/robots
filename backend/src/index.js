const bcrypt = require("bcrypt");
const pool = require("./db");

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

(async () => {
  await waitForDB();
  await initDB();
})();
