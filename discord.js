const { Client, GatewayIntentBits, Message, ChannelSelectMenuBuilder, ChannelType, ActionRowBuilder } = require('discord.js');
const WebSocket = require('ws');
const fs = require('fs');
require('dotenv').config();

const configPath = `./config.json`;

const defaultConfig = {
    websocketPort: "38200",
    syncedChannel: "",
    chatWebhookUrl: "",
    serverWebhookUrl: "",
    syncEnabled: "true"
};

let config = { ...defaultConfig };

try {
    if (fs.existsSync(configPath)) {
        const data = fs.readFileSync(configPath, `utf-8`);
        config = { ...defaultConfig, ...JSON.parse(data) };
    } else {
        console.log(`Config file not found, using defaults...`);
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    }
} catch (err) {
    console.error(`Error loading config, using defaults...`);
}

function saveConfig() {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});

client.once('clientReady', () => {
    console.log(`[Discord] Logged in as ${client.user.tag}`);
});

client.on(`interactionCreate`, async(interaction) => {
    if(!interaction.isChannelSelectMenu()) return;
    
    if(interaction.customId === `ch-select`){
        const selectedChannelId = interaction.values[0];
        const selectedChannel = client.channels.cache.get(selectedChannelId);
        if (!selectedChannel) return interaction.reply({ content: "Channel not found.", flags: 'Ephemeral' });

        try {
            const chatWebhook = await selectedChannel.createWebhook({
                name: 'Minecraft Chat',
            });

            const serverWebhook = await selectedChannel.createWebhook({
                name: '[MC] Server'
            });


            config.syncedChannel = selectedChannelId;
            config.chatWebhookUrl = chatWebhook.url; 
            config.serverWebhookUrl = serverWebhook.url; 
            saveConfig(); 

            await interaction.reply({ 
                content: `Synced channel set to <#${selectedChannelId}>`, 
                flags: 'Ephemeral'
            });
        } catch (err) {
            console.error("Failed to create webhook:", err);
            await interaction.reply({ 
                content: `Failed to create webhook. Is the \`Manage Webhooks\` permission granted?`, 
                flags: 'Ephemeral'
            });
        }
    }
})

client.on(`messageCreate`, async(Message) => {
    if(Message.author.bot) return;

    if (Message.content.startsWith(`%`)) {

        const args = Message.content.slice(1).trim().split(/ +/)
        const cmd = args.shift()?.toLowerCase();

        if (!cmd) return

        if (cmd === `setup`) {
            const select = new ChannelSelectMenuBuilder()
                .setCustomId(`ch-select`)
                .setPlaceholder(`Select channel to sync with Minecraft`)
                .addChannelTypes(ChannelType.GuildText);
        
            const row = new ActionRowBuilder().addComponents(select);

            await Message.reply({
                content: `**Set sync channel**`,
                components: [row]
            });
            return;
        }

        if (cmd === `toggle`) {
            config.syncEnabled = !config.syncEnabled;
            saveConfig();

            const status = config.syncEnabled ? "enabled" : "disabled";
            return Message.reply(`Chat sync is now ${status}`);
        }

        if (cmd === `test`) {
            const payload = JSON.stringify({
                type: `discord_chat`,
                username: `Debug`,
                message: `Testing WebSocket connection... If you can see this message in Minecraft the connection is working!`
            });
            let sent = false;
            wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(payload);
                    sent = true;
                }
            });

            if (sent) {
                console.log('[Debug] Sent test message to Minecraft chat.');
            } else {
                return console.log(`[Debug] No Minecraft server connected`);
            };
        }

