import WalletModel   from './models/Wallet.js';
import Settings      from './models/Settings.js';
import TransferModel from './models/Transfer.js';
import AlertModel    from './models/Alert.js';
import logger        from '../utils/logger.js';

/* BigInt ↔ String (MongoDB không lưu được BigInt natively) */
const toStr = (v) => (v != null ? String(v) : null);
const toBig = (s) => (s != null ? BigInt(s) : undefined);

const MAX_TRANSFERS      = 500;
const ALERT_RETENTION_MS = 24 * 60 * 60 * 1000; // giữ cảnh báo 24 giờ

class DatabaseService {
  /* ═══════════════════════════ WALLETS ═══════════════════════════ */

  /** Load tất cả ví kèm override (dùng lúc startup) */
  async getAllWalletsWithOverrides() {
    const docs = await WalletModel.find().lean();
    return docs.map(doc => ({
      wallet: {
        address:     doc.address,
        label:       doc.label,
        category:    doc.category,
        logo:        doc.logo,
        website:     doc.website,
        description: doc.description,
      },
      override: doc.alertOverride?.thresholdRaw
        ? {
            thresholdRaw:  toBig(doc.alertOverride.thresholdRaw),
            changePercent: doc.alertOverride.changePercent,
          }
        : null,
    }));
  }

  /** Seed ví mặc định từ config nếu collection còn rỗng */
  async seedWallets(wallets) {
    const count = await WalletModel.countDocuments();
    if (count > 0) return;
    await WalletModel.insertMany(wallets.map(w => ({
      address:     w.address,
      label:       w.label       ?? '',
      category:    w.category    ?? 'other',
      logo:        w.logo        ?? '💼',
      website:     w.website     ?? '',
      description: w.description ?? '',
    })));
    logger.info(`[DB] Seed ${wallets.length} ví mặc định vào MongoDB`);
  }

  /** Lưu ví mới. Trả về false nếu địa chỉ đã tồn tại. */
  async saveWallet(wallet) {
    try {
      await WalletModel.create({
        address:     wallet.address,
        label:       wallet.label       ?? '',
        category:    wallet.category    ?? 'other',
        logo:        wallet.logo        ?? '💼',
        website:     wallet.website     ?? '',
        description: wallet.description ?? '',
      });
      return true;
    } catch (err) {
      if (err.code === 11000) return false;
      throw err;
    }
  }

  async deleteWallet(address) {
    const { deletedCount } = await WalletModel.deleteOne({ address: address.toLowerCase() });
    return deletedCount > 0;
  }

  async saveWalletAlertOverride(address, config) {
    await WalletModel.updateOne(
      { address: address.toLowerCase() },
      { $set: { alertOverride: {
          thresholdRaw:  toStr(config.thresholdRaw),
          changePercent: config.changePercent,
        },
      }},
    );
  }

  async clearWalletAlertOverride(address) {
    await WalletModel.updateOne(
      { address: address.toLowerCase() },
      { $set: { alertOverride: null } },
    );
  }

  /* ═══════════════════════════ SETTINGS ══════════════════════════ */

  /** Lấy hoặc khởi tạo document settings global */
  async getSettings() {
    let doc = await Settings.findById('global').lean();
    if (!doc) {
      doc = (await Settings.create({ _id: 'global' })).toObject();
      logger.info('[DB] Tạo document settings mặc định');
    }
    return doc;
  }

  async updateAlertConfig(cfg) {
    const update = {};
    if (cfg.thresholdRaw      != null) update['alertConfig.thresholdRaw']      = toStr(cfg.thresholdRaw);
    if (cfg.changePercent     != null) update['alertConfig.changePercent']      = cfg.changePercent;
    if (cfg.absoluteChangeRaw != null) update['alertConfig.absoluteChangeRaw'] = toStr(cfg.absoluteChangeRaw);
    await Settings.findByIdAndUpdate('global', { $set: update }, { upsert: true });
  }

  async updateDiscordConfig(cfg) {
    await Settings.findByIdAndUpdate(
      'global',
      { $set: { discordConfig: cfg } },
      { upsert: true },
    );
  }

  /** Chuyển alertConfig lưu trong DB (strings) thành runtime (BigInt) */
  parseAlertConfig(alertConfig) {
    return {
      thresholdRaw:      toBig(alertConfig.thresholdRaw)      ?? 1_000_000_000_000_000_000n,
      changePercent:     alertConfig.changePercent             ?? 1,
      absoluteChangeRaw: toBig(alertConfig.absoluteChangeRaw) ?? 100_000_000_000_000_000_000n,
    };
  }

  /* ═══════════════════════════ TRANSFERS ══════════════════════════ */

  /** Load N giao dịch gần nhất (mới nhất trước) */
  async getRecentTransfers(limit = MAX_TRANSFERS) {
    return TransferModel.find().sort({ timeStamp: -1 }).limit(limit).lean();
  }

  /** Lưu một giao dịch. Bỏ qua nếu đã có (duplicate hash+tokenSymbol). */
  async saveTransfer(tx) {
    try {
      await TransferModel.create(tx);
    } catch (err) {
      if (err.code !== 11000) throw err;
    }
    /* Trim về MAX khi overflow */
    const count = await TransferModel.countDocuments();
    if (count > MAX_TRANSFERS + 50) {
      const oldest = await TransferModel
        .find({}, '_id')
        .sort({ timeStamp: 1 })
        .limit(count - MAX_TRANSFERS);
      await TransferModel.deleteMany({ _id: { $in: oldest.map(d => d._id) } });
    }
  }

  /* ═══════════════════════════ ALERTS ════════════════════════════ */

  /** Load tất cả cảnh báo trong 24 giờ gần nhất (mới nhất trước) */
  async getRecentAlerts() {
    const since = new Date(Date.now() - ALERT_RETENTION_MS);
    return AlertModel.find({ timestamp: { $gte: since } }).sort({ timestamp: -1 }).lean();
  }

  /** Lưu một cảnh báo và xóa những bản cũ hơn 24 giờ. */
  async saveAlert(alert) {
    await AlertModel.create({
      walletAddr:  alert.walletAddr  ?? '',
      walletLabel: alert.walletLabel ?? '',
      token:       alert.token       ?? '',
      level:       alert.level,
      message:     alert.message     ?? '',
      timestamp:   new Date(alert.timestamp ?? Date.now()),
    });
    /* Xóa cảnh báo cũ hơn 24 giờ (không await để không chặn luồng chính) */
    const cutoff = new Date(Date.now() - ALERT_RETENTION_MS);
    AlertModel.deleteMany({ timestamp: { $lt: cutoff } }).catch(() => {});
  }
}

export default new DatabaseService();
