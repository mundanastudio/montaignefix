import { PDFDocument, PDFString, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "npm:pdf-lib@1.17.1"
import { logoFix, logoGrupo, logoMundana } from "./report-logos.ts"

const W = 595.28
const H = 841.89
const LEFT = 40
const RIGHT = 555
const BOTTOM = 58
const NAVY = rgb(12 / 255, 33 / 255, 110 / 255)
const GOLD = rgb(240 / 255, 162 / 255, 29 / 255)
const INK = rgb(51 / 255, 51 / 255, 51 / 255)
const MUTED = rgb(89 / 255, 89 / 255, 89 / 255)
const ZEBRA = rgb(243 / 255, 245 / 255, 250 / 255)
const LINE = rgb(226 / 255, 226 / 255, 226 / 255)

export interface PdfTicket {
  code: string
  title: string
  href: string
  facts: Array<[string, string]>
}

export interface PdfReport {
  title: string
  subtitle: string
  counts: Array<[string, string]>
  tables: Array<{ title: string; headers: string[]; rows: string[][]; widths: number[] }>
  tickets: PdfTicket[]
  closing: string
}

function latin(value: string): string {
  return Array.from(value.replace(/\s+/g, " ").trim())
    .map((char) => {
      if (char === "•") return "·"
      const code = char.codePointAt(0) ?? 0
      return code >= 32 && code <= 255 ? char : ""
    })
    .join("")
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const chunks = String(text).replace(/\r\n/g, "\n").split("\n")
  const lines: string[] = []
  for (const chunk of chunks) {
    const words = latin(chunk).split(" ").filter(Boolean)
    if (words.length === 0) {
      lines.push("")
      continue
    }
    let line = ""
    for (const word of words) {
      const next = line ? `${line} ${word}` : word
      if (font.widthOfTextAtSize(next, size) <= width) line = next
      else {
        if (line) lines.push(line)
        line = word
      }
    }
    if (line) lines.push(line)
  }
  return lines.length ? lines : [""]
}

function png(doc: PDFDocument, b64: string): Promise<PDFImage> {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return doc.embedPng(bytes)
}

export async function buildReportPdf(report: PdfReport): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.setTitle(`Montaigne Fix · ${report.title}`)
  doc.setAuthor("Montaigne Fix")
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const fix = await png(doc, logoFix)
  const grupo = await png(doc, logoGrupo)
  const mundana = await png(doc, logoMundana)
  const pages: PDFPage[] = []
  let page = doc.addPage([W, H])
  pages.push(page)
  let y = H - 28

  const chrome = (target: PDFPage) => {
    target.drawRectangle({ x: 0, y: H - 18, width: W, height: 18, color: NAVY })
    target.drawRectangle({ x: 0, y: H - 22, width: W, height: 4, color: GOLD })
    target.drawRectangle({ x: 0, y: 36, width: W, height: 2, color: GOLD })
    target.drawImage(grupo, { x: LEFT, y: 10, width: 108, height: 20 })
    target.drawImage(mundana, { x: RIGHT - 92, y: 12, width: 92, height: 16 })
  }
  const next = () => {
    page = doc.addPage([W, H])
    pages.push(page)
    chrome(page)
    y = H - 40
  }
  const need = (height: number) => {
    if (y - height < BOTTOM) next()
  }
  const text = (value: string, size: number, face: PDFFont, color = INK, x = LEFT) => {
    page.drawText(latin(value), { x, y, size, font: face, color })
    y -= size + 4
  }
  const link = (href: string, x1: number, y1: number, x2: number, y2: number) => {
    if (!href) return
    const annot = doc.context.register(
      doc.context.obj({
        Type: "Annot",
        Subtype: "Link",
        Rect: [x1, y1, x2, y2],
        Border: [0, 0, 0],
        A: { Type: "Action", S: "URI", URI: PDFString.of(href) },
      }),
    )
    page.node.addAnnot(annot)
  }

  chrome(page)
  y = H - 36
  const logoW = 200
  const logoH = (fix.height / fix.width) * logoW
  page.drawImage(fix, { x: (W - logoW) / 2, y: y - logoH, width: logoW, height: logoH })
  y -= logoH + 16
  text(report.title, 16, bold, NAVY)
  text(report.subtitle, 9, font, MUTED)
  y -= 4
  page.drawRectangle({ x: LEFT, y, width: RIGHT - LEFT, height: 1.2, color: GOLD })
  y -= 14

  const boxW = (RIGHT - LEFT) / report.counts.length
  const boxTop = y
  report.counts.forEach((count, index) => {
    const x = LEFT + index * boxW
    page.drawRectangle({ x, y: boxTop - 36, width: boxW, height: 36, color: ZEBRA, borderColor: LINE, borderWidth: 0.4 })
    page.drawText(latin(count[0]), { x: x + 6, y: boxTop - 14, size: 8, font: bold, color: NAVY })
    page.drawText(latin(count[1]), { x: x + 6, y: boxTop - 30, size: 12, font: bold, color: NAVY })
  })
  y = boxTop - 50

  const drawTable = (title: string, headers: string[], rows: string[][], widths: number[]) => {
    need(36)
    text(title, 12, bold, NAVY)
    y -= 2
    const paintRow = (cells: string[], header: boolean) => {
      const lines = cells.map((cell, index) => wrap(cell, header ? bold : font, 8, widths[index] - 8))
      const height = Math.max(...lines.map((item) => item.length)) * 11 + 8
      need(height + 4)
      if (header) page.drawRectangle({ x: LEFT, y: y - height + 8, width: RIGHT - LEFT, height, color: ZEBRA })
      let x = LEFT
      lines.forEach((item, index) => {
        item.forEach((line, lineIndex) => {
          page.drawText(line, { x: x + 4, y: y - lineIndex * 11, size: 8, font: header ? bold : font, color: header ? NAVY : INK })
        })
        x += widths[index]
      })
      y -= height
      page.drawRectangle({ x: LEFT, y: y + 6, width: RIGHT - LEFT, height: header ? 1.2 : 0.4, color: header ? GOLD : LINE })
      y -= 2
    }
    paintRow(headers, true)
    if (rows.length === 0) paintRow(headers.map((_, index) => (index === 0 ? "Ninguna" : "")), false)
    for (const row of rows) paintRow(row, false)
    y -= 8
  }

  for (const table of report.tables) drawTable(table.title, table.headers, table.rows, table.widths)

  if (report.tickets.length) {
    need(28)
    text("Información de las incidencias", 12, bold, NAVY)
    y -= 4
  }

  for (const ticket of report.tickets) {
    need(70)
    const heading = `${ticket.code} · ${ticket.title}`
    const titleY = y
    text(heading, 12, bold, NAVY)
    if (ticket.href) {
      const width = Math.min(bold.widthOfTextAtSize(latin(heading), 12), RIGHT - LEFT)
      page.drawRectangle({ x: LEFT, y: titleY - 2, width, height: 0.6, color: GOLD })
      link(ticket.href, LEFT, titleY - 2, LEFT + width, titleY + 12)
    }
    y -= 2
    for (const [label, value] of ticket.facts) {
      const lines = wrap(value, font, 8, 390)
      const height = Math.max(14, lines.length * 11 + 4)
      need(height)
      page.drawRectangle({ x: LEFT, y: y - height + 10, width: 110, height, color: ZEBRA })
      page.drawText(latin(label), { x: LEFT + 4, y, size: 8, font: bold, color: NAVY })
      lines.forEach((line, index) => {
        page.drawText(line, { x: LEFT + 116, y: y - index * 11, size: 8, font, color: INK })
      })
      y -= height
    }
    y -= 10
  }

  need(28)
  text(report.closing, 8, font, MUTED)
  text("Documento interno. Contiene datos del solicitante. Conservación: 12 meses.", 8, font, MUTED)

  pages.forEach((item, index) => {
    const label = String(index + 1)
    item.drawText(label, { x: W / 2 - font.widthOfTextAtSize(label, 8) / 2, y: 16, size: 8, font, color: NAVY })
  })
  return doc.save()
}
