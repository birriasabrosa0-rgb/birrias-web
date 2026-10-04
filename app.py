import os
import random
import time
import hashlib
import hmac
import re
import secrets
import feedparser
import json
import redis  # <-- NUEVO
from datetime import datetime, timedelta
from flask import Flask, jsonify, render_template, request, session
from flask_sqlalchemy import SQLAlchemy
from flask_mail import Mail, Message
import pytz
import requests
from apscheduler.schedulers.background import BackgroundScheduler

# ================= INSTANCIA ÚNICA DE FLASK =================
app = Flask(__name__)
app.secret_key = "brawl_stars_clave_secreta"

# ================= CONFIGURACIÓN DE BASE DE DATOS Y CORREO =================
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///suscriptores.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Configuración correcta para Gmail (Puerto 465 con SSL)
app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 465
app.config['MAIL_USE_SSL'] = True
app.config['MAIL_USE_TLS'] = False
app.config['MAIL_USERNAME'] = 'birriasabrosa0@gmail.com'
app.config['MAIL_PASSWORD'] = 'pmnlvhoxfejfspgs'
app.config['PASSWORD_RESET_SECRET'] = os.environ.get('PASSWORD_RESET_SECRET')

db = SQLAlchemy(app)
mail = Mail(app)

# ================= CONEXIÓN A REDIS (NUEVO) =================
try:
    # Memurai o Docker usan el puerto 6379 por defecto
    r = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)
    r.ping()  # Comprobar que Redis está vivo
    print("✅ Conectado a Redis. El caché persistente está activo.")
except Exception as e:
    print(f"⚠️ No se pudo conectar a Redis: {e}. Usando caché en memoria.")
    r = None

# ================= CONFIGURACIÓN API BRAWL STARS =================
BASE_URL = "https://api.brawlstars.com/v1"
_BRAWL_API_CACHE = {}
_BRAWL_API_CACHE_LIMIT = 180


def _brawl_cache_read(cache_key, require_fresh=True):
    """Lee el caché. Si require_fresh es True, solo devuelve datos no expirados."""
    if r:
        cached = r.get(cache_key)
        if not cached:
            return None
        try:
            entry = json.loads(cached)
            # Si exigimos frescura y ya expiró, devolvemos None (pero el dato sigue en Redis para fallback)
            if require_fresh and time.time() > entry.get("expires_at", 0):
                return None
            return entry.get("data")
        except (ValueError, TypeError):
            return None
    
    # Fallback a memoria (solo si Redis no está disponible)
    entry = _BRAWL_API_CACHE.get(cache_key)
    if not entry:
        return None
    expires_at, payload = entry
    if require_fresh and time.monotonic() >= expires_at:
        return None
    return payload


def _brawl_cache_write(cache_key, payload, ttl_seconds):
    """Guarda en caché. En Redis se guarda por 7 días para sobrevivir a mantenimientos largos."""
    entry = {
        "data": payload,
        "expires_at": time.time() + ttl_seconds  # Tiempo de "frescura"
    }
    if r:
        # Guardamos en Redis por 7 días (86400 * 7 segundos)
        r.setex(cache_key, 86400 * 7, json.dumps(entry))
        return
    
    # Fallback a memoria
    now = time.monotonic()
    expired = [key for key, (expires_at, _) in _BRAWL_API_CACHE.items() if now >= expires_at]
    for key in expired:
        _BRAWL_API_CACHE.pop(key, None)
    while len(_BRAWL_API_CACHE) >= _BRAWL_API_CACHE_LIMIT:
        _BRAWL_API_CACHE.pop(next(iter(_BRAWL_API_CACHE)))
    _BRAWL_API_CACHE[cache_key] = (now + ttl_seconds, payload)


def _brawl_api_request(path, params=None):
    api_token = os.environ.get("BRAWL_STARS_API_TOKEN", "").strip()
    if not api_token:
        return None, (jsonify({
            "error": "El servidor aún no tiene configurada la API de Brawl Stars."
        }), 503)

    try:
        response = requests.get(
            f"{BASE_URL}{path}",
            headers={"Authorization": f"Bearer {api_token}", "Accept": "application/json"},
            params=params,
            timeout=12,
        )
    except requests.Timeout:
        return None, (jsonify({"error": "La API de Brawl Stars tardó demasiado. Inténtalo de nuevo."}), 504)
    except requests.RequestException as error:
        print("Error de conexión con la API de Brawl Stars:", error)
        return None, (jsonify({"error": "No se pudo conectar con la API de Brawl Stars."}), 502)

    if response.status_code != 200:
        if response.status_code == 404:
            message = "No encontramos ese perfil. Revisa la etiqueta de jugador e inténtalo de nuevo."
        elif response.status_code == 400:
            message = "La etiqueta no tiene un formato válido. Escríbela como aparece en el juego."
        else:
            message = obtener_error_api_brawl(response.status_code)
        print(f"Error de API Brawl Stars en {path}: HTTP {response.status_code}")
        status = response.status_code if response.status_code in (401, 403, 429) else (404 if response.status_code == 404 else (400 if response.status_code == 400 else 502))
        return None, (jsonify({"error": message}), status)

    try:
        return response.json(), None
    except ValueError:
        return None, (jsonify({"error": "La API de Brawl Stars devolvió una respuesta ilegible."}), 502)


