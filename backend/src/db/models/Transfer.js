import mongoose from 'mongoose';

const transferSchema = new mongoose.Schema({
  hash:            { type: String, required: true },
  timeStamp:       { type: Number, required: true, index: true },
  from:            { type: String, default: null },
  fromLabel:       { type: String, default: null },
  to:              { type: String, default: null },
  toLabel:         { type: String, default: null },
  valueFormatted:  { type: String, default: '0'  },
  valueRaw:        { type: Number, default: 0     },
  tokenSymbol:     { type: String, default: ''   },
  tokenName:       { type: String, default: ''   },
  tokenDecimal:    { type: String, default: '18' },
  contractAddress: { type: String, default: null },
  walletAddress:   { type: String, default: ''   },
  walletLabel:     { type: String, default: ''   },
  _derived:        { type: Boolean, default: false },
});

/* Hash + tokenSymbol cùng nhau là unique (1 tx BSCScan có thể chứa nhiều token) */
transferSchema.index({ hash: 1, tokenSymbol: 1 }, { unique: true });

export default mongoose.model('Transfer', transferSchema);
