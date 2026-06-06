/**
 * Entry point — kết nối tất cả các thành phần lại với nhau.
 *
 * Thứ tự khởi tạo:
 *   1. DB       → kết nối MongoDB, load wallets + settings
 *   2. Factory  → tạo đúng loại provider (HTTP hoặc WS)
 *   3. Singleton → lưu provider vào ProviderManager
 *   4. Observer  → WsServer đăng ký lắng nghe EventBus
 *   5. Strategy  → MonitorManager cấu hình WalletMonitor với các strategy
 *   6. Provider  → bắt đầu lắng nghe blockchain
 *
 * REST API (quản lý ví):
 *   GET    /api/wallets          — danh sách ví đang theo dõi
 *   POST   /api/wallets          — thêm ví { address, label? }
 *   DELETE /api/wallets/:address — xóa ví
 */
import { createServer } from 'http';

import config                   from './config/config.js';
import { connectDB }             from './db/connection.js';
import db                        from './db/DatabaseService.js';
import providerManager          from './core/ProviderManager.js';
import ProviderFactory          from './factory/ProviderFactory.js';
import MonitorManager           from './monitors/MonitorManager.js';
import WsServer                 from './core/WsServer.js';
import eventBus                 from './core/EventBus.js';
import discordService                                    from './services/DiscordService.js';
import { startTrendingService }                          from './services/TrendingService.js';
import { startTransferService, initStore, setTransferSaveFn } from './services/TransferService.js';
import logger                                            from './utils/logger.js';

/* ── Bắt lỗi toàn cục — ngăn server crash ────────────────── */
process.on('unhandledRejection', (reason) => {
  logger.error('[Process] Unhandled rejection:', reason?.message ?? String(reason));
});
process.on('uncaughtException', (err) => {
  logger.error('[Process] Uncaught exception:', err.message);
});

/* ── Đọc body JSON từ request ────────────────────────────── */
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => (data += chunk));
    req.on('end',  () => resolve(data));
    req.on('error', reject);
  });
}

