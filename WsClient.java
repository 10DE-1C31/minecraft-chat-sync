package com.chatSync;

import org.java_websocket.client.WebSocketClient;
import org.java_websocket.handshake.ServerHandshake;

import java.net.URI;

public class WsClient extends WebSocketClient {

    public WsClient(URI serverUri) {
        super(serverUri);
    }
    
    @Override
    public void onOpen(ServerHandshake handshakedata) {
        System.out.println("[Chat Sync] Connected to Websocket");
    }

    @Override 
    public void onMessage(String message) {
        System.out.println("[Chat Sync] Recieved: "+ message);
        InboundMsgHandler.handleIncomingMsg(message);
    }

    @Override 
    public void onClose(int code, String reason, boolean remote) {
        System.out.println("[Chat Sync] [Info] WebSocket disconnected: " + reason);

        new Thread(Main::scheduleReconnect).start();
    }

    @Override
    public void onError(Exception ex) {
        System.err.println("[Chat Sync] WebSocket error: " + ex.getMessage());
    }

        public void sendMsg(String type, String username, String message, String uuid) {
        if (this.isOpen()) {
            String safeName = username.replace("\\", "\\\\").replace("\"", "\\\"");
            String safeMsg = message.replace("\\", "\\\\").replace("\"", "\\\"");
            String safeUuid = uuid != null ? uuid.replace("\"", "\\\"") : "";

            String json = String.format(
                "{\"type\":\"%s\",\"username\":\"%s\",\"message\":\"%s\",\"uuid\":\"%s\"}",
                type, safeName, safeMsg, safeUuid);

            this.send(json);
            System.out.println("[Chat Sync] Sending: " + json);
        } else {
            System.out.println("[Chat Sync] Failed to send message");
        }
    }
}
