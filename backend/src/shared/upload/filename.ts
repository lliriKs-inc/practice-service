/**
 * Busboy/Multer exposes multipart filenames as Latin-1 strings. Browsers send
 * UTF-8 bytes, so a Cyrillic filename can arrive as "ÐÐ¼Ñ.docx".
 * Decode only when the original value is exactly a valid UTF-8 byte sequence;
 * otherwise preserve ordinary Latin-1 and already-correct Unicode names.
 */
export function normalizeUploadedFilename(fileName: string): string {
  const decoded = Buffer.from(fileName, "latin1").toString("utf8");

  return Buffer.from(decoded, "utf8").toString("latin1") === fileName
    ? decoded
    : fileName;
}
