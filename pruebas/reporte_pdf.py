# -*- coding: utf-8 -*-
"""Genera el reporte PDF de las pruebas automáticas de Konys Pizza.

El reporte tiene tres partes, igual que el ejemplo del curso:
  1. Portada con el resultado general, los totales y el entorno de ejecución.
  2. Tabla resumen con las 30 pruebas, su resultado y su tiempo.
  3. Una página por prueba con lo esperado, lo obtenido y la captura.

No depende de las pruebas: recibe una lista de objetos con los atributos
id, grupo, nombre, esperado, estado, obtenido, duracion y captura.
"""

from __future__ import annotations

import datetime as dt
import os
import platform
import sys
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    Image,
    KeepTogether,
    NextPageTemplate,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

# ---------------------------------------------------------------------------
# Paleta y medidas
# ---------------------------------------------------------------------------
WINE = colors.HexColor("#641C23")
WINE_DARK = colors.HexColor("#4A1218")
ORANGE = colors.HexColor("#F28C28")
CREAM = colors.HexColor("#FFF8F0")
GREEN = colors.HexColor("#16A34A")
GREEN_BG = colors.HexColor("#E8F7EE")
RED = colors.HexColor("#DC2626")
RED_BG = colors.HexColor("#FDECEC")
AMBER = colors.HexColor("#D97706")
AMBER_BG = colors.HexColor("#FFF7E6")
GRAY_900 = colors.HexColor("#111827")
GRAY_700 = colors.HexColor("#374151")
GRAY_500 = colors.HexColor("#6B7280")
GRAY_400 = colors.HexColor("#9CA3AF")
GRAY_200 = colors.HexColor("#E5E7EB")
GRAY_100 = colors.HexColor("#F3F4F6")
WHITE = colors.white

PAGE_W, PAGE_H = A4
MARGIN_X = 42
MARGIN_TOP = 54
MARGIN_BOTTOM = 42
CONTENT_W = PAGE_W - 2 * MARGIN_X

# ---------------------------------------------------------------------------
# Estilos
# ---------------------------------------------------------------------------
BASE = getSampleStyleSheet()

STYLE_H1 = ParagraphStyle(
    "KonysH1", parent=BASE["Heading1"], fontName="Helvetica-Bold",
    fontSize=19, leading=23, textColor=WINE, spaceAfter=6,
)
STYLE_H2 = ParagraphStyle(
    "KonysH2", parent=BASE["Heading2"], fontName="Helvetica-Bold",
    fontSize=14.5, leading=18, textColor=WINE_DARK, spaceAfter=4,
)
STYLE_H3 = ParagraphStyle(
    "KonysH3", parent=BASE["Heading3"], fontName="Helvetica-Bold",
    fontSize=11.5, leading=15, textColor=GRAY_900, spaceAfter=3,
)
STYLE_BODY = ParagraphStyle(
    "KonysBody", parent=BASE["BodyText"], fontName="Helvetica",
    fontSize=9.5, leading=13.5, textColor=GRAY_700, spaceAfter=4,
)
STYLE_BODY_SM = ParagraphStyle(
    "KonysBodySm", parent=STYLE_BODY, fontSize=8.4, leading=11.5,
)
STYLE_LABEL = ParagraphStyle(
    "KonysLabel", parent=STYLE_BODY, fontName="Helvetica-Bold",
    fontSize=8.5, leading=11, textColor=GRAY_500, spaceBefore=5, spaceAfter=2,
)
STYLE_CAPTION = ParagraphStyle(
    "KonysCaption", parent=STYLE_BODY, fontSize=8, leading=10.5,
    textColor=GRAY_500, alignment=TA_CENTER,
)
STYLE_COVER_TITLE = ParagraphStyle(
    "KonysCoverTitle", parent=STYLE_H1, fontName="Helvetica-Bold",
    fontSize=23, leading=27, textColor=WINE, spaceAfter=3,
)
STYLE_COVER_SUB = ParagraphStyle(
    "KonysCoverSub", parent=STYLE_BODY, fontSize=10.5, leading=14,
    textColor=GRAY_500, spaceAfter=0,
)
STYLE_TABLE = ParagraphStyle(
    "KonysTable", parent=STYLE_BODY, fontSize=8.2, leading=10.4, spaceAfter=0,
)
STYLE_TABLE_B = ParagraphStyle(
    "KonysTableB", parent=STYLE_TABLE, fontName="Helvetica-Bold",
)
STYLE_TABLE_HEAD = ParagraphStyle(
    "KonysTableHead", parent=STYLE_TABLE_B, textColor=WHITE, fontSize=8.2,
)
STYLE_METRIC = ParagraphStyle(
    "KonysMetric", parent=STYLE_BODY, fontName="Helvetica-Bold",
    fontSize=19, leading=22, alignment=TA_CENTER, textColor=WINE, spaceAfter=0,
)
STYLE_METRIC_LABEL = ParagraphStyle(
    "KonysMetricLabel", parent=STYLE_BODY, fontSize=7.4, leading=9,
    textColor=GRAY_500, alignment=TA_CENTER, spaceAfter=0,
)


