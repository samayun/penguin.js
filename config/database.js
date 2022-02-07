module.exports = {
  connection: process.env.DB_CONNECTION || 'mongodb',
  connections: {
    mongodb: {
      driver: 'mongodb',
      url: process.env.DATABASE_URL,
      prefix: process.env.DB_PRE_PROTOCOL || 'mongodb+srv://',
      suffix: process.env.DB_EXTRA || 'retryWrites=true&w=majority',
      host: process.env.DB_HOST || '127.0.0.1',
      port: process.env.DB_PORT || undefined,
      database: process.env.DB_NAME || 'db_penguin',
      username: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
    },
    mysql: {
      driver: 'mysql',
      url: process.env.DATABASE_URL,
      prefix: process.env.DB_PRE_PROTOCOL || 'mysql://',
      host: process.env.DB_HOST || '127.0.0.1',
      port: process.env.DB_PORT || 3306,
      database: process.env.DB_NAME || 'db_penguin',
      username: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
    },
  },
};
