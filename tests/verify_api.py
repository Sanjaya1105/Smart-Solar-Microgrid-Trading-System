"""Integration checks against an isolated, disposable MongoDB on localhost:27028.
Build the API to artifacts/management-build first. No production database is used.
"""
import datetime as dt
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import urllib.error
import urllib.request
import uuid

ROOT = Path(__file__).resolve().parents[1]
BASE = 'http://127.0.0.1:5198'
password = 'Test-' + uuid.uuid4().hex
env = dict(os.environ, ASPNETCORE_URLS=BASE, ASPNETCORE_ENVIRONMENT='Development',
           MongoDb__ConnectionString='mongodb://127.0.0.1:27028',
           MongoDb__DatabaseName='verification_' + uuid.uuid4().hex,
           SeedData__Enabled='true', SeedData__DefaultPassword=password,
           Jwt__Key=uuid.uuid4().hex + uuid.uuid4().hex,
           Jwt__QrSigningKey=uuid.uuid4().hex + uuid.uuid4().hex)
passed = 0

def call(path, token='', method='GET', body=None, expected=200):
    global passed
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    request = urllib.request.Request(BASE + path, data=json.dumps(body).encode() if body is not None else None,
                                     headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            code, text = response.status, response.read()
    except urllib.error.HTTPError as error:
        code, text = error.code, error.read()
    assert code == expected, f'{method} {path}: expected {expected}, got {code}: {text.decode()}'
    passed += 1
    return json.loads(text) if text else None

def stamp(hours):
    return (dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=hours)).isoformat()

