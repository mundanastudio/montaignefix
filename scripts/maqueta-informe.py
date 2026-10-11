"""Maqueta del PDF semanal. Datos de ejemplo, no lee la base de datos."""

from pathlib import Path

from reportlab.lib.colors import Color, white
from reportlab.lib.enums import TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    Image,
    PageBreak,
    KeepTogether,
    HRFlowable,
)

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "maqueta-informe-semanal.pdf"
LOGO_FIX = ROOT / "assets" / "email" / "assets" / "montaigne-fix-logo.png"
LOGO_GRUPO = ROOT / "assets" / "brand-source" / "logo_grupo_montaigne.png"
LOGO_MUNDANA = ROOT / "assets" / "email" / "assets" / "mundana-studio-logo.png"
FONT_DIR = ROOT / "assets" / "fonts" / "helvetica-neue"

NAVY = Color(12 / 255, 33 / 255, 110 / 255)
GOLD = Color(240 / 255, 162 / 255, 29 / 255)
INK = Color(51 / 255, 51 / 255, 51 / 255)
MUTED = Color(89 / 255, 89 / 255, 89 / 255)
LINE = Color(226 / 255, 226 / 255, 226 / 255)
ZEBRA = Color(243 / 255, 245 / 255, 250 / 255)
GREEN = Color(31 / 255, 106 / 255, 67 / 255)
AMBER = Color(138 / 255, 74 / 255, 5 / 255)


def register_fonts():
    regular = FONT_DIR / "HelveticaNeueLTStd-Lt.otf"
    bold = FONT_DIR / "HelveticaNeueLTStd-Bd.otf"
    try:
        pdfmetrics.registerFont(TTFont("HN", str(regular)))
        pdfmetrics.registerFont(TTFont("HN-Bold", str(bold)))
        return "HN", "HN-Bold"
    except Exception:
        return "Helvetica", "Helvetica-Bold"


FONT, FONT_BOLD = register_fonts()


def style(name, **kwargs):
    base = dict(fontName=FONT, fontSize=9, leading=12, textColor=INK, alignment=TA_LEFT)
    base.update(kwargs)
    return ParagraphStyle(name, **base)


S_H1 = style("h1", fontName=FONT_BOLD, fontSize=16, leading=20, textColor=NAVY)
S_H2 = style("h2", fontName=FONT_BOLD, fontSize=12, leading=15, textColor=NAVY, spaceBefore=4, spaceAfter=4)
S_META = style("meta", fontSize=8.5, leading=11, textColor=MUTED)
S_CELL = style("cell", fontSize=8, leading=10)
S_CELL_B = style("cellb", fontName=FONT_BOLD, fontSize=8, leading=10, textColor=NAVY)
S_SMALL = style("small", fontSize=8, leading=10, textColor=MUTED)
S_BODY = style("body", fontSize=9, leading=12)
S_LABEL = style("label", fontName=FONT_BOLD, fontSize=8, leading=10, textColor=NAVY)


def P(text, st=S_CELL):
    return Paragraph(str(text), st)


def table(headers, rows, col_widths):
    head = [P(h, S_CELL_B) for h in headers]
    body = [[P(cell) for cell in row] for row in rows]
    data = [head, *body]
    tbl = Table(data, colWidths=col_widths, repeatRows=1)
    tbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), ZEBRA),
                ("TEXTCOLOR", (0, 0), (-1, 0), NAVY),
                ("LINEBELOW", (0, 0), (-1, 0), 1, GOLD),
                ("LINEBELOW", (0, 1), (-1, -2), 0.3, LINE),
                ("LINEBELOW", (0, -1), (-1, -1), 0.3, LINE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, ZEBRA]),
            ]
        )
    )
    return tbl


def header_footer(canvas, doc):
    canvas.saveState()
    w, h = A4
    canvas.setFillColor(NAVY)
    canvas.rect(0, h - 8 * mm, w, 8 * mm, fill=1, stroke=0)
    canvas.setFillColor(GOLD)
    canvas.rect(0, h - 10 * mm, w, 2 * mm, fill=1, stroke=0)
    canvas.setFillColor(white)
    canvas.rect(0, 0, w, 14 * mm, fill=1, stroke=0)
    canvas.setFillColor(GOLD)
    canvas.rect(0, 14 * mm, w, 1.2 * mm, fill=1, stroke=0)
    if LOGO_GRUPO.exists():
        canvas.drawImage(str(LOGO_GRUPO), 14 * mm, 3 * mm, width=42 * mm, height=8 * mm, preserveAspectRatio=True, mask="auto")
    if LOGO_MUNDANA.exists():
        canvas.drawImage(str(LOGO_MUNDANA), w - 54 * mm, 4 * mm, width=32 * mm, height=6 * mm, preserveAspectRatio=True, mask="auto")
    canvas.setFillColor(NAVY)
    canvas.setFont(FONT, 8)
    canvas.drawCentredString(w / 2, 5 * mm, f"{doc.page}")
    canvas.restoreState()


