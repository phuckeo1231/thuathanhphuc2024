/**
 * ============================================================
 * DESIGN PATTERN: FACTORY
 * ============================================================
 * TokenFactory tạo các đối tượng Token và Wallet chuẩn hoá.
 *
 * Lợi ích:
 *   - Tách logic tạo đối tượng ra khỏi nơi sử dụng
 *   - Dễ thêm logic validate, normalize khi mở rộng
 *   - Các module khác không cần biết cấu trúc bên trong của
 *     Token hay Wallet
 * ============================================================
 */

class Token {
  constructor({ address, symbol, decimals, name }) {
    this.address  = address.toLowerCase();
    this.symbol   = symbol.toUpperCase();
    this.decimals = decimals;
    this.name     = name;
  }
}

class Wallet {
  constructor({ address, label }) {
    this.address = address.toLowerCase();
    this.label   = label || `${address.slice(0, 6)}…${address.slice(-4)}`;
  }
}

class TokenFactory {
  /**
   * Tạo đối tượng Token từ config object.
   * @param {{ address: string, symbol: string, decimals: number, name: string }} config
   * @returns {Token}
   */
  createToken(config) {
    return new Token(config);
  }

  /**
   * Tạo đối tượng Wallet từ config object.
   * @param {{ address: string, label?: string }} config
   * @returns {Wallet}
   */
  createWallet(config) {
    return new Wallet(config);
  }
}

export default TokenFactory;
export { Token, Wallet };