log_path = ROOT / 'artifacts' / 'api-verification.log'
with log_path.open('w') as log:
    process = subprocess.Popen([r'C:\Program Files\dotnet\dotnet.exe', str(ROOT / 'artifacts/management-build/SolarMicrogrid.Api.dll')],
                               cwd=ROOT / 'SolarMicrogrid.Api', env=env, stdout=log, stderr=log)
    try:
        for attempt in range(50):
            if process.poll() is not None:
                raise RuntimeError(f'API exited. See {log_path}')
            try:
                with urllib.request.urlopen(BASE + '/api/health', timeout=1):
                    break
            except (OSError, urllib.error.URLError):
                time.sleep(.2)
        else:
            raise RuntimeError(f'API did not start. See {log_path}')

        tokens = {role: call('/api/auth/login', method='POST', body={'nicOrEmail': f'{role}@solar.local', 'password': password})['token']
                  for role in ['backoffice', 'operator', 'prosumer']}
        back, operator, prosumer = (tokens[r] for r in ['backoffice', 'operator', 'prosumer'])
        call('/api/users', expected=401)
        call('/api/users', operator, expected=403)
        call('/api/reservations/prosumers', prosumer, expected=403)
        people = call('/api/reservations/prosumers', operator)
        assert people and set(people[0]) == {'id', 'fullName', 'nic'}
        owner = people[0]['id']

        profile = {'nic': '999999999V', 'fullName': 'Verification Person', 'email': 'verify@example.test',
                   'phone': '+94771234567', 'address': 'Verification address', 'password': password}
        user = call('/api/users/prosumers', back, 'POST', profile, 201)
        assert user['status'] == 'Pending' and 'passwordHash' not in user
        call('/api/auth/login', method='POST', body={'nicOrEmail': profile['email'], 'password': password}, expected=403)
        call('/api/users/prosumers', back, 'POST', profile, 409)
        call(f"/api/users/{user['id']}/status", back, 'PATCH', {'status': 'Active'})
        call('/api/auth/login', method='POST', body={'nicOrEmail': profile['email'], 'password': password})
        profile['fullName'] = 'Updated Person'
        call(f"/api/users/{user['id']}", back, 'PUT', profile)
        call(f"/api/users/{user['id']}/status", back, 'PATCH', {'status': 'Inactive'})
        call('/api/auth/login', method='POST', body={'nicOrEmail': profile['email'], 'password': password}, expected=403)
        call(f"/api/users/{user['id']}/status", back, 'PATCH', {'status': 'Active'})

        node = {'name': 'Verification Hub', 'address': 'Test address', 'latitude': 6.9, 'longitude': 79.8,
                'capacityKwh': 100, 'batteryStorageSlots': 10, 'operatingHours': '08:00-18:00', 'operatorUserId': None}
        station = call('/api/stations', back, 'POST', node, 201)
        sid = station['id']
        node['name'] = 'Updated Hub'
        call(f'/api/stations/{sid}', operator, 'PUT', node)
        call(f'/api/stations/{sid}/deactivate', operator, 'POST', expected=403)
        def slot(start, end):
            body = {'stationId': sid, 'startUtc': stamp(start), 'endUtc': stamp(end), 'totalCapacity': 3}
            return call('/api/stations/slots', operator, 'POST', body), body
        first, first_body = slot(24, 25)
        second, second_body = slot(48, 49)
        near, _ = slot(2, 3)
        far, _ = slot(192, 193)
        call('/api/stations/slots', operator, 'POST', first_body, 409)
        booking_body = {'prosumerUserId': owner, 'slotId': first['id'], 'transactionType': 'Charging', 'energyKwh': 4.5}
        booking = call('/api/reservations/staff', operator, 'POST', booking_body)
        bid = booking['id']
        assert booking['prosumerUserId'] == owner
        call('/api/reservations/staff', prosumer, 'POST', booking_body, 403)
        call('/api/reservations/staff', back, 'POST', {**booking_body, 'slotId': far['id']}, 409)
        call(f'/api/stations/{sid}/deactivate', back, 'POST', expected=409)
        call(f"/api/stations/slots/{first['id']}", operator, 'DELETE', expected=409)
        call(f"/api/stations/slots/{first['id']}", operator, 'PUT', {**first_body, 'startUtc': stamp(26), 'endUtc': stamp(27)}, 409)
        call(f'/api/reservations/{bid}/staff', operator, 'PUT', {**booking_body, 'slotId': second['id'], 'energyKwh': 6})
        updated_slots = call(f'/api/stations/slots?stationId={sid}&availableOnly=false', operator)
        assert next(s for s in updated_slots if s['id'] == first['id'])['reservedCapacity'] == 0
        approved = call(f'/api/reservations/{bid}/decision?approve=true', operator, 'POST')
        dashboard = call('/api/reservations/dashboard', back)
        assert dashboard['approvedFutureReservations'] >= 1
        renewed = call(f'/api/reservations/{bid}/qr', prosumer, 'POST')
        call('/api/reservations/complete-by-qr', operator, 'POST', {'qrToken': approved['qrToken']}, 409)
        call('/api/reservations/complete-by-qr', back, 'POST', {'qrToken': renewed['qrToken']}, 403)
        complete = call('/api/reservations/complete-by-qr', operator, 'POST', {'qrToken': renewed['qrToken']})
        assert complete['status'] == 'Completed'
        call('/api/reservations/complete-by-qr', operator, 'POST', {'qrToken': renewed['qrToken']}, 409)

        short = call('/api/reservations/staff', back, 'POST', {**booking_body, 'slotId': near['id']})
        call(f"/api/reservations/{short['id']}/cancel", operator, 'POST', expected=409)
        call(f"/api/reservations/{short['id']}/staff", operator, 'PUT', booking_body, 409)
        cancelled = call('/api/reservations/staff', operator, 'POST', booking_body)
        call(f"/api/stations/slots/{first['id']}/status", operator, 'PATCH', {'status': 'Unavailable'})
        call(f"/api/reservations/{cancelled['id']}/cancel", operator, 'POST')
        state = call(f'/api/stations/slots?stationId={sid}&availableOnly=false', operator)
        assert next(s for s in state if s['id'] == first['id'])['status'] == 'Unavailable'
        unused, _ = slot(72, 73)
        call(f"/api/stations/slots/{unused['id']}", operator, 'DELETE', expected=204)

        call('/api/auth/account', prosumer)
        call('/api/auth/change-password', prosumer, 'POST', {'currentPassword': 'wrong', 'newPassword': password + 'new'}, 400)
        call('/api/auth/change-password', prosumer, 'POST', {'currentPassword': password, 'newPassword': password + 'new'}, 204)
        call('/api/auth/login', method='POST', body={'nicOrEmail': 'prosumer@solar.local', 'password': password}, expected=401)
        call('/api/auth/login', method='POST', body={'nicOrEmail': 'prosumer@solar.local', 'password': password + 'new'})
        if '--browser' in sys.argv:
            subprocess.run(['cmd', '/c', 'npx playwright test'], cwd=ROOT / 'web', env=dict(os.environ, VERIFICATION_PASSWORD=password), check=True)
        print(f'PASS: {passed} API response checks plus ownership, status, capacity, dashboard and password assertions.')
    finally:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