@app.route("/api/player/<player_tag>")
def api_player(player_tag):
    tag = player_tag.strip().upper()
    if not tag.startswith("#"):
        tag = f"#{tag}"
    if not re.fullmatch(r"#[A-Z0-9]{3,15}", tag):
        return jsonify({"error": "Escribe una etiqueta válida, por ejemplo #2PP12345."}), 400

    cache_key = f"brawl:player:{tag}"
    
    # 1. Intentar leer caché fresco
    cached = _brawl_cache_read(cache_key, require_fresh=True)
    if cached is not None:
        print(f"🔄 Sirviendo perfil de {tag} desde caché fresca.")
        return jsonify(cached)

    # 2. Llamar a la API
    encoded_tag = requests.utils.quote(tag, safe="")
    payload, error = _brawl_api_request(f"/players/{encoded_tag}")
    
    if error:
        # 3. Fallback a caché viejo si la API falla (ej. mantenimiento 503)
        cached_stale = _brawl_cache_read(cache_key, require_fresh=False)
        if cached_stale is not None:
            print(f"⚠️ API caída. Sirviendo perfil de {tag} desde caché antigua (modo resiliente).")
            return jsonify(cached_stale)
        return error  # Si no hay caché, sí que falla (solo la primera vez)

    if not isinstance(payload, dict):
        return jsonify({"error": "El perfil recibido no tiene un formato válido."}), 502

    # 4. Guardar en caché (fresco por 5 minutos, persistente 7 días)
    _brawl_cache_write(cache_key, payload, 300)
    return jsonify(payload)


@app.route("/api/brawlers")
def api_brawlers():
    cache_key = "brawl:brawlers:all"
    
    # 1. Intentar leer caché fresco
    cached = _brawl_cache_read(cache_key, require_fresh=True)
    if cached is not None:
        print("🔄 Sirviendo brawlers desde caché fresca.")
        return jsonify(cached)

    # 2. Llamar a la API (paginación)
    all_brawlers = []
    after = None
    for _ in range(20):
        params = {"limit": 100}
        if after:
            params["after"] = after
        payload, error = _brawl_api_request("/brawlers", params=params)
        
        if error:
            # 3. Fallback a caché viejo
            cached_stale = _brawl_cache_read(cache_key, require_fresh=False)
            if cached_stale is not None:
                print("⚠️ API caída. Sirviendo brawlers desde caché antigua (modo resiliente).")
                return jsonify(cached_stale)
            return error

        page_items = payload if isinstance(payload, list) else payload.get("items", []) if isinstance(payload, dict) else []
        if not isinstance(page_items, list):
            return jsonify({"error": "La lista de Brawlers llegó con un formato inesperado."}), 502
        all_brawlers.extend(item for item in page_items if isinstance(item, dict))

        paging = payload.get("paging", {}) if isinstance(payload, dict) else {}
        cursors = paging.get("cursors", {}) if isinstance(paging, dict) else {}
        after = cursors.get("after") if isinstance(cursors, dict) else None
        if not after or not page_items:
            break

    result = {"items": all_brawlers, "count": len(all_brawlers)}
    
    # 4. Guardar en caché (fresco por 6 horas, persistente 7 días)
    _brawl_cache_write(cache_key, result, 21600)
    return jsonify(result)


def obtener_error_api_brawl(status_code):
    """Devuelve una explicación útil sin exponer detalles internos de la API."""
    if status_code in (401, 403):
        return "La clave de Brawl Stars no está autorizada. Comprueba que sea nueva, esté activa y permita la IP pública de este servidor."
    if status_code == 429:
        return "La API de Brawl Stars ha recibido demasiadas peticiones. Espera un poco y vuelve a intentarlo."
    if status_code >= 500:
        return "La API de Brawl Stars no está disponible ahora mismo. Inténtalo de nuevo más tarde."
    return f"La API de Brawl Stars respondió con el error {status_code}."


SECTORES = [
    {"id": 0, "label": "10 🪙", "value": 10, "weight": 30},
    {"id": 1, "label": "25 🪙", "value": 25, "weight": 25},
    {"id": 2, "label": "5 🪙", "value": 5, "weight": 35},
    {"id": 3, "label": "50 🪙", "value": 50, "weight": 15},
    {"id": 4, "label": "0 🪙", "value": 0, "weight": 30},
    {"id": 5, "label": "100 🪙", "value": 100, "weight": 8},
    {"id": 6, "label": "15 🪙", "value": 15, "weight": 28},
    {"id": 7, "label": "💎 500 🪙", "value": 500, "weight": 3},
]

# Variable global para evitar duplicados automáticos en envíos periódicos
ULTIMO_ID_PROCESADO = None

# ================= FUNCIONES DE CONTROL =================
def obtener_proximo_reset():
    tz_spain = pytz.timezone("Europe/Madrid")
    ahora_spain = datetime.now(tz_spain)
    reset_hoy = ahora_spain.replace(hour=8, minute=0, second=0, microsecond=0)

    if ahora_spain >= reset_hoy:
        proximo_reset = reset_hoy + timedelta(days=1)
    else:
        proximo_reset = reset_hoy

    return proximo_reset


def resetear_limite_diario():
    tz_spain = pytz.timezone("Europe/Madrid")
    ahora_spain = datetime.now(tz_spain)
    proximo_reset = obtener_proximo_reset()

    last_reset_str = session.get("last_reset_time")

    debe_reiniciar = False
    if not last_reset_str:
        debe_reiniciar = True
    else:
        try:
            fecha_guardada = datetime.fromisoformat(last_reset_str)
            if ahora_spain > fecha_guardada:
                debe_reiniciar = True
        except ValueError:
            debe_reiniciar = True

    if debe_reiniciar:
        session["intentos_ruleta"] = 1
        session["intentos_caja"] = 3
        session["last_reset_time"] = proximo_reset.isoformat()


