# Solargrid native Android client

This is the pure Android client required by the assignment. It uses Java Android views, `SQLiteOpenHelper` for the local session/reference cache, `HttpURLConnection` for REST, and ZXing for QR rendering/scanning. The API remains the source of truth for accounts, stations, slots, reservations and QR verification.

## Implemented flows

- Prosumer or Grid Operator JWT login with role-aware home screen.
- Prosumer registration through `POST /api/auth/register-prosumer`; pending activation is communicated clearly.
- Prosumer dashboard: reservations, booking creation, reservation history and approved QR generation.
- Grid Operator dashboard: station list, camera QR scan and server-verified completion through `/api/reservations/complete-by-qr`.
- Nearby station data from `/api/stations?activeOnly=true`; GPS is shown from the API response. A production build can replace the list card with Google Maps markers using `/api/stations/nearby` and the assignment's Maps key policy.
- Account display and password change through `/api/auth/account` and `/api/auth/change-password`.
- SQLite stores only JWT and safe user references; no business rules or MongoDB data are duplicated locally.

## Build and run

Open `mobile/` in Android Studio with Android SDK 35 and JDK 17. The emulator IIS API URL is `http://10.0.2.2:8081`; start the SolarGrid IIS site before running the app. For direct API development, temporarily use the ASP.NET HTTP profile URL. On a physical device, replace `10.0.2.2` with the computer LAN IP (for example `http://192.168.1.10:8081`) and keep both devices on the same network. The development manifest permits cleartext HTTP only for local testing; production must use trusted HTTPS.

```powershell
cd mobile
gradlew.bat assembleDebug
adb install app/build/outputs/apk/debug/app-debug.apk
```

The Android Gradle Plugin 8.5.2 requires Gradle 8.7 or newer. If Android Studio asks for a Gradle version, choose the wrapper and use Gradle 8.7 (`gradle/wrapper/gradle-wrapper.properties`). Commit the generated `gradlew`, `gradlew.bat` and wrapper JAR if Android Studio creates them.

The Android app must never connect to MongoDB directly. Use an HTTPS API base URL in release builds, remove development seed credentials, and add a release keystore before submission.

## Requirement boundaries

SQLite is deliberately limited to session/reference caching. Server-side validation still controls the seven-day booking window, twelve-hour update/cancel rule, capacity, roles and QR replay protection. The camera scanner receives the token and the API performs final verification.
