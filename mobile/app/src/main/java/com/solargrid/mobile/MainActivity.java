package com.solargrid.mobile;

import android.graphics.*;
import android.graphics.drawable.GradientDrawable;
import android.os.*;
import android.text.InputType;
import android.net.Uri;
import android.view.*;
import android.widget.*;
import androidx.appcompat.app.AppCompatActivity;
import com.google.zxing.*;
import com.google.zxing.common.BitMatrix;
import com.journeyapps.barcodescanner.ScanContract;
import com.journeyapps.barcodescanner.ScanOptions;
import org.json.*;
import java.util.concurrent.*;

/** Native Android client for Prosumer and Grid Operator workflows. */
public final class MainActivity extends AppCompatActivity {
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private LocalStore store; private LinearLayout root; private TextView message;
    private EditText operatorToken;
    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    private final androidx.activity.result.ActivityResultLauncher<ScanOptions> scanner = registerForActivityResult(new ScanContract(), result -> { if (result.getContents() != null && operatorToken != null) operatorToken.setText(result.getContents()); });
    private TextView title(String value) { TextView view = new TextView(this); view.setText(value); view.setTextSize(27); view.setTypeface(null, Typeface.BOLD); view.setTextColor(Color.rgb(16,43,42)); view.setPadding(0, dp(22), 0, dp(8)); return view; }
    private EditText field(String hint, boolean password) { EditText input = new EditText(this); input.setHint(hint); input.setTextSize(16); input.setSingleLine(true); if (password) input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD); input.setPadding(dp(18), 0, dp(18), 0); GradientDrawable bg = new GradientDrawable(); bg.setColor(Color.WHITE); bg.setCornerRadius(dp(18)); bg.setStroke(dp(1), Color.rgb(205,220,214)); input.setBackground(bg); input.setElevation(dp(2)); LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, dp(56)); lp.setMargins(0, dp(6), 0, dp(12)); input.setLayoutParams(lp); return input; }
    private Button button(String text, View.OnClickListener listener) { Button button = new Button(this); button.setText(text); button.setTextColor(Color.WHITE); button.setTextSize(16); button.setAllCaps(false); button.setTypeface(null, Typeface.BOLD); button.setPadding(dp(18), 0, dp(18), 0); GradientDrawable bg = new GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT, new int[]{Color.rgb(24,105,88), Color.rgb(34,142,113)}); bg.setCornerRadius(dp(18)); button.setBackground(bg); button.setElevation(dp(4)); button.setMinHeight(dp(52)); button.setOnClickListener(listener); LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, dp(56)); lp.setMargins(0, dp(7), 0, dp(7)); button.setLayoutParams(lp); return button; }
    @Override public void onCreate(Bundle state) { super.onCreate(state); store = new LocalStore(this); showHomeOrLogin(); }
    private void base(String heading) { root = new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL); root.setPadding(dp(24), dp(18), dp(24), dp(30)); root.setBackgroundColor(Color.rgb(246,250,247)); ScrollView scroll = new ScrollView(this); scroll.setFillViewport(true); scroll.setBackgroundColor(Color.rgb(246,250,247)); scroll.addView(root); setContentView(scroll); root.addView(title(heading)); message = new TextView(this); message.setTextSize(14); message.setPadding(0, 0, 0, dp(10)); message.setTextColor(Color.rgb(166,74,62)); root.addView(message); }
    private void showHomeOrLogin() { if (store.token().isEmpty()) showLogin(); else showDashboard(); }
    private void showLogin() {
        base("Solargrid mobile"); TextView intro = new TextView(this); intro.setText("Sign in as a Prosumer or Grid Operator"); root.addView(intro);
        EditText identity = field("Email or NIC", false), password = field("Password", true); root.addView(identity); root.addView(password);
        root.addView(button("Sign in", v -> run(() -> { JSONObject data = ApiClient.request("/api/auth/login", "", "POST", new JSONObject().put("nicOrEmail", identity.getText().toString().trim()).put("password", password.getText().toString())); store.saveSession(data.getString("token"), data.getString("role"), data.getString("fullName"), data.getString("userId")); runOnUiThread(this::showDashboard); })));
        root.addView(button("Create prosumer account", v -> showRegistration()));
    }
    private void showRegistration() {
        base("Create prosumer account"); EditText nic = field("NIC", false), name = field("Full name", false), email = field("Email", false), phone = field("Phone", false), address = field("Address", false), password = field("Password (8+ characters)", true); for (EditText input : new EditText[]{nic,name,email,phone,address,password}) root.addView(input);
        root.addView(button("Register", v -> run(() -> { ApiClient.request("/api/auth/register-prosumer", "", "POST", new JSONObject().put("nic",nic.getText().toString()).put("fullName",name.getText().toString()).put("email",email.getText().toString()).put("phone",phone.getText().toString()).put("address",address.getText().toString()).put("password",password.getText().toString())); runOnUiThread(() -> { toast("Registration submitted. Backoffice activation is required."); showLogin(); }); })));
        root.addView(button("Back to sign in", v -> showLogin()));
    }
    private void showDashboard() {
        boolean operator = "GridOperator".equals(store.role()); base("Hello, " + store.fullName()); TextView role = new TextView(this); role.setText(store.role() + " mobile workspace"); root.addView(role);
        if (operator) { root.addView(button("Operations and QR verification", v -> showOperator())); root.addView(button("Nearby stations", v -> showStations())); }
        else { root.addView(button("My reservations", v -> showReservations())); root.addView(button("Book an energy slot", v -> showBooking())); root.addView(button("Nearby stations", v -> showStations())); }
        root.addView(button("Account settings", v -> showSettings())); root.addView(button("Sign out", v -> { store.clear(); showLogin(); }));
    }