@app.before_request
def inicializar_usuario():
    if "monedas" not in session:
        session["monedas"] = 100
    resetear_limite_diario()


# ================= RUTAS PRINCIPALES =================
@app.route("/")
def inicio():
    return render_template(
        "index.html",
        monedas=session["monedas"],
        intentos_ruleta=session.get("intentos_ruleta", 1),
        intentos_caja=session.get("intentos_caja", 3),
        reset_time=session.get("last_reset_time"),
    )


@app.route("/reset")
def reset_sesion():
    session.clear()
    return "<h1>Sesión Reiniciada Correctamente</h1><p><a href='/'>Volver al Juego</a></p>"


# ================= RUTA MAPAS OFICIAL =================
@app.route("/api/mapas")
def get_mapas():
    cache_key = "brawl:mapas:rotation"
    
    # 1. Intentar leer caché fresco
    cached = _brawl_cache_read(cache_key, require_fresh=True)
    if cached is not None:
        print("🔄 Sirviendo mapas desde caché fresca.")
        return jsonify(cached)

    api_token = os.environ.get("BRAWL_STARS_API_TOKEN", "").strip()
    if not api_token:
        return jsonify({
            "error": "Falta configurar BRAWL_STARS_API_TOKEN en el entorno donde se ejecuta la web."
        }), 503

    try:
        url = f"{BASE_URL}/events/rotation"
        response = requests.get(
            url,
            headers={
                "Authorization": f"Bearer {api_token}",
                "Accept": "application/json",
            },
            timeout=10,
        )

        if response.status_code != 200:
            print(f"Error de API Brawl Stars en /events/rotation: HTTP {response.status_code}")
            # 2. Fallback a caché viejo
            cached_stale = _brawl_cache_read(cache_key, require_fresh=False)
            if cached_stale is not None:
                print("⚠️ API caída. Sirviendo mapas desde caché antigua (modo resiliente).")
                return jsonify(cached_stale)
            
            status = response.status_code if response.status_code in (401, 403, 429) else 502
            return jsonify({"error": obtener_error_api_brawl(response.status_code)}), status

        try:
            data = response.json()
        except ValueError:
            return jsonify({"error": "La API de Brawl Stars devolvió una respuesta ilegible."}), 502

        eventos = []
        items = data if isinstance(data, list) else data.get("items", []) if isinstance(data, dict) else None
        if not isinstance(items, list):
            return jsonify({"error": "La API de Brawl Stars devolvió un formato de rotación inesperado."}), 502

        for item in items:
            if not isinstance(item, dict):
                continue
            event_info = item.get("event", item)
            if not isinstance(event_info, dict):
                continue
            mode_data = event_info.get("mode", "BRAWL STARS")
            if isinstance(mode_data, str):
                mode_name = mode_data.replace("_", " ").upper()
            elif isinstance(mode_data, dict):
                mode_name = str(mode_data.get("name") or "BRAWL STARS").replace("_", " ").upper()
            else:
                mode_name = "BRAWL STARS"

            map_field = event_info.get("map", "En Vivo")
            if isinstance(map_field, dict):
                map_name = map_field.get("name", "En Vivo")
                map_id = map_field.get("id")
            else:
                map_name = str(map_field) if map_field else "En Vivo"
                map_id = event_info.get("id")

            map_img = f"https://cdn.brawlify.com/maps/regular/{map_id}.png" if map_id else ""
            end_time = item.get("endTime") or event_info.get("endTime")
            end_timestamp = None
            if isinstance(end_time, str):
                try:
                    end_timestamp = int(datetime.fromisoformat(end_time.replace("Z", "+00:00")).timestamp() * 1000)
                except ValueError:
                    pass

            eventos.append({
                "modo_nombre": mode_name,
                "endTimestamp": end_timestamp,
                "live": {"name": map_name, "img": map_img},
            })

        # 3. Guardar en caché (fresco por 30 minutos, persistente 7 días)
        _brawl_cache_write(cache_key, eventos, 1800)
        return jsonify(eventos)

    except requests.Timeout:
        cached_stale = _brawl_cache_read(cache_key, require_fresh=False)
        if cached_stale is not None:
            print("⚠️ Timeout. Sirviendo mapas desde caché antigua.")
            return jsonify(cached_stale)
        return jsonify({"error": "La conexión con la API de Brawl Stars tardó demasiado. Inténtalo de nuevo."}), 504
    except requests.RequestException as e:
        cached_stale = _brawl_cache_read(cache_key, require_fresh=False)
        if cached_stale is not None:
            print("⚠️ Error de conexión. Sirviendo mapas desde caché antigua.")
            return jsonify(cached_stale)
        print("Error de conexión con la API de Brawl Stars:", e)
        return jsonify({"error": "No se pudo conectar con la API de Brawl Stars. Comprueba tu conexión e inténtalo de nuevo."}), 502
    except Exception as e:
        print("Error al procesar la rotación de Brawl Stars:", e)
        return jsonify({"error": "No se pudo procesar la rotación de mapas recibida."}), 500


# ================= API MINIJUEGOS =================
@app.route("/api/estado-minijuegos", methods=["GET"])
def estado_minijuegos():
    resetear_limite_diario()
    return jsonify({
        "intentos_ruleta": session["intentos_ruleta"],
        "intentos_caja": session["intentos_caja"],
        "reset_time": session["last_reset_time"],
        "monedas": session["monedas"],
    })