def _color_estado(estado: str):
    e = (estado or "").lower()
    if e.startswith("aprob"):
        return GREEN, GREEN_BG, "Aprobada"
    if e.startswith("omit") or e.startswith("no ejec"):
        return AMBER, AMBER_BG, estado
    return RED, RED_BG, "Fallida"


def _fmt_seg(segundos: float) -> str:
    segundos = max(0.0, float(segundos or 0))
    if segundos < 60:
        return f"{segundos:.1f} s"
    return f"{int(segundos // 60)} min {segundos % 60:.0f} s"


def _hex(color) -> str:
    return "#%02X%02X%02X" % (
        round(color.red * 255), round(color.green * 255), round(color.blue * 255)
    )


def _fmt_fecha(valor) -> str:
    if isinstance(valor, dt.datetime):
        return valor.strftime("%d/%m/%Y %H:%M:%S")
    return str(valor or "")


def _p(texto: str, estilo=STYLE_BODY) -> Paragraph:
    """Paragraph seguro para textos con acentos, <, > y saltos de línea."""
    limpio = escape(str(texto or "")).replace("\n", "<br/>")
    return Paragraph(limpio, estilo)


def _imagen_ajustada(ruta: str, max_w: float = CONTENT_W, max_h: float = 300):
    try:
        if not ruta or not Path(ruta).exists():
            return None
        iw, ih = ImageReader(ruta).getSize()
        if not iw or not ih:
            return None
        escala = min(max_w / iw, max_h / ih)
        return Image(ruta, width=iw * escala, height=ih * escala)
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Decoración de páginas
# ---------------------------------------------------------------------------
def _dibujar_logo(c: canvas.Canvas, x: float, y: float, escala: float = 1.0) -> None:
    """Pequeño cono de pizza dibujado con formas (sin imágenes externas)."""
    c.saveState()
    c.translate(x, y)
    c.scale(escala, escala)
    # Masa
    c.setFillColor(colors.HexColor("#F2A541"))
    p = c.beginPath()
    p.moveTo(0, 0)
    p.lineTo(42, 0)
    p.lineTo(22, 38)
    p.curveTo(21, 40, 19, 40, 18, 38)
    p.close()
    c.drawPath(p, fill=1, stroke=0)
    # Queso
    c.setFillColor(colors.HexColor("#FFCB52"))
    c.ellipse(-2, -3, 44, 10, fill=1, stroke=0)
    # Pepperoni
    c.setFillColor(colors.HexColor("#D6402A"))
    for cx, cy, r in ((10, 18, 3.2), (21, 15, 3.5), (31, 19, 2.8), (17, 27, 2.2)):
        c.circle(cx, cy, r, fill=1, stroke=0)
    # Borde superior
    c.setStrokeColor(colors.HexColor("#CF7A22"))
    c.setLineWidth(1)
    c.line(1, 1, 41, 1)
    c.restoreState()


