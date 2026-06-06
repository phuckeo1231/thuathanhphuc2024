import mongoose from 'mongoose';

/* Singleton document — luôn dùng _id = 'global' */
const settingsSchema = new mongoose.Schema({
  _id: { type: String, default: 'global' },

  alertConfig: {
    thresholdRaw:      { type: String,  default: '1000000000000000000'    },
    changePercent:     { type: Number,  default: 1                        },
    absoluteChangeRaw: { type: String,  default: '100000000000000000000'  },
  },

  discordConfig: {
    webhookUrl:  { type: String,  default: ''    },
    enabled:     { type: Boolean, default: false },
    sendHigh:    { type: Boolean, default: true  },
    sendMedium:  { type: Boolean, default: true  },
    sendLow:     { type: Boolean, default: false },
  },
});

export default mongoose.model('Settings', settingsSchema);
