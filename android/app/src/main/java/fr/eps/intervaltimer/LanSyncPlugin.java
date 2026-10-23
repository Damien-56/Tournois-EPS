package fr.eps.tournois;

import android.os.Handler;
import android.os.Looper;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.PluginMethod;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.Inet4Address;
import java.net.NetworkInterface;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Enumeration;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Minimal local HTTP hub. The master tablet owns the state; clients only read
 * the snapshot or submit actions. No Internet service or third-party SDK is used. */
@CapacitorPlugin(name = "LanSync")
public class LanSyncPlugin extends Plugin {
    private final ExecutorService executor = Executors.newCachedThreadPool();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private volatile ServerSocket serverSocket;
    private volatile String state = "{}";
    private volatile int revision = 0;
    private final List<String> actions = Collections.synchronizedList(new ArrayList<>());

    @PluginMethod
    public void start(PluginCall call) {
        int port = call.getInt("port", 8765);
        executor.execute(() -> {
            try {
                if (serverSocket != null && !serverSocket.isClosed()) {
                    resolveInfo(call, port);
                    return;
                }
                serverSocket = new ServerSocket(port);
                executor.execute(() -> acceptLoop());
                resolveInfo(call, serverSocket.getLocalPort());
            } catch (Exception error) {
                call.reject("Impossible de démarrer le serveur local", error);
            }
        });
    }

    private void resolveInfo(PluginCall call, int port) {
        JSObject result = new JSObject();
        String address = localAddress();
        result.put("address", address);
        result.put("port", port);
        result.put("joinUrl", "http://" + address + ":" + port);
        call.resolve(result);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        try { if (serverSocket != null) serverSocket.close(); } catch (Exception ignored) { }
        call.resolve();
    }

    @PluginMethod
    public void setState(PluginCall call) {
        String next = call.getString("state", "{}");
        state = next;
        revision++;
        call.resolve();
    }

    @PluginMethod
    public void getState(PluginCall call) {
        JSObject result = new JSObject();
        result.put("state", state);
        result.put("revision", revision);
        call.resolve(result);
    }

    @PluginMethod
    public void getActions(PluginCall call) {
        int after = call.getInt("after", 0);
        JSArray result = new JSArray();
        synchronized (actions) {
            for (int index = Math.max(0, after); index < actions.size(); index++) {
                JSObject item = new JSObject();
                item.put("sequence", index + 1);
                item.put("action", actions.get(index));
                result.put(item);
            }
        }
        JSObject response = new JSObject();
        response.put("actions", result);
        call.resolve(response);
    }

    @PluginMethod
    public void sendAction(PluginCall call) {
        String baseUrl = call.getString("url", "").replaceAll("/$", "");
        String action = call.getString("action", "{}");
        executor.execute(() -> {
            try {
                post(baseUrl + "/action", action);
                call.resolve();
            } catch (Exception error) { call.reject("Action locale refusée", error); }
        });
    }

    private void acceptLoop() {
        while (serverSocket != null && !serverSocket.isClosed()) {
            try { Socket socket = serverSocket.accept(); executor.execute(() -> handle(socket)); }
            catch (Exception ignored) { break; }
        }
    }

    private void handle(Socket socket) {
        try (Socket client = socket; BufferedReader reader = new BufferedReader(new InputStreamReader(client.getInputStream(), StandardCharsets.UTF_8)); OutputStream output = client.getOutputStream()) {
            String request = reader.readLine();
            if (request == null) return;
            int contentLength = 0; String line;
            while (!(line = reader.readLine()).isEmpty()) {
                if (line.toLowerCase().startsWith("content-length:")) contentLength = Integer.parseInt(line.substring(line.indexOf(':') + 1).trim());
            }
            char[] chars = new char[contentLength]; int read = 0;
            while (read < contentLength) { int count = reader.read(chars, read, contentLength - read); if (count < 0) break; read += count; }
            String body = new String(chars, 0, read);
            String[] parts = request.split(" "); String method = parts[0]; String path = parts.length > 1 ? parts[1] : "/";
            String response;
            if ("OPTIONS".equals(method)) response = "";
            else if ("GET".equals(method) && path.startsWith("/state")) response = state;
            else if ("POST".equals(method) && path.startsWith("/action")) { actions.add(body); response = "{\"ok\":true}"; }
            else response = "{\"error\":\"not-found\"}";
            byte[] data = response.getBytes(StandardCharsets.UTF_8);
            String headers = "HTTP/1.1 200 OK\r\nContent-Type: application/json; charset=utf-8\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET,POST,OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type\r\nContent-Length: " + data.length + "\r\nConnection: close\r\n\r\n";
            output.write(headers.getBytes(StandardCharsets.UTF_8)); output.write(data); output.flush();
        } catch (Exception ignored) { }
    }

    private void post(String target, String body) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(target).openConnection();
        connection.setRequestMethod("POST"); connection.setDoOutput(true); connection.setRequestProperty("Content-Type", "application/json");
        try (OutputStream output = connection.getOutputStream()) { output.write(body.getBytes(StandardCharsets.UTF_8)); }
        if (connection.getResponseCode() >= 400) throw new IllegalStateException("HTTP " + connection.getResponseCode());
        connection.disconnect();
    }

    private String localAddress() {
        try {
            Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
            while (interfaces.hasMoreElements()) {
                Enumeration<java.net.InetAddress> addresses = interfaces.nextElement().getInetAddresses();
                while (addresses.hasMoreElements()) { java.net.InetAddress address = addresses.nextElement(); if (!address.isLoopbackAddress() && address instanceof Inet4Address) return address.getHostAddress(); }
            }
        } catch (Exception ignored) { }
        return "127.0.0.1";
    }
}
