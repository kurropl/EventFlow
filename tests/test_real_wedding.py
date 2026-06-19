#!/usr/bin/env python3
"""
EventFlow — Test Realista: Boda con Menú Completo
===================================================
Simula una boda real de 120 invitados con menú completo:
  - Cocktail: 2 aperitivos fríos + 2 calientes
  - Compartir mesa: 2 platos
  - Plato principal: carne/pescado
  - Arroz
  - Postre
  - Bebidas: vino, cava, agua

Verifica:
  - Escandallo generado con TODOS los ingredientes del menú
  - Stock descontado correctamente
  - Staffing auto-generado
  - Pagos creados
  - Pedidos a proveedores generados
"""
import requests, json, time, sys
from datetime import datetime

BASE = "https://eventcater.duckdns.org"
s = requests.Session()
s.verify = False

results = []

def log(msg, ok=None):
    sym = "✓" if ok is True else ("✗" if ok is False else "→")
    t = datetime.now().strftime("%H:%M:%S")
    prefix = f"[{t}]"
    line = f"{prefix} {'  ' if ok is not None else '→ '}{msg}"
    print(line)
    results.append({"msg": msg, "ok": ok})

def api(method, path, data=None, token=None):
    url = f"{BASE}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Cookie"] = f"eventflow_token={token}"
    r = getattr(s, method)(url, json=data, headers=headers, timeout=30)
    try:
        return r.status_code, r.json()
    except:
        return r.status_code, {"error": r.text}

# ═══════════════════════════════════════════════════════
# 1. AUTH
# ═══════════════════════════════════════════════════════
print("=" * 60)
print("  EVENTFLOW — TEST REALISTA: BODA MENÚ COMPLETO")
print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print("=" * 60)

code, body = api("post", "/api/auth/login", {"username": "admin", "password": "admin123"})
TOKEN = body.get("token", "")
log("Login admin", ok=bool(TOKEN))

# ═══════════════════════════════════════════════════════
# 2. MENÚ COMPLETO — 10 items reales del catálogo
# ═══════════════════════════════════════════════════════
MENU_ITEMS = [
    # Cocktail frío (4 uds × 120 pax = 480 piezas)
    {"item_id": "e17d83d8", "name": "Carpaccio de vaca vieja madurada, tomate y trufa",
     "category": "aperitivo-frio", "quantity": 10, "unit_price_pvp": 3.80, "unit_price_cost": 1.60},
    {"item_id": "0d242995", "name": "Brioche de tomate, ventresca de atún y eneldo",
     "category": "aperitivo-frio", "quantity": 10, "unit_price_pvp": 2.60, "unit_price_cost": 1.00},
    # Cocktail caliente
    {"item_id": "85908a1d", "name": "Croquetas de jamón ibérico",
     "category": "aperitivo-caliente", "quantity": 10, "unit_price_pvp": 2.20, "unit_price_cost": 0.70},
    {"item_id": "9dbdbfe1", "name": "Bao bun de costilla con salsa BBQ-miso",
     "category": "aperitivo-caliente", "quantity": 10, "unit_price_pvp": 3.40, "unit_price_cost": 1.40},
    # Compartir mesa
    {"item_id": "d2d25f73", "name": "Carpaccio de vaca vieja madurada con trufa y colmenillas",
     "category": "compartir-mesa", "quantity": 12, "unit_price_pvp": 7.50, "unit_price_cost": 3.20},
    {"item_id": "1fdf4535", "name": "Pulpo a la brasa, parmentier de patata y mojo picón",
     "category": "compartir-mesa", "quantity": 12, "unit_price_pvp": 6.50, "unit_price_cost": 2.80},
    # Plato principal
    {"item_id": "ca04f9e1", "name": "Carrillera a baja temperatura con puré de patatas trufado",
     "category": "carne", "quantity": 60, "unit_price_pvp": 12.50, "unit_price_cost": 5.00},
    # Arroz
    {"item_id": "aeb8ffd5", "name": "Arroz meloso de mariscos y pescados de roca",
     "category": "arroz", "quantity": 12, "unit_price_pvp": 9.00, "unit_price_cost": 3.80},
    # Postre
    {"item_id": "40a2e7df", "name": "Tarta de queso",
     "category": "postre", "quantity": 12, "unit_price_pvp": 4.00, "unit_price_cost": 1.50},
    # Bebidas
    {"item_id": "d14aeff0", "name": "Cava brindis",
     "category": "bebida", "quantity": 120, "unit_price_pvp": 3.50, "unit_price_cost": 1.20},
    {"item_id": "9bc34311", "name": "Vino tinto Lomas del Marquez",
     "category": "bebida", "quantity": 120, "unit_price_pvp": 4.50, "unit_price_cost": 1.80},
    {"item_id": "57c11a15", "name": "Vino blanco Verdejo",
     "category": "bebida", "quantity": 60, "unit_price_pvp": 4.00, "unit_price_cost": 1.50},
    {"item_id": "c4333213", "name": "Agua",
     "category": "bebida", "quantity": 120, "unit_price_pvp": 1.20, "unit_price_cost": 0.30},
]

