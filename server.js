const express = require('express');
const mongoose = require('mongoose');
const { createClient } = require('redis');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/vlr_analytics';
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

// 1. CONNECTIONS
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB Persistent Cluster Online.'))
  .catch(err => console.error('❌ MongoDB Connection Failure:', err));

const redisClient = createClient({ url: REDIS_URL });
redisClient.on('error', err => console.error('❌ Redis Cache Cluster Failure:', err));
redisClient.connect().then(() => console.log('✅ Redis Speed Layer Online.'));

// 2. MONGOOSE DATA MODEL
const playerSchema = new mongoose.Schema({
  ign: { type: String, required: true, unique: true },
  team: String,
  agents: [String],
  historicalStats: { acs: Number, kd: Number, kdDiff: Number },
  lastUpdated: { type: Date, default: Date.now }
});
const Player = mongoose.model('Player', playerSchema);

// 3. API ROUTE: FETCH LEADERBOARD (Pure Redis execution for speed)
app.get('/api/leaderboard', async (req, res) => {
  try {
    const topPlayers = await redisClient.zRangeWithScores('vct:leaderboard:acs', 0, -1, { REV: true });
    res.json(topPlayers);
  } catch (error) {
    res.status(500).json({ error: "Failed to compute real-time standing calculations." });
  }
});

// 4. API ROUTE: CACHE-ASIDE PROFILE QUERY (MongoDB + Redis Integration)
app.get('/api/player/:ign', async (req, res) => {
  const { ign } = req.params;
  const cacheKey = `player:cache:${ign.toLowerCase()}`;

  try {
    // Attempt cache read
    const cachedData = await redisClient.hGetAll(cacheKey);
    if (cachedData && cachedData.ign) {
      return res.json({ source: 'Redis In-Memory Cache Layer', data: {
        ...cachedData,
        agents: JSON.parse(cachedData.agents)
      }});
    }

    // Cache Miss -> Query primary MongoDB storage
    const dbPlayer = await Player.findOne({ ign: { $regex: new RegExp(`^${ign}$`, 'i') } });
    if (!dbPlayer) return res.status(404).json({ error: "Player profile target signature not found." });

    const flatPayload = {
      ign: dbPlayer.ign,
      team: dbPlayer.team,
      agents: JSON.stringify(dbPlayer.agents),
      acs: dbPlayer.historicalStats.acs.toString(),
      kd: dbPlayer.historicalStats.kd.toString(),
      kdDiff: dbPlayer.historicalStats.kdDiff.toString()
    };

    // Populate the Redis cache hash with an explicit 60-second expiration window
    await redisClient.hSet(cacheKey, flatPayload);
    await redisClient.expire(cacheKey, 60);

    res.json({ source: 'MongoDB Primary Document Store', data: dbPlayer });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Data pipeline execution error during search query routing." });
  }
});

app.listen(3000, () => console.log('🚀 Web Stack Core Active on Port 3000'));