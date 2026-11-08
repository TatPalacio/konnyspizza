# -*- coding: utf-8 -*-
"""Konys Pizza · 30 pruebas automáticas con Selenium y reporte PDF.

Se ejecuta desde la raíz del proyecto:

    py pruebas/pruebas_reservas.py
    py pruebas/pruebas_reservas.py --rapido --oculto

La suite levanta un servidor local propio y fuerza el modo demo (localStorage)
para que las pruebas no dependan de Supabase ni de internet. Al final genera
un PDF en pruebas/reportes/ con portada, tabla resumen y una página por prueba.
"""

from __future__ import annotations

import argparse
import datetime as dt
import os
import platform
import re
import shutil
import sys
import threading
import time
import traceback
from dataclasses import dataclass
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Callable, Optional
from urllib.parse import unquote, urlparse

from selenium import webdriver
from selenium.common.exceptions import (
    ElementClickInterceptedException,
    ElementNotInteractableException,
    NoSuchElementException,
    StaleElementReferenceException,
    TimeoutException,
    WebDriverException,
)
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

# ---------------------------------------------------------------------------
# Rutas y configuración global
# ---------------------------------------------------------------------------
RAIZ = Path(__file__).resolve().parent.parent
PRUEBAS_DIR = Path(__file__).resolve().parent
REPORTES_DIR = PRUEBAS_DIR / "reportes"
DOCS_CAPTURAS = RAIZ / "docs" / "capturas"

BASE_URL = ""
RAPIDO = False
OCULTO = False
NAVEGADOR_PEDIDO = "auto"
PAUSA = 0.42
VELOCIDAD_TECLEO = 0.022
TIMEOUT = 16

# Se rellena al iniciar la ejecución
EJECUCION = dt.datetime.now()
CARPETA_CAPTURAS = REPORTES_DIR / f"capturas_{EJECUCION:%Y-%m-%d_%H-%M-%S}"


@dataclass
class Prueba:
    id: int
    grupo: str
    nombre: str
    esperado: str
    funcion: Callable
    estado: str = "Pendiente"
    obtenido: str = ""
    duracion: float = 0.0
    captura: str = ""


class Omitida(Exception):
    """Se usa cuando una prueba no aplica en el momento de la ejecución."""


# ---------------------------------------------------------------------------
# Utilidades generales
# ---------------------------------------------------------------------------
def log(mensaje: str) -> None:
    try:
        print(mensaje, flush=True)
    except UnicodeEncodeError:
        print(mensaje.encode("ascii", "replace").decode("ascii"), flush=True)


def pausa(multiplicador: float = 1.0) -> None:
    if not RAPIDO:
        time.sleep(PAUSA * multiplicador)


def esperar(driver, segundos: int = TIMEOUT) -> WebDriverWait:
    return WebDriverWait(driver, segundos)


def slug(texto: str) -> str:
    limpio = re.sub(r"[^A-Za-z0-9]+", "_", texto).strip("_").lower()
    return limpio[:52] or "prueba"


def scroll_a(driver, objetivo) -> None:
    try:
        el = driver.find_element(By.CSS_SELECTOR, objetivo) if isinstance(objetivo, str) else objetivo
        driver.execute_script(
            "const r = arguments[0].getBoundingClientRect();"
            "const y = Math.max(0, r.top + window.scrollY - 100);"
            "window.scrollTo({top: y, behavior: 'instant'});",
            el,
        )
        pausa(0.2)
    except Exception:
        pass


def inyectar_estilos(driver) -> None:
    try:
        driver.execute_script("""
            if (!document.getElementById('__selenium_style')) {
              const s = document.createElement('style');
              s.id = '__selenium_style';
              s.textContent = '.__selenium_focus{outline:3px solid #F28C28 !important;' +
                'outline-offset:2px !important;box-shadow:0 0 0 4px rgba(242,140,40,.18) !important}';
              document.head.appendChild(s);
            }
        """)
    except WebDriverException:
        pass


def mostrar_cartel(driver, numero: int, total: int, nombre: str, estado: str) -> None:
    color = {"Aprobada": "#16A34A", "Fallida": "#DC2626"}.get(estado, "#D97706")
    try:
        driver.execute_script("""
            const id = '__selenium_banner';
            let el = document.getElementById(id);
            if (!el) {
              el = document.createElement('div');
              el.id = id;
              document.body.appendChild(el);
            }
            Object.assign(el.style, {
              position: 'fixed', left: '14px', top: '14px', zIndex: '2147483647',
              padding: '10px 16px', borderRadius: '10px',
              font: '600 14px Inter, Arial, sans-serif', color: '#fff',
              boxShadow: '0 8px 24px rgba(0,0,0,.28)', maxWidth: '460px',
              lineHeight: '1.35', pointerEvents: 'none'
            });
            el.textContent = arguments[0];
            el.style.background = arguments[1];
        """, f"Prueba {numero} de {total}: {nombre} · {estado}", color)
        pausa(0.15)
    except WebDriverException:
        pass


def captura_documentacion(driver, nombre: str) -> None:
    """Captura limpia (sin cartel) para las imágenes del README."""
    try:
        DOCS_CAPTURAS.mkdir(parents=True, exist_ok=True)
        # Espera fija para que termine el scroll suave y la transición del header
        # (0.2 s) incluso cuando se ejecuta con --rapido.
        time.sleep(0.45)
        driver.save_screenshot(str(DOCS_CAPTURAS / f"{nombre}.png"))
    except Exception as exc:  # pragma: no cover - solo documentación
        log(f"      (aviso) no se pudo guardar docs/capturas/{nombre}.png: {exc}")


def click(driver, selector: str, obligatorio: bool = True):
    try:
        el = esperar(driver).until(EC.element_to_be_clickable((By.CSS_SELECTOR, selector)))
    except TimeoutException:
        if obligatorio:
            raise AssertionError(f"No se encontró el elemento visible «{selector}».")
        return None
    scroll_a(driver, el)
    try:
        el.click()
    except (ElementClickInterceptedException, StaleElementReferenceException):
        try:
            driver.execute_script("arguments[0].click();", el)
        except Exception as exc:
            if obligatorio:
                raise AssertionError(f"No se pudo pulsar «{selector}»: {exc}")
            return None
    pausa()
    return el


def escribir(driver, selector: str, texto: str, limpiar: bool = True):
    el = esperar(driver).until(EC.element_to_be_clickable((By.CSS_SELECTOR, selector)))
    scroll_a(driver, el)
    driver.execute_script(
        "arguments[0].focus(); arguments[0].classList.add('__selenium_focus');", el
    )
    if limpiar:
        try:
            el.clear()
        except Exception:
            driver.execute_script("arguments[0].value = '';", el)
    if RAPIDO:
        el.send_keys(texto)
    else:
        for caracter in texto:
            el.send_keys(caracter)
            time.sleep(VELOCIDAD_TECLEO)
    driver.execute_script("arguments[0].classList.remove('__selenium_focus');", el)
    pausa(0.3)
    return el


def texto_de(driver, selector: str) -> str:
    try:
        return driver.find_element(By.CSS_SELECTOR, selector).text.strip()
    except Exception:
        return ""