def _portada(c: canvas.Canvas, doc) -> None:
    c.saveState()
    # Banda superior
    c.setFillColor(WINE)
    c.rect(0, PAGE_H - 168, PAGE_W, 168, fill=1, stroke=0)
    c.setFillColor(ORANGE)
    c.rect(0, PAGE_H - 172, PAGE_W, 4, fill=1, stroke=0)
    _dibujar_logo(c, 46, PAGE_H - 112, 1.35)
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 25)
    c.drawString(118, PAGE_H - 92, "KONYS PIZZA")
    c.setFillColor(colors.HexColor("#F9C48E"))
    c.setFont("Helvetica-Bold", 11)
    c.drawString(119, PAGE_H - 111, "SISTEMA DE RESERVAS DE MESAS")
    c.setFillColor(colors.HexColor("#E9D5D7"))
    c.setFont("Helvetica", 10)
    c.drawString(119, PAGE_H - 130, "Reporte de pruebas automáticas con Selenium")
    c.setFillColor(colors.HexColor("#C9A5A9"))
    c.setFont("Helvetica", 8.5)
    c.drawRightString(PAGE_W - MARGIN_X, PAGE_H - 130, _fmt_fecha(doc.extra.get("fecha")))
    # Pie
    c.setStrokeColor(GRAY_200)
    c.setLineWidth(0.6)
    c.line(MARGIN_X, 34, PAGE_W - MARGIN_X, 34)
    c.setFillColor(GRAY_400)
    c.setFont("Helvetica", 7.5)
    c.drawString(MARGIN_X, 23, "Konys Pizza · Proyecto académico · Universidad de Santander")
    c.drawRightString(PAGE_W - MARGIN_X, 23, "Reporte generado automáticamente")
    c.restoreState()


def _pagina_normal(c: canvas.Canvas, doc) -> None:
    c.saveState()
    c.setFillColor(WINE)
    c.rect(0, PAGE_H - 30, PAGE_W, 30, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 8.5)
    c.drawString(MARGIN_X, PAGE_H - 19, "KONYS PIZZA")
    c.setFont("Helvetica", 8)
    c.setFillColor(colors.HexColor("#E9D5D7"))
    c.drawString(MARGIN_X + 72, PAGE_H - 19, "Reporte de pruebas automáticas")
    c.setFillColor(colors.HexColor("#F9C48E"))
    c.drawRightString(PAGE_W - MARGIN_X, PAGE_H - 19, _fmt_fecha(doc.extra.get("fecha")))
    c.setStrokeColor(GRAY_200)
    c.setLineWidth(0.6)
    c.line(MARGIN_X, 32, PAGE_W - MARGIN_X, 32)
    c.setFillColor(GRAY_400)
    c.setFont("Helvetica", 7.5)
    c.drawString(MARGIN_X, 22, "Konys Pizza · Selenium + ReportLab")
    c.drawRightString(PAGE_W - MARGIN_X, 22, f"Página {c.getPageNumber()}")
    c.restoreState()


# ---------------------------------------------------------------------------
# Bloques del reporte
# ---------------------------------------------------------------------------
def _banda_resultado(resultado: str, detalle: str) -> Table:
    if resultado == "APROBADA":
        fondo, color, titulo = GREEN, WHITE, "EJECUCIÓN APROBADA"
    elif resultado == "INCOMPLETA":
        fondo, color, titulo = AMBER, WHITE, "EJECUCIÓN INCOMPLETA"
    else:
        fondo, color, titulo = RED, WHITE, "EJECUCIÓN CON FALLOS"
    t = Table(
        [[Paragraph(f"<b>{titulo}</b>", ParagraphStyle(
            "Resultado", parent=STYLE_BODY, fontName="Helvetica-Bold",
            fontSize=15, leading=18, textColor=color, alignment=TA_CENTER,
        ))],
         [Paragraph(escape(detalle), ParagraphStyle(
             "ResultadoDetalle", parent=STYLE_BODY, fontSize=8.5, leading=11,
             textColor=color, alignment=TA_CENTER,
         ))]],
        colWidths=[CONTENT_W],
    )
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), fondo),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
    ]))
    return t


