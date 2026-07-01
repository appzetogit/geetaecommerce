/** Barcode formats for iOS WASM decoding — standalone to avoid circular imports. */
export const IOS_WASM_READER_FORMATS = [
  "EAN13",
  "EAN8",
  "Code128",
  "Code39",
  "Code93",
  "UPCA",
  "UPCE",
  "ITF",
  "Codabar",
  "DataBar",
  "QRCode",
  "DataMatrix",
  "PDF417",
] as const;
