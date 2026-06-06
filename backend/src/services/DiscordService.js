import logger from '../utils/logger.js';

const LEVEL_COLOR = { high: 0xe74c3c, medium: 0xf39c12, low: 0x3498db };
const LEVEL_EMOJI = { high: '🔴', medium: '🟠', low: '🔵' };
const LEVEL_LABEL = { high: 'CAO', medium: 'VỪA', low: 'THẤP' };

class DiscordService {
  #config = {
    webhookUrl: '',
    enabled:    false,
    sendHigh:   true,
    sendMedium: true,
    sendLow:    false,
  };

  updateConfig(cfg) {
    this.#config = { ...this.#config, ...cfg };
  }

  getConfig() {
    return { ...this.#config };
  }

  #shouldSend(level) {
    const { enabled, webhookUrl, sendHigh, sendMedium, sendLow } = this.#config;
    if (!enabled || !webhookUrl) return false;
    if (level === 'high'   && sendHigh)   return true;
    if (level === 'medium' && sendMedium) return true;
    if (level === 'low'    && sendLow)    return true;
    return false;
  }

  async sendAlert(alert) {
    if (!this.#shouldSend(alert.level)) return;

    const emoji = LEVEL_EMOJI[alert.level] ?? '⚪';
    const label = LEVEL_LABEL[alert.level] ?? alert.level;
    const addr  = alert.walletAddr ?? '';

    const embed = {
      color:       LEVEL_COLOR[alert.level] ?? 0x95a5a6,
      title:       `${emoji} Cảnh báo ${label} — ${alert.walletLabel ?? addr.slice(0, 10)}`,
      description: `**${alert.token ?? '?'}** ${alert.message}`,
      fields: [
        {
          name:   'Ví',
          value:  addr ? `[${addr.slice(0, 8)}…${addr.slice(-4)}](https://bscscan.com/address/${addr})` : '?',
          inline: true,
        },
        { name: 'Token',   value: alert.token ?? '?',  inline: true },
        { name: 'Mức độ', value: `${emoji} ${label}`,  inline: true },
      ],
      timestamp: new Date(alert.timestamp ?? Date.now()).toISOString(),
      footer:    { text: 'BSC Wallet Monitor' },
    };

    const res = await fetch(this.#config.webhookUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ embeds: [embed] }),
    });
    if (!res.ok) throw new Error(`Discord webhook trả về HTTP ${res.status}`);
  }

  async sendTest() {
    const { webhookUrl } = this.#config;
    if (!webhookUrl) throw new Error('Chưa cấu hình webhook URL');

    const embed = {
      color:       0x2ecc71,
      title:       '✅ Kết nối thành công',
      description: 'BSC Wallet Monitor đã kết nối với Discord!\nCác cảnh báo ví sẽ được gửi tại đây.',
      timestamp:   new Date().toISOString(),
      footer:      { text: 'BSC Wallet Monitor' },
    };

    const res = await fetch(webhookUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ embeds: [embed] }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}: ${text}`);
    }
  }
}

const discordService = new DiscordService();

/* Khởi tạo từ env nếu có */
if (process.env.DISCORD_WEBHOOK_URL) {
  discordService.updateConfig({
    webhookUrl: process.env.DISCORD_WEBHOOK_URL,
    enabled:    true,
  });
  logger.info('[Discord] Webhook được cấu hình từ .env');
}

export default discordService;