@app.route("/api/girar-ruleta", methods=["POST"])
def girar_ruleta():
    resetear_limite_diario()
    if session.get("intentos_ruleta", 0) <= 0:
        return jsonify({"success": False, "message": "Sin intentos disponibles"}), 400

    session["intentos_ruleta"] -= 1
    pesos = [s["weight"] for s in SECTORES]
    premio_ganado = random.choices(SECTORES, weights=pesos, k=1)[0]
    session["monedas"] += premio_ganado["value"]
    session.modified = True

    return jsonify({
        "success": True,
        "sector_id": premio_ganado["id"],
        "premio": premio_ganado,
        "nuevas_monedas": session["monedas"],
        "intentos_ruleta": session["intentos_ruleta"],
    })


@app.route("/api/sumar-monedas", methods=["POST"])
def sumar_monedas():
    data = request.get_json() or {}
    cantidad = data.get("cantidad", 0)
    session["monedas"] += cantidad
    session.modified = True
    return jsonify({"success": True, "nuevas_monedas": session["monedas"]})


@app.route('/perfil')
def perfil():
    return render_template('perfil.html')


# ================= MODELO Y RUTAS NEWSLETTER =================
class Suscriptor(db.Model):
    __tablename__ = 'suscriptor_newsletter'
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    activo = db.Column(db.Boolean, default=True)
    fecha_registro = db.Column(db.DateTime, default=datetime.utcnow)


class CodigoRestablecerPassword(db.Model):
    __tablename__ = 'firebase_password_reset_codes'
    email = db.Column(db.String(254), primary_key=True)
    uid = db.Column(db.String(128), nullable=False)
    codigo_hash = db.Column(db.String(64), nullable=False)
    creado_en = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    expira_en = db.Column(db.DateTime, nullable=False)
    intentos = db.Column(db.Integer, nullable=False, default=0)

with app.app_context():
    db.create_all()


def obtener_firebase_admin_auth():
    """Devuelve Firebase Admin Auth usando una cuenta de servicio del servidor."""
    import firebase_admin
    from firebase_admin import auth as admin_auth, credentials

    try:
        firebase_admin.get_app()
    except ValueError:
        ruta_credenciales = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS')
        credencial = (
            credentials.Certificate(ruta_credenciales)
            if ruta_credenciales
            else credentials.ApplicationDefault()
        )
        firebase_admin.initialize_app(credencial, {
            'projectId': os.environ.get('FIREBASE_PROJECT_ID', 'birrias')
        })
    return admin_auth


CODIGOS_BIRRIACOINS = {
    'BIRRIASSTART': 100,
    'BIRRIASPLAY': 250,
    'BIRRIASVIP': 500,
}


@app.route('/api/redeem-code', methods=['POST'])
def canjear_codigo_birriacoins():
    autorizacion = request.headers.get('Authorization', '')
    if not autorizacion.startswith('Bearer '):
        return jsonify({'success': False, 'message': 'Inicia sesión para canjear un código.'}), 401

    datos = request.get_json(silent=True) or {}
    codigo = re.sub(r'[^A-Z0-9]', '', str(datos.get('code') or '').upper())
    recompensa = CODIGOS_BIRRIACOINS.get(codigo)
    if not recompensa:
        return jsonify({'success': False, 'message': 'Ese código no es válido.'}), 400

    try:
        admin_auth = obtener_firebase_admin_auth()
        token = autorizacion.split(' ', 1)[1].strip()
        datos_usuario = admin_auth.verify_id_token(token)
        uid = datos_usuario['uid']
    except Exception:
        app.logger.exception('No se pudo verificar la sesión para canjear BirriaCoins.')
        return jsonify({'success': False, 'message': 'Tu sesión ha caducado. Inicia sesión de nuevo.'}), 401

    try:
        from firebase_admin import firestore
        firestore_db = firestore.client()
        usuario_ref = firestore_db.collection('usuarios').document(uid)
        canje_ref = usuario_ref.collection('codigosCanjeados').document(codigo)
        transaccion = firestore_db.transaction(max_attempts=5)

        @firestore.transactional
        def aplicar_canje(transaction):
            canje_snap = canje_ref.get(transaction=transaction)
            if canje_snap.exists:
                return {'success': False, 'already_redeemed': True}

            usuario_snap = usuario_ref.get(transaction=transaction)
            usuario = usuario_snap.to_dict() if usuario_snap.exists else {}
            try:
                saldo_actual = int(usuario.get('birriacoins', 100))
            except (TypeError, ValueError):
                saldo_actual = 0
            saldo_nuevo = max(0, saldo_actual) + recompensa

            transaction.set(usuario_ref, {'birriacoins': saldo_nuevo}, merge=True)
            transaction.set(canje_ref, {
                'codigo': codigo,
                'recompensa': recompensa,
                'fechaCanje': firestore.SERVER_TIMESTAMP,
            })
            return {'success': True, 'balance': saldo_nuevo}

        resultado = aplicar_canje(transaccion)
        if resultado.get('already_redeemed'):
            return jsonify({'success': False, 'message': 'Ya canjeaste este código en esta cuenta.'}), 409
        return jsonify({
            'success': True,
            'reward': recompensa,
            'balance': resultado['balance'],
            'message': f'¡Has recibido {recompensa} BirriaCoins!'
        })
    except Exception:
        app.logger.exception('No se pudo canjear el código de BirriaCoins en Firebase.')
        return jsonify({'success': False, 'message': 'No se pudo guardar el canje en Firebase. Inténtalo de nuevo.'}), 503