def _tabla_totales(total: int, aprobadas: int, fallidas: int, omitidas: int,
                   porcentaje: float) -> Table:
    def celda(valor: str, etiqueta: str, color=WINE) -> list:
        return [
            Paragraph(valor, ParagraphStyle(
                "Metrica", parent=STYLE_METRIC, textColor=color,
            )),
            Paragraph(etiqueta, STYLE_METRIC_LABEL),
        ]

    datos = [[
        celda(str(total), "PRUEBAS"),
        celda(str(aprobadas), "APROBADAS", GREEN),
        celda(str(fallidas), "FALLIDAS", RED if fallidas else GRAY_400),
        celda(str(omitidas), "OMITIDAS", AMBER if omitidas else GRAY_400),
        celda(f"{porcentaje:.1f}%", "ÉXITO", GREEN if porcentaje >= 100 else WINE),
    ]]
    cw = CONTENT_W / 5
    t = Table(datos, colWidths=[cw] * 5)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), CREAM),
        ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor("#F0DFD9")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#F0DFD9")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
    ]))
    return t


def _tabla_entorno(entorno: dict) -> Table:
    filas = []
    for clave, valor in entorno.items():
        filas.append([
            Paragraph(f"<b>{escape(str(clave))}</b>", STYLE_TABLE_B),
            Paragraph(escape(str(valor)).replace("\n", "<br/>"), STYLE_TABLE),
        ])
    t = Table(filas, colWidths=[112, CONTENT_W - 112])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), GRAY_100),
        ("BACKGROUND", (1, 0), (1, -1), WHITE),
        ("BOX", (0, 0), (-1, -1), 0.6, GRAY_200),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, GRAY_200),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    return t


def _tabla_resumen(resultados: list) -> Table:
    cabecera = ["#", "Grupo", "Prueba", "Resultado", "Tiempo"]
    filas = [[Paragraph(x, STYLE_TABLE_HEAD) for x in cabecera]]
    for p in resultados:
        color, _, etiqueta = _color_estado(p.estado)
        filas.append([
            Paragraph(f"{p.id:02d}", STYLE_TABLE_B),
            Paragraph(escape(p.grupo), STYLE_TABLE),
            Paragraph(escape(p.nombre), STYLE_TABLE_B),
            Paragraph(f'<font color="{_hex(color)}"><b>{escape(etiqueta)}</b></font>', STYLE_TABLE),
            Paragraph(_fmt_seg(p.duracion), STYLE_TABLE),
        ])
    t = Table(filas, colWidths=[24, 78, 268, 70, 50], repeatRows=1)
    estilo = [
        ("BACKGROUND", (0, 0), (-1, 0), WINE),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOX", (0, 0), (-1, -1), 0.7, GRAY_200),
        ("INNERGRID", (0, 0), (-1, -1), 0.35, GRAY_200),
        ("TOPPADDING", (0, 0), (-1, -1), 2.3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.3),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]
    for i in range(1, len(filas)):
        if i % 2 == 0:
            estilo.append(("BACKGROUND", (0, i), (-1, i), colors.HexColor("#FAFAFA")))
    t.setStyle(TableStyle(estilo))
    return t


