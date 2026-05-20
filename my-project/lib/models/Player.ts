import mongoose from 'mongoose';

const playerSchema = new mongoose.Schema({
  ign: { type: String, required: true, unique: true },
  team: String,
  agents: [String],
  historicalStats: { acs: Number, kd: Number, kdDiff: Number },
  lastUpdated: { type: Date, default: Date.now },
});

export const Player =
  mongoose.models.Player || mongoose.model('Player', playerSchema);