def build():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(OUT),
        pagesize=A4,
        leftMargin=14 * mm,
        rightMargin=14 * mm,
        topMargin=16 * mm,
        bottomMargin=20 * mm,
        title="Montaigne Fix · Informe semanal (maqueta)",
        author="Montaigne Fix",
    )
    story = []
    if LOGO_FIX.exists():
        story.append(Image(str(LOGO_FIX), width=78 * mm, height=24 * mm, kind="proportional"))
    story.append(Spacer(1, 3 * mm))
    story.append(Paragraph("Informe semanal", S_H1))
    story.append(Paragraph("Colegio Montaigne de Sevilla · 5 al 11 de octubre de 2026", S_META))
    story.append(Paragraph("Maqueta con datos de ejemplo. El informe real saldrá cada miércoles a las 8:00.", S_META))
    story.append(Spacer(1, 3 * mm))
    story.append(HRFlowable(width="100%", thickness=1, color=GOLD, spaceAfter=3 * mm))

    counts = [[
        [P("Cerradas esta semana", S_LABEL), P("2", S_H2)],
        [P("Resueltas, sin cerrar", S_LABEL), P("1", S_H2)],
        [P("Siguen abiertas", S_LABEL), P("4", S_H2)],
        [P("Material pendiente", S_LABEL), P("2", S_H2)],
    ]]
    box = Table(counts, colWidths=[46 * mm, 46 * mm, 46 * mm, 44 * mm])
    box.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), ZEBRA),
                ("BOX", (0, 0), (-1, -1), 0.4, LINE),
                ("LINEAFTER", (0, 0), (-2, -1), 0.4, LINE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    # The counts table is 1 row of 4 pairs, but I built 4 rows of 2. Redo as one row.
    story.append(box)
    story.append(Spacer(1, 5 * mm))

    story.append(Paragraph("Resueltas y cerradas esta semana", S_H2))
    story.append(
        table(
            ["Código", "Reparación", "Lugar", "Prioridad", "Estado", "Asignado", "Fechas"],
            [
                ["MF-0038", "La puerta del patio no cierra", "Patio", "P2", "Cerrado", "Agustín", "Abierta 06/10/26 • 09:12\nCerrada 09/10/26 • 13:40"],
                ["MF-0041", "Fluorescente fundido en secretaría", "Secretaría", "P3", "Cerrado", "Andrés", "Abierta 07/10/26 • 11:05\nCerrada 10/10/26 • 16:20"],
                ["MF-0042", "Persiana atascada", "Aula 3", "P1", "Resuelto", "Andrés", "Abierta 08/10/26 • 08:40\nResuelta 11/10/26 • 10:15"],
            ],
            [22 * mm, 42 * mm, 24 * mm, 18 * mm, 20 * mm, 22 * mm, 34 * mm],
        )
    )
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph("Siguen abiertas", S_H2))
    story.append(
        table(
            ["Código", "Reparación", "Lugar", "Prioridad", "Estado", "Asignado", "Abierta"],
            [
                ["MF-0031", "Luz del pasillo de primaria parpadea", "Pasillo primaria", "P2", "En curso", "Agustín", "02/10/26 • 12:18"],
                ["MF-0044", "Gotea el grifo del laboratorio", "Laboratorio", "Sin prioridad", "Nuevo", "Sin asignar", "11/10/26 • 07:55"],
                ["MF-0027", "Silla rota en la biblioteca", "Biblioteca", "P3", "En espera", "Agustín", "28/09/26 • 15:02"],
                ["MF-0019", "Persiana del salón de actos", "Salón de actos", "P2", "Asignado", "Andrés", "20/09/26 • 09:30"],
            ],
            [22 * mm, 48 * mm, 28 * mm, 24 * mm, 22 * mm, 22 * mm, 16 * mm],
        )
    )
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph("Pendiente de comprar", S_H2))
    story.append(
        table(
            ["Artículo", "Incidencia", "Quién lo pidió", "Desde"],
            [
                ["Bisagra de persiana", "MF-0042 · Aula 3", "Andrés", "09/10/26 • 18:10"],
                ["Bombilla LED 12 W", "MF-0031 · Pasillo primaria", "Agustín", "02/10/26 • 12:40"],
            ],
            [55 * mm, 55 * mm, 40 * mm, 32 * mm],
        )
    )

    story.append(PageBreak())
    story.append(Paragraph("Detalle de cada incidencia", S_H1))
    story.append(Paragraph("En el informe real, una ficha como esta por cada parte de las tablas anteriores.", S_META))
    story.append(Spacer(1, 3 * mm))

    ficha = []
    ficha.append(Paragraph("MF-0042 · Persiana atascada", S_H2))
    ficha.append(Paragraph("Aula 3 · P1 · Resuelto · Andrés", S_META))
    ficha.append(Spacer(1, 2 * mm))
    facts = [
        ["Solicitante", "Lucía Romero · lucia.romero@colegiomontaigne.com"],
        ["Reparación", "La persiana del aula 3 no sube. El aula queda a oscuras por las mañanas."],
        ["Observaciones del solicitante", "Pasa desde el lunes. No hemos forzado la cinta."],
        ["Abierta", "08/10/26 • 08:40"],
        ["Asignada", "08/10/26 • 09:05"],
        ["Resuelta", "11/10/26 • 10:15"],
        ["Cerrada", "—"],
    ]
    fact_table = Table([[P(a, S_LABEL), P(b)] for a, b in facts], colWidths=[42 * mm, 140 * mm])
    fact_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LINEBELOW", (0, 0), (-1, -1), 0.3, LINE),
                ("LEFTPADDING", (0, 0), (-1, -1), 3),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ("BACKGROUND", (0, 0), (0, -1), ZEBRA),
            ]
        )
    )
    ficha.append(fact_table)
    ficha.append(Spacer(1, 3 * mm))
    ficha.append(Paragraph("Materiales", S_LABEL))
    ficha.append(Spacer(1, 1 * mm))
    ficha.append(
        table(
            ["Artículo", "Estado", "Quién", "Fecha"],
            [
                ["Cinta de persiana", "Comprado", "Fran", "10/10/26 • 17:02"],
                ["Bisagra de persiana", "Pendiente", "Andrés", "09/10/26 • 18:10"],
            ],
            [70 * mm, 30 * mm, 40 * mm, 42 * mm],
        )
    )
    ficha.append(Spacer(1, 3 * mm))
    ficha.append(Paragraph("Observaciones", S_LABEL))
    ficha.append(Paragraph("Interna · Andrés · 11/10/26 • 10:12 — Cinta cambiada. Falta la bisagra; la persiana ya sube.", S_BODY))
    ficha.append(Paragraph("Gestión · Fran · 08/10/26 • 09:05 — Prioridad P1. Asignada a Andrés.", S_BODY))
    ficha.append(Spacer(1, 2 * mm))
    ficha.append(Paragraph("Historial", S_LABEL))
    ficha.append(Paragraph("11/10/26 • 10:15 · Andrés marcó Resuelto.", S_BODY))
    ficha.append(Paragraph("10/10/26 • 17:02 · Fran marcó comprada la cinta de persiana.", S_BODY))
    ficha.append(Paragraph("09/10/26 • 18:10 · Andrés pidió bisagra de persiana.", S_BODY))
    ficha.append(Paragraph("08/10/26 • 09:05 · Fran asignó a Andrés y puso P1.", S_BODY))
    ficha.append(Paragraph("08/10/26 • 08:40 · Lucía Romero abrió el parte.", S_BODY))
    story.append(KeepTogether(ficha))

    story.append(Spacer(1, 8 * mm))
    story.append(HRFlowable(width="100%", thickness=0.4, color=LINE, spaceBefore=2 * mm, spaceAfter=2 * mm))
    story.append(Paragraph("Montaigne Fix · Colegio Montaigne de Sevilla · powered by Mundana Studio", S_SMALL))
    story.append(Paragraph("Documento interno. Contiene datos del solicitante. Conservación: 12 meses.", S_SMALL))

    doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
    print(OUT)


if __name__ == "__main__":
    build()