def _tabla_grupos(resultados: list) -> Table:
    grupos = []
    for p in resultados:
        if p.grupo not in grupos:
            grupos.append(p.grupo)
    cab = ["Grupo", "Pruebas", "Aprobadas", "Fallidas", "Omitidas"]
    filas = [[Paragraph(x, STYLE_TABLE_HEAD) for x in cab]]
    for g in grupos:
        del_grupo = [p for p in resultados if p.grupo == g]
        filas.append([
            Paragraph(escape(g), STYLE_TABLE_B),
            Paragraph(str(len(del_grupo)), STYLE_TABLE),
            Paragraph(str(sum(1 for p in del_grupo if p.estado == "Aprobada")), STYLE_TABLE),
            Paragraph(str(sum(1 for p in del_grupo if p.estado == "Fallida")), STYLE_TABLE),
            Paragraph(str(sum(1 for p in del_grupo if p.estado == "Omitida")), STYLE_TABLE),
        ])
    t = Table(filas, colWidths=[150, 65, 65, 65, 65], repeatRows=1)
    estilo = [
        ("BACKGROUND", (0, 0), (-1, 0), WINE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOX", (0, 0), (-1, -1), 0.6, GRAY_200),
        ("INNERGRID", (0, 0), (-1, -1), 0.35, GRAY_200),
        ("TOPPADDING", (0, 0), (-1, -1), 2.4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.4),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]
    for i in range(1, len(filas)):
        if i % 2 == 0:
            estilo.append(("BACKGROUND", (0, i), (-1, i), colors.HexColor("#FAFAFA")))
    t.setStyle(TableStyle(estilo))
    return t


def _detalle_prueba(p, numero_total: int, ultimo: bool) -> list:
    color, fondo, etiqueta = _color_estado(p.estado)
    historia = []
    historia.append(Paragraph(
        f"Prueba {p.id:02d} de {numero_total:02d} · {escape(p.nombre)}",
        STYLE_H2,
    ))
    # Ficha con grupo, estado y tiempo
    ficha = Table([[
        Paragraph(f"<b>Grupo</b><br/>{escape(p.grupo)}", STYLE_TABLE),
        Paragraph(f'<b>Resultado</b><br/><font color="{_hex(color)}"><b>{escape(etiqueta)}</b></font>', STYLE_TABLE),
        Paragraph(f"<b>Tiempo</b><br/>{_fmt_seg(p.duracion)}", STYLE_TABLE),
    ]], colWidths=[CONTENT_W * 0.42, CONTENT_W * 0.30, CONTENT_W * 0.28])
    ficha.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), fondo),
        ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#EFE0E2")),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#EFE0E2")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
    ]))
    historia.append(ficha)
    historia.append(Spacer(1, 7))
    historia.append(Paragraph("QUÉ SE ESPERABA", STYLE_LABEL))
    historia.append(_p(p.esperado, STYLE_BODY))
    historia.append(Paragraph("QUÉ SE OBTUVO", STYLE_LABEL))
    historia.append(_p(p.obtenido or "Sin información.", ParagraphStyle(
        "Obtenido", parent=STYLE_BODY,
        textColor=colors.HexColor("#166534") if p.estado == "Aprobada" else (
            colors.HexColor("#92400E") if p.estado == "Omitida" else colors.HexColor("#991B1B")),
    )))
    historia.append(Spacer(1, 4))
    img = _imagen_ajustada(p.captura, max_w=CONTENT_W, max_h=292)
    if img is not None:
        marco = Table([[img]], colWidths=[CONTENT_W])
        marco.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.8, GRAY_200),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FCFCFC")),
        ]))
        historia.append(KeepTogether([marco, Spacer(1, 2), Paragraph(
            "Captura de pantalla tomada automáticamente al terminar la prueba.",
            STYLE_CAPTION,
        )]))
    else:
        historia.append(Paragraph(
            "No se pudo guardar la captura de esta prueba.", STYLE_CAPTION,
        ))
    return historia


