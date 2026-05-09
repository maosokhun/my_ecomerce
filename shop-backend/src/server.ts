import 'dotenv/config';
import app from './app';
import prisma from './lib/prisma';

const PORT = process.env.PORT || 5000;

const start = async () => {
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not set. Configure database connection before starting backend.');
    }
    if (!process.env.JWT_SECRET?.trim()) {
      throw new Error('JWT_SECRET is not set. Add it in Render Environment (any long random string).');
    }

    await prisma.$connect();
    console.log('✅ Database connected');

    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

start();
