# FiveM Backup

Este é um projeto aberto e gratuito desenvolvido pelo para facilitar o processo de backup automático de bancos de dados MySQL em servidores FiveM. A principal função do script é realizar backups periódicos do banco de dados do servidor, compactar os arquivos gerados e enviá-los para armazenamento externo por meio de um webhook. Dessa forma, garante-se a segurança e integridade dos dados, permitindo que eles sejam recuperados facilmente em caso de falhas ou perdas.

O projeto foi desenvolvido com o objetivo de ser uma ferramenta prática, simples de configurar e eficiente, sem depender de ferramentas proprietárias ou complexas. Todos os recursos fornecidos são totalmente gratuitos, permitindo que qualquer administrador de servidor FiveM implemente o sistema de backup com facilidade e flexibilidade.

Sinta-se à vontade para contribuir, modificar e adaptar o código às suas necessidades específicas. O objetivo é manter a comunidade forte e oferecer soluções de código aberto para os desafios diários do gerenciamento de servidores FiveM.

## Requisitos
- [`Node.js`](https://nodejs.org/en/download/prebuilt-installer)
- Servidor FiveM

## Instalação

1. **Instale as dependências necessárias**. No diretório do recurso, rode o comando:
   ```bash
   npm install
2. **Crie a build compativel com fivem**.
    ```bash
    npm run build
    ```
   - Será gerado em `Q_backup` os arquivos.
3. **configure o arquivo `config.json` com suas configurações:**

    ```json
    {
        "webhook": "",
        "retention": 10,
        "interval": 4
    }
    ```
    ### Explicação dos campos do `config.json`:

    - `webhook`: Link do webhook onde será enviado a copía do backup.
    - `retention`: O número de dias para manter os backups antes de excluí-los. Por exemplo, `10` dias.
    - `interval` Intervalo de horas que será feito o backups.
4. **Comando para gerar backup manualmente**
    ```bash
    /backupdb
    ```
5. **Instalando resource na base**
    - Copie a pasta `Q_backup` do projeto para dentro das resources da base e coloca para iniciar no seu `.cfg`.

# Autor
Proelias7 by [`Quantic Store`](https://discord.gg/Qqe5a3J58J)