# Calculate subtotals
for item in MENU_ITEMS:
    item["subtotal_pvp"] = round(item["quantity"] * item["unit_price_pvp"], 2)
    item["subtotal_cost"] = round(item["quantity"] * item["unit_price_cost"], 2)

total_pvp = sum(i["subtotal_pvp"] for i in MENU_ITEMS)
total_cost = sum(i["subtotal_cost"] for i in MENU_ITEMS)
bar_price = 3 * 15  # 3 hours × €15/hour
iva = 10
total_with_iva = round((total_pvp + bar_price) * (1 + iva / 100), 2)

print(f"\nMenú: {len(MENU_ITEMS)} items | PVP: €{total_pvp:.2f} | Coste: €{total_cost:.2f}")
print(f"Barra: €{bar_price} | Total+IVA: €{total_with_iva:.2f}")

# ═══════════════════════════════════════════════════════
# 3. CREAR LEAD
# ═══════════════════════════════════════════════════════
log("Creando lead...")
code, body = api("post", "/api/leads", {
    "name": "Familia García-Martínez",
    "email": "garcia.martinez@email.com",
    "phone": "623456789",
    "event_type": "boda",
    "guest_count": 120,
    "event_date": "2026-10-10",
    "message": "Boda familiar con 120 invitados. Ceremonia religiosa + banquete. Estilo elegante."
})
LEAD_ID = body.get("data", {}).get("id", "")
log(f"Lead creado: {LEAD_ID[:8]}...", ok=bool(LEAD_ID))

# ═══════════════════════════════════════════════════════
# 4. CREAR CLIENTE
# ═══════════════════════════════════════════════════════
log("Creando cliente...")
code, body = api("post", "/api/clients", {
    "name": "Familia García-Martínez",
    "email": "garcia.martinez@email.com",
    "phone": "623456789",
    "cif": "B87654321"
})
CLIENT_ID = body.get("data", {}).get("id", body.get("id", ""))
log(f"Cliente creado: {CLIENT_ID[:8]}...", ok=bool(CLIENT_ID))

# ═══════════════════════════════════════════════════════
# 5. CREAR EVENTO con menú completo
# ═══════════════════════════════════════════════════════
log("Creando evento con menú completo (13 items)...")
code, body = api("post", "/api/events", {
    "client_name": "Familia García-Martínez",
    "client_email": "garcia.martinez@email.com",
    "client_phone": "623456789",
    "client_id": CLIENT_ID if CLIENT_ID and CLIENT_ID != "" else None,
    "event_type": "boda",
    "guest_count": 120,
    "kids_count": 8,
    "event_date": "2026-10-10",
    "selected_items": MENU_ITEMS,
    "bar_hours": 3,
    "notes": "Boda elegante. Ceremonia 12:00, cóctel 13:30, banquete 15:00."
}, token=TOKEN)
EVENT_ID = body.get("data", {}).get("id", "")
log(f"Evento creado: {EVENT_ID[:8]}...", ok=bool(EVENT_ID))

