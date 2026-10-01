import { test, expect } from "@playwright/test";

// API fixtures isolate page wiring from database availability. Business rules are
// covered separately by tests/verify_api.py against the real API.
for (const role of ["Backoffice", "GridOperator", "Prosumer"]) {
  test(`${role}: login, restored session, pages and booking dialogs stay connected`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const startUtc = new Date(Date.now() + 86400000).toISOString();
    const endUtc = new Date(Date.now() + 90000000).toISOString();
    const slot = {
      id: "slot-1",
      stationId: "station-1",
      startUtc,
      endUtc,
      totalCapacity: 5,
      reservedCapacity: 1,
      status: "Available",
    };
    const station = {
      id: "station-1",
      name: "Test Solar Hub",
      address: "Colombo",
      latitude: 6.9,
      longitude: 79.8,
      capacityKwh: 100,
      batteryStorageSlots: 5,
      operatingHours: "08:00-18:00",
      status: "Active",
      operatorUserId: null,
    };
    const user = {
      id: "user-1",
      nic: "900000003V",
      fullName: "Test Prosumer",
      email: "prosumer@example.test",
      phone: "+94770000000",
      address: "Colombo",
      role: "Prosumer",
      status: "Active",
    };
    const reservations = [
      {
        id: "booking-1",
        stationId: station.id,
        slotId: slot.id,
        prosumerNic: user.nic,
        transactionType: "Charging",
        energyKwh: 5,
        status: "Pending",
      },
    ];
    let created = false;
    let changedPassword = false;
    await page.route("**/api/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const pathname = url.pathname;
      const reply = (json: unknown, status = 200) =>
        route.fulfill({ status, json });
      if (pathname === "/api/auth/login") {
        expect(request.postDataJSON()).toEqual({
          nicOrEmail: "tester@example.test",
          password: "TestPassword123!",
        });
        return reply({ token: `test-${role}`, role, fullName: "Test User" });
      }
      expect(request.headers().authorization).toBe(`Bearer test-${role}`);
      if (pathname === "/api/auth/account")
        return reply({ fullName: "Test User", email: "tester@example.test" });
      if (pathname === "/api/auth/change-password") {
        changedPassword = true;
        expect(request.postDataJSON().newPassword).toBe("ChangedPassword123!");
        return route.fulfill({ status: 204 });
      }
      if (pathname === "/api/reservations/dashboard")
        return reply({
          pendingReservations: reservations.length,
          approvedFutureReservations: 0,
          completedReservations: 0,
          activeStations: 1,
        });
      if (pathname === "/api/reservations/prosumers") return reply([user]);
      if (
        pathname === "/api/reservations/mine" ||
        pathname === "/api/reservations/operations"
      )
        return reply(reservations);
      if (
        request.method() === "POST" &&
        ["/api/reservations", "/api/reservations/staff"].includes(pathname)
      ) {
        expect(pathname).toBe(
          role === "Prosumer" ? "/api/reservations" : "/api/reservations/staff",
        );
        expect(request.postDataJSON()).toMatchObject({
          slotId: slot.id,
          transactionType: "DropOff",
          energyKwh: 7,
        });
        if (role !== "Prosumer")
          expect(request.postDataJSON().prosumerUserId).toBe(user.id);
        created = true;
        const booking = {
          ...reservations[0],
          id: "booking-2",
          transactionType: "DropOff",
          energyKwh: 7,
        };
        reservations.push(booking);
        return reply(booking, 201);
      }
      if (pathname === "/api/users") return reply([user]);
      if (pathname === "/api/stations/slots") return reply([slot]);
      if (pathname === "/api/stations/station-1") return reply(station);
      if (pathname === "/api/stations") return reply([station]);
      throw new Error(`Unexpected API request: ${request.method()} ${url}`);
    });

    await page.goto("/");
    await page.getByLabel("Email or NIC").fill("tester@example.test");
    await page.getByLabel("Password", { exact: true }).fill("TestPassword123!");
    await page.getByRole("button", { name: "Enter workspace" }).click();
    await expect(
      page.getByRole("heading", { name: "Welcome, Test User." }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Welcome, Test User." }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "People & access", exact: true }),
    ).toHaveCount(role === "Backoffice" ? 1 : 0);

    if (role === "Backoffice") {
      await page
        .getByRole("button", { name: "People & access", exact: true })
        .click();
      await expect(
        page.getByText("Test Prosumer", { exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Add staff", exact: true })
        .click();
      await expect(
        page.getByRole("dialog", { name: "Add staff" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Close", exact: true }).click();
    }
    await page
      .getByRole("button", { name: "Solar stations", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: station.name }),
    ).toBeVisible();
    if (role !== "Prosumer") {
      await page
        .getByRole("button", { name: "Manage station & slots" })
        .click();
      await expect(
        page.getByRole("dialog", { name: "Station & schedule", exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Add slot", exact: true }).click();
      await expect(
        page.getByRole("dialog", { name: "Create slot", exact: true }),
      ).toBeVisible();
      await page
        .getByRole("dialog", { name: "Create slot", exact: true })
        .getByRole("button", { name: "Close", exact: true })
        .click();
      await page
        .getByRole("dialog", { name: "Station & schedule", exact: true })
        .getByRole("button", { name: "Close", exact: true })
        .click();
    }
    await page
      .getByRole("button", { name: "Reservations", exact: true })
      .click();
    await page.getByRole("button", { name: "Pending", exact: true }).click();
    await expect(page.locator(".table-row")).toHaveCount(1);
    await page.getByRole("button", { name: "Current", exact: true }).click();
    await expect(page.locator(".table-row")).toHaveCount(1);
    await page.getByRole("button", { name: "New reservation" }).click();
    if (role !== "Prosumer")
      await page.getByRole("combobox", { name: "Prosumer", exact: true }).selectOption(user.id);
    await page
      .getByRole("combobox", { name: "Solar station", exact: true })
      .selectOption(station.id);
    await page.getByRole("combobox", { name: "Available slot", exact: true }).selectOption(slot.id);
    await page.getByLabel("Energy amount (kWh)").fill("7");
    await page
      .getByRole("button", { name: "Create reservation", exact: true })
      .click();
    await expect(page.locator(".table-row")).toHaveCount(2);
    expect(created).toBe(true);

    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
      "Test User",
    );
    await page
      .getByLabel("Current password", { exact: true })
      .fill("TestPassword123!");
    await page
      .getByLabel(/^New password/)
      .fill("ChangedPassword123!");
    await page
      .getByLabel("Confirm new password", { exact: true })
      .fill("ChangedPassword123!");
    await page
      .getByRole("button", { name: "Change password", exact: true })
      .click();
    await expect(
      page.getByText("Password changed successfully.", { exact: false }),
    ).toBeVisible();
    expect(changedPassword).toBe(true);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Open navigation" }).click();
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(
      page.getByRole("button", { name: "Enter workspace" }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => localStorage.getItem("solargrid.token")),
    ).toBeNull();
    expect(errors).toEqual([]);
  });
}
