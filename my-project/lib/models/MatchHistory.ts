import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

const matchHistorySchema = new Schema({
  ign: { type: String, required: true, index: true },
  team: { type: String, required: true },
  event: { type: String, required: true },
  playedAt: { type: Date, required: true, index: true },
  opponent: { type: String, required: true },
  map: { type: String, required: true },
  agent: { type: String, required: true },
  result: { type: String, enum: ['W', 'L'], required: true },
  score: { type: String, required: true },
  sourceUrl: String,
  stats: {
    acs: { type: Number, required: true },
    kills: { type: Number, required: true },
    deaths: { type: Number, required: true },
    assists: { type: Number, required: true },
    kd: { type: Number, required: true },
  },
});

matchHistorySchema.index({ ign: 1, playedAt: -1 });

export type MatchHistoryRecord = InferSchemaType<typeof matchHistorySchema>;

export const MatchHistory: Model<MatchHistoryRecord> =
  (mongoose.models.MatchHistory as Model<MatchHistoryRecord> | undefined) ??
  mongoose.model<MatchHistoryRecord>('MatchHistory', matchHistorySchema);
