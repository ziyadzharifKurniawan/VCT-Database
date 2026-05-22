import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

const playerSchema = new Schema({
  ign: { type: String, required: true, unique: true },
  team: { type: String, required: true },
  agents: [{ type: String, required: true }],
  historicalStats: {
    acs: { type: Number, required: true },
    kd: { type: Number, required: true },
    kdDiff: { type: Number, required: true },
  },
  lastUpdated: { type: Date, default: Date.now },
});

export type PlayerRecord = InferSchemaType<typeof playerSchema>;

export const Player: Model<PlayerRecord> =
  (mongoose.models.Player as Model<PlayerRecord> | undefined) ??
  mongoose.model<PlayerRecord>('Player', playerSchema);