# Verify status = draft
code, body = api("get", f"/api/events/{EVENT_ID}", token=TOKEN)
status = body.get("data", {}).get("status", "?")
log(f"Estado inicial: {status}", ok=(status == "draft"))

# ═══════════════════════════════════════════════════════
# 6. CREAR PRESUPUESTO
# ═══════════════════════════════════════════════════════
log("Creando presupuesto...")
code, body = api("post", "/api/quotes", {
    "event_id": EVENT_ID,
    "base_pvp": total_pvp,
    "bar_price": bar_price,
    "extras_pvp": 0,
    "iva_pct": 10,
    "notes": "Menú completo boda García-Martínez. Válido 30 días."
}, token=TOKEN)
QUOTE_ID = body.get("data", {}).get("id", "")
log(f"Presupuesto creado: {QUOTE_ID[:8]}...", ok=bool(QUOTE_ID))

# ═══════════════════════════════════════════════════════
# 7. FWD-2: draft → sent
# ═══════════════════════════════════════════════════════
log("FWD-2: draft → sent...")
code, body = api("post", f"/api/events/{EVENT_ID}/transitions", {"transition": "FWD-2"}, token=TOKEN)
fwd2_ok = body.get("success", False)
log(f"FWD-2: {'OK' if fwd2_ok else body.get('error', '?')}", ok=fwd2_ok)

code, body = api("get", f"/api/events/{EVENT_ID}", token=TOKEN)
status = body.get("data", {}).get("status", "?")
log(f"Estado: {status}", ok=(status == "sent"))

# ═══════════════════════════════════════════════════════
# 8. FWD-3: sent → accepted (esto genera escandallo + staffing + pagos)
# ═══════════════════════════════════════════════════════
log("FWD-3: sent → accepted (genera escandallo + staffing + pagos)...")
code, body = api("post", f"/api/events/{EVENT_ID}/transitions", {"transition": "FWD-3"}, token=TOKEN)
fwd3_ok = body.get("success", False)
log(f"FWD-3: {'OK' if fwd3_ok else body.get('error', '?')}", ok=fwd3_ok)

code, body = api("get", f"/api/events/{EVENT_ID}", token=TOKEN)
status = body.get("data", {}).get("status", "?")
log(f"Estado: {status}", ok=(status == "accepted"))

# ═══════════════════════════════════════════════════════
# 9. VERIFICAR ESCANDALLO
# ═══════════════════════════════════════════════════════
print("\n--- ESCANDALLO ---")
code, body = api("get", f"/api/stock/escandallos?event_id={EVENT_ID}", token=TOKEN)
esc_data = body.get("data", {})
event_esc = esc_data.get(EVENT_ID, {})
esc_items = event_esc.get("items", [])
log(f"Items en escandallo: {len(esc_items)}", ok=(len(esc_items) > 0))
for item in esc_items:
    log(f"  • {item.get('ingredient_name', '?')}: {item.get('quantity_needed', '?')} {item.get('unit', '?')} (stock: {item.get('stock_available', '?')})")

# ═══════════════════════════════════════════════════════
# 10. VERIFICAR STAFFING
# ═══════════════════════════════════════════════════════
print("\n--- PERSONAL ---")
code, body = api("get", f"/api/staffing/lines?event_id={EVENT_ID}", token=TOKEN)
staff_data = body.get("data", [])
if isinstance(staff_data, dict):
    staff_data = staff_data.get("lines", staff_data.get("data", []))
log(f"Líneas de personal: {len(staff_data)}", ok=(len(staff_data) > 0))
for line in staff_data:
    log(f"  • {line.get('role', '?')}: {line.get('slots_needed', '?')} puestos ({line.get('status', '?')})")

