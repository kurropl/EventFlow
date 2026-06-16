#!/usr/bin/env python3
"""
EventFlow — Kanban Pipeline Test Suite v3 (post-bugfix)
========================================================
1 test case per kanban column + inverse transitions.
Validates the full state machine: draft → sent → accepted → completed
with all inverse paths (lost, cancelled, reopened).
"""

import json, sys, uuid, time, requests
from datetime import datetime, timedelta

BASE = "https://eventcater.duckdns.org"
TOKEN = None
RESULTS = []
CREATED_IDS = []

def log(msg, level="INFO"):
    ts = datetime.now().strftime("%H:%M:%S")
    prefix = {"INFO": "  ", "PASS": "  ✓", "FAIL": "  ✗", "TEST": "→ "}.get(level, "  ")
    print(f"[{ts}] {prefix} {msg}")

def api(method, path, data=None):
    global TOKEN
    headers = {"Content-Type": "application/json"}
    if TOKEN:
        headers["Cookie"] = f"eventflow_token={TOKEN}"
    url = f"{BASE}{path}"
    try:
        r = requests.request(method, url, json=data, headers=headers, timeout=30)
        body = {}
        try:
            body = r.json()
        except:
            body = {"_raw": r.text[:200]}
        return r.status_code, body
    except Exception as e:
        return 0, {"error": str(e)}

def assert_test(test_name, condition, detail=""):
    status = "PASS" if condition else "FAIL"
    RESULTS.append({"test": test_name, "status": status, "detail": detail})
    log(test_name, status)
    if detail and not condition:
        log(f"  Detail: {detail}")

# ============================================================
# AUTH
# ============================================================
def login():
    global TOKEN
    log("Logging in...", "TEST")
    status, body = api("POST", "/api/auth/login", {"username": "admin", "password": "admin123"})
    if status == 200 and body.get("success") and body.get("token"):
        TOKEN = body["token"]
        assert_test("AUTH: Login exitoso", True)
        return True
    assert_test("AUTH: Login exitoso", False, f"status={status}")
    return False

# ============================================================
# HELPERS
# ============================================================
def create_lead(name):
    status, body = api("POST", "/api/leads", {
        "name": name, "email": f"{uuid.uuid4().hex[:8]}@test.com",
        "phone": "+34600000000", "event_type": "boda", "guest_count": 80
    })
    return body.get("data", {}).get("id")

def create_event(client_name):
    event_date = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
    status, body = api("POST", "/api/events", {
        "client_name": client_name,
        "client_email": f"{uuid.uuid4().hex[:8]}@test.com",
        "event_type": "boda", "event_date": event_date, "guest_count": 80,
        "status": "draft",
        "selected_items": [{"item_id": "1", "name": "Carpaccio de vaca vieja madurada con trufa y colmenillas", "category": "compartir-mesa", "quantity": 1}]
    })
    if body.get("success") and body.get("data", {}).get("id"):
        return body["data"]["id"]
    return None

def create_quote(event_id):
    status, body = api("POST", "/api/quotes", {
        "event_id": event_id, "base_pvp": 4200, "bar_price": 0,
        "extras_pvp": 0, "extras_cost": 0, "iva_pct": 21
    })
    return body.get("data", {}).get("id")

def transition(event_id, transition, motivo="Test"):
    status, body = api("POST", f"/api/events/{event_id}/transitions", {
        "transition": transition, "motivo": motivo
    })
    return status, body

def get_status(event_id):
    status, body = api("GET", f"/api/events/{event_id}")
    return body.get("data", {}).get("status") if body.get("data") else None

def verify_pipeline():
    status, body = api("GET", "/api/events/light")
    if body.get("success"):
        return {e["id"]: e.get("status") for e in body.get("data", [])}
    return {}

