import mongoose from 'mongoose';
import logger   from '../utils/logger.js';

const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/bsc-monitor';

mongoose.connection.on('disconnected', () =>
  logger.warn('[DB] MongoDB ngắt kết nối — đang thử lại...')
);
mongoose.connection.on('reconnected', () =>
  logger.info('[DB] MongoDB kết nối lại thành công')
);

export async function connectDB() {
  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS:          45000,
  });
  logger.info(`[DB] Kết nối MongoDB: ${MONGODB_URI}`);
}

export default mongoose;