# ---------------------------------------------------------------------------
# Servidor local en modo demo
# ---------------------------------------------------------------------------
class Handler(SimpleHTTPRequestHandler):
    """Sirve el proyecto y sustituye js/config.js por una configuración vacía.

    Así la aplicación arranca en modo demo (localStorage), sin llamar a Supabase
    y sin depender de las claves que pueda tener el archivo local.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(RAIZ), **kwargs)

    def do_GET(self):  # noqa: N802 (nombre exigido por http.server)
        ruta = unquote(urlparse(self.path).path)
        if ruta == "/js/config.js":
            cuerpo = (
                "window.KONYS_CONFIG = { SUPABASE_URL: '', SUPABASE_ANON_KEY: '' };\n"
            ).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/javascript; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(cuerpo)))
            self.end_headers()
            self.wfile.write(cuerpo)
            return
        super().do_GET()

    def log_message(self, fmt, *args):  # silenciar el log del servidor
        pass

    def handle_one_request(self):
        try:
            super().handle_one_request()
        except (ConnectionResetError, BrokenPipeError):
            pass


def iniciar_servidor():
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    hilo = threading.Thread(target=httpd.serve_forever, daemon=True)
    hilo.start()
    url = f"http://127.0.0.1:{httpd.server_address[1]}/"
    time.sleep(0.15)
    return httpd, url


# ---------------------------------------------------------------------------
# Navegador
# ---------------------------------------------------------------------------
def _existe_chrome() -> bool:
    candidatos = [
        Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe"),
        Path(r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"),
        Path(os.environ.get("LOCALAPPDATA", "")) / "Google/Chrome/Application/chrome.exe",
    ]
    return any(p.exists() for p in candidatos) or bool(shutil.which("chrome") or shutil.which("google-chrome"))


def _existe_edge() -> bool:
    candidatos = [
        Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"),
        Path(r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"),
    ]
    return any(p.exists() for p in candidatos) or bool(shutil.which("msedge") or shutil.which("microsoft-edge"))


def _orden_navegadores() -> list[str]:
    if NAVEGADOR_PEDIDO != "auto":
        return [NAVEGADOR_PEDIDO]
    disponibles = []
    if _existe_chrome():
        disponibles.append("chrome")
    if _existe_edge():
        disponibles.append("edge")
    return disponibles or ["chrome", "edge"]


def _opciones(nombre: str):
    if nombre == "chrome":
        from selenium.webdriver.chrome.options import Options
        opciones = Options()
    else:
        from selenium.webdriver.edge.options import Options
        opciones = Options()
    opciones.page_load_strategy = "eager"
    opciones.add_argument("--window-size=1440,900")
    opciones.add_argument("--lang=es-CO")
    opciones.add_argument("--disable-search-engine-choice-screen")
    opciones.add_argument("--no-first-run")
    opciones.add_argument("--disable-extensions")
    opciones.add_argument("--disable-background-networking")
    # Las pruebas no necesitan internet: se evita esperar fuentes y el SDK CDN.
    opciones.add_argument(
        "--host-resolver-rules=MAP cdn.jsdelivr.net ~NOTFOUND, "
        "MAP fonts.googleapis.com ~NOTFOUND, MAP fonts.gstatic.com ~NOTFOUND"
    )
    if OCULTO:
        opciones.add_argument("--headless=new")
        opciones.add_argument("--disable-gpu")
    return opciones


def crear_driver():
    errores = []
    for nombre in _orden_navegadores():
        try:
            opciones = _opciones(nombre)
            if nombre == "chrome":
                driver = webdriver.Chrome(options=opciones)
            else:
                driver = webdriver.Edge(options=opciones)
            driver.set_page_load_timeout(35)
            driver.implicitly_wait(0)
            return driver, nombre
        except Exception as exc:  # noqa: BLE001
            errores.append(f"{nombre}: {exc}")
    detalle = "\n".join(errores)
    raise RuntimeError(
        "No se pudo abrir Chrome ni Edge. Instala un navegador compatible y "
        "comprueba la conexión la primera vez (Selenium descarga el driver).\n" + detalle
    )


# ---------------------------------------------------------------------------
# Navegación y helpers de la aplicación
# ---------------------------------------------------------------------------
def reset(driver, movil: bool = False) -> None:
    """Reinicia el estado de la app y deja la página pública cargada."""
    if not movil:
        driver.set_window_size(1440, 900)
    driver.get(BASE_URL)
    driver.execute_script(
        "try{localStorage.clear()}catch(e){};"
        "try{sessionStorage.clear()}catch(e){};"
    )
    driver.get(BASE_URL)
    esperar(driver).until(
        lambda d: d.execute_script("return document.readyState") in ("interactive", "complete")
    )
    inyectar_estilos(driver)
    esperar(driver).until(
        lambda d: d.find_elements(By.CSS_SELECTOR, "[data-testid='mesa-card']")
        or d.find_elements(By.CSS_SELECTOR, "[data-testid='carga-error']")
    )
    pausa()


def abrir_admin(driver) -> None:
    reset(driver)
    driver.get(BASE_URL + "admin.html")
    esperar(driver).until(
        EC.visibility_of_element_located((By.CSS_SELECTOR, "[data-testid='login']"))
    )
    inyectar_estilos(driver)
    pausa()


def leer_password_admin() -> str:
    archivo = RAIZ / "js" / "admin-config.js"
    try:
        contenido = archivo.read_text(encoding="utf-8")
        m = re.search(r'ADMIN_PASSWORD"\s*:\s*"([^"]*)"', contenido)
        if m:
            return m.group(1)
    except Exception:
        pass
    return "konys2026"


def login_admin(driver, password: Optional[str] = None) -> None:
    abrir_admin(driver)
    escribir(driver, "[data-testid='login-password']", password or leer_password_admin())
    click(driver, "[data-testid='login-submit']")
    esperar(driver).until(
        EC.visibility_of_element_located((By.CSS_SELECTOR, "[data-testid='admin-panel']"))
    )
    esperar(driver).until(
        lambda d: d.find_elements(By.CSS_SELECTOR, "[data-testid='admin-content'] .page-head")
    )
    pausa()


def ir_admin_seccion(driver, seccion: str) -> None:
    click(driver, f"[data-testid='nav-{seccion}']")
    esperar(driver).until(
        EC.presence_of_element_located((By.CSS_SELECTOR, "[data-testid='admin-content'] .page-head"))
    )
    pausa()


def abrir_reserva(driver, mesa: str = "Mesa 1") -> None:
    esperar(driver).until(
        lambda d: d.find_elements(By.CSS_SELECTOR, "[data-testid='mesa-card']")
    )
    xpath = (
        "//article[@data-testid='mesa-card']"
        f"[.//h3[normalize-space()='{mesa}']]"
    )
    try:
        card = driver.find_element(By.XPATH, xpath)
    except Exception:
        raise AssertionError(f"No se encontró la tarjeta de «{mesa}».")
    boton = card.find_element(
        By.CSS_SELECTOR, "button[data-reservar]"
    )
    scroll_a(driver, boton)
    try:
        boton.click()
    except ElementClickInterceptedException:
        driver.execute_script("arguments[0].click();", boton)
    esperar(driver).until(
        EC.visibility_of_element_located((By.CSS_SELECTOR, "#r-form"))
    )
    inyectar_estilos(driver)
    pausa()
    esperar_slots(driver)


def esperar_slots(driver, segundos: int = 18) -> None:
    esperar(driver, segundos).until(
        lambda d: d.find_elements(By.CSS_SELECTOR, "#r-slots [data-testid='reserva-slot']")
        or d.find_elements(By.CSS_SELECTOR, "#r-slots [data-testid='reserva-sin-horarios']")
    )


def seleccionar_fecha(driver, fecha: str) -> None:
    """Selecciona una fecha concreta en el calendario, avanzando de mes si hace falta."""
    for _ in range(6):
        encontrados = driver.find_elements(
            By.CSS_SELECTOR, f"#r-cal [data-testid='reserva-dia'][data-fecha='{fecha}']"
        )
        if encontrados:
            boton = encontrados[0]
            scroll_a(driver, boton)
            if boton.get_attribute("disabled"):
                raise AssertionError(f"La fecha {fecha} está deshabilitada en el calendario.")
            boton.click()
            esperar(driver).until(
                lambda d: d.find_elements(
                    By.CSS_SELECTOR, f"#r-cal [data-fecha='{fecha}'].is-sel"
                )
            )
            esperar_slots(driver)
            pausa()
            return
        click(driver, "[data-testid='reserva-mes-siguiente']")
        pausa()
    raise AssertionError(f"No se pudo seleccionar la fecha {fecha} en el calendario.")


def seleccionar_fecha_futura(driver) -> str:
    """Elige la primera fecha futura habilitada (los lunes están cerrados)."""
    hoy = dt.date.today().isoformat()
    for _ in range(4):
        botones = driver.find_elements(
            By.CSS_SELECTOR, "#r-cal [data-testid='reserva-dia']:not([disabled])"
        )
        candidatos = [
            b for b in botones
            if (b.get_attribute("data-fecha") or "") > hoy
        ]
        if candidatos:
            boton = candidatos[0]
            fecha = boton.get_attribute("data-fecha")
            scroll_a(driver, boton)
            boton.click()
            esperar(driver).until(
                lambda d: d.find_elements(
                    By.CSS_SELECTOR, f"#r-cal [data-fecha='{fecha}'].is-sel"
                )
            )
            esperar_slots(driver)
            pausa()
            return fecha
        click(driver, "[data-testid='reserva-mes-siguiente']")
        pausa()
    raise AssertionError("No se encontró una fecha futura habilitada en el calendario.")


def seleccionar_horario_libre(driver) -> str:
    slots = driver.find_elements(
        By.CSS_SELECTOR,
        "#r-slots button[data-testid='reserva-slot'][data-estado='av']:not([disabled])",
    )
    if not slots:
        raise AssertionError(
            "No hay horarios libres para la mesa y fecha elegidas. "
            "La captura muestra el estado que vio el usuario."
        )
    slot = slots[0]
    hora = slot.get_attribute("data-hora")
    scroll_a(driver, slot)
    slot.click()
    esperar(driver).until(
        lambda d: d.find_element(
            By.CSS_SELECTOR, f"#r-slots [data-hora='{hora}']"
        ).get_attribute("aria-pressed") == "true"
    )
    pausa()
    return hora


def preparar_reserva(driver, mesa: str = "Mesa 1"):
    abrir_reserva(driver, mesa)
    fecha = seleccionar_fecha_futura(driver)
    hora = seleccionar_horario_libre(driver)
    return fecha, hora


def llenar_datos(driver, nombre: str = "Ana Torres", telefono: Optional[str] = None,
                 personas: str = "2") -> None:
    escribir(driver, "#i-nombre", nombre)
    if telefono is not None:
        escribir(driver, "#i-tel", telefono)
    escribir(driver, "#i-personas", str(personas))


def enviar_reserva(driver) -> None:
    click(driver, "[data-testid='reserva-confirmar']")
    pausa(1.0)


def esperar_confirmacion(driver) -> None:
    esperar(driver, 20).until(
        EC.visibility_of_element_located((By.CSS_SELECTOR, "[data-testid='reserva-confirmada']"))
    )
    pausa()


def crear_reserva_exitosa(driver, mesa: str = "Mesa 1", nombre: str = "Ana Torres",
                          telefono: Optional[str] = "300 123 4567",
                          personas: str = "2"):
    fecha, hora = preparar_reserva(driver, mesa)
    llenar_datos(driver, nombre=nombre, telefono=telefono, personas=personas)
    enviar_reserva(driver)
    esperar_confirmacion(driver)
    return fecha, hora


def crear_mesa_admin(driver, nombre: str, capacidad: int = 4,
                     zona: str = "terraza") -> str:
    login_admin(driver)
    ir_admin_seccion(driver, "mesas")
    click(driver, "[data-testid='mesa-nueva']")
    esperar(driver).until(EC.visibility_of_element_located((By.CSS_SELECTOR, "#mesa-form")))
    escribir(driver, "#m-nombre", nombre)
    escribir(driver, "#m-cap", str(capacidad))
    click(driver, f"[data-z='{zona}']")
    click(driver, "[data-testid='mesa-guardar']")
    esperar(driver).until(EC.invisibility_of_element_located((By.ID, "admin-modal")))
    esperar(driver).until(
        lambda d: nombre in d.find_element(
            By.CSS_SELECTOR, "[data-testid='admin-content']"
        ).text
    )
    pausa()
    return texto_de(driver, "[data-testid='admin-content']")


# ---------------------------------------------------------------------------
# Las 30 pruebas
# ---------------------------------------------------------------------------
def t01_pagina_carga(driver):
    reset(driver)
    tarjetas = driver.find_elements(By.CSS_SELECTOR, "[data-testid='mesa-card']")
    assert len(tarjetas) == 4, f"Se esperaban 4 mesas activas y se encontraron {len(tarjetas)}."
    assert "Konys Pizza" in driver.title, f"El título fue «{driver.title}»."
    captura_documentacion(driver, "pagina-principal")
    return f"La página cargó con el título «{driver.title}» y 4 tarjetas de mesas activas."


def t02_estilos_y_scripts(driver):
    reset(driver)
    hojas = driver.execute_script("return document.styleSheets.length")
    fondo = driver.execute_script(
        "return getComputedStyle(document.querySelector('.btn-primary')).backgroundColor"
    )
    scripts = driver.execute_script(
        "return {kui: !!window.KUI, kval: !!window.KVal, db: !!window.DB, modo: window.DB && window.DB.mode}"
    )
    assert hojas > 0, "No se cargó ninguna hoja de estilos."
    assert fondo not in ("", "rgba(0, 0, 0, 0)"), "El encabezado no tiene color de fondo aplicado."
    assert scripts["kui"] and scripts["kval"] and scripts["db"], (
        f"Faltan módulos JavaScript: {scripts}"
    )
    assert scripts["modo"] == "demo", f"DB.mode fue «{scripts['modo']}», se esperaba demo."
    return (
        f"{hojas} hoja(s) de estilos, encabezado con fondo {fondo}, "
        "KUI/KVal/DB cargados y DB.mode = demo."
    )


def t03_carta_y_modo_demo(driver):
    reset(driver)
    platos = driver.find_elements(By.CSS_SELECTOR, "[data-testid='carta-card']")
    assert len(platos) == 8, f"Se esperaban 8 platos y se encontraron {len(platos)}."
    badge = texto_de(driver, ".demo-badge")
    assert "Modo demo" in badge, f"No aparece la etiqueta de modo demo: «{badge}»."
    return f"Se renderizaron {len(platos)} platos y la etiqueta «{badge.splitlines()[0]}»."


def t04_grid_escritorio(driver):
    driver.set_window_size(1440, 900)
    reset(driver)
    columnas = driver.execute_script(
        "return getComputedStyle(document.querySelector('#mesas-grid')).gridTemplateColumns"
    )
    assert len(columnas.split()) == 4, f"En escritorio la cuadrícula tiene «{columnas}»."
    return f"En 1440 px la cuadrícula de mesas se distribuyó en 4 columnas ({columnas})."


def t05_filtro_terraza(driver):
    reset(driver)
    click(driver, "[data-testid='zona-terraza']")
    esperar(driver).until(
        lambda d: len(d.find_elements(By.CSS_SELECTOR, "[data-testid='mesa-card']")) == 2
    )
    tarjetas = driver.find_elements(By.CSS_SELECTOR, "[data-testid='mesa-card']")
    zonas = [t.find_element(By.CSS_SELECTOR, ".meta").text for t in tarjetas]
    assert len(tarjetas) == 2, f"Se esperaban 2 mesas de terraza y hay {len(tarjetas)}."
    assert all("Terraza" in z for z in zonas), f"Alguna tarjeta no es de terraza: {zonas}"
    scroll_a(driver, "#mesas")
    captura_documentacion(driver, "mesas")
    return f"El filtro Terraza mostró {len(tarjetas)} mesas y todas indican zona Terraza."


def t06_filtro_salon(driver):
    reset(driver)
    click(driver, "[data-testid='zona-salon']")
    esperar(driver).until(
        lambda d: len(d.find_elements(By.CSS_SELECTOR, "[data-testid='mesa-card']")) == 2
    )
    tarjetas = driver.find_elements(By.CSS_SELECTOR, "[data-testid='mesa-card']")
    zonas = [t.find_element(By.CSS_SELECTOR, ".meta").text for t in tarjetas]
    assert len(tarjetas) == 2, f"Se esperaban 2 mesas de salón y hay {len(tarjetas)}."
    assert all("Salón" in z for z in zonas), f"Alguna tarjeta no es de salón: {zonas}"
    return f"El filtro Salón mostró {len(tarjetas)} mesas y todas indican zona Salón."


def t07_mesas_inactivas(driver):
    reset(driver)
    nombres = [
        t.find_element(By.CSS_SELECTOR, "h3").text.strip()
        for t in driver.find_elements(By.CSS_SELECTOR, "[data-testid='mesa-card']")
    ]
    assert nombres == ["Mesa 1", "Mesa 2", "Mesa 3", "Mesa 4"], f"Mesas visibles: {nombres}"
    assert "Mesa 5" not in nombres, "La mesa inactiva Mesa 5 no debería mostrarse."
    return f"Se mostraron solo las mesas activas: {', '.join(nombres)}; Mesa 5 quedó oculta."


def t08_filtro_pizzas(driver):
    reset(driver)
    click(driver, "[data-testid='cat-pizzas']")
    esperar(driver).until(
        lambda d: len(d.find_elements(By.CSS_SELECTOR, "[data-testid='carta-card']")) == 4
    )
    tarjetas = driver.find_elements(By.CSS_SELECTOR, "[data-testid='carta-card']")
    etiquetas = [t.find_element(By.CSS_SELECTOR, ".tag").text for t in tarjetas]
    assert len(tarjetas) == 4, f"Se esperaban 4 pizzas y hay {len(tarjetas)}."
    assert all(e == "Pizzas" for e in etiquetas), f"Etiquetas: {etiquetas}"
    return f"La categoría Pizzas mostró {len(tarjetas)} platos, todos con etiqueta Pizzas."


def t09_filtro_bebidas(driver):
    reset(driver)
    click(driver, "[data-testid='cat-bebidas']")
    esperar(driver).until(
        lambda d: len(d.find_elements(By.CSS_SELECTOR, "[data-testid='carta-card']")) == 2
    )
    tarjetas = driver.find_elements(By.CSS_SELECTOR, "[data-testid='carta-card']")
    nombres = [t.find_element(By.CSS_SELECTOR, "h3").text for t in tarjetas]
    assert len(tarjetas) == 2, f"Se esperaban 2 bebidas y hay {len(tarjetas)}."
    assert all("Limonada" in n or "Gaseosa" in n for n in nombres), f"Bebidas: {nombres}"
    return f"La categoría Bebidas mostró {len(tarjetas)} platos: {', '.join(nombres)}."


def t10_precio_cop(driver):
    reset(driver)
    tarjetas = driver.find_elements(By.CSS_SELECTOR, "[data-testid='carta-card']")
    especial = None
    for t in tarjetas:
        if t.find_element(By.CSS_SELECTOR, "h3").text.strip() == "Pizza Konys Especial":
            especial = t
            break
    assert especial is not None, "No se encontró la Pizza Konys Especial."
    contenido = especial.text
    assert "$34.000" in contenido, f"El precio no se formateó en COP: «{contenido}»."
    assert "Pizzas" in contenido, f"No aparece la categoría del plato: «{contenido}»."
    scroll_a(driver, "#carta")
    captura_documentacion(driver, "carta")
    return f"La Pizza Konys Especial muestra la categoría Pizzas y el precio $34.000 en formato COP."


def t11_reserva_vacia(driver):
    abrir_reserva(driver)
    enviar_reserva(driver)
    esperar(driver).until(EC.visibility_of_element_located((By.CSS_SELECTOR, "#h-nombre")))
    nombre = texto_de(driver, "#h-nombre")
    personas = texto_de(driver, "#h-personas")
    hora = texto_de(driver, "#reserva-hora-error")
    alerta = texto_de(driver, "#r-form-alert")
    assert "Ingresa tu nombre completo" in nombre, f"Error de nombre: «{nombre}»"
    assert "Indica cuántas personas" in personas, f"Error de personas: «{personas}»"
    assert "Selecciona un horario" in hora, f"Error de hora: «{hora}»"
    assert "Revisa los campos" in alerta, f"Aviso general: «{alerta}»"
    assert not driver.find_element(By.ID, "vista-confirmacion").is_displayed()
    captura_documentacion(driver, "validaciones")
    return (
        "Se mostraron los errores de nombre, personas y hora, además del aviso general "
        "«Revisa los campos marcados», sin registrar la reserva."
    )


def t12_nombre_con_numeros(driver):
    preparar_reserva(driver)
    llenar_datos(driver, nombre="Ana 123", personas="2")
    enviar_reserva(driver)
    esperar(driver).until(
        lambda d: "Usa solo letras" in texto_de(d, "#h-nombre")
    )
    assert not driver.find_element(By.ID, "vista-confirmacion").is_displayed()
    return f"El nombre «Ana 123» fue rechazado con el mensaje «{texto_de(driver, '#h-nombre')}»."


def t13_nombre_corto(driver):
    preparar_reserva(driver)
    llenar_datos(driver, nombre="Al", personas="2")
    enviar_reserva(driver)
    esperar(driver).until(
        lambda d: "al menos 3 letras" in texto_de(d, "#h-nombre")
    )
    return f"El nombre «Al» fue rechazado con el mensaje «{texto_de(driver, '#h-nombre')}»."


def t14_telefono_incompleto(driver):
    preparar_reserva(driver)
    llenar_datos(driver, nombre="Ana Torres", telefono="300 12", personas="2")
    enviar_reserva(driver)
    esperar(driver).until(
        lambda d: "10 dígitos" in texto_de(d, "#h-tel")
    )
    assert not driver.find_element(By.ID, "vista-confirmacion").is_displayed()
    return f"El teléfono «300 12» fue rechazado con el mensaje «{texto_de(driver, '#h-tel')}»."


def t15_personas_cero(driver):
    preparar_reserva(driver)
    llenar_datos(driver, nombre="Ana Torres", personas="0")
    enviar_reserva(driver)
    esperar(driver).until(
        lambda d: "Indica cuántas personas" in texto_de(d, "#h-personas")
    )
    return f"Con 0 personas apareció el mensaje «{texto_de(driver, '#h-personas')}»."


def t16_capacidad_excedida(driver):
    abrir_reserva(driver, "Mesa 1")
    seleccionar_fecha_futura(driver)
    seleccionar_horario_libre(driver)
    llenar_datos(driver, nombre="Ana Torres", personas="3")
    esperar(driver).until(
        EC.visibility_of_element_located((By.CSS_SELECTOR, "[data-testid='reserva-capacidad']"))
    )
    alerta = texto_de(driver, "[data-testid='reserva-capacidad']")
    ayuda = texto_de(driver, "#h-personas")
    assert "¿Son más de 2?" in alerta, f"Alerta de capacidad: «{alerta}»"
    assert "máximo 2 personas" in ayuda, f"Ayuda de personas: «{ayuda}»"
    captura_documentacion(driver, "reserva")
    enviar_reserva(driver)
    assert not driver.find_element(By.ID, "vista-confirmacion").is_displayed(), (
        "La reserva no debería confirmarse cuando se excede la capacidad."
    )
    return "Mesa 1 (capacidad 2) mostró la alerta «¿Son más de 2?» y no permitió confirmar con 3 personas."


def t17_telefono_con_espacios(driver):
    preparar_reserva(driver)
    escribir(driver, "#i-nombre", "Ana Torres")
    escribir(driver, "#i-tel", "300 123 4567")
    escribir(driver, "#i-personas", "2")
    valor = driver.find_element(By.ID, "i-tel").get_attribute("value")
    assert valor == "300 123 4567", f"El teléfono quedó como «{valor}»."
    enviar_reserva(driver)
    esperar_confirmacion(driver)
    return f"El teléfono con espacios se normalizó a «{valor}» y la reserva se confirmó."


def t18_error_desaparece(driver):
    abrir_reserva(driver)
    nombre = escribir(driver, "#i-nombre", "Ana 123")
    driver.execute_script("arguments[0].blur();", nombre)
    esperar(driver).until(
        lambda d: "Usa solo letras" in texto_de(d, "#h-nombre")
    )
    escribir(driver, "#i-nombre", "Ana Torres")
    esperar(driver, 5).until(
        EC.invisibility_of_element_located((By.CSS_SELECTOR, "#h-nombre"))
    )
    return "El error apareció al salir del campo y desapareció al escribir un nombre válido."


def t19_stepper_personas(driver):
    abrir_reserva(driver)
    click(driver, "[data-testid='reserva-personas-mas']")
    click(driver, "[data-testid='reserva-personas-mas']")
    valor = driver.find_element(By.ID, "i-personas").get_attribute("value")
    assert valor == "2", f"Después de dos clics en + el valor fue «{valor}»."
    click(driver, "[data-testid='reserva-personas-menos']")
    valor = driver.find_element(By.ID, "i-personas").get_attribute("value")
    assert valor == "1", f"Después del clic en - el valor fue «{valor}»."
    return "Los botones + y - ajustaron el número de personas a 2 y luego a 1."


def t20_cerrar_con_esc(driver):
    abrir_reserva(driver)
    driver.find_element(By.ID, "i-nombre").send_keys(Keys.ESCAPE)
    esperar(driver, 8).until(
        EC.invisibility_of_element_located((By.ID, "reserva-modal"))
    )
    return "El modal de reserva se cerró al pulsar Esc."


def t21_reserva_exitosa(driver):
    fecha, hora = crear_reserva_exitosa(driver)
    codigo = texto_de(driver, "[data-testid='reserva-codigo']")
    assert re.fullmatch(r"KNY-\d{4}-\d{4}", codigo), f"Código inesperado: «{codigo}»"
    captura_documentacion(driver, "confirmacion")
    return f"La reserva para {fecha} a las {hora} se confirmó con el código {codigo}."


def t22_resumen_confirmacion(driver):
    fecha, hora = crear_reserva_exitosa(driver, nombre="Laura Gómez", personas="2")
    detalle = texto_de(driver, ".detail-grid")
    assert "Laura Gómez" in detalle, f"No aparece el cliente: «{detalle}»"
    assert "Mesa 1" in detalle, f"No aparece la mesa: «{detalle}»"
    assert "2 personas" in detalle, f"No aparece el número de personas: «{detalle}»"
    assert "Terraza" in detalle, f"No aparece la zona: «{detalle}»"
    return (
        f"El resumen mostró cliente Laura Gómez, Mesa 1, zona Terraza, 2 personas, "
        f"fecha {fecha} y hora {hora}."
    )


def t23_volver_al_inicio(driver):
    crear_reserva_exitosa(driver)
    click(driver, "[data-testid='reserva-volver']")
    esperar(driver).until(
        EC.visibility_of_element_located((By.ID, "vista-inicio"))
    )
    assert not driver.find_element(By.ID, "vista-confirmacion").is_displayed()
    return "El botón «Volver al inicio» ocultó la confirmación y restauró la página principal."


def t24_doble_reserva(driver):
    fecha, hora = crear_reserva_exitosa(driver)
    click(driver, "[data-testid='reserva-volver']")
    esperar(driver).until(EC.visibility_of_element_located((By.ID, "vista-inicio")))
    abrir_reserva(driver, "Mesa 1")
    seleccionar_fecha(driver, fecha)
    slot = driver.find_element(By.CSS_SELECTOR, f"#r-slots [data-hora='{hora}']")
    estado = slot.get_attribute("data-estado")
    assert estado == "oc", (
        f"El horario {hora} del {fecha} figura como «{estado}» después de reservarlo; "
        "se esperaba ocupado («oc»)."
    )
    return f"Al reabrir Mesa 1 el {fecha}, el horario {hora} apareció ocupado y no se pudo volver a elegir."


def t25_html_escapado(driver):
    crear_mesa_admin(driver, "<b>Mesa QA</b>", capacidad=4, zona="terraza")
    driver.get(BASE_URL)
    esperar(driver).until(
        lambda d: d.find_elements(By.CSS_SELECTOR, "[data-testid='mesa-card']")
    )
    tarjetas = driver.find_elements(By.CSS_SELECTOR, "[data-testid='mesa-card']")
    encontrada = None
    for t in tarjetas:
        if t.find_element(By.CSS_SELECTOR, "h3").text.strip() == "<b>Mesa QA</b>":
            encontrada = t
            break
    assert encontrada is not None, (
        f"La mesa con HTML no apareció como texto. Mesas: "
        f"{[t.find_element(By.CSS_SELECTOR, 'h3').text for t in tarjetas]}"
    )
    h3 = encontrada.find_element(By.CSS_SELECTOR, "h3")
    assert not h3.find_elements(By.TAG_NAME, "b"), "El HTML del nombre se interpretó como etiqueta <b>."
    assert "<b>Mesa QA</b>" not in driver.page_source, (
        "El HTML del nombre aparece sin escapar en el código fuente."
    )
    assert "&lt;b&gt;Mesa QA&lt;/b&gt;" in driver.page_source, (
        "El nombre no aparece escapado en el código fuente."
    )
    return (
        "La mesa llamada «<b>Mesa QA</b>» se mostró como texto literal; el HTML no se "
        "interpretó ni ejecutó en la página pública."
    )


def t26_movil(driver):
    driver.set_window_size(375, 812)
    reset(driver, movil=True)
    columnas = driver.execute_script(
        "return getComputedStyle(document.querySelector('#mesas-grid')).gridTemplateColumns"
    )
    assert len(columnas.split()) == 1, f"En móvil la cuadrícula tiene «{columnas}»."
    menu = driver.find_element(By.ID, "menu-open")
    assert menu.is_displayed(), "El botón de menú hamburguesa no está visible en móvil."
    menu.click()
    esperar(driver).until(EC.visibility_of_element_located((By.ID, "mobile-menu")))
    click(driver, "#menu-close")
    esperar(driver).until(EC.invisibility_of_element_located((By.ID, "mobile-menu")))
    scroll_a(driver, "#mesas")
    captura_documentacion(driver, "celular")
    return "En 375 px la cuadrícula pasó a 1 columna y el menú hamburguesa abrió y cerró correctamente."


def t27_admin_password_incorrecta(driver):
    abrir_admin(driver)
    escribir(driver, "[data-testid='login-password']", "clave-incorrecta")
    click(driver, "[data-testid='login-submit']")
    esperar(driver).until(
        EC.visibility_of_element_located((By.CSS_SELECTOR, "[data-testid='login-error']"))
    )
    error = texto_de(driver, "[data-testid='login-error']")
    assert "Contraseña incorrecta" in error, f"Aviso mostrado: «{error}»"
    assert driver.find_element(By.ID, "login").is_displayed()
    assert not driver.find_element(By.ID, "shell").is_displayed()
    return "La contraseña incorrecta mostró el aviso «Contraseña incorrecta» y no abrió el panel."


def t28_admin_login(driver):
    login_admin(driver)
    assert not driver.find_element(By.ID, "login").is_displayed()
    assert driver.find_element(By.ID, "shell").is_displayed()
    crumb = texto_de(driver, "#crumb")
    navs = driver.find_elements(By.CSS_SELECTOR, ".side-nav .side-item")
    assert crumb == "Resumen", f"La sección inicial fue «{crumb}»."
    assert len(navs) == 5, f"Se esperaban 5 secciones y hay {len(navs)}."
    captura_documentacion(driver, "admin")
    return f"El panel abrió en la sección «{crumb}» con {len(navs)} secciones de gestión."


def t29_admin_crear_mesa(driver):
    contenido = crear_mesa_admin(driver, "Mesa QA", capacidad=5, zona="salon")
    assert "Mesa QA" in contenido, "La mesa creada no aparece en la tabla del panel."
    assert "5 personas" in contenido, "La capacidad de la mesa creada no aparece en la tabla."
    assert "Salón" in contenido, "La zona de la mesa creada no aparece en la tabla."
    return "El panel creó la «Mesa QA» de 5 personas en Salón y la fila apareció en la tabla."


def t30_admin_carta_ocultar(driver):
    login_admin(driver)
    ir_admin_seccion(driver, "carta")
    driver.execute_script("""
        const i = document.querySelector('[data-testid="plato-buscar"]');
        i.value = 'Pizza';
        i.dispatchEvent(new Event('input', { bubbles: true }));
    """)
    esperar(driver).until(
        lambda d: len(d.find_elements(By.CSS_SELECTOR, "[data-testid='platos-list'] tbody tr")) == 2
    )
    fila = None
    for tr in driver.find_elements(By.CSS_SELECTOR, "[data-testid='platos-list'] tbody tr"):
        if "Pizza Konys Especial" in tr.text:
            fila = tr
            break
    assert fila is not None, "No se encontró Pizza Konys Especial al buscar «Pizza»."
    fila.find_element(By.CSS_SELECTOR, "button[data-ph]").click()
    esperar(driver).until(
        lambda d: any(
            "Pizza Konys Especial" in tr.text and "No disponible" in tr.text
            for tr in d.find_elements(By.CSS_SELECTOR, "[data-testid='platos-list'] tbody tr")
        )
    )
    driver.get(BASE_URL)
    esperar(driver).until(
        lambda d: d.find_elements(By.CSS_SELECTOR, "[data-testid='carta-card']")
    )
    click(driver, "[data-testid='cat-pizzas']")
    esperar(driver).until(
        lambda d: len(d.find_elements(By.CSS_SELECTOR, "[data-testid='carta-card']")) == 3
    )
    nombres = [
        t.find_element(By.CSS_SELECTOR, "h3").text
        for t in driver.find_elements(By.CSS_SELECTOR, "[data-testid='carta-card']")
    ]
    assert "Pizza Konys Especial" not in nombres, (
        f"El plato oculto sigue visible para el cliente: {nombres}"
    )
    return (
        "El panel buscó «Pizza», ocultó Pizza Konys Especial y la carta pública pasó de "
        "4 a 3 pizzas, sin mostrar el plato oculto."
    )


def construir_pruebas() -> list[Prueba]:
    definiciones = [
        ("Carga", "La página principal carga", "Debe abrirse la página con 4 mesas activas y el título de Konys Pizza.", t01_pagina_carga),
        ("Carga", "Estilos y scripts disponibles", "Deben cargarse el CSS, KUI, KVal y DB, y la app debe estar en modo demo.", t02_estilos_y_scripts),
        ("Carga", "Carta y etiqueta de modo demo", "Deben mostrarse los 8 platos y la etiqueta «Modo demo».", t03_carta_y_modo_demo),
        ("Carga", "Cuadrícula de escritorio", "En 1440 px las mesas deben distribuirse en 4 columnas.", t04_grid_escritorio),
        ("Mesas", "Filtro Terraza", "Al filtrar Terraza deben quedar 2 mesas, todas de esa zona.", t05_filtro_terraza),
        ("Mesas", "Filtro Salón", "Al filtrar Salón deben quedar 2 mesas, todas de esa zona.", t06_filtro_salon),
        ("Mesas", "Mesas inactivas ocultas", "Solo deben verse las mesas activas (1 a 4), nunca la Mesa 5.", t07_mesas_inactivas),
        ("Carta", "Filtro Pizzas", "La categoría Pizzas debe mostrar 4 platos con su etiqueta.", t08_filtro_pizzas),
        ("Carta", "Filtro Bebidas", "La categoría Bebidas debe mostrar Limonada y Gaseosa.", t09_filtro_bebidas),
        ("Carta", "Precio en pesos colombianos", "La Pizza Konys Especial debe mostrar categoría y precio $34.000.", t10_precio_cop),
        ("Validaciones", "Reserva con campos vacíos", "Deben aparecer errores de nombre, personas y hora, sin registrar.", t11_reserva_vacia),
        ("Validaciones", "Nombre con números", "El nombre «Ana 123» debe rechazarse por usar solo letras y espacios.", t12_nombre_con_numeros),
        ("Validaciones", "Nombre demasiado corto", "El nombre «Al» debe rechazarse por tener menos de 3 letras.", t13_nombre_corto),
        ("Validaciones", "Teléfono incompleto", "El teléfono «300 12» debe rechazarse por no tener 10 dígitos.", t14_telefono_incompleto),
        ("Validaciones", "Cero personas", "No debe permitirse una reserva con 0 personas.", t15_personas_cero),
        ("Validaciones", "Capacidad excedida", "Mesa 1 (capacidad 2) debe bloquear una reserva de 3 personas.", t16_capacidad_excedida),
        ("Comportamiento", "Teléfono con espacios", "«300 123 4567» debe aceptarse y normalizarse, permitiendo confirmar.", t17_telefono_con_espacios),
        ("Comportamiento", "El error desaparece al corregir", "Al corregir el nombre, el mensaje de error debe ocultarse.", t18_error_desaparece),
        ("Comportamiento", "Botones + y - de personas", "Los botones deben aumentar y disminuir el número de personas.", t19_stepper_personas),
        ("Comportamiento", "Cerrar el modal con Esc", "El modal de reserva debe cerrarse al pulsar Esc.", t20_cerrar_con_esc),
        ("Registro", "Reserva exitosa", "Una reserva válida debe confirmarse con un código KNY-AAAA-NNNN.", t21_reserva_exitosa),
        ("Registro", "Resumen de la confirmación", "El resumen debe mostrar cliente, mesa, zona, personas, fecha y hora.", t22_resumen_confirmacion),
        ("Registro", "Volver al inicio", "El botón debe ocultar la confirmación y restaurar la página.", t23_volver_al_inicio),
        ("Registro", "Prevención de doble reserva", "El horario reservado debe quedar ocupado al reabrir la mesa.", t24_doble_reserva),
        ("Seguridad", "HTML mostrado como texto", "Un nombre de mesa con HTML debe mostrarse escapado, no ejecutarse.", t25_html_escapado),
        ("Celular", "Diseño a 375 px", "La cuadrícula debe pasar a 1 columna y el menú hamburguesa debe funcionar.", t26_movil),
        ("Administración", "Contraseña incorrecta", "El panel debe rechazar la contraseña y mantenerse en el login.", t27_admin_password_incorrecta),
        ("Administración", "Acceso al panel", "La contraseña correcta debe abrir el Resumen con sus 5 secciones.", t28_admin_login),
        ("Administración", "Crear una mesa", "El panel debe crear una mesa y mostrarla en la tabla.", t29_admin_crear_mesa),
        ("Administración", "Buscar y ocultar un plato", "El plato oculto debe desaparecer de la carta pública.", t30_admin_carta_ocultar),
    ]
    return [
        Prueba(i, grupo, nombre, esperado, funcion)
        for i, (grupo, nombre, esperado, funcion) in enumerate(definiciones, 1)
    ]


# ---------------------------------------------------------------------------
# Ejecución y reporte
# ---------------------------------------------------------------------------
def ejecutar_pruebas(driver) -> tuple[list[Prueba], bool, str]:
    pruebas = construir_pruebas()
    total = len(pruebas)
    CARPETA_CAPTURAS.mkdir(parents=True, exist_ok=True)
    incompleta = False
    motivo = ""

    for indice, prueba in enumerate(pruebas, 1):
        log(f"[{indice:02d}/{total}] {prueba.grupo} · {prueba.nombre}")
        inicio = time.time()
        try:
            # Cada prueba arranca desde la página principal y con el modo demo limpio.
            # Así una prueba no depende del estado que dejó la anterior.
            reset(driver)
            obtenido = prueba.funcion(driver)
            prueba.estado = "Aprobada"
            prueba.obtenido = obtenido or "La comprobación se cumplió."
        except Omitida as exc:
            prueba.estado = "Omitida"
            prueba.obtenido = str(exc)
        except AssertionError as exc:
            prueba.estado = "Fallida"
            prueba.obtenido = str(exc) or "La comprobación no se cumplió."
        except (TimeoutException, NoSuchElementException, StaleElementReferenceException,
                ElementClickInterceptedException, ElementNotInteractableException) as exc:
            prueba.estado = "Fallida"
            prueba.obtenido = (
                "La prueba no pudo completar una interacción con la página: "
                f"{type(exc).__name__}: {exc}".strip()
            )
        except WebDriverException as exc:
            prueba.estado = "Fallida"
            prueba.obtenido = f"El navegador dejó de responder: {type(exc).__name__}: {exc}"
            incompleta = True
            motivo = "La ventana del navegador se cerró o dejó de responder durante la ejecución."
            traceback.print_exc()
        except Exception as exc:  # noqa: BLE001
            prueba.estado = "Fallida"
            prueba.obtenido = f"Error inesperado: {type(exc).__name__}: {exc}"
            traceback.print_exc()

        prueba.duracion = time.time() - inicio
        if prueba.estado != "Omitida" or prueba.obtenido:
            mostrar_cartel(driver, indice, total, prueba.nombre, prueba.estado)
            ruta_captura = CARPETA_CAPTURAS / f"{indice:02d}_{slug(prueba.nombre)}.png"
            try:
                driver.save_screenshot(str(ruta_captura))
                prueba.captura = str(ruta_captura)
            except Exception as exc:  # noqa: BLE001
                log(f"      (aviso) captura no disponible: {exc}")
        log(f"      -> {prueba.estado} ({prueba.duracion:.1f} s)")

        if incompleta:
            for pendiente in pruebas[indice:]:
                pendiente.estado = "Omitida"
                pendiente.obtenido = "No se ejecutó porque el navegador se cerró durante la prueba anterior."
                pendiente.duracion = 0.0
            break

    return pruebas, incompleta, motivo


def recolectar_entorno(driver, navegador: str, duracion_total: float, url: str) -> dict:
    try:
        caps = driver.capabilities or {}
    except Exception:
        caps = {}
    try:
        tam = driver.get_window_size()
        resolucion = f"{tam.get('width', '?')} × {tam.get('height', '?')} px"
    except Exception:
        resolucion = "No disponible"
    bruto = str(caps.get("browserName", navegador))
    if "edge" in bruto.lower():
        nombre = "Microsoft Edge"
    elif "chrome" in bruto.lower():
        nombre = "Google Chrome"
    elif "firefox" in bruto.lower():
        nombre = "Mozilla Firefox"
    else:
        nombre = bruto.title()
    version = caps.get("browserVersion", "desconocida")
    try:
        import selenium
        version_selenium = selenium.__version__
    except Exception:
        version_selenium = "desconocida"
    return {
        "Navegador": f"{nombre} {version}",
        "Selenium WebDriver": version_selenium,
        "Python": platform.python_version(),
        "Sistema operativo": platform.platform(),
        "Resolución": resolucion,
        "Modo de ejecución": "Oculto (headless)" if OCULTO else "Visible",
        "Velocidad": "Rápida, sin pausas" if RAPIDO else "Normal, con pausas",
        "Fecha y hora": EJECUCION.strftime("%d/%m/%Y %H:%M:%S"),
        "Duración total": f"{duracion_total:.1f} s",
        "Servidor local": url,
        "Datos": "Modo demo (localStorage), sin Supabase ni internet",
    }


def main(argv=None) -> int:
    global BASE_URL, RAPIDO, OCULTO, NAVEGADOR_PEDIDO, PAUSA, VELOCIDAD_TECLEO

    parser = argparse.ArgumentParser(
        description="Ejecuta las 30 pruebas Selenium de Konys Pizza y genera el PDF."
    )
    parser.add_argument("--rapido", action="store_true", help="Sin pausas ni efecto de tecleo.")
    parser.add_argument("--oculto", action="store_true", help="Ejecuta el navegador sin ventana.")
    parser.add_argument("--sin-abrir", action="store_true", help="No abre el PDF al terminar.")
    parser.add_argument(
        "--navegador", choices=["auto", "chrome", "edge"], default="auto",
        help="Navegador a usar. Por defecto intenta Chrome y luego Edge.",
    )
    args = parser.parse_args(argv)

    RAPIDO = args.rapido
    OCULTO = args.oculto
    NAVEGADOR_PEDIDO = args.navegador
    if RAPIDO:
        PAUSA = 0.0
        VELOCIDAD_TECLEO = 0.0

    REPORTES_DIR.mkdir(parents=True, exist_ok=True)
    CARPETA_CAPTURAS.mkdir(parents=True, exist_ok=True)

    httpd = None
    driver = None
    resultados: list[Prueba] = []
    incompleta = False
    motivo = ""
    entorno = {}
    inicio = time.time()
    codigo_salida = 0

    try:
        httpd, BASE_URL = iniciar_servidor()
        log("=" * 78)
        log("Konys Pizza · Pruebas automáticas con Selenium")
        log(f"Servidor local: {BASE_URL}")
        log("=" * 78)
        driver, navegador = crear_driver()
        log(f"Navegador: {navegador} · modo {'oculto' if OCULTO else 'visible'}")
        driver.get(BASE_URL)
        resultados, incompleta, motivo = ejecutar_pruebas(driver)
        duracion_total = time.time() - inicio
        entorno = recolectar_entorno(driver, navegador, duracion_total, BASE_URL)
    except Exception as exc:  # noqa: BLE001
        log("\nNo se pudo completar la ejecución:")
        log(f"{type(exc).__name__}: {exc}")
        traceback.print_exc()
        incompleta = True
        motivo = f"No se pudo iniciar la ejecución: {type(exc).__name__}: {exc}"
        duracion_total = time.time() - inicio
        if not resultados:
            resultados = construir_pruebas()
            for p in resultados:
                p.estado = "Omitida"
                p.obtenido = "No se ejecutó porque no fue posible iniciar el navegador."
        if not entorno:
            entorno = {
                "Navegador": "No disponible",
                "Selenium WebDriver": "No disponible",
                "Python": platform.python_version(),
                "Sistema operativo": platform.platform(),
                "Fecha y hora": EJECUCION.strftime("%d/%m/%Y %H:%M:%S"),
                "Duración total": f"{duracion_total:.1f} s",
                "Datos": "No fue posible iniciar el navegador.",
            }
        codigo_salida = 2
    finally:
        if driver is not None:
            try:
                driver.quit()
            except Exception:
                pass
        if httpd is not None:
            try:
                httpd.shutdown()
                httpd.server_close()
            except Exception:
                pass

    if not resultados:
        return codigo_salida or 2

    total = len(resultados)
    aprobadas = sum(1 for p in resultados if p.estado == "Aprobada")
    fallidas = sum(1 for p in resultados if p.estado == "Fallida")
    omitidas = sum(1 for p in resultados if p.estado == "Omitida")
    duracion_total = time.time() - inicio

    if incompleta:
        resultado_general = "INCOMPLETA"
        detalle_general = motivo or "La ejecución no terminó todas las pruebas."
    elif fallidas:
        resultado_general = "CON FALLOS"
        detalle_general = (
            f"{fallidas} de {total} pruebas fallaron. Revisa el detalle para ver "
            "qué se esperaba y qué se obtuvo en cada caso."
        )
    else:
        resultado_general = "APROBADA"
        detalle_general = (
            f"Las {total} pruebas finalizaron correctamente. "
            f"{aprobadas} aprobadas y {omitidas} omitidas."
        )

    nombre_pdf = REPORTES_DIR / f"reporte_pruebas_{EJECUCION:%Y-%m-%d_%H-%M-%S}.pdf"
    try:
        from reporte_pdf import abrir_pdf, generar_reporte_pdf
        ruta_pdf = generar_reporte_pdf(
            nombre_pdf, resultados, entorno, EJECUCION,
            duracion_total, resultado_general, detalle_general,
        )
        log("\n" + "=" * 78)
        log(f"Reporte PDF: {ruta_pdf}")
        log(f"Capturas:    {CARPETA_CAPTURAS}")
        log(f"Resultado:   {aprobadas} aprobadas · {fallidas} fallidas · {omitidas} omitidas")
        log("=" * 78)
        # Imagen de portada para el README (opcional: solo si PyMuPDF está instalado).
        try:
            try:
                import pymupdf as fitz  # type: ignore
            except ImportError:
                import fitz  # type: ignore
            documento = fitz.open(ruta_pdf)
            pagina = documento[0]
            pix = pagina.get_pixmap(dpi=110)
            DOCS_CAPTURAS.mkdir(parents=True, exist_ok=True)
            pix.save(str(DOCS_CAPTURAS / "reporte.png"))
        except Exception:
            pass
        if not args.sin_abrir:
            abrir_pdf(ruta_pdf)
    except Exception as exc:  # noqa: BLE001
        log(f"No se pudo generar el PDF: {type(exc).__name__}: {exc}")
        traceback.print_exc()
        codigo_salida = codigo_salida or 3

    if fallidas or incompleta:
        codigo_salida = codigo_salida or 1
    return codigo_salida


if __name__ == "__main__":
    sys.exit(main())
