const mongoose = require('mongoose');
const { createClient } = require('redis');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/vlr_analytics';
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

const vctDataset = [
  { ign: "TenZ", team: "Sentinels", agents: ["Jett", "Omen", "Reyna"], acs: 245.8, kd: 1.22, kdDiff: 142 },
  { ign: "aspas", team: "Leviatán", agents: ["Jett", "Raze", "Neon"], acs: 262.1, kd: 1.38, kdDiff: 289 },
  { ign: "Chronicle", team: "Fnatic", agents: ["Viper", "Killjoy", "Breach"], acs: 218.4, kd: 1.15, kdDiff: 98 },
  { ign: "Boaster", team: "Fnatic", agents: ["Omen", "Astra", "Gekko"], acs: 185.2, kd: 0.95, kdDiff: -22 },
  { ign: "Derke", team: "Vitality", agents: ["Jett", "Raze", "Yoru"], acs: 251.0, kd: 1.24, kdDiff: 195 },
  { ign: "Cryocells", team: "100 Thieves", agents: ["Jett", "Chamber", "Brimstone"], acs: 238.5, kd: 1.21, kdDiff: 110 },
  { ign: "Asuna", team: "100 Thieves", agents: ["Raze", "Gekko", "KAY/O"], acs: 222.9, kd: 1.08, kdDiff: 45 },
  { ign: "something", team: "Paper Rex", agents: ["Jett", "Reyna", "Breach"], acs: 255.3, kd: 1.28, kdDiff: 210 },
  { ign: "f0rsakeN", team: "Paper Rex", agents: ["Yoru", "Breach", "Cypher"], acs: 231.7, kd: 1.14, kdDiff: 88 },
  { ign: "cned", team: "FUT Esports", agents: ["Jett", "Chamber", "Sage"], acs: 240.1, kd: 1.19, kdDiff: 125 }
];

async function seedDatabase() {
  console.log("🚀 Starting data ingestion pipeline...");

  await mongoose.connect(MONGO_URI);
  console.log("✅ MongoDB Connected.");

  const playerSchema = new mongoose.Schema({
    ign: { type: String, required: true, unique: true },
    team: String,
    agents: [String],
    historicalStats: { acs: Number, kd: Number, kdDiff: Number },
    lastUpdated: { type: Date, default: Date.now }
  });
  const Player = mongoose.models.Player || mongoose.model('Player', playerSchema);

  const redisClient = createClient({ url: REDIS_URL });
  await redisClient.connect();
  console.log("✅ Redis Connected.");

  try {
    await Player.deleteMany({});
    await redisClient.del('vct:leaderboard:acs');
    console.log("🧹 Databases cleared for fresh seed ingestion.");

    for (const player of vctDataset) {
      // Write Document to MongoDB
      await Player.create({
        ign: player.ign,
        team: player.team,
        agents: player.agents,
        historicalStats: { acs: player.acs, kd: player.kd, kdDiff: player.kdDiff }
      });

      // Write Score Entry to Redis Sorted Set
      await redisClient.zAdd('vct:leaderboard:acs', { score: player.acs, value: player.ign });
    }

    console.log(`\n🎉 Seed Successful! Loaded ${vctDataset.length} VCT player records.`);
  } catch (error) {
    console.error("❌ Seeding interrupted:", error);
  } finally {
    await mongoose.connection.close();
    await redisClient.quit();
    console.log("🔌 Connections closed safely.");
    process.exit(0);
  }
}

seedDatabase();