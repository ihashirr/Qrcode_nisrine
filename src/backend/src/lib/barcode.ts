import bwipjs from "bwip-js";

/**
 * Renders a barcode PNG for the sticker.
 *
 * Symbology is picked from the payload: a 12/13-digit value renders as
 * EAN-13/UPC-A (the retail symbology on the physical label — e.g.
 * "0 788364 199676"), anything else as Code128. So the day the official
 * GTIN series is assigned, swapping the numbers into products.json is the
 * only change needed.
 *
 * `paddingwidth` bakes the mandatory quiet zone into the image so the bars
 * never sit against the sticker edge — scanners fail without it.
 */
export async function renderBarcodePng(value: string): Promise<Buffer> {
  const digits = value.replace(/\s+/g, "");
  const isGtin = /^\d{12,13}$/.test(digits);

  return bwipjs.toBuffer({
    bcid: isGtin ? (digits.length === 13 ? "ean13" : "upca") : "code128",
    text: isGtin ? digits : value,
    scale: 3,
    height: 18,
    includetext: true,
    textxalign: "center",
    paddingwidth: 12,
    paddingheight: 2,
    backgroundcolor: "FFFFFF",
  });
}
