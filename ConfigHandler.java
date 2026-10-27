package com.chatSync;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.io.FileReader;
import java.io.FileWriter;
import java.nio.file.Files;
import java.nio.file.Paths;

public class ConfigHandler {
        private static final String CONFIG_PATH = "config.json";
    private static final Gson gson = new GsonBuilder().setPrettyPrinting().create();

    public static void load() {
        try {
            String content = new String(Files.readAllBytes(Paths.get(CONFIG_PATH)));
            JsonObject json = JsonParser.parseString(content).getAsJsonObject();

            if (json.has("forwardChat")) Config.forwardChat = json.get("forwardChat").getAsBoolean();
            if (json.has("forwardJoinLeave")) Config.forwardJoinLeave = json.get("forwardJoinLeave").getAsBoolean();
            if (json.has("forwardDeaths")) Config.forwardDeaths = json.get("forwardDeaths").getAsBoolean();
            if (json.has("forwardAdvancements")) Config.forwardAdvancements = json.get("forwardAdvancements").getAsBoolean();
            
            System.out.println("[Chat Sync] Config loaded from file.");
            System.out.println("[Chat Sync] Loaded values: Chat=" + Config.forwardChat + ", Deaths=" + Config.forwardDeaths);
        } catch (Exception e) {
            System.out.println("[Chat Sync] Failed to load config.json: " + e.getMessage());
        }
    }

    public static void update(String key, boolean value) {
        try {
            String content = new String(Files.readAllBytes(Paths.get(CONFIG_PATH)));
            JsonObject json = JsonParser.parseString(content).getAsJsonObject();
            
            json.addProperty(key, value);
            
            try (FileWriter writer = new FileWriter(CONFIG_PATH)) {
                gson.toJson(json, writer);
            }
            
            load(); 
        } catch (Exception e) {
            System.out.println("[Chat Sync] Failed to update config.json: " + e.getMessage());
        }
    }
}