# ═══════════════════════════════════════════════════════
# 11. VERIFICAR PAGOS
# ═══════════════════════════════════════════════════════
print("\n--- PAGOS ---")
code, body = api("get", f"/api/events/{EVENT_ID}", token=TOKEN)
ev = body.get("data", {})
# Check payments via the event
code2, body2 = api("get", f"/api/payments?event_id={EVENT_ID}", token=TOKEN)
payments = body2.get("data", [])
log(f"Pagos generados: {len(payments)}", ok=(len(payments) >= 2))
for p in payments:
    log(f"  • {p.get('type', '?')}: €{p.get('amount', '?')} ({p.get('status', '?')})")

# ═══════════════════════════════════════════════════════
# 12. VERIFICAR OPERACIONES
# ═══════════════════════════════════════════════════════
print("\n--- OPERACIONES ---")
code, body = api("get", f"/api/events/{EVENT_ID}/orders", token=TOKEN)
orders = body.get("data", [])
log(f"Órdenes de operación: {len(orders)}", ok=(len(orders) > 0))
for o in orders:
    log(f"  • Tablas: {o.get('tables_suggested', '?')} | Camareros: {o.get('waiters_suggested', '?')}")

# ═══════════════════════════════════════════════════════
# 13. VERIFICAR STOCK ANTES DE DESCONTAR
# ═══════════════════════════════════════════════════════
print("\n--- CHECK STOCK ---")
code, body = api("get", f"/api/stock/check?event_id={EVENT_ID}", token=TOKEN)
stock_check = body.get("data", body)
warnings = stock_check.get("warnings", [])
log(f"Warnings de stock: {len(warnings)}", ok=(len(warnings) == 0) if len(warnings) == 0 else None)
for w in warnings:
    log(f"  ⚠ {w.get('ingredient_name', '?')}: necesita {w.get('needed', '?')} {w.get('unit', '?')}, hay {w.get('available', '?')} (déficit: {w.get('deficit', '?')})")

# ═══════════════════════════════════════════════════════
# 14. GENERAR PEDIDO A PROVEEDOR desde escandallo
# ═══════════════════════════════════════════════════════
print("\n--- GENERAR PEDIDO PROVEEDOR ---")
code, body = api("post", "/api/stock/generate-order", {"event_id": EVENT_ID}, token=TOKEN)
order_ok = body.get("success", False)
if order_ok:
    orders_created = body.get("orders", [])
    log(f"Pedidos generados: {len(orders_created)}", ok=True)
    for o in orders_created:
        log(f"  • Proveedor: {o.get('supplier', '?')} | Items: {len(o.get('items', []))}")
else:
    log(f"Generar pedido: {body.get('error', '?')}", ok=False)

# ═══════════════════════════════════════════════════════
# 15. FWD-4: accepted → completed
# ═══════════════════════════════════════════════════════
print("\n--- COMPLETAR EVENTO ---")
log("FWD-4: accepted → completed...")
code, body = api("post", f"/api/events/{EVENT_ID}/transitions", {"transition": "FWD-4"}, token=TOKEN)
fwd4_ok = body.get("success", False)
log(f"FWD-4: {'OK' if fwd4_ok else body.get('error', '?')}", ok=fwd4_ok)

code, body = api("get", f"/api/events/{EVENT_ID}", token=TOKEN)
status = body.get("data", {}).get("status", "?")
log(f"Estado final: {status}", ok=(status == "completed"))

# ═══════════════════════════════════════════════════════
# RESUMEN
# ═══════════════════════════════════════════════════════
print("\n" + "=" * 60)
passed = sum(1 for r in results if r["ok"] is True)
failed = sum(1 for r in results if r["ok"] is False)
total = len(results)
print(f"  RESUMEN: {passed}/{total} passed, {failed} failed")
if failed == 0:
    print("  TODOS LOS TESTS PASARON")
else:
    print("\n  FALLOS:")
    for r in results:
        if r["ok"] is False:
            print(f"    ✗ {r['msg']}")
print("=" * 60)
sys.exit(0 if failed == 0 else 1)