//        if (cmd === 'cfg') {
//            if (args.length === 0) {
//                const configPromise = new Promise((resolve) => {
//                   global.resolveConfigPromise = resolve;
//                });
//
//                wss.clients.forEach((client) => {
//                    if (client.readyState === WebSocket.OPEN) {
//                        client.send(JSON.stringify({ type: "config" })); 
//                  }
//                });
//
//                const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 3000));
//                
//                try {
//                    await Promise.race([configPromise, timeout]);
//                } catch (e) {
//                    return Message.reply("Minecraft server timed out.");
//                }
//
//                return Message.reply(
//                    `**Sync Config**\n` +
//                    `\`forwardChat\`: ${config.forwardChat}\n` +
//                    `\`forwardJoinLeave\`: ${config.forwardJoinLeave}\n` +
//                    `\`forwardDeaths\`: ${config.forwardDeaths}\n` +
//                    `\`forwardAdvancements\`: ${config.forwardAdvancements}\n`
//                );
//            }
//        }
//    }

        if (cmd === `help`) {
            Message.reply(`
                ## Help
                \`setup\` Choose the channel to sync with Minecraft
                \`toggle\` Toggles the chat sync on or off
                \`help\` Displays this message
            `);
        }

        else {
            Message.reply(`
                **[Error]** Invalid command

                ### Commands
                \`setup\` Choose the channel to sync with Minecraft
                \`toggle\` Toggles the chat sync on or off
                \`help\` Displays this message
            `);
        }
    }

    else {
        if (!config.syncEnabled) return;
        if (!config.syncedChannel || Message.channel.id !== config.syncedChannel) return;

        let displayName = Message.member ? Message.member.displayName : Message.author.username;
        if (displayName.length > 16) displayName = displayName.slice(0, 13) + '...';

        const payload = JSON.stringify({
            type: 'discord_chat',
            username: displayName,
            message: Message.content
        });

        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(payload);
            }
        });
    }
})

const wss = new WebSocket.Server({ port: config.websocketPort });
console.log(`[WebSocket] Server started on port ${config.websocketPort}`);

wss.on(`connection`, (ws) => {
    console.log(`[WebSocket] WebSocket connected`)
    
        ws.on('message', async (data) => {
        try {
            const payload = JSON.parse(data);

            if (!config.syncEnabled) return;
            
            if (payload.type === 'config_sync') {
                config.forwardChat = payload.forwardChat;
                config.forwardJoinLeave = payload.forwardJoinLeave;
                config.forwardDeaths = payload.forwardDeaths;
                config.forwardAdvancements = payload.forwardAdvancements;
                saveConfig();
                console.log(`[WebSocket] Config synced from Minecraft.`);

                if (global.resolveConfigPromise) {
                    global.resolveConfigPromise();
                    global.resolveConfigPromise = null;
                }
                return;
            }

            if (!config.syncedChannel) return;
            const channel = client.channels.cache.get(config.syncedChannel);
            if (!channel) return;

            console.log(`[WebSocket] Recieved from Minecraft: {Type: ${payload.type} Username:${payload.username} Message:${payload.message}}`);

            if (payload.type === 'chat') {
                if (!config.chatWebhookUrl) return; 

                await fetch(config.chatWebhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: payload.username,
                        avatar_url: `https://mc-heads.net/avatar/${payload.uuid}`,
                        content: `${payload.message}`
                    })
                });
            }
            
            else if (payload.type === 'join' || payload.type === `leave`) {
                if (!config.serverWebhookUrl) return; 

                await fetch(config.serverWebhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: `Server message:`,
                        content: `${payload.username} ${payload.message}`
                    })
                });
            }

            else if (payload.type === 'death') {
                if (!config.serverWebhookUrl) return; 

                await fetch(config.serverWebhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: `Server message:`,
                        content: `${payload.message}`
                    })
                });
            }

            else if (payload.type === 'advancement') {
                if (!config.serverWebhookUrl) return; 

                await fetch(config.serverWebhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: `Server message:`,
                        content: `${payload.username} ${payload.message}`
                    })
                });
            }

            else {
                console.log(`[Error] Unknown message type: ${payload.type}`);
            }

        } catch (err) {
            console.error(`[Error] Failed to process message:`, err);
        }
    
    });
});

wss.on(`close`, (ws) => {
    console.log(`[WebSocket] WebSocket disconnected`)
});

wss.on(`error`, (err) => {
    console.log(`[Error] WebSocket error`, err)
});

client.login(process.env.DISCORD_TOKEN);