def enviar_aviso_contrasena_actualizada(email):
    mensaje = Message(
        subject='Se actualizó la contraseña de tu cuenta BIRRIAS',
        sender=app.config.get('MAIL_DEFAULT_SENDER') or app.config.get('MAIL_USERNAME'),
        recipients=[email],
        body=(
            'La contraseña de tu cuenta BIRRIAS se actualizó correctamente.\n\n'
            'Si no hiciste este cambio, ponte en contacto con el equipo de BIRRIAS y protege tu cuenta.'
        ),
        html='''<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:28px 12px;background:#10091d;color:#f8f5ff;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td align="center">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:540px;background:#1b0d2d;border:1px solid #482477;border-radius:18px;">
      <tr><td align="center" style="padding:28px 24px 8px;font-size:26px;font-weight:900;letter-spacing:3px;">BIRRIAS</td></tr>
      <tr><td align="center" style="padding:16px 30px 28px;">
        <h1 style="margin:0 0 14px;font-size:23px;">Contraseña actualizada</h1>
        <p style="margin:0;color:#c9bfd8;font-size:15px;line-height:1.7;">La contraseña de tu cuenta se cambió correctamente.</p>
        <p style="margin:16px 0 0;color:#c9bfd8;font-size:14px;line-height:1.7;">Si no reconoces este cambio, ponte en contacto con el equipo de BIRRIAS y protege tu cuenta.</p>
      </td></tr>
      <tr><td align="center" style="padding:14px;border-top:1px solid #39234e;color:#81758f;font-size:12px;">Aviso de seguridad automático</td></tr>
    </table>
  </td></tr></table>
</body></html>'''
    )
    mail.send(mensaje)


@app.route('/api/password-change/notification', methods=['POST'])
def notificar_cambio_contrasena():
    autorizacion = request.headers.get('Authorization', '')
    if not autorizacion.startswith('Bearer '):
        return jsonify({'success': False, 'message': 'Inicia sesión para completar esta solicitud.'}), 401

    try:
        admin_auth = obtener_firebase_admin_auth()
        token = autorizacion.split(' ', 1)[1].strip()
        datos_usuario = admin_auth.verify_id_token(token)
        usuario = admin_auth.get_user(datos_usuario['uid'])
        email = usuario.email
        if not email:
            return jsonify({'success': False, 'message': 'La cuenta no tiene un correo disponible.'}), 400
    except Exception:
        app.logger.exception('No se pudo validar al usuario para notificar el cambio de contraseña.')
        return jsonify({'success': False, 'message': 'No se pudo verificar la sesión.'}), 401

    try:
        enviar_aviso_contrasena_actualizada(email)
    except Exception:
        app.logger.exception('No se pudo enviar el aviso de cambio de contraseña.')
        return jsonify({'success': False, 'message': 'La contraseña cambió, pero no se pudo enviar el aviso por correo.'}), 503
    return jsonify({'success': True, 'message': 'Aviso enviado.'})


def hash_codigo_restablecimiento(email, codigo):
    secreto = app.config.get('PASSWORD_RESET_SECRET')
    if not secreto:
        raise RuntimeError('Falta configurar PASSWORD_RESET_SECRET en el servidor.')
    contenido = f'{email}:{codigo}'.encode('utf-8')
    return hmac.new(secreto.encode('utf-8'), contenido, hashlib.sha256).hexdigest()


def respuesta_generica_codigo():
    return jsonify({
        'success': True,
        'message': 'Si ese correo tiene una cuenta, se ha enviado un código de seis cifras.'
    })