/* ── HTTP Server + REST API ──────────────────────────────── */
const httpServer = createServer(async (req, res) => {
  // CORS — cho phép frontend gọi REST API
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = req.url ?? '/';

  /* ── GET /health ── */
  if (url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
    return;
  }

  /* ── GET /api/snapshot — trả về snapshot số dư hiện tại cho frontend load ngay ── */
  if (url === '/api/snapshot' && req.method === 'GET') {
    const payload = wsServer?.getSnapshotPayload();
    if (!payload) {
      res.writeHead(204); // snapshot chưa sẵn sàng
      res.end();
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(payload));
    return;
  }

  /* ── GET /api/wallets ── */
  if (url === '/api/wallets' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(monitorManager.listWallets()));
    return;
  }

  /* ── POST /api/wallets ── */
  if (url === '/api/wallets' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const { address, label } = JSON.parse(body);

      if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address.trim())) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Địa chỉ ví BSC không hợp lệ (cần 0x + 40 ký tự hex)' }));
        return;
      }

      const addr   = address.trim().toLowerCase();
      const lbl    = (label ?? '').trim() || `Ví BSC ${monitorManager.listWallets().length + 1}`;
      const wallet = { address: addr, label: lbl };

      const added = monitorManager.addWallet(wallet);
      if (!added) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Ví đã được theo dõi' }));
        return;
      }
      providerManager.getProvider().addWallet?.(wallet);

      // Lưu vào MongoDB
      await db.saveWallet(wallet);

      wsServer.broadcastWalletsUpdate(monitorManager.listWallets());
      logger.info(`[API] Thêm ví: ${lbl} (${addr})`);

      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(wallet));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Body JSON không hợp lệ' }));
    }
    return;
  }

  /* ── GET /api/alert-settings ── */
  if (url === '/api/alert-settings' && req.method === 'GET') {
    const cfg = monitorManager.getAlertConfig();
    const thresholdRaw = cfg.thresholdRaw ?? 1_000_000_000_000_000_000n;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      thresholdBnb:  Number(thresholdRaw) / 1e18,
      changePercent: cfg.changePercent ?? 10,
    }));
    return;
  }

  /* ── PUT /api/alert-settings ── */
  if (url === '/api/alert-settings' && req.method === 'PUT') {
    try {
      const body = await readBody(req);
      const { thresholdBnb, changePercent } = JSON.parse(body);
      const newCfg = {
        thresholdRaw:  BigInt(Math.round((Number(thresholdBnb) || 1) * 1e18)),
        changePercent: Math.max(1, Number(changePercent) || 10),
      };
      monitorManager.updateAlertConfig(newCfg);

      // Lưu vào MongoDB
      await db.updateAlertConfig(newCfg);

      logger.info(`[API] Cập nhật cài đặt cảnh báo: ngưỡng=${thresholdBnb} BNB, biến động=${changePercent}%`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Dữ liệu không hợp lệ' }));
    }
    return;
  }

  /* ── GET /api/alert-settings/wallet/:address ── */
  const walletCfgMatch = url.match(/^\/api\/alert-settings\/wallet\/(0x[0-9a-fA-F]{40})$/i);
  if (walletCfgMatch && req.method === 'GET') {
    const addr = walletCfgMatch[1].toLowerCase();
    const cfg  = monitorManager.getWalletAlertConfig(addr);
    const thresholdRaw = cfg.thresholdRaw ?? 1_000_000_000_000_000_000n;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      thresholdBnb:  Number(thresholdRaw) / 1e18,
      changePercent: cfg.changePercent ?? 10,
      hasOverride:   cfg.hasOverride ?? false,
    }));
    return;
  }

  /* ── PUT /api/alert-settings/wallet/:address ── */
  if (walletCfgMatch && req.method === 'PUT') {
    try {
      const addr = walletCfgMatch[1].toLowerCase();
      const body = await readBody(req);
      const { thresholdBnb, changePercent } = JSON.parse(body);
      const override = {
        thresholdRaw:  BigInt(Math.round((Number(thresholdBnb) || 1) * 1e18)),
        changePercent: Math.max(1, Number(changePercent) || 10),
      };
      monitorManager.updateWalletAlertConfig(addr, override);

      // Lưu vào MongoDB
      await db.saveWalletAlertOverride(addr, override);

      logger.info(`[API] Cài đặt riêng ví ${addr}: ngưỡng=${thresholdBnb} BNB, biến động=${changePercent}%`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Dữ liệu không hợp lệ' }));
    }
    return;
  }

  /* ── DELETE /api/alert-settings/wallet/:address ── */
  if (walletCfgMatch && req.method === 'DELETE') {
    const addr = walletCfgMatch[1].toLowerCase();
    monitorManager.resetWalletAlertConfig(addr);

    // Xóa override trong MongoDB
    await db.clearWalletAlertOverride(addr);

    logger.info(`[API] Reset cài đặt ví ${addr} về mặc định`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  /* ── GET /api/transfers ── */
  if (url === '/api/transfers' && req.method === 'GET') {
    const transfers = await db.getRecentTransfers();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(transfers));
    return;
  }

  /* ── GET /api/alerts ── */
  if (url === '/api/alerts' && req.method === 'GET') {
    const alerts = await db.getRecentAlerts();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(alerts));
    return;
  }

  /* ── GET /api/discord-settings ── */
  if (url === '/api/discord-settings' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(discordService.getConfig()));
    return;
  }

  /* ── PUT /api/discord-settings ── */
  if (url === '/api/discord-settings' && req.method === 'PUT') {
    try {
      const body = await readBody(req);
      const { webhookUrl, enabled, sendHigh, sendMedium, sendLow } = JSON.parse(body);
      const cfg = { webhookUrl, enabled, sendHigh, sendMedium, sendLow };
      discordService.updateConfig(cfg);

      // Lưu vào MongoDB
      await db.updateDiscordConfig(cfg);

      logger.info(`[API] Cập nhật Discord settings: enabled=${enabled}`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Dữ liệu không hợp lệ' }));
    }
    return;
  }

  /* ── POST /api/discord-test ── */
  if (url === '/api/discord-test' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const parsed = JSON.parse(body || '{}');
      if (parsed.webhookUrl) discordService.updateConfig({ webhookUrl: parsed.webhookUrl });
      await discordService.sendTest();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  /* ── DELETE /api/wallets/:address ── */
  const deleteMatch = url.match(/^\/api\/wallets\/(0x[0-9a-fA-F]{40})$/i);
  if (deleteMatch && req.method === 'DELETE') {
    const addr    = deleteMatch[1].toLowerCase();
    const removed = monitorManager.removeWallet(addr);

    if (!removed) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Ví không tìm thấy' }));
      return;
    }

    // Xóa khỏi MongoDB
    await db.deleteWallet(addr);
    providerManager.getProvider().removeWallet?.(addr);

    wsServer.broadcastWalletsUpdate(monitorManager.listWallets());
    logger.info(`[API] Xóa ví: ${addr}`);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  res.writeHead(404);
  res.end();
});

