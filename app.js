const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const axios = require('axios');
const FormData = require('form-data');
const archiver = require('archiver');

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
    } else {
        logger('negado','Formato de string de conexão desconhecido.');
    }

    return connectionConfig;
}

let backupTimeout;

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
            const [day, month, year, hour, minute] = file.split('.sql')[0].split('-');
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

            const zip = archiver('zip', {
                zlib: { level: 9 }
            });
            
            const outputZipPath = path.join(pathDB, `${datetime}.zip`);
            
            const output = fs.createWriteStream(outputZipPath);
            
            zip.on('error', (err) => {
                logger('negado', `Erro ao compactar arquivos:\n${err.message}`);
            });
            
            output.on('close', async () => {
                const formData = new FormData();
            
                formData.append('payload_json', JSON.stringify({
                    content: `Backup realizado com sucesso!`
                }));
            
                formData.append('file', fs.createReadStream(outputZipPath));
            
                try {
                    await axios.post(config.webhook, formData, { 
                        headers: formData.getHeaders(),
                        maxContentLength: Infinity,
                        maxBodyLength: Infinity, 
                        timeout: 300000             
                    });
                    
                    logger('sucesso', `Backup salvo na nuvem!`);

                    fs.unlink(outputZipPath, (err) => {
                        if (err) logger('negado', `Erro ao deletar arquivo zip: ${err.message}`);
                    });
                } catch (error) {
                    logger('negado', `Erro ao enviar backup para a nuvem: ${error.message}`);
                }
            });
            
            zip.append(fs.createReadStream(local), { name: `${datetime}.sql` });
            
            zip.pipe(output);
            
            zip.finalize();
        }

        const now = new Date();
        const nextBackupDate = new Date(now.getTime() + config.interval * 60 * 60 * 1000);
        const nextBackupDatetime = `${nextBackupDate.getHours()}:${nextBackupDate.getMinutes()}`;

        logger('aviso',`Próximo backup será às: ${nextBackupDatetime}`);

        if (backupTimeout) clearTimeout(backupTimeout);

        backupTimeout = setTimeout(startBackup, config.interval * 60 * 60 * 1000);

    } catch (error) {
        logger('negado',`Erro ao realizar o backup Base: ${database}\n${error.message}`);
    } finally {
        await connection.end();
    }
}

backupTimeout = setTimeout(startBackup, config.interval * 60 * 60 * 1000);

RegisterCommand("backupdb", startBackup);