@app.route('/api/password-reset/request', methods=['POST'])
def solicitar_codigo_restablecimiento():
    datos = request.get_json(silent=True) or {}
    email = str(datos.get('email') or '').strip().lower()
    if len(email) > 254 or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', email):
        return jsonify({'success': False, 'message': 'Escribe un correo electrónico válido.'}), 400
    if not app.config.get('PASSWORD_RESET_SECRET'):
        return jsonify({'success': False, 'message': 'El servidor aún no tiene configurado el restablecimiento de contraseña.'}), 503

    try:
        admin_auth = obtener_firebase_admin_auth()
        usuario = admin_auth.get_user_by_email(email)
    except Exception as error:
        if getattr(error, 'code', None) == 'auth/user-not-found':
            return respuesta_generica_codigo()
        app.logger.exception('Firebase Admin no pudo preparar un restablecimiento de contraseña.')
        return jsonify({'success': False, 'message': 'El servicio de restablecimiento no está disponible ahora.'}), 503

    ahora = datetime.utcnow()
    codigo_existente = CodigoRestablecerPassword.query.filter_by(email=email).first()
    if codigo_existente and ahora - codigo_existente.creado_en < timedelta(seconds=60):
        return respuesta_generica_codigo()

    codigo = f'{secrets.randbelow(1_000_000):06d}'
    nuevo_registro = CodigoRestablecerPassword(
        email=email,
        uid=usuario.uid,
        codigo_hash=hash_codigo_restablecimiento(email, codigo),
        creado_en=ahora,
        expira_en=ahora + timedelta(minutes=10),
        intentos=0
    )
    if codigo_existente:
        db.session.delete(codigo_existente)
    db.session.add(nuevo_registro)

    try:
        db.session.commit()
        mensaje = Message(
            subject='Tu código para cambiar la contraseña de BIRRIAS',
            sender=app.config.get('MAIL_DEFAULT_SENDER') or app.config.get('MAIL_USERNAME'),
            recipients=[email],
            body=(
                f'Tu código para cambiar la contraseña es: {codigo}\n\n'
                'Introdúcelo en la página de BIRRIAS junto con tu nueva contraseña. '
                'El código caduca en 10 minutos y solo puede usarse una vez. '
                'Si no solicitaste este cambio, ignora este correo.'
            ),
            html=f'''<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Restablece tu contraseña de BIRRIAS</title>
</head>
<body style="margin:0;padding:0;background-color:#10091d;color:#f8f5ff;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">Tu código de seguridad de BIRRIAS caduca en 10 minutos.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#10091d;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background-color:#1b0d2d;border:1px solid #482477;border-radius:20px;overflow:hidden;">
        <tr><td align="center" style="padding:30px 24px 12px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
            <td style="padding-right:12px;vertical-align:middle;"><img src="cid:birriasprofile" alt="" width="54" height="54" style="display:block;width:54px;height:54px;border:2px solid #9b62f5;border-radius:50%;object-fit:cover;"></td>
            <td style="vertical-align:middle;font-size:27px;font-weight:900;letter-spacing:3px;color:#ffffff;">BIRRIAS</td>
          </tr></table>
          <div style="width:56px;height:4px;margin:16px auto 0;border-radius:4px;background-color:#8b43f5;"></div>
        </td></tr>
        <tr><td align="center" style="padding:22px 32px 8px;">
          <h1 style="margin:0;color:#ffffff;font-size:25px;line-height:1.25;">Restablece tu contraseña</h1>
          <p style="margin:14px 0 0;color:#c9bfd8;font-size:16px;line-height:1.6;">Usa este código para continuar. Introdúcelo en la página de BIRRIAS:</p>
        </td></tr>
        <tr><td align="center" style="padding:22px 24px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="background-color:#10091d;border:1px dashed #9b62f5;border-radius:14px;">
            <tr><td align="center" style="padding:18px 28px;color:#ffffff;font-family:Consolas,'Courier New',monospace;font-size:38px;font-weight:700;letter-spacing:3px;white-space:nowrap;">
              {codigo}
            </td></tr>
          </table>
        </td></tr>
        <tr><td align="center" style="padding:0 32px 30px;">
          <p style="margin:0;color:#c9bfd8;font-size:14px;line-height:1.7;">El código caduca en <strong style="color:#ffffff;">10 minutos</strong> y solo puede usarse una vez.</p>
          <p style="margin:14px 0 0;color:#9387a5;font-size:13px;line-height:1.6;">Si no pediste cambiar tu contraseña, puedes ignorar este mensaje. Tu contraseña actual seguirá igual.</p>
        </td></tr>
        <tr><td align="center" style="padding:16px 20px;border-top:1px solid #39234e;color:#81758f;font-size:12px;">BIRRIAS · Correo automático de seguridad</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>'''
        )
        with open(os.path.join(app.root_path, 'static', 'images', 'birriasprofile.jpg'), 'rb') as imagen_perfil:
            mensaje.attach(
                'birriasprofile.jpg',
                'image/jpeg',
                imagen_perfil.read(),
                'inline',
                headers={'Content-ID': '<birriasprofile>'}
            )
        mail.send(mensaje)
    except Exception:
        db.session.rollback()
        registro = CodigoRestablecerPassword.query.filter_by(email=email).first()
        if registro and registro.codigo_hash == nuevo_registro.codigo_hash:
            db.session.delete(registro)
            db.session.commit()
        app.logger.exception('No se pudo enviar el correo de restablecimiento.')
        return jsonify({'success': False, 'message': 'No se pudo enviar el correo. Inténtalo de nuevo más tarde.'}), 503

    return respuesta_generica_codigo()


def obtener_codigo_restablecimiento_valido(email, codigo):
    """Valida el código sin consumirlo; el cambio de contraseña lo consume después."""
    registro = CodigoRestablecerPassword.query.filter_by(email=email).first()
    ahora = datetime.utcnow()
    mensaje_error = 'El código es incorrecto o ha caducado. Solicita uno nuevo.'

    if not registro:
        return None, mensaje_error
    if ahora >= registro.expira_en or registro.intentos >= 5:
        db.session.delete(registro)
        db.session.commit()
        return None, mensaje_error

    codigo_valido = hmac.compare_digest(
        registro.codigo_hash,
        hash_codigo_restablecimiento(email, codigo)
    )
    if not codigo_valido:
        registro.intentos += 1
        if registro.intentos >= 5:
            db.session.delete(registro)
        db.session.commit()
        return None, mensaje_error

    return registro, None


@app.route('/api/password-reset/verify', methods=['POST'])
def verificar_codigo_restablecimiento():
    datos = request.get_json(silent=True) or {}
    email = str(datos.get('email') or '').strip().lower()
    codigo = str(datos.get('code') or '').strip()

    if len(email) > 254 or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', email):
        return jsonify({'success': False, 'message': 'Escribe un correo electrónico válido.'}), 400
    if not re.fullmatch(r'\d{6}', codigo):
        return jsonify({'success': False, 'message': 'El código debe tener seis cifras.'}), 400
    if not app.config.get('PASSWORD_RESET_SECRET'):
        return jsonify({'success': False, 'message': 'El servidor aún no tiene configurado el restablecimiento de contraseña.'}), 503

    registro, error = obtener_codigo_restablecimiento_valido(email, codigo)
    if error:
        return jsonify({'success': False, 'message': error}), 400
    return jsonify({'success': True, 'message': 'Código confirmado. Ya puedes elegir tu nueva contraseña.'})