# ============================================================
# TEST CASES — 1 per kanban column + 2 inverse
# ============================================================
TESTS = [
    {
        "id": "TC-01", "label": "Borrador", "target": "draft",
        "flow": ["create_lead", "create_event"],
    },
    {
        "id": "TC-02", "label": "Enviado", "target": "sent",
        "flow": ["create_lead", "create_event", "create_quote", "FWD-2"],
    },
    {
        "id": "TC-03", "label": "Aceptado", "target": "accepted",
        "flow": ["create_lead", "create_event", "create_quote", "FWD-2", "FWD-3"],
    },
    {
        "id": "TC-04", "label": "Realizado", "target": "completed",
        "flow": ["create_lead", "create_event", "create_quote", "FWD-2", "FWD-3", "FWD-4"],
    },
    {
        "id": "TC-05", "label": "Perdido", "target": "lost",
        "flow": ["create_lead", "create_event", "create_quote", "FWD-2", "INV-1"],
    },
    {
        "id": "TC-06", "label": "Cancelado", "target": "cancelled",
        "flow": ["create_lead", "create_event", "create_quote", "FWD-2", "FWD-3", "INV-3"],
    },
    {
        "id": "TC-07", "label": "Reabierto", "target": "reopened",
        "flow": ["create_lead", "create_event", "create_quote", "FWD-2", "FWD-3", "FWD-4", "INV-4"],
    },
    {
        "id": "TC-08", "label": "INV-2: revertir aceptación", "target": "sent",
        "flow": ["create_lead", "create_event", "create_quote", "FWD-2", "FWD-3", "INV-2"],
    },
    {
        "id": "TC-09", "label": "INV-5: re-cerrar", "target": "completed",
        "flow": ["create_lead", "create_event", "create_quote", "FWD-2", "FWD-3", "FWD-4", "INV-4", "INV-5"],
    },
]

def run_test(tc):
    print(f"\n{'='*60}")
    print(f"  {tc['id']}: {tc['label']} → target: {tc['target']}")
    print(f"  Flow: {' → '.join(tc['flow'])}")
    print(f"{'='*60}")

    name = f"Test {tc['id']} {uuid.uuid4().hex[:6]}"
    event_id = quote_id = None
    transition_results = []

    for step in tc["flow"]:
        if step == "create_lead":
            lead_id = create_lead(name)
            assert_test(f"{tc['id']}: Lead creado", lead_id is not None, f"lead_id={lead_id}")
            if not lead_id: return

        elif step == "create_event":
            event_id = create_event(name)
            assert_test(f"{tc['id']}: Evento creado (draft)", event_id is not None)
            if not event_id: return
            CREATED_IDS.append(event_id)
            assert_test(f"{tc['id']}: Estado inicial = draft", get_status(event_id) == "draft")

        elif step == "create_quote":
            quote_id = create_quote(event_id)
            assert_test(f"{tc['id']}: Quote creado", quote_id is not None)
            # Event should still be draft after quote creation
            status = get_status(event_id)
            assert_test(f"{tc['id']}: Event sigue draft tras crear quote", status == "draft", f"status={status}")

        else:
            # Transition
            log(f"{step}", "TEST")
            s, b = transition(event_id, step)
            ok = s == 200 and b.get("success")
            assert_test(f"{tc['id']}: {step}", ok, f"err={b.get('error','')} http={s}")
            transition_results.append((step, ok))

    # Final state
    final = get_status(event_id)
    assert_test(f"{tc['id']}: Estado final = '{tc['target']}'", final == tc["target"],
                f"expected={tc['target']} actual={final}")

    # Pipeline check
    pipeline = verify_pipeline()
    assert_test(f"{tc['id']}: Aparece en pipeline", event_id in pipeline,
                f"status={pipeline.get(event_id, 'MISSING')}")

    # Escandallo check if accepted or further
    if "FWD-3" in tc["flow"] and final not in ("lost", "cancelled", "sent"):
        s, b = api("GET", f"/api/stock/escandallos?event_id={event_id}")
        if s == 200 and b.get("success"):
            items = b.get("data", {}).get(event_id, {}).get("items", [])
            assert_test(f"{tc['id']}: Escandallo generado", len(items) > 0, f"items={len(items)}")

def main():
    print("\n" + "=" * 60)
    print("  EventFlow — Kanban Pipeline Test Suite v3")
    print("  " + datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    print("=" * 60)

    if not login():
        print("\n  FATAL: Cannot authenticate.\n")
        sys.exit(1)

    for tc in TESTS:
        run_test(tc)

    # Summary
    total = len(RESULTS)
    passed = sum(1 for r in RESULTS if r["status"] == "PASS")
    failed = sum(1 for r in RESULTS if r["status"] == "FAIL")

    print(f"\n{'='*60}")
    print(f"  RESUMEN: {passed}/{total} passed, {failed} failed")
    print(f"{'='*60}")

    if failed > 0:
        print(f"\n  FALLOS:")
        for r in RESULTS:
            if r["status"] == "FAIL":
                print(f"    * {r['test']}: {r['detail']}")
    else:
        print(f"\n  TODOS LOS TESTS PASARON")

    print(f"\n  Eventos de test creados: {len(CREATED_IDS)}")
    print()
    sys.exit(0 if failed == 0 else 1)

if __name__ == "__main__":
    main()
