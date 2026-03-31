const bcrypt = require("bcrypt");
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const pool = require("./db");
const authMiddleware = require("./authMiddleware");
const { broadcast } = require("./websocket");

const Redis = require("ioredis");

const redis = new Redis({
  host: "redis",
  port: 6379,
});

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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS robot_positions (
      id SERIAL PRIMARY KEY,
      robot_id INTEGER REFERENCES robots(id) ON DELETE CASCADE,
      lat FLOAT,
      lon FLOAT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

/* ===== REGISTER ===== */
app.post("/auth/register", async (req, res) => {
  const { email, password } = req.body;

  try {
    const hash = await bcrypt.hash(password, 10);

    await pool.query(
      "INSERT INTO users (email, password_hash) VALUES ($1, $2)",
      [email, hash],
    );

    res.sendStatus(201);
  } catch (err) {
    res.status(400).send("User already exists");
  }
});

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

/* ===== SET ROBOTS ===== */
app.post("/robots", authMiddleware, async (req, res) => {
  let { name, status, lat, lon } = req.body;

  if (!lat || !lon) {
    lat = 47 + Math.random() * (55 - 47);
    lon = 6 + Math.random() * (15 - 6);
  }

  if (!status) {
    status = Math.random() > 0.5 ? "moving" : "idle";
  }

  if (!name) {
    name = `Robot ${Math.floor(Math.random() * 1000)}`;
  }

  const result = await pool.query(
    `INSERT INTO robots (name, status, lat, lon)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
    [name, status, lat, lon],
  );

  const robot = result.rows[0];

  broadcast(robot);

  await redis.del("robots");

  res.json(robot);
});

/* ===== MOVE ROBOTS ===== */
app.post("/robots/:id/move", authMiddleware, async (req, res) => {
  const { id } = req.params;

  const result = await pool.query("SELECT * FROM robots WHERE id=$1", [id]);

  const robot = result.rows[0];

  if (!robot) return res.sendStatus(404);

  if (robot.status !== "moving") {
    return res.json(robot);
  }

  const lat = robot.lat + (Math.random() - 0.5) * 0.05;
  const lon = robot.lon + (Math.random() - 0.5) * 0.05;

  const updated = await pool.query(
    "UPDATE robots SET lat=$1, lon=$2 WHERE id=$3 RETURNING *",
    [lat, lon, id],
  );

  const updatedRobot = updated.rows[0];

  await pool.query(
    `INSERT INTO robot_positions (robot_id, lat, lon)
    VALUES ($1, $2, $3)`,
    [id, lat, lon],
  );

  broadcast(updatedRobot);

  await redis.del("robots");

  res.json(updatedRobot);
});

/* ===== ROBOTS MOVES HISTORY ===== */
app.get("/robots/:id/history", async (req, res) => {
  const { id } = req.params;

  const result = await pool.query(
    `SELECT lat, lon, created_at
     FROM robot_positions
     WHERE robot_id=$1
     ORDER BY created_at ASC`,
    [id],
  );

  res.json(result.rows);
});

/* ===== SIMULATION ===== */
let simulationInterval = null;

function startSimulation() {
  if (simulationInterval) return;

  simulationInterval = setInterval(simulate, 2000);
  console.log("Simulation STARTED");
}

function stopSimulation() {
  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
    console.log("Simulation STOPPED");
  }
}

app.post("/simulation/start", async (req, res) => {
  startSimulation();
  res.json({ status: "started" });
});

app.post("/simulation/stop", async (req, res) => {
  stopSimulation();
  res.json({ status: "stopped" });
});

const SIMULATION_TOKEN = jwt.sign({ id: 1 }, "secret");

async function simulate() {
  const robots = await pool.query("SELECT * FROM robots");

  for (let r of robots.rows) {
    if (r.status !== "moving") continue;

    await fetch(`http://localhost:3000/robots/${r.id}/move`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SIMULATION_TOKEN}`,
      },
    });
  }
}

(async () => {
  await waitForDB();
  await initDB();

  simulationInterval = setInterval(simulate, 2000);
})();

app.listen(3000, () => console.log("API running"));
