const path = require('path');
const { fileURLToPath } = require('url');

// CommonJS адаптер для ES6 модулей
class DatabaseAdapter {
    constructor() {
        this.db = null;
    }

    async init() {
        // Динамически импортируем ES6 модуль
        const initPath = path.resolve(__dirname, './init.js');
        const { createDatabase } = await import(`file://${initPath}`);
        this.db = await createDatabase();
        return this.db;
    }

    async close() {
        if (this.db) {
            await this.db.close();
            this.db = null;
        }
    }

    // Proxy методы для SQLite
    prepare(sql) {
        if (!this.db) throw new Error('Database not initialized');
        return this.db.prepare(sql);
    }

    async run(sql, params = []) {
        if (!this.db) throw new Error('Database not initialized');
        return await this.db.run(sql, params);
    }

    async get(sql, params = []) {
        if (!this.db) throw new Error('Database not initialized');
        return await this.db.get(sql, params);
    }

    async all(sql, params = []) {
        if (!this.db) throw new Error('Database not initialized');
        return await this.db.all(sql, params);
    }

    async exec(sql) {
        if (!this.db) throw new Error('Database not initialized');
        return await this.db.exec(sql);
    }
}

module.exports = { DatabaseAdapter }; 