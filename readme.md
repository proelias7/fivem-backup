# FiveM Backup

![Version](https://img.shields.io/badge/version-1.1-blue)
![License](https://img.shields.io/badge/license-ISC-green)
![FiveM](https://img.shields.io/badge/FiveM-Compatible-orange)

Sistema de backup automático de banco de dados MySQL para servidores FiveM. Realiza backups periódicos, compacta em **gzip** (menor tamanho possível) e envia para o Discord via webhook.

## Funcionalidades

- Backup automático do banco de dados MySQL
- Compressão **gzip** com nível máximo (ideal para Discord)
- Envio automático via webhook do Discord
- Retenção configurável de backups antigos
- Intervalo de backup personalizável
- Comando manual para backup imediato
- Logs coloridos no console

## Requisitos

- [Node.js](https://nodejs.org/en/download/prebuilt-installer) (v16+)
- Servidor FiveM com `mysql_connection_string` configurada
- Webhook do Discord (opcional, para backup na nuvem)

## Instalação

### 1. Clone o repositório

```bash
git clone https://github.com/proelias7/fivem-backup.git
cd fivem-backup
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Gere a build para FiveM

```bash
npm run build
```

Os arquivos serão gerados na pasta `Q_backup`.

### 4. Configure o `config.json`

Edite o arquivo `Q_backup/config.json`:

```json
{
    "webhook": "https://discord.com/api/webhooks/...",
    "retention": 10,
    "interval": 4
}
```

| Campo | Descrição |
|-------|-----------|
| `webhook` | URL do webhook do Discord para envio do backup. Deixe vazio `""` para desativar |
| `retention` | Número de dias para manter os backups locais antes de excluí-los |
| `interval` | Intervalo em **horas** entre cada backup automático |

### 5. Instale o resource no servidor

1. Copie a pasta `Q_backup` para a pasta `resources` do seu servidor FiveM
2. Adicione no seu `server.cfg`:

```cfg
ensure Q_backup
```

## Uso

### Backup Automático

O backup é executado automaticamente no intervalo configurado (padrão: 4 horas).

### Backup Manual

Execute o comando no console do servidor:

```
backupdb
```

## Estrutura do Backup

Os backups são salvos em `Q_backup/backups/` com o formato:

```
DD-MM-YYYY-HH-MM.sql      # Backup local
DD-MM-YYYY-HH-MM.sql.gz   # Enviado para Discord (comprimido)
```

## Changelog

### v1.1
- Migração de `.zip` para `.gz` (gzip) - arquivos até 70% menores
- Compressão nível máximo (level 9)
- Remoção da dependência `archiver` (usa `zlib` nativo)
- Melhor tratamento de erros no envio para Discord
- Suporte a arquivos `.gz` na limpeza de backups antigos

### v1.0
- Release inicial
- Backup automático MySQL
- Envio via webhook Discord
- Sistema de retenção de backups

## Contribuição

Sinta-se à vontade para abrir issues, enviar pull requests ou sugerir melhorias. O projeto é open-source e toda contribuição é bem-vinda!

## Suporte

Precisa de ajuda? Entre no nosso Discord:

[![Discord](https://img.shields.io/badge/Discord-Quantic%20Store-5865F2?logo=discord&logoColor=white)](https://discord.gg/Qqe5a3J58J)

## Autor

Desenvolvido por **Proelias7** - [Quantic Store](https://discord.gg/Qqe5a3J58J)

## Licença

Este projeto está sob a licença ISC. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.