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
    private void showStations() { base("Nearby solar stations"); root.addView(button("Refresh stations", v -> loadStations())); root.addView(button("Back", v -> showDashboard())); loadStations(); }
    private void loadStations() { run(() -> { JSONArray stations = ApiClient.list("/api/stations?activeOnly=true", store.token()); runOnUiThread(() -> { clearDynamicRows(4); for (int i=0;i<stations.length();i++) { JSONObject station=stations.optJSONObject(i); TextView item=new TextView(this); item.setPadding(0,dp(16),0,dp(16)); double lat=station.optDouble("latitude"), lon=station.optDouble("longitude"); item.setText(station.optString("name")+"\n"+station.optString("address")+"\nGPS "+lat+", "+lon+"\nCapacity "+station.optDouble("capacityKwh")+" kWh\nTap to open in Google Maps"); item.setOnClickListener(v->{ try { startActivity(new android.content.Intent(android.content.Intent.ACTION_VIEW, Uri.parse("geo:"+lat+","+lon+"?q="+lat+","+lon+"("+Uri.encode(station.optString("name") )+")"))); } catch(Exception e) { message.setText("Google Maps is not available on this device."); } }); root.addView(item); } }); }); }
    private void showReservations() { base("My reservations"); root.addView(button("Refresh", v -> loadReservations())); root.addView(button("Back", v -> showDashboard())); loadReservations(); }
    private void loadReservations() { run(() -> { JSONArray reservations=ApiClient.list("/api/reservations/mine",store.token()); runOnUiThread(() -> { clearDynamicRows(4); for(int i=0;i<reservations.length();i++){ JSONObject item=reservations.optJSONObject(i); LinearLayout card=new LinearLayout(this); card.setOrientation(LinearLayout.VERTICAL); TextView row=new TextView(this); row.setPadding(0,15,0,8); row.setText("Status: "+item.optString("status")+"\nEnergy: "+item.optDouble("energyKwh")+" kWh\nReservation: "+item.optString("id")); card.addView(row); String status=item.optString("status"); if("Approved".equals(status)) card.addView(button("Show secure QR", v -> showQr(item.optString("id")))); if(!"Completed".equals(status) && !"Cancelled".equals(status) && !"Rejected".equals(status)) { card.addView(button("Edit reservation", v -> showEditReservation(item))); card.addView(button("Cancel reservation", v -> cancelReservation(item.optString("id")))); } root.addView(card); } }); }); }
    private void cancelReservation(String reservationId) { run(() -> { ApiClient.request("/api/reservations/"+reservationId+"/cancel", store.token(), "POST", null); runOnUiThread(() -> showSummary("Reservation cancelled", "Your cancellation request was accepted by the server.")); }); }
    private void showSummary(String heading, String detail) { base(heading); TextView text=new TextView(this); text.setText(detail+"\n\nThe server has returned a successful result."); text.setTextSize(17); text.setPadding(0,dp(18),0,dp(18)); root.addView(text); root.addView(button("View reservations",v->showReservations())); root.addView(button("Back to dashboard",v->showDashboard())); }
    private void showEditReservation(JSONObject reservation) {
        base("Edit reservation");
        EditText energy=field("Energy kWh",false); energy.setText(reservation.optString("energyKwh")); root.addView(label("Energy amount (kWh)")); root.addView(energy);
        Spinner type=new Spinner(this); type.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,new String[]{"DropOff","Charging"})); String oldType=reservation.optString("transactionType"); if("Charging".equals(oldType)) type.setSelection(1); root.addView(label("Transaction type")); root.addView(type);
        root.addView(button("Save changes", v -> { try { double amount=Double.parseDouble(energy.getText().toString().trim()); run(() -> { ApiClient.request("/api/reservations/"+reservation.optString("id"),store.token(),"PUT",new JSONObject().put("slotId",reservation.optString("slotId")).put("transactionType",type.getSelectedItem().toString()).put("energyKwh",amount)); runOnUiThread(() -> showSummary("Reservation updated", "Your changes were saved and the reservation is waiting for approval.")); }); } catch(Exception e) { message.setText("Enter a valid energy amount."); } }));
        root.addView(button("Back",v->showReservations()));
    }
    // Keep the heading, status text and refresh button, removing only previously rendered API rows.
    private void clearDynamicRows(int firstRowIndex) { if (root != null && root.getChildCount() > firstRowIndex) root.removeViews(firstRowIndex, root.getChildCount() - firstRowIndex); }
    private void showBooking() {
        base("Book an energy slot");
        Spinner stationPicker = new Spinner(this), slotPicker = new Spinner(this);
        stationPicker.setPrompt("Select a solar station"); slotPicker.setPrompt("Select an available time slot");
        ArrayAdapter<String> stationsAdapter = new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, new java.util.ArrayList<>());
        ArrayAdapter<String> slotsAdapter = new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, new java.util.ArrayList<>());
        slotsAdapter.add("Select an available time slot");
        stationPicker.setAdapter(stationsAdapter); slotPicker.setAdapter(slotsAdapter);
        root.addView(label("Solar station")); root.addView(stationPicker); root.addView(label("Available time slot")); root.addView(slotPicker);
        EditText energy = field("Energy kWh", false); root.addView(energy);
        Spinner type = new Spinner(this); type.setAdapter(new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, new String[]{"DropOff", "Charging"})); root.addView(type);
        final JSONArray[] stationsData = { new JSONArray() }, slotsData = { new JSONArray() };
        root.addView(button("Create booking", v -> {
            try {
                int stationIndex = stationPicker.getSelectedItemPosition(), slotIndex = slotPicker.getSelectedItemPosition() - 1;
                if (stationIndex < 0 || slotIndex < 0 || stationsData[0].length() == 0 || slotsData[0].length() == 0) { message.setText("Select a station and available time slot first."); return; }
                JSONObject slot = slotsData[0].getJSONObject(slotIndex);
                if (energy.getText().toString().trim().isEmpty()) { message.setText("Enter the energy amount."); return; }
                run(() -> { ApiClient.request("/api/reservations", store.token(), "POST", new JSONObject().put("slotId", slot.getString("id")).put("transactionType", type.getSelectedItem().toString()).put("energyKwh", Double.parseDouble(energy.getText().toString()))); runOnUiThread(() -> showSummary("Booking submitted", "Your energy slot request was sent for approval.")); });
            } catch (Exception e) { message.setText(e.getMessage()); }
        }));
        root.addView(button("Back", v -> showDashboard()));
        stationPicker.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener() {
            public void onNothingSelected(android.widget.AdapterView<?> parent) { }
            public void onItemSelected(android.widget.AdapterView<?> parent, View view, int position, long id) {
                if (position < 0 || position >= stationsData[0].length()) return;
                try { String stationId = stationsData[0].getJSONObject(position).getString("id"); loadAvailableSlots(stationId, slotsAdapter, slotsData); } catch (Exception e) { message.setText(e.getMessage()); }
            }
        });
        run(() -> { JSONArray data = ApiClient.list("/api/stations?activeOnly=true", store.token()); runOnUiThread(() -> { try { stationsData[0] = data; for (int i=0;i<data.length();i++) { JSONObject station=data.getJSONObject(i); stationsAdapter.add(station.optString("name") + " / " + station.optString("address")); } stationsAdapter.notifyDataSetChanged(); } catch (Exception e) { message.setText(e.getMessage()); } }); });
    }
    private TextView label(String text) { TextView label = new TextView(this); label.setText(text); label.setPadding(0, 14, 0, 4); return label; }
    private void loadAvailableSlots(String stationId, ArrayAdapter<String> adapter, final JSONArray[] slotsData) {
        adapter.clear(); adapter.add("Loading available time slots..."); adapter.notifyDataSetChanged(); slotsData[0] = new JSONArray(); run(() -> { JSONArray data = ApiClient.list("/api/stations/slots?stationId=" + Uri.encode(stationId) + "&availableOnly=true", store.token()); runOnUiThread(() -> { try { adapter.clear(); adapter.add("Select an available time slot"); slotsData[0] = data; for (int i=0;i<data.length();i++) { JSONObject slot=data.getJSONObject(i); adapter.add(formatSlot(slot)); } adapter.notifyDataSetChanged(); if (data.length() == 0) message.setText("No available slots for this station."); } catch (Exception e) { message.setText(e.getMessage()); } }); });
    }
    private String formatSlot(JSONObject slot) { return formatApiDate(slot.optString("startUtc")) + " - " + formatApiDate(slot.optString("endUtc")) + " (" + slot.optInt("reservedCapacity") + "/" + slot.optInt("totalCapacity") + " reserved)"; }
    private String formatApiDate(String value) { try { return new java.text.SimpleDateFormat("dd MMM, HH:mm", java.util.Locale.getDefault()).format(java.util.Date.from(java.time.Instant.parse(value))); } catch (Exception ignored) { return value; } }
    private void showQr(String reservationId) { run(() -> { JSONObject result=ApiClient.request("/api/reservations/"+reservationId+"/qr",store.token(),"POST",null); runOnUiThread(() -> { base("Secure reservation QR"); String token=result.optString("qrToken"); ImageView image=new ImageView(this); image.setImageBitmap(qr(token,700)); root.addView(image); root.addView(new TextView(this) {{ setText("Single-use token. Show this QR at the station."); }}); root.addView(button("Done",v->showReservations())); }); }); }
    private Bitmap qr(String value,int size) { try { BitMatrix matrix=new MultiFormatWriter().encode(value,BarcodeFormat.QR_CODE,size,size); Bitmap bitmap=Bitmap.createBitmap(size,size,Bitmap.Config.ARGB_8888); for(int x=0;x<size;x++) for(int y=0;y<size;y++) bitmap.setPixel(x,y,matrix.get(x,y)?Color.BLACK:Color.WHITE); return bitmap; } catch(Exception e) { return null; } }
    private void showOperator() { base("Operator QR verification"); TextView info=new TextView(this); info.setText("Scan the prosumer QR. The server verifies its signature, state, expiry and single-use hash."); root.addView(info); operatorToken=field("Scanned QR token",false); root.addView(operatorToken); root.addView(button("Scan QR with camera",v->{ ScanOptions options=new ScanOptions(); options.setPrompt("Scan Solargrid transaction QR"); options.setBeepEnabled(true); scanner.launch(options); })); root.addView(button("Verify and complete transfer",v->run(() -> { ApiClient.request("/api/reservations/complete-by-qr",store.token(),"POST",new JSONObject().put("qrToken",operatorToken.getText().toString().trim())); runOnUiThread(()->{toast("Transfer completed.");showDashboard();}); }))); root.addView(button("Back",v->showDashboard())); }
    private void showSettings() { base("Account settings"); run(() -> { JSONObject account=ApiClient.request("/api/users/me",store.token(),"GET",null); runOnUiThread(()->{ EditText name=field("Full name",false),email=field("Email",false),phone=field("Phone",false),address=field("Address",false); name.setText(account.optString("fullName")); email.setText(account.optString("email")); phone.setText(account.optString("phone")); address.setText(account.optString("address")); root.addView(label("Profile details")); root.addView(name);root.addView(email);root.addView(phone);root.addView(address); root.addView(button("Save profile",v->run(()->{ ApiClient.request("/api/users/me",store.token(),"PUT",new JSONObject().put("fullName",name.getText().toString().trim()).put("email",email.getText().toString().trim()).put("phone",phone.getText().toString().trim()).put("address",address.getText().toString().trim())); runOnUiThread(()->{toast("Profile updated.");showDashboard();}); }))); EditText current=field("Current password",true), next=field("New password",true); root.addView(label("Change password")); root.addView(current);root.addView(next); root.addView(button("Change password",v->run(()->{ApiClient.request("/api/auth/change-password",store.token(),"POST",new JSONObject().put("currentPassword",current.getText().toString()).put("newPassword",next.getText().toString()));runOnUiThread(()->toast("Password changed."));}))); root.addView(button("Request account deactivation",v->run(()->{ApiClient.request("/api/users/me/request-deactivation",store.token(),"POST",null);runOnUiThread(()->toast("Deactivation request submitted."));})));root.addView(button("Back",v->showDashboard()));}); }); }
    private interface Task { void execute() throws Exception; }
    private void run(Task action) { message.setText("Connecting to Solargrid API..."); executor.execute(() -> { try { action.execute(); } catch(Exception e) { String detail = e.getMessage(); runOnUiThread(() -> { String visible = detail == null || detail.isEmpty() ? "Request failed. Check that the API is running and the emulator can reach it." : detail; message.setText(visible); toast(visible); }); } }); }
    private void toast(String text) { Toast.makeText(this,text,Toast.LENGTH_LONG).show(); }
    @Override protected void onDestroy(){ executor.shutdownNow(); super.onDestroy(); }
}

