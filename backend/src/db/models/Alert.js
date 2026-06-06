import mongoose from 'mongoose';

const alertSchema = new mongoose.Schema({
  walletAddr:  { type: String, default: '' },
  walletLabel: { type: String, default: '' },
  token:       { type: String, default: '' },
  level:       { type: String, enum: ['high', 'medium', 'low'], required: true },
  message:     { type: String, default: '' },
  timestamp:   { type: Date,   default: Date.now, index: true },
});

export default mongoose.model('Alert', alertSchema);
