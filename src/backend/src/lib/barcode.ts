import bwipjs from "bwip-js";

/**
 * Renders a Code128 barcode (alphanumeric-safe, standard for retail cartons)
 * to a PNG buffer. Pure-JS renderer — no native canvas dependency.
 */
export async function renderBarcodePng(value: string): Promise<Buffer> {
  return bwipjs.toBuffer({
    bcid: "code128",
    text: value,
    scale: 3,
    height: 16,
    includetext: true,
    textxalign: "center",
    backgroundcolor: "FFFFFF",
  });
}
