/**
 * Local / daemon keep-alive script.
 * Pings https://probooker.onrender.com/health every 8 minutes.
 */
const URL = "https://probooker.onrender.com/health";
const INTERVAL_MS = 8 * 60 * 1000; // 8 minutes

async function ping() {
  const now = new Date().toISOString();
  try {
    const res = await fetch(URL, { headers: { "User-Agent": "ProBooker-KeepAlive/1.0" } });
    const data = await res.json();
    console.log(`[${now}] Ping OK (status ${res.status}, uptime ${data.uptime?.toFixed(1)}s)`);
  } catch (err) {
    console.error(`[${now}] Ping failed:`, err.message);
  }
}

console.log(`Starting ProBooker keep-alive for ${URL} every 8 minutes...`);
ping();
setInterval(ping, INTERVAL_MS);
