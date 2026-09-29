const redis = require('redis');
const config = require('./index');

let client = null;

async function connect() {
  if (client && client.isOpen) return client;

  const options = {
    socket: {
      host: config.redis.host,
      port: config.redis.port,
      reconnectStrategy: (retries) => {
        if (retries > 10) {
          console.error('[Redis] Max retries exceeded, giving up');
          return new Error('Redis reconnect max retries');
        }
        return Math.min(retries * 50, 500);
      },
    },
  };

  if (config.redis.password) {
    options.password = config.redis.password;
  }

  client = redis.createClient(options);

  client.on('error', (err) => {
    console.error('[Redis] Client error:', err.message);
  });

  client.on('connect', () => {
    console.log('[Redis] Connected successfully');
  });

  try {
    await client.connect();
    return client;
  } catch (err) {
    console.error('[Redis] Connection failed:', err.message);
    client = null;
    return null;
  }
}

async function get(key) {
  try {
    if (!client || !client.isOpen) return null;
    const value = await client.get(key);
    return value ? JSON.parse(value) : null;
  } catch (err) {
    console.error('[Redis] Get error:', err.message);
    return null;
  }
}

async function set(key, value, ttlSeconds) {
  try {
    if (!client || !client.isOpen) return false;
    const ttl = ttlSeconds || config.redis.ttl;
    await client.setEx(key, ttl, JSON.stringify(value));
    return true;
  } catch (err) {
    console.error('[Redis] Set error:', err.message);
    return false;
  }
}

async function del(key) {
  try {
    if (!client || !client.isOpen) return false;
    await client.del(key);
    return true;
  } catch (err) {
    console.error('[Redis] Del error:', err.message);
    return false;
  }
}

async function invalidatePattern(pattern) {
  try {
    if (!client || !client.isOpen) return false;
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(keys);
    }
    return true;
  } catch (err) {
    console.error('[Redis] Invalidate pattern error:', err.message);
    return false;
  }
}

async function testConnection() {
  try {
    if (!client) await connect();
    if (!client) return false;
    await client.ping();
    return true;
  } catch (err) {
    console.error('[Redis] Test connection failed:', err.message);
    return false;
  }
}

module.exports = {
  connect,
  get,
  set,
  del,
  invalidatePattern,
  testConnection,
  getClient: () => client,
};
