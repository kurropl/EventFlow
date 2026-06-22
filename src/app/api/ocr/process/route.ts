/**
 * EventFlow — API de proceso OCR
 * POST /api/ocr/process
 * 
 * Recibe una imagen, la procesa con Tesseract OCR nativo (tesseract-ocr),
 * y devuelve los datos estructurados según el modo.
 *
 * Modos: ticket_proveedor, etiqueta_ingrediente, albaran, codigo_barras
 * 
 * El resultado se devuelve al frontend, que luego puede llamar a
 * POST /api/ocr/apply para aplicar los datos (crear stock, actualizar precios, etc.)
 */
import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, readFile, unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import crypto from "crypto";
import { execSync } from "child_process";
import { query } from "@/lib/db";
import { sanitizeError } from "@/lib/security";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "ocr");
const TESSERACT_BIN = "/usr/bin/tesseract";

interface ParsedItem {
  name: string;
  quantity: number;
  unit: string;
  cost: number;
  supplier?: string;
  lot?: string;
  expiry?: string;
  barcode?: string;
}

function runTesseract(imagePath: string): { text: string; confidence: number } {
  const outBase = imagePath.replace(/\.[^.]+$/, "");
  const args = [`"${TESSERACT_BIN}"`, `"${imagePath}"`, `"${outBase}"`, "-l", "spa", "--oem", "1", "2>&1"];

  try {
    const stderr = execSync(args.join(" "), { timeout: 30000, encoding: "utf-8" });

    // Leer archivo de salida .txt
    const txtPath = outBase + ".txt";
    let text = "";
    if (existsSync(txtPath)) {
      text = require("fs").readFileSync(txtPath, "utf-8").trim();
    }

    // Extraer nivel de confianza del stderr si está disponible
    const confMatch = stderr.match(/Confidence:\s*(\d+\.?\d*)/i);
    const confidence = confMatch ? parseFloat(confMatch[1]) / 100 : text.length > 10 ? 0.75 : 0.2;

    return { text, confidence };
  } catch (e: any) {
    console.warn("Tesseract error:", e.message?.slice(0, 200));
    return { text: "", confidence: 0 };
  }
}

function parseTicket(text: string): ParsedItem[] {
  const items: ParsedItem[] = [];
  const lines = text.split("\n").filter(Boolean);

  let currentSupplier = "";

  for (const line of lines) {
    // Detectar proveedor (línea con razón social al principio)
    const provMatch = line.match(/^(distribuidora|proveedor|proveedora|carnicería|pescadería|frutería|mercadona|makro|costco|el corte inglés|dia|carrefour)/i);
    if (provMatch) currentSupplier = provMatch[0];

    // Buscar patrón: nombre + cantidad + precio
    // Ej: "Tomate triturado 2kg 3,45€" o "Tomate triturado 2 kg 3.45"
    const itemMatch = line.match(
      /^(.+?)\s+(\d+[.,]?\d*)\s*(kg|g|l|ml|ud|unidad|unidades|pack|latas?|bolsas?)\s+(\d+[.,]?\d+)\s*[€€$]?$/i
    );

    if (itemMatch) {
      items.push({
        name: itemMatch[1].trim().toLowerCase(),
        quantity: parseFloat(itemMatch[2].replace(",", ".")),
        unit: itemMatch[3].toLowerCase(),
        cost: parseFloat(itemMatch[4].replace(",", ".")),
        supplier: currentSupplier || undefined,
      });
    } else {
      // Patrón más flexible: solo precio al final
      const priceMatch = line.match(/(\d+[.,]?\d+)\s*[€€$]/);
      if (priceMatch && !line.match(/^(total|subtotal|iva|base|importe)/i)) {
        const price = parseFloat(priceMatch[1].replace(",", "."));
        if (price > 0.1 && price < 10000) {
          items.push({
            name: line.replace(priceMatch[0], "").trim().toLowerCase(),
            quantity: 1,
            unit: "ud",
            cost: price,
            supplier: currentSupplier || undefined,
          });
        }
      }
    }
  }

  return items;
}

