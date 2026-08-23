import "dotenv/config";
import mysql from "mysql2/promise";

const port = Number(process.env.DB_PORT || 3306);
if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`DB_PORT 必须是有效端口，当前值：${process.env.DB_PORT}`);
}

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_DATABASE || 'test',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});

export default pool;
