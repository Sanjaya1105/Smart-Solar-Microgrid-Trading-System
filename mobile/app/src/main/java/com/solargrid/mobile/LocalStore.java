package com.solargrid.mobile;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * SQLite is the Android client's local persistence layer.
 * MongoDB remains the source of truth for server-side business records.
 */
public final class LocalStore extends SQLiteOpenHelper {
    private static final String DB = "solargrid_local.db";
    private static final int VERSION = 2;
    private static final String SESSION_TABLE = "app_session";
    private static final String REFERENCES_TABLE = "references_cache";
    private static final String RESERVATIONS_TABLE = "reservations_cache";

    public LocalStore(Context context) {
        super(context.getApplicationContext(), DB, null, VERSION);
    }

    @Override
    public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE IF NOT EXISTS " + SESSION_TABLE + " (" +
                "id INTEGER PRIMARY KEY CHECK (id = 1), " +
                "token TEXT NOT NULL, role TEXT NOT NULL, full_name TEXT NOT NULL, " +
                "user_id TEXT NOT NULL, updated_at INTEGER NOT NULL)");
        db.execSQL("CREATE TABLE IF NOT EXISTS " + REFERENCES_TABLE + " (" +
                "key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL)");
        db.execSQL("CREATE TABLE IF NOT EXISTS " + RESERVATIONS_TABLE + " (" +
                "id TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at INTEGER NOT NULL)");
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        if (oldVersion < 2) {
            db.execSQL("ALTER TABLE " + REFERENCES_TABLE +
                    " ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0");
            db.execSQL("CREATE TABLE IF NOT EXISTS " + SESSION_TABLE + " (" +
                    "id INTEGER PRIMARY KEY CHECK (id = 1), " +
                    "token TEXT NOT NULL, role TEXT NOT NULL, full_name TEXT NOT NULL, " +
                    "user_id TEXT NOT NULL, updated_at INTEGER NOT NULL)");
            db.execSQL("CREATE TABLE IF NOT EXISTS " + RESERVATIONS_TABLE + " (" +
                    "id TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at INTEGER NOT NULL)");
        }
    }

    /** Store the authenticated session in SQLite so it survives process restarts. */
    public void saveSession(String token, String role, String fullName, String userId) {
        ContentValues values = new ContentValues();
        values.put("id", 1);
        values.put("token", token == null ? "" : token);
        values.put("role", role == null ? "" : role);
        values.put("full_name", fullName == null ? "" : fullName);
        values.put("user_id", userId == null ? "" : userId);
        values.put("updated_at", System.currentTimeMillis());
        getWritableDatabase().insertWithOnConflict(
                SESSION_TABLE, null, values, SQLiteDatabase.CONFLICT_REPLACE);
    }

    /** Read the current JWT from SQLite for authenticated REST calls. */
    public String token() {
        return sessionValue("token");
    }

    /** Read the authenticated role from SQLite for role-aware navigation. */
    public String role() {
        return sessionValue("role");
    }

    /** Read the authenticated display name from SQLite. */
    public String fullName() {
        return sessionValue("full_name");
    }

    /** Read the authenticated user id from SQLite. */
    public String userId() {
        return sessionValue("user_id");
    }

    private String sessionValue(String column) {
        try (Cursor cursor = getReadableDatabase().query(
                SESSION_TABLE, new String[]{column}, "id = ?", new String[]{"1"},
                null, null, null)) {
            return cursor.moveToFirst() ? cursor.getString(0) : "";
        }
    }

    /** Clear credentials and user-specific cached reservations on sign out. */
    public void clear() {
        SQLiteDatabase db = getWritableDatabase();
        db.beginTransaction();
        try {
            db.delete(SESSION_TABLE, null, null);
            db.delete(RESERVATIONS_TABLE, null, null);
            db.setTransactionSuccessful();
        } finally {
            db.endTransaction();
        }
    }

    /** Cache a JSON reference collection such as active stations or available slots. */
    public void cacheReference(String key, String value) {
        ContentValues values = new ContentValues();
        values.put("key", key);
        values.put("value", value == null ? "" : value);
        values.put("updated_at", System.currentTimeMillis());
        getWritableDatabase().insertWithOnConflict(
                REFERENCES_TABLE, null, values, SQLiteDatabase.CONFLICT_REPLACE);
    }

    /** Return a previously cached reference collection, or null when none exists. */
    public String reference(String key) {
        try (Cursor cursor = getReadableDatabase().query(
                REFERENCES_TABLE, new String[]{"value"}, "key = ?", new String[]{key},
                null, null, null)) {
            return cursor.moveToFirst() ? cursor.getString(0) : null;
        }
    }

    /** Replace the user's reservation snapshot after a successful API read. */
    public void cacheReservations(JSONArray reservations) {
        SQLiteDatabase db = getWritableDatabase();
        db.beginTransaction();
        try {
            db.delete(RESERVATIONS_TABLE, null, null);
            long now = System.currentTimeMillis();
            for (int i = 0; i < reservations.length(); i++) {
                JSONObject reservation = reservations.optJSONObject(i);
                if (reservation == null || reservation.optString("id").isEmpty()) continue;
                ContentValues values = new ContentValues();
                values.put("id", reservation.optString("id"));
                values.put("payload", reservation.toString());
                values.put("updated_at", now);
                db.insertWithOnConflict(
                        RESERVATIONS_TABLE, null, values, SQLiteDatabase.CONFLICT_REPLACE);
            }
            db.setTransactionSuccessful();
        } finally {
            db.endTransaction();
        }
    }

    /** Return the last reservation snapshot for offline read-only display. */
    public JSONArray cachedReservations() {
        JSONArray result = new JSONArray();
        try (Cursor cursor = getReadableDatabase().query(
                RESERVATIONS_TABLE, new String[]{"payload"}, null, null,
                null, null, "updated_at DESC")) {
            while (cursor.moveToNext()) {
                try {
                    result.put(new JSONObject(cursor.getString(0)));
                } catch (Exception ignored) {
                    // Ignore a malformed cache row and keep valid reservations readable.
                }
            }
        }
        return result;
    }

    /** Remove a snapshot after a successful write until the next server sync. */
    public void clearReservationCache() {
        getWritableDatabase().delete(RESERVATIONS_TABLE, null, null);
    }
}
