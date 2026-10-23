package fr.eps.tournois;

import android.os.Handler;
import android.os.Looper;
import android.content.Context;
import android.net.nsd.NsdManager;
import android.net.nsd.NsdServiceInfo;
import android.net.wifi.WifiManager;

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
import java.util.UUID;
import java.util.HashSet;
import java.util.Set;

/** Minimal local HTTP hub. The master tablet owns the state; clients only read
 * the snapshot or submit actions. No Internet service or third-party SDK is used. */
@CapacitorPlugin(name = "LanSync")
public class LanSyncPlugin extends Plugin {
    private final ExecutorService executor = Executors.newCachedThreadPool();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private volatile ServerSocket serverSocket;
    private volatile String state = "{}";
    private volatile int revision = 0;
    private volatile String sessionToken;
    private volatile NsdManager nsdManager;
    private volatile NsdManager.RegistrationListener registrationListener;
    private volatile WifiManager.MulticastLock multicastLock;
    private final List<String> actions = Collections.synchronizedList(new ArrayList<>());
    private final Set<String> actionIds = Collections.synchronizedSet(new HashSet<>());

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
                sessionToken = UUID.randomUUID().toString().replace("-", "");
                acquireMulticastLock();
                registerMdns(serverSocket.getLocalPort());
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
        result.put("joinUrl", "http://" + address + ":" + port + "?token=" + sessionToken);
        call.resolve(result);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        try { if (serverSocket != null) serverSocket.close(); } catch (Exception ignored) { }
        unregisterMdns();
        releaseMulticastLock();
        sessionToken = null;
        actions.clear();
        actionIds.clear();
        revision = 0;
        call.resolve();
    }

    @PluginMethod
    public void discover(PluginCall call) {
        NsdManager manager = getNsdManager();
        if (manager == null) { call.reject("La découverte réseau local est indisponible"); return; }
        acquireMulticastLock();
        List<String[]> peers = Collections.synchronizedList(new ArrayList<>());
        final NsdManager.DiscoveryListener[] holder = new NsdManager.DiscoveryListener[1];
        NsdManager.DiscoveryListener listener = new NsdManager.DiscoveryListener() {
            public void onDiscoveryStarted(String serviceType) { }
            public void onDiscoveryStopped(String serviceType) { }
            public void onStartDiscoveryFailed(String serviceType, int errorCode) { }
            public void onStopDiscoveryFailed(String serviceType, int errorCode) { }
            public void onServiceLost(NsdServiceInfo serviceInfo) { }
            public void onServiceFound(NsdServiceInfo serviceInfo) {
                if (!"_tournois-eps._tcp.".equals(serviceInfo.getServiceType())) return;
                try {
                    manager.resolveService(serviceInfo, new NsdManager.ResolveListener() {
                        public void onResolveFailed(NsdServiceInfo info, int errorCode) { }
                        public void onServiceResolved(NsdServiceInfo info) {
                            String host = info.getHost() == null ? "" : info.getHost().getHostAddress();
                            byte[] tokenBytes = info.getAttributes().get("token");
                            String token = tokenBytes == null ? "" : new String(tokenBytes, StandardCharsets.UTF_8);
                            if (!host.isEmpty() && !token.isEmpty()) peers.add(new String[] { info.getServiceName(), host, String.valueOf(info.getPort()), token });
                        }
                    });
                } catch (Exception ignored) { }
            }
        };
        holder[0] = listener;
        try { manager.discoverServices("_tournois-eps._tcp.", NsdManager.PROTOCOL_DNS_SD, listener); }
        catch (Exception error) { releaseMulticastLock(); call.reject("Impossible de rechercher la tablette maître", error); return; }
        mainHandler.postDelayed(() -> {
            try { manager.stopServiceDiscovery(holder[0]); } catch (Exception ignored) { }
            if (serverSocket == null || serverSocket.isClosed()) releaseMulticastLock();
            JSArray result = new JSArray();
            synchronized (peers) {
                for (String[] peer : peers) {
                    JSObject item = new JSObject();
                    item.put("name", peer[0]); item.put("address", peer[1]); item.put("port", Integer.parseInt(peer[2]));
                    item.put("joinUrl", "http://" + peer[1] + ":" + peer[2] + "?token=" + peer[3]); result.put(item);
                }
            }
            JSObject response = new JSObject(); response.put("peers", result); call.resolve(response);
        }, 2200);
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
        String targetUrl = call.getString("url", "");
        String action = call.getString("action", "{}");
        executor.execute(() -> {
            try {
                post(targetUrl, action);
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
            String response; int status = 200;
            if ("OPTIONS".equals(method)) response = "";
            else if (!authorized(path)) { status = 401; response = "{\"error\":\"session-token-required\"}"; }
            else if ("GET".equals(method) && route(path).equals("/state")) response = state;
            else if ("POST".equals(method) && route(path).equals("/action")) {
                String actionId = actionId(body);
                if (actionId.isEmpty()) { status = 400; response = "{\"error\":\"action-id-required\"}"; }
                else if (actionIds.add(actionId)) { actions.add(body); response = "{\"ok\":true,\"queued\":true}"; }
                else response = "{\"ok\":true,\"duplicate\":true}";
            }
            else { status = 404; response = "{\"error\":\"not-found\"}"; }
            byte[] data = response.getBytes(StandardCharsets.UTF_8);
            String statusText = status == 200 ? "OK" : status == 400 ? "Bad Request" : status == 401 ? "Unauthorized" : "Not Found";
            String headers = "HTTP/1.1 " + status + " " + statusText + "\r\nContent-Type: application/json; charset=utf-8\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET,POST,OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type\r\nContent-Length: " + data.length + "\r\nConnection: close\r\n\r\n";
            output.write(headers.getBytes(StandardCharsets.UTF_8)); output.write(data); output.flush();
        } catch (Exception ignored) { }
    }

    private String route(String path) { int query = path.indexOf('?'); return query >= 0 ? path.substring(0, query) : path; }

    private boolean authorized(String path) {
        if (sessionToken == null) return false;
        String marker = "token=";
        int start = path.indexOf(marker);
        if (start < 0) return false;
        int end = path.indexOf('&', start);
        String token = end >= 0 ? path.substring(start + marker.length(), end) : path.substring(start + marker.length());
        return sessionToken.equals(token);
    }

    private String actionId(String body) {
        try { return new JSONObject(body).optString("id", ""); }
        catch (Exception ignored) { return ""; }
    }

    private void post(String target, String body) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(target).openConnection();
        connection.setRequestMethod("POST"); connection.setDoOutput(true); connection.setRequestProperty("Content-Type", "application/json");
        try (OutputStream output = connection.getOutputStream()) { output.write(body.getBytes(StandardCharsets.UTF_8)); }
        if (connection.getResponseCode() >= 400) throw new IllegalStateException("HTTP " + connection.getResponseCode());
        connection.disconnect();
    }

    private NsdManager getNsdManager() {
        if (nsdManager == null) nsdManager = (NsdManager) getContext().getSystemService(Context.NSD_SERVICE);
        return nsdManager;
    }

    private void acquireMulticastLock() {
        try {
            WifiManager wifi = (WifiManager) getContext().getSystemService(Context.WIFI_SERVICE);
            if (wifi == null) return;
            if (multicastLock == null) { multicastLock = wifi.createMulticastLock("tournois-eps-mdns"); multicastLock.setReferenceCounted(false); }
            if (!multicastLock.isHeld()) multicastLock.acquire();
        } catch (Exception ignored) { }
    }

    private void releaseMulticastLock() {
        try { if (multicastLock != null && multicastLock.isHeld()) multicastLock.release(); } catch (Exception ignored) { }
    }

    private void registerMdns(int port) {
        NsdManager manager = getNsdManager();
        if (manager == null) return;
        NsdServiceInfo service = new NsdServiceInfo();
        service.setServiceName("Tournois-EPS"); service.setServiceType("_tournois-eps._tcp."); service.setPort(port); service.setAttribute("token", sessionToken);
        registrationListener = new NsdManager.RegistrationListener() {
            public void onServiceRegistered(NsdServiceInfo info) { }
            public void onRegistrationFailed(NsdServiceInfo info, int errorCode) { }
            public void onServiceUnregistered(NsdServiceInfo info) { }
            public void onUnregistrationFailed(NsdServiceInfo info, int errorCode) { }
        };
        try { manager.registerService(service, NsdManager.PROTOCOL_DNS_SD, registrationListener); } catch (Exception ignored) { }
    }

    private void unregisterMdns() {
        if (nsdManager == null || registrationListener == null) return;
        try { nsdManager.unregisterService(registrationListener); } catch (Exception ignored) { }
        registrationListener = null;
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
