package com.solargrid.mobile;

import org.json.*;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;

/** Small REST client. Business rules, authorization and persistence stay in the ASP.NET API. */
public final class ApiClient {
    // Android Emulator reaches the developer machine through 10.0.2.2. Use the API's HTTP development port to avoid an untrusted local HTTPS certificate.
    // Android emulator reaches the local IIS-hosted SolarGrid site through 10.0.2.2.
    //public static String baseUrl = "http://10.0.2.2:8081";
    public static String baseUrl = "http://192.168.1.3";
    public static JSONObject request(String path, String token, String method, JSONObject body) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(baseUrl + path).openConnection();
        connection.setRequestMethod(method); connection.setInstanceFollowRedirects(false); connection.setConnectTimeout(12000); connection.setReadTimeout(12000); connection.setRequestProperty("Content-Type", "application/json");
        if (token != null && !token.isEmpty()) connection.setRequestProperty("Authorization", "Bearer " + token);
        if (body != null) { connection.setDoOutput(true); try (OutputStream output = connection.getOutputStream()) { output.write(body.toString().getBytes(StandardCharsets.UTF_8)); } }
        int status = connection.getResponseCode(); InputStream input = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
        String response = read(input); if (status < 200 || status >= 300) { String detail = response; try { detail = new JSONObject(response).optString("detail", response); } catch (Exception ignored) { } throw new IOException(detail); }
        return response.isEmpty() ? new JSONObject() : new JSONObject(response);
    }
    public static JSONArray list(String path, String token) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(baseUrl + path).openConnection(); connection.setRequestProperty("Authorization", "Bearer " + token); connection.setConnectTimeout(12000); connection.setReadTimeout(12000);
        int status = connection.getResponseCode(); String response = read(status >= 400 ? connection.getErrorStream() : connection.getInputStream()); if (status < 200 || status >= 300) { String detail = response; try { detail = new JSONObject(response).optString("detail", response); } catch (Exception ignored) { } throw new IOException(detail); } return new JSONArray(response);
    }
    private static String read(InputStream input) throws IOException { if (input == null) return ""; try (BufferedReader reader = new BufferedReader(new InputStreamReader(input, StandardCharsets.UTF_8))) { StringBuilder result = new StringBuilder(); String line; while ((line = reader.readLine()) != null) result.append(line); return result.toString(); } }
}