function parseLabel(text: string): ParsedItem[] {
  const item: ParsedItem = {
    name: "",
    quantity: 1,
    unit: "ud",
    cost: 0,
  };

  // Buscar nombre del ingrediente (primera línea significativa)
  const lines = text.split("\n").filter(Boolean);
  if (lines.length > 0) {
    item.name = lines[0].trim().toLowerCase();
  }

  // Buscar lote: "LOTE: XXXX" o "LOT XXXX"
  const lotMatch = text.match(/(?:LOTE|LOT|L|BATCH|N\.?\s*LOTE)[:\s]*([A-Z0-9_-]+)/i);
  if (lotMatch) item.lot = lotMatch[1];

  // Buscar caducidad: "CAD: DD/MM/AAAA" o "FECHA: DD/MM/AAAA"
  const expiryMatch = text.match(/(?:CAD|CADUCIDAD|FECHA|CONSUMO|VENCE?)[:\s]*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i);
  if (expiryMatch) item.expiry = expiryMatch[1];

  // Buscar peso: "PESO: 5KG" o "5,00 KG"
  const weightMatch = text.match(/(?:PESO|NETO)[:\s]*(\d+[.,]?\d*)\s*(kg|g)/i) ||
                      text.match(/(\d+[.,]?\d+)\s*(kg|g)\b/i);
  if (weightMatch) {
    item.quantity = parseFloat(weightMatch[1].replace(",", "."));
    item.unit = weightMatch[2].toLowerCase();
  }

  return [item];
}

function parseAlbaran(text: string): ParsedItem[] {
  const items: ParsedItem[] = [];
  const lines = text.split("\n").filter(Boolean);

  for (const line of lines) {
    // Patrón: cantidad + nombre + opcional precio
    const match = line.match(/^(\d+)\s+(.+?)\s+(\d+[.,]?\d*)\s*[€€$]?/);
    if (match) {
      items.push({
        name: match[2].trim().toLowerCase(),
        quantity: parseInt(match[1], 10),
        unit: "ud",
        cost: parseFloat(match[3].replace(",", ".")),
      });
    }
  }

  return items;
}

function parseBarcode(text: string): ParsedItem[] {
  // Código de barras / QR: el texto suele ser el código o nombre del producto
  const code = text.trim();
  if (!code) return [];

  return [{
    name: code,
    quantity: 1,
    unit: "ud",
    cost: 0,
    barcode: code,
  }];
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const image = formData.get("image") as File | null;
    const mode = (formData.get("mode") as string) || "ticket_proveedor";

    if (!image) {
      return NextResponse.json({ success: false, error: "No se recibió imagen" }, { status: 400 });
    }

    const bytes = await image.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const ext = image.type?.includes("png") ? "png" : "jpg";
    const hash = crypto.randomUUID().slice(0, 8);
    const filename = `ocr-${Date.now()}-${hash}.${ext}`;

    await mkdir(UPLOAD_DIR, { recursive: true });
    const filePath = path.join(UPLOAD_DIR, filename);
    await writeFile(filePath, buffer);

    // Ejecutar OCR
    const { text, confidence } = runTesseract(filePath);

    if (!text) {
      // Fallback: el fichero no se pudo leer, pero puede que la imagen se haya procesado parcialmente
      const txtPath = filePath.replace(/\.[^.]+$/, "") + ".txt";
      const fallbackText = existsSync(txtPath)
        ? require("fs").readFileSync(txtPath, "utf-8").trim()
        : "";

      if (!fallbackText) {
        // Limpiar
        try { await unlink(filePath); } catch {}
        return NextResponse.json({
          success: false,
          error: "No se pudo extraer texto de la imagen",
          debug: { size: image.size, type: image.type },
        }, { status: 422 });
      }
    }

    // Parsear según modo
    let items: ParsedItem[] = [];
    const cleanText = text.trim();

    switch (mode) {
      case "ticket_proveedor":
        items = parseTicket(cleanText);
        break;
      case "etiqueta_ingrediente":
        items = parseLabel(cleanText);
        break;
      case "albaran":
        items = parseAlbaran(cleanText);
        break;
      case "codigo_barras":
        items = parseBarcode(cleanText);
        break;
      default:
        items = parseTicket(cleanText);
    }

    // Buscar ingredientes existentes en BD para match
    let matchedIngredients: Array<{ id: string; name: string; current_price: number | null }> = [];
    if (items.length > 0) {
      const names = items.map(i => i.name).filter(Boolean);
      if (names.length > 0) {
        const placeholders = names.map((_, idx) => `$${idx + 1}`).join(", ");
        const result = await query(
          `SELECT id, name, current_price FROM ingredients WHERE LOWER(name) = ANY($1::text[])`,
          [names]
        );
        matchedIngredients = (result.rows || []).map((r: any) => ({
          id: r.id,
          name: r.name,
          current_price: r.current_price ? Number(r.current_price) : null,
        }));
      }
    }

    // Limpiar ficheros temporales
    try { await unlink(filePath); } catch {}
    try { await unlink(filePath.replace(/\.[^.]+$/, "") + ".txt"); } catch {}

    return NextResponse.json({
      success: true,
      data: {
        mode,
        text: cleanText.slice(0, 2000),
        confidence,
        items,
        matchedIngredients,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "OCR failed";
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}