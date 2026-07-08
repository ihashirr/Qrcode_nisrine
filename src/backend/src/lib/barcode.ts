import bwipjs from "bwip-js";

/**
 * Renders a Code128 barcode (the reliable default for retail checkout
 * scanners) to a PNG buffer.
 *
 * `paddingwidth` bakes a generous horizontal quiet zone into the image so
 * the bars never sit against the sticker edge — scanners fail without it.
 * At scale 3 this yields well over the 5mm clear space each side that the
 * production checklist requires.
 */
export async function renderBarcodePng(value: string): Promise<Buffer> {
  return bwipjs.toBuffer({
    bcid: "code128",
    text: value,
    scale: 3,
    height: 16,
    includetext: true,
    textxalign: "center",
    paddingwidth: 12,
    paddingheight: 2,
    backgroundcolor: "FFFFFF",
  });
}
