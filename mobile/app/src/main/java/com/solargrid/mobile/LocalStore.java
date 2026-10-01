package com.solargrid.mobile;

import android.content.*;
import android.database.sqlite.*;

/** SQLite stores only the current JWT and safe account references; MongoDB remains the source of truth. */
public final class LocalStore extends SQLiteOpenHelper {
    private static final String DB = "solargrid_local.db";
    private final SharedPreferences prefs;
    public LocalStore(Context context) { super(context, DB, null, 1); prefs = context.getSharedPreferences("session", Context.MODE_PRIVATE); }
    @Override public void onCreate(SQLiteDatabase db) { db.execSQL("CREATE TABLE IF NOT EXISTS references_cache (key TEXT PRIMARY KEY, value TEXT NOT NULL)"); }
    @Override public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) { }
    public void saveSession(String token, String role, String fullName, String userId) { prefs.edit().putString("token", token).putString("role", role).putString("fullName", fullName).putString("userId", userId).apply(); }
    public String token() { return prefs.getString("token", ""); }
    public String role() { return prefs.getString("role", ""); }
    public String fullName() { return prefs.getString("fullName", ""); }
    public void clear() { prefs.edit().clear().apply(); }
    public void cacheReference(String key, String value) { getWritableDatabase().insertWithOnConflict("references_cache", null, values(key, value), SQLiteDatabase.CONFLICT_REPLACE); }
    private ContentValues values(String key, String value) { ContentValues values = new ContentValues(); values.put("key", key); values.put("value", value); return values; }
}
