package com.chatSync;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import net.minecraft.network.chat.Component;
import net.minecraft.server.MinecraftServer;
import net.neoforged.neoforge.server.ServerLifecycleHooks;

public class InboundMsgHandler {
    
    public static void handleIncomingMsg(String jsonstring) {
        try {
            JsonObject json = JsonParser.parseString(jsonstring).getAsJsonObject();
            String type = json.get("type").getAsString();

             if (type.equals("config")) {
                if (json.has("key") && !json.get("key").isJsonNull()) {

                    String key = json.get("key").getAsString();
                    boolean value = json.get("value").getAsBoolean();
                    
                    ConfigHandler.update(key, value);
                    System.out.println("[Chat Sync] Config updated via Discord: " + key + "=" + value);
                    
                } else {
                    
                    String response = String.format(
                        "{\"type\":\"config_sync\",\"forwardChat\":%b,\"forwardJoinLeave\":%b,\"forwardDeaths\":%b,\"forwardAdvancements\":%b}",
                        Config.forwardChat, Config.forwardJoinLeave, Config.forwardDeaths, Config.forwardAdvancements
                    );
                    
                    if (Main.chatSyncClient != null && Main.chatSyncClient.isOpen()) {
                        Main.chatSyncClient.send(response);
                    }
                    System.out.println("[Chat Sync] Config sent to Discord.");
                }
                return;
            }

            if(type.equals("discord_chat")) {
                String username = json.get("username").getAsString();
                String message = json.get("message").getAsString();

                String formatted = "[" + username + "] " + message;

                MinecraftServer server = ServerLifecycleHooks.getCurrentServer();
                 if (server != null) {
                    server.getPlayerList().broadcastSystemMessage(Component.literal(formatted), false);
                 }
            }

        } catch (Exception e) {
            System.out.println("[Chat Sync] Error parsing incoming JSON: " + e.getMessage());
        } 
    }
}