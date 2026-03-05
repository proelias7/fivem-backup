const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { pipeline } = require('stream/promises');
const mysql = require('mysql2/promise');

const basePath = GetResourcePath(GetCurrentResourceName());

let config;

function logger(status, message) {
    if (status === 'sucesso') console.log(`\x1b[32m${message}\x1b[0m`); 
    if (status === 'negado') console.log(`\x1b[31m${message}\x1b[0m`);   
    if (status === 'aviso') console.log(`\x1b[34m${message}\x1b[0m`); 
}

try {
    config = JSON.parse(LoadResourceFile(GetCurrentResourceName(), 'config.json'));
} catch (error) {
    logger('negado', `Erro ao carregar a configuração:/n${error.message}`);
    process.exit(1);
}

function parseMysqlConnectionString(connectionString) {
    let connectionConfig = {};

    if (connectionString.startsWith('mysql://')) {
        const url = new URL(connectionString);
        connectionConfig = {
            user: url.username,
            host: url.hostname,
            port: url.port || '3306',
            password: url.password,
            database: url.pathname.replace('/', ''),
            charset: url.searchParams.get('charset') || 'utf8mb4'
        };
    } else if (connectionString.startsWith('server=')) {
        const params = new URLSearchParams(connectionString.replace(/;/g, '&'));
        connectionConfig = {
            host: params.get('server'),
            user: params.get('uid'),
            password: params.get('password'),
            database: params.get('database'),
            port: params.get('port') || '3306',
            charset: params.get('charset') || 'utf8mb4'
        };
    } else if (connectionString.startsWith('user=')) {
        const params = new URLSearchParams(connectionString.replace(/;/g, '&'));
        connectionConfig = {
            host: params.get('host') || params.get('server') || 'localhost',
            user: params.get('user'),
            password: params.get('password'),
            database: params.get('database'),
            port: params.get('port') || '3306',
            charset: params.get('charset') || 'utf8mb4'
        };
    } else {
        logger('negado','Formato de string de conexão desconhecido.');
    }

    return connectionConfig;
}

let backupTimeout;
const MINUTE_IN_MS = 60 * 1000;

async function sendBackupToWebhook(webhookUrl, filePath, fileName) {
    if (typeof fetch !== 'function' || typeof FormData !== 'function' || typeof Blob !== 'function') {
        throw new Error('Runtime atual nao suporta fetch/FormData nativos.');
    }

    const fileBuffer = await fs.promises.readFile(filePath);
    const formData = new FormData();

    formData.append('payload_json', JSON.stringify({
        content: 'Backup realizado com sucesso!'
    }));
    formData.append('file', new Blob([fileBuffer], { type: 'application/gzip' }), fileName);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000);

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            body: formData,
            signal: controller.signal
        });

        if (!response.ok) {
            const responseBody = await response.text();
            throw new Error(`Webhook retornou ${response.status}: ${responseBody}`);
        }
    } finally {
        clearTimeout(timeoutId);
    }
}

const startBackup = async () => {
    const mysqlConnectionString = GetConvar("mysql_connection_string", "");

    let connectionConfig;
    try {
        connectionConfig = parseMysqlConnectionString(mysqlConnectionString);
    } catch (error) {
        logger('negado',`Erro ao interpretar string de conexão: ${error.message}`);
        return;
    }

    const { host, user, password, port, database } = connectionConfig;
    const pathDB = path.join(basePath, 'backups');

    if (!fs.existsSync(pathDB)) {
        try {
            await fs.promises.mkdir(pathDB, { recursive: true });
        } catch (error) {
            logger('negado',`Erro ao criar diretório de backup.`);
            return;
        }
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - config.retention);

    try {
        const files = await fs.promises.readdir(pathDB);
        for (const file of files) {
            const filePath = path.join(pathDB, file);
            const baseName = file.replace(/\.(sql|sql\.gz|gz)$/, '');
            const [day, month, year, hour, minute] = baseName.split('-');
            const fileDate = new Date(year, month - 1, day, hour, minute);

            if (fileDate < thirtyDaysAgo) {
                await fs.promises.unlink(filePath);
            }
        }
    } catch (error) {
        logger('negado',`Erro ao remover arquivos antigos.`);
        return;
    }

    const date = new Date();
    const datetime = `${date.getDate()}-${(date.getMonth() + 1)}-${date.getFullYear()}-${date.getHours()}-${date.getMinutes()}`;
    const local = path.join(pathDB, `${datetime}.sql`);

    const connection = await mysql.createConnection({
        host,
        user,
        password,
        port,
        database
    });

    const sqlStatements = [];

    try {
        const [tables] = await connection.query('SHOW TABLES');

        sqlStatements.push(`-- Dumping database: ${database}`);
        sqlStatements.push(`CREATE DATABASE IF NOT EXISTS ${database};`);
        sqlStatements.push(`SET NAMES utf8mb4;`);
        sqlStatements.push(`USE ${database};`);
        sqlStatements.push('');

        for (const row of tables) {
            const tableName = Object.values(row)[0];

            sqlStatements.push(`DROP TABLE IF EXISTS \`${tableName}\`;`);
            const [createTable] = await connection.query(`SHOW CREATE TABLE \`${tableName}\``);
            sqlStatements.push(`${createTable[0]['Create Table']};`);
            sqlStatements.push('');

            const [rows] = await connection.query(`SELECT * FROM \`${tableName}\``);
            rows.forEach((row) => {
                const values = Object.values(row).map(value => {
                    if (value === null) return 'NULL';
                    return `'${value.toString().replace(/'/g, "\\'")}'`;
                }).join(', ');

                sqlStatements.push(`INSERT INTO \`${tableName}\` VALUES (${values});`);
            });
            sqlStatements.push('');
        }

        fs.writeFileSync(local, sqlStatements.join('\n'));

        logger('sucesso',`Backup realizado com sucesso!`);

        if (config.webhook !== "") {
            const outputGzPath = path.join(pathDB, `${datetime}.sql.gz`);

            try {
                const gzip = zlib.createGzip({ level: 9 });
                const source = fs.createReadStream(local);
                const destination = fs.createWriteStream(outputGzPath);

                await pipeline(source, gzip, destination);

                await sendBackupToWebhook(config.webhook, outputGzPath, `${datetime}.sql.gz`);

                logger('sucesso', `Backup salvo na nuvem!`);

                await fs.promises.unlink(outputGzPath);
            } catch (error) {
                logger('negado', `Erro ao compactar/enviar backup: ${error.message}`);
            }
        }

        const now = new Date();
        const nextBackupDate = new Date(now.getTime() + config.interval * MINUTE_IN_MS);
        const nextBackupDatetime = `${nextBackupDate.getHours()}:${nextBackupDate.getMinutes()}`;

        logger('aviso',`Próximo backup será às: ${nextBackupDatetime}`);

        if (backupTimeout) clearTimeout(backupTimeout);

        backupTimeout = setTimeout(startBackup, config.interval * MINUTE_IN_MS);

    } catch (error) {
        logger('negado',`Erro ao realizar o backup Base: ${database}\n${error.message}`);
    } finally {
        await connection.end();
    }
}

backupTimeout = setTimeout(startBackup, config.interval * MINUTE_IN_MS);

RegisterCommand("backupdb", startBackup);