@app.route('/api/password-reset/confirm', methods=['POST'])
def confirmar_codigo_restablecimiento():
    datos = request.get_json(silent=True) or {}
    email = str(datos.get('email') or '').strip().lower()
    codigo = str(datos.get('code') or '').strip()
    nueva_password = str(datos.get('password') or '')
    confirmar_password = str(datos.get('confirm_password') or '')

    if len(email) > 254 or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', email):
        return jsonify({'success': False, 'message': 'Escribe un correo electrónico válido.'}), 400
    if not re.fullmatch(r'\d{6}', codigo):
        return jsonify({'success': False, 'message': 'El código debe tener seis cifras.'}), 400
    if len(nueva_password) < 8:
        return jsonify({'success': False, 'message': 'La nueva contraseña debe tener al menos 8 caracteres.'}), 400
    if nueva_password != confirmar_password:
        return jsonify({'success': False, 'message': 'Las contraseñas no coinciden.'}), 400
    if not app.config.get('PASSWORD_RESET_SECRET'):
        return jsonify({'success': False, 'message': 'El servidor aún no tiene configurado el restablecimiento de contraseña.'}), 503

    registro, error = obtener_codigo_restablecimiento_valido(email, codigo)
    if error:
        return jsonify({'success': False, 'message': error}), 400

    uid = registro.uid
    # Consumir el código antes de cambiar la contraseña para impedir que se reutilice.
    db.session.delete(registro)
    db.session.commit()
    try:
        admin_auth = obtener_firebase_admin_auth()
        admin_auth.update_user(uid, password=nueva_password)
    except Exception:
        app.logger.exception('Firebase Admin no pudo actualizar la contraseña.')
        return jsonify({'success': False, 'message': 'No se pudo guardar la contraseña. Solicita un código nuevo e inténtalo otra vez.'}), 503

    try:
        enviar_aviso_contrasena_actualizada(email)
        aviso_enviado = True
    except Exception:
        app.logger.exception('La contraseña cambió, pero no se pudo enviar el aviso por correo.')
        aviso_enviado = False

    return jsonify({
        'success': True,
        'notification_sent': aviso_enviado,
        'message': 'La contraseña se actualizó correctamente. Ya puedes iniciar sesión.'
    })