/* ── Khởi động server sau khi DB sẵn sàng ───────────────── */
async function bootstrap() {
  // 0. Kết nối MongoDB
  await connectDB();

  // 1. Load settings từ DB
  const settings     = await db.getSettings();
  const alertConfig  = db.parseAlertConfig(settings.alertConfig);
  const discordCfg   = settings.discordConfig;

  // 2. Áp dụng Discord config
  if (discordCfg?.webhookUrl) {
    discordService.updateConfig(discordCfg);
    logger.info('[DB] Đã tải Discord settings từ MongoDB');
  }

  // 3. Load danh sách ví từ DB; nếu DB rỗng thì seed từ config
  await db.seedWallets(config.wallets);
  const walletsWithOverrides = await db.getAllWalletsWithOverrides();
  const wallets = walletsWithOverrides.map(r => r.wallet);
  logger.info(`[DB] Đã tải ${wallets.length} ví từ MongoDB`);

  // 4. FACTORY
  const provider = ProviderFactory.create({ ...config, wallets });

  // 5. SINGLETON
  providerManager.setProvider(provider);

  // 6. OBSERVER
  const wsServerInst = new WsServer();
  wsServerInst.init(httpServer);
  // expose to handler closures
  wsServer = wsServerInst;

  /* Gửi cảnh báo lên Discord + lưu vào MongoDB */
  eventBus.subscribe('alert', (data) => {
    const alert = {
      walletAddr:  data.wallet?.address,
      walletLabel: data.wallet?.label,
      token:       data.token?.symbol ?? String(data.token ?? '?'),
      level:       data.level,
      message:     data.message,
      timestamp:   data.timestamp,
    };
    discordService.sendAlert(alert).catch(err =>
      logger.error('[Discord] Lỗi gửi cảnh báo:', err.message)
    );
    db.saveAlert(alert).catch(err =>
      logger.error('[DB] Lỗi lưu alert:', err.message)
    );
  });

  // 7. STRATEGY
  monitorManager = new MonitorManager();
  monitorManager.init(wallets, alertConfig);

  // Restore per-wallet overrides đã lưu trước đó
  let overrideCount = 0;
  for (const { wallet, override } of walletsWithOverrides) {
    if (override) {
      monitorManager.updateWalletAlertConfig(wallet.address, override);
      overrideCount++;
    }
  }
  if (overrideCount > 0) logger.info(`[DB] Restore ${overrideCount} wallet override(s)`);

  // 8. Load lịch sử transfers + alerts từ DB
  const [savedTransfers] = await Promise.all([
    db.getRecentTransfers(),
  ]);
  initStore(savedTransfers);                    // điền vào in-memory store
  wsServer.setInitialTransfers(savedTransfers); // gửi ngay cho client mới kết nối
  setTransferSaveFn(tx => db.saveTransfer(tx)); // wire save callback
  logger.info(`[DB] Đã tải ${savedTransfers.length} giao dịch từ MongoDB`);

  // 9. Khởi động HTTP server
  httpServer.listen(config.PORT, async () => {
    logger.info(`HTTP/WS server chạy tại http://localhost:${config.PORT}`);
    logger.info(`Provider: ${config.PROVIDER_TYPE.toUpperCase()} | Wallets: ${wallets.length} | Tokens: ${config.tokens.length}`);

    startTrendingService().catch(err => logger.error('[Trending] Lỗi khởi động:', err.message));
    startTransferService(monitorManager.listWallets());

    await startProviderWithRetry(provider);
  });
}

/* ── Biến shared giữa bootstrap và request handlers ─────── */
let wsServer;
let monitorManager;

/* ── Tự động thử lại provider ───────────────────────────── */
async function startProviderWithRetry(provider, maxRetries = 5, delayMs = 5000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await provider.start();
      return;
    } catch (err) {
      logger.error(`[Provider] Lần thử ${attempt}/${maxRetries} thất bại: ${err.message}`);
      if (attempt < maxRetries) {
        logger.info(`[Provider] Thử lại sau ${delayMs / 1000}s...`);
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
  }
  logger.error('[Provider] Không thể khởi động sau tất cả các lần thử — tiếp tục không có dữ liệu blockchain.');
}

bootstrap().catch(err => {
  logger.error('[Bootstrap] Khởi động thất bại:', err.message);
  process.exit(1);
});

process.on('SIGTERM', () => {
  logger.info('Đang tắt server...');
  monitorManager?.stopAll();
  process.exit(0);
});