# ---------------------------------------------------------------------------
# API pública
# ---------------------------------------------------------------------------
def generar_reporte_pdf(ruta_pdf, resultados, entorno: dict,
                        fecha: dt.datetime, duracion_total: float,
                        resultado_general: str, detalle_general: str) -> str:
    """Escribe el PDF y devuelve la ruta."""
    ruta_pdf = str(Path(ruta_pdf))
    Path(ruta_pdf).parent.mkdir(parents=True, exist_ok=True)

    total = len(resultados)
    aprobadas = sum(1 for p in resultados if p.estado == "Aprobada")
    fallidas = sum(1 for p in resultados if p.estado == "Fallida")
    omitidas = sum(1 for p in resultados if p.estado == "Omitida")
    ejecutadas = total - omitidas
    porcentaje = (aprobadas / ejecutadas * 100) if ejecutadas else 0.0

    doc = BaseDocTemplate(
        ruta_pdf, pagesize=A4,
        leftMargin=MARGIN_X, rightMargin=MARGIN_X,
        topMargin=MARGIN_TOP, bottomMargin=MARGIN_BOTTOM,
        title="Reporte de pruebas · Konys Pizza",
        author="Konys Pizza",
        subject="Pruebas automáticas con Selenium WebDriver",
        creator="pruebas/reporte_pdf.py",
    )
    doc.extra = {"fecha": fecha}
    frame_portada = Frame(MARGIN_X, MARGIN_BOTTOM, CONTENT_W,
                          PAGE_H - MARGIN_BOTTOM - MARGIN_TOP,
                          id="portada", leftPadding=0, rightPadding=0,
                          topPadding=0, bottomPadding=0)
    frame_normal = Frame(MARGIN_X, MARGIN_BOTTOM, CONTENT_W,
                         PAGE_H - MARGIN_BOTTOM - 54, id="normal",
                         leftPadding=0, rightPadding=0,
                         topPadding=0, bottomPadding=0)
    doc.addPageTemplates([
        PageTemplate(id="portada", frames=[frame_portada], onPage=_portada),
        PageTemplate(id="normal", frames=[frame_normal], onPage=_pagina_normal),
    ])

    historia = []
    # --- Portada ---------------------------------------------------------
    historia.append(Spacer(1, 158))
    historia.append(Paragraph("Resumen de la ejecución", STYLE_COVER_TITLE))
    historia.append(Paragraph(
        "Resultado de las pruebas automáticas del sistema de reservas de Konys Pizza.",
        STYLE_COVER_SUB,
    ))
    historia.append(Spacer(1, 10))
    historia.append(_banda_resultado(resultado_general, detalle_general))
    historia.append(Spacer(1, 12))
    historia.append(_tabla_totales(total, aprobadas, fallidas, omitidas, porcentaje))
    historia.append(Spacer(1, 14))
    historia.append(Paragraph("Entorno de ejecución", STYLE_H3))
    historia.append(_tabla_entorno(entorno))
    historia.append(Spacer(1, 12))
    historia.append(Paragraph("Alcance de las pruebas", STYLE_H3))
    historia.append(Paragraph(
        "La suite recorre la página pública y el panel de administración: carga de "
        "estilos y scripts, mesas y filtros por zona, carta por categorías, formulario "
        "de reserva, validaciones de nombre, teléfono, personas y capacidad, selección "
        "de fecha y horario, confirmación con código, prevención de doble reserva, "
        "cierre del modal con Esc, seguridad frente a HTML, diseño móvil y operaciones "
        "básicas del panel (acceso, mesas y carta). Cada prueba deja una captura de "
        "pantalla que se incluye en el detalle.",
        STYLE_BODY_SM,
    ))
    historia.append(Spacer(1, 8))
    historia.append(Paragraph(
        f"Duración total de la ejecución: <b>{_fmt_seg(duracion_total)}</b>.",
        STYLE_BODY_SM,
    ))
    historia.append(NextPageTemplate("normal"))
    historia.append(PageBreak())

    # --- Tabla resumen ---------------------------------------------------
    historia.append(Paragraph("Resultado de las pruebas", STYLE_H1))
    historia.append(Paragraph(
        f"Se ejecutaron {total} pruebas: {aprobadas} aprobadas, {fallidas} fallidas "
        f"y {omitidas} omitidas. El porcentaje de éxito se calcula sobre las pruebas "
        f"ejecutadas (sin contar las omitidas).",
        STYLE_BODY_SM,
    ))
    historia.append(Spacer(1, 7))
    historia.append(_tabla_resumen(resultados))
    historia.append(Spacer(1, 12))
    historia.append(KeepTogether([
        Paragraph("Resumen por grupo", STYLE_H3),
        _tabla_grupos(resultados),
    ]))
    historia.append(PageBreak())

    # --- Detalle ---------------------------------------------------------
    historia.append(Paragraph("Detalle de cada prueba", STYLE_H1))
    historia.append(Paragraph(
        "Cada ficha indica qué se esperaba, qué se obtuvo y la captura tomada al "
        "finalizar la prueba. Las capturas también quedan en la carpeta de reportes.",
        STYLE_BODY_SM,
    ))
    historia.append(Spacer(1, 10))
    for i, p in enumerate(resultados):
        if i > 0:
            historia.append(PageBreak())
        historia.extend(_detalle_prueba(p, total, ultimo=(i == len(resultados) - 1)))

    doc.build(historia)
    return ruta_pdf


def abrir_pdf(ruta: str) -> None:
    """Abre el PDF con la aplicación predeterminada del sistema."""
    try:
        if sys.platform.startswith("win"):
            os.startfile(ruta)  # type: ignore[attr-defined]
        elif sys.platform == "darwin":
            os.system(f'open "{ruta}"')
        else:
            os.system(f'xdg-open "{ruta}"')
    except Exception:
        pass