@app.route('/api/suscribir-newsletter', methods=['POST'])
def suscribir_newsletter():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"success": False, "message": "No se recibieron datos JSON válidos."}), 400
        
    email = data.get('email', '').strip()
    if not email or '@' not in email:
        return jsonify({"success": False, "message": "Correo electrónico no válido."}), 400

    try:
        existente = Suscriptor.query.filter_by(email=email).first()
        if existente:
            if not existente.activo:
                existente.activo = True
                db.session.commit()
                return jsonify({"success": True, "message": "¡Te has vuelto a suscribir con éxito!"})
            return jsonify({"success": False, "message": "Este correo ya está suscrito."}), 400

        nuevo_suscriptor = Suscriptor(email=email)
        db.session.add(nuevo_suscriptor)
        db.session.commit()
        return jsonify({"success": True, "message": "¡Suscripción realizada con éxito!"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": "Error interno al procesar la suscripción."}), 500

import requests
from flask import jsonify, current_app
from datetime import datetime
import feedparser

# =========================================================================
# 1. FUNCIÓN AUTOMÁTICA PARA YOUTUBE (Título y Enlace directo del video)
# =========================================================================
def verificar_y_enviar_youtube():
    url_feed = "https://www.youtube.com/feeds/videos.xml?channel_id=UCooVYzDx-hmuMVaww6hN61Q"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    video_info = None
    try:
        response = requests.get(url_feed, headers=headers, timeout=5)
        if response.status_code == 200:
            feed = feedparser.parse(response.content)
            if feed and feed.entries:
                latest = feed.entries[0]
                video_id = latest.get("yt_videoid", latest.id.split(":")[-1])
                titulo = latest.get("title", "Nuevo video de Brawl Stars")
                enlace = latest.get("link", f"https://www.youtube.com/watch?v={video_id}")
                video_info = {"id": video_id, "titulo": titulo, "enlace": enlace}
    except Exception as e:
        print(f"⚠️ Aviso al obtener YouTube: {e}")
        
    # Respaldo si falla la red local
    if not video_info:
        video_info = {
            "id": "yt_brawl_default_id",
            "titulo": "Brawl Stars Update & New Content Overview",
            "enlace": "https://www.youtube.com/@BrawlStars/videos"
        }
        
    with app.app_context():
        suscriptores = Suscriptor.query.filter_by(activo=True).all()
        if not suscriptores:
            return
            
        print(f"📤 Enviando alerta automática de YouTube a {len(suscriptores)} suscriptor(es)...")
        for sub in suscriptores:
            try:
                msg = Message(
                    subject=f"🎥 Nuevo video de Brawl Stars: {video_info['titulo']}",
                    sender=app.config.get('MAIL_USERNAME'),
                    recipients=[sub.email]
                )
                msg.body = (
                    f"¡Hola!\n\n"
                    f"Se ha publicado un nuevo video en el canal oficial de Brawl Stars:\n\n"
                    f"📌 {video_info['titulo']}\n\n"
                    f"Puedes verlo y disfrutarlo aquí:\n{video_info['enlace']}\n\n"
                    f"¡Gracias por suscribirte!"
                )
                mail.send(msg)
                print(f"✅ Correo de YouTube enviado a {sub.email}")
            except Exception as e:
                print(f"❌ Error enviando correo de YouTube a {sub.email}: {e}")

# =========================================================================
# 2. FUNCIÓN AUTOMÁTICA PARA X / TWITTER (Aviso genérico de nueva publicación)
# =========================================================================
def verificar_y_enviar_x():
    enlace_x = "https://x.com/BrawlStars"
    
    with app.app_context():
        suscriptores = Suscriptor.query.filter_by(activo=True).all()
        if not suscriptores:
            return
            
        print(f"📤 Enviando alerta automática de X a {len(suscriptores)} suscriptor(es)...")
        for sub in suscriptores:
            try:
                msg = Message(
                    subject="📢 Nueva publicación oficial de Brawl Stars en X",
                    sender=app.config.get('MAIL_USERNAME'),
                    recipients=[sub.email]
                )
                msg.body = (
                    f"¡Hola!\n\n"
                    f"Hay una nueva publicación de Brawl Stars en X. "
                    f"Más información en el siguiente enlace:\n\n"
                    f"🔗 {enlace_x}\n\n"
                    f"¡Gracias por suscribirte!"
                )
                mail.send(msg)
                print(f"✅ Correo de X enviado a {sub.email}")
            except Exception as e:
                print(f"❌ Error enviando correo de X a {sub.email}: {e}")

# =========================================================================
# RUTAS DE PRUEBA RÁPIDA (Opcionales por si quieres forzarlas desde el navegador)
# =========================================================================
@app.route('/api/probar-video-yt', methods=['GET'])
def probar_video_yt():
    verificar_y_enviar_yt = verificar_y_enviar_youtube()
    return jsonify({"success": True, "message": "Proceso automático de YouTube ejecutado."})

@app.route('/api/probar-publicacion-x', methods=['GET'])
def probar_publicacion_x():
    verificar_y_enviar_x()
    return jsonify({"success": True, "message": "Proceso automático de X ejecutado."})
# ================= PROGRAMADOR DE TAREAS AUTOMÁTICO EN SEGUNDO PLANO =================
if not app.debug or os.environ.get('WERKZEUG_RUN_MAIN') == 'true':
    scheduler = BackgroundScheduler()
    if not scheduler.running:
        # Se ejecutará automáticamente cada 2 horas para revisar si hay contenido nuevo de forma autónoma
        scheduler.add_job(func=lambda: enviar_newsletter_a_todos(verificar_cambios=True), trigger="interval", hours=2)
        scheduler.start()


@app.route('/api/probar-correo', methods=['GET'])
def probar_correo():
    # Esta ruta de prueba fuerza el envío manual inmediato para que compruebes el resultado al instante
    enviar_newsletter_a_todos(verificar_cambios=False)
    return jsonify({"success": True, "message": "¡Se ha intentado enviar la newsletter a todos los suscriptores activos!"})


from werkzeug.security import generate_password_hash, check_password_hash
from flask import render_template, request, redirect, url_for, flash, session

# Definición del Modelo de Usuario (en tu sección de modelos SQLAlchemy)
class Usuario(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    nombre_usuario = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    nacionalidad = db.Column(db.String(50), nullable=False)
    fecha_nacimiento = db.Column(db.String(20), nullable=False)
    activo = db.Column(db.Boolean, default=True)

# 1. Ruta para el Registro de Cuentas
@app.route('/api/registro', methods=['POST'])
def registrar_usuario():
    data = request.form if request.form else request.json
    
    nombre_usuario = data.get('nombre_usuario')
    email = data.get('email')
    nacionalidad = data.get('nacionalidad')
    fecha_nacimiento = data.get('fecha_nacimiento')
    password = data.get('password')
    password_confirm = data.get('password_confirm')
    
    # Validaciones básicas
    if not all([nombre_usuario, email, nacionalidad, fecha_nacimiento, password, password_confirm]):
        return jsonify({"success": False, "message": "Por favor, completa todos los campos."}), 400
        
    if password != password_confirm:
        return jsonify({"success": False, "message": "Las contraseñas no coinciden."}), 400

    if len(password) < 8:
        return jsonify({"success": False, "message": "La contraseña debe tener al menos 8 caracteres."}), 400
        
    if Usuario.query.filter((Usuario.email == email) | (Usuario.nombre_usuario == nombre_usuario)).first():
        return jsonify({"success": False, "message": "El correo o el nombre de usuario ya están registrados."}), 400
        
    try:
        nuevo_usuario = Usuario(
            nombre_usuario=nombre_usuario,
            email=email,
            nacionalidad=nacionalidad,
            fecha_nacimiento=fecha_nacimiento,
            password_hash=generate_password_hash(password)
        )
        db.session.add(nuevo_usuario)
        db.session.commit()
        
        # Opcional: Iniciar sesión automáticamente al registrarse
        session['user_id'] = nuevo_usuario.id
        session['username'] = nuevo_usuario.nombre_usuario
        
        return jsonify({"success": True, "message": "¡Cuenta creada con éxito!"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": f"Error en el servidor: {str(e)}"}), 500

# 2. Ruta para el Inicio de Sesión (Permite Email o Usuario)
@app.route('/api/login', methods=['POST'])
def login_usuario():
    data = request.form if request.form else request.json
    identificador = data.get('identificador') # Puede ser email o nombre de usuario
    password = data.get('password')
    
    if not identificador or not password:
        return jsonify({"success": False, "message": "Introduce tus datos de acceso."}), 400
        
    # Buscar por email o por nombre de usuario
    usuario = Usuario.query.filter(
        (Usuario.email == identificador) | (Usuario.nombre_usuario == identificador)
    ).first()
    
    if usuario and check_password_hash(usuario.password_hash, password):
        session['user_id'] = usuario.id
        session['username'] = usuario.nombre_usuario
        return jsonify({"success": True, "message": f"¡Bienvenido de nuevo, {usuario.nombre_usuario}!"})
    
    return jsonify({"success": False, "message": "Credenciales incorrectas. Verifica tus datos."}), 401

@app.route('/perfil')
def ver_perfil():
    return render_template('perfil.html')
# 3. Ruta para Cerrar Sesión
@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('index')) # Ajusta a tu ruta principal
# ================= INICIO DEL SERVIDOR =================
if __name__ == "__main__":
    app.run(debug=True)