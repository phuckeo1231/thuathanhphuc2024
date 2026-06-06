import mongoose from 'mongoose';

const alertOverrideSchema = new mongoose.Schema({
  thresholdRaw:  { type: String },
  changePercent: { type: Number },
}, { _id: false });

const walletSchema = new mongoose.Schema({
  address:     { type: String, required: true, unique: true, lowercase: true, trim: true },
  label:       { type: String, default: '' },
  category:    { type: String, default: 'other' },
  logo:        { type: String, default: '💼' },
  website:     { type: String, default: '' },
  description: { type: String, default: '' },
  alertOverride: { type: alertOverrideSchema, default: null },
}, { timestamps: true });

export default mongoose.model('Wallet', walletSchema);
