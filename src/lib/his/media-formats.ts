import type { MediaCategory } from "@prisma/client";

/**
 * Extensible registry of accepted diagnostic file formats. A format is
 * accepted only when the extension, declared MIME type AND the file's real
 * signature ("magic bytes") agree — an extension alone never proves a format.
 * Archives (ZIP) are disabled: they cannot be inspected safely here.
 */

export interface MediaFormat {
  key: string;
  label: string;
  extensions: string[];
  mimeTypes: string[];
  maxBytes: number;
  /** How the browser may preview it after a permission check. */
  preview: "image" | "pdf" | "video" | "audio" | "text" | "none";
  check: (head: Uint8Array) => boolean;
}

const MB = 1024 * 1024;
const at = (b: Uint8Array, sig: number[], offset = 0) => sig.every((v, i) => b[offset + i] === v);
const ascii = (b: Uint8Array, text: string, offset = 0) => at(b, [...text].map((c) => c.charCodeAt(0)), offset);
const ZIP = (b: Uint8Array) => at(b, [0x50, 0x4b, 0x03, 0x04]);
const OLE = (b: Uint8Array) => at(b, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

/** Printable UTF-8/ASCII text with no NUL bytes in the inspected head. */
export function looksLikeText(b: Uint8Array): boolean {
  if (b.length === 0) return false;
  if (b.includes(0)) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(b.subarray(0, Math.max(0, b.length - 4)));
    return true;
  } catch {
    return false;
  }
}

const textStart = (b: Uint8Array) => new TextDecoder().decode(b).replace(/^\uFEFF/, "").trimStart();

export const MEDIA_FORMATS: MediaFormat[] = [
  { key: "pdf", label: "PDF", extensions: ["pdf"], mimeTypes: ["application/pdf"], maxBytes: 50 * MB, preview: "pdf", check: (b) => ascii(b, "%PDF-") },
  { key: "docx", label: "Word (DOCX)", extensions: ["docx"], mimeTypes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"], maxBytes: 25 * MB, preview: "none", check: ZIP },
  { key: "doc", label: "Word (DOC)", extensions: ["doc"], mimeTypes: ["application/msword"], maxBytes: 25 * MB, preview: "none", check: OLE },
  { key: "xlsx", label: "Excel (XLSX)", extensions: ["xlsx"], mimeTypes: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"], maxBytes: 25 * MB, preview: "none", check: ZIP },
  { key: "xls", label: "Excel (XLS)", extensions: ["xls"], mimeTypes: ["application/vnd.ms-excel"], maxBytes: 25 * MB, preview: "none", check: OLE },
  { key: "csv", label: "CSV", extensions: ["csv"], mimeTypes: ["text/csv"], maxBytes: 10 * MB, preview: "text", check: looksLikeText },
  { key: "txt", label: "Text", extensions: ["txt"], mimeTypes: ["text/plain"], maxBytes: 10 * MB, preview: "text", check: looksLikeText },
  { key: "jpeg", label: "JPEG image", extensions: ["jpg", "jpeg"], mimeTypes: ["image/jpeg"], maxBytes: 50 * MB, preview: "image", check: (b) => at(b, [0xff, 0xd8, 0xff]) },
  { key: "png", label: "PNG image", extensions: ["png"], mimeTypes: ["image/png"], maxBytes: 50 * MB, preview: "image", check: (b) => at(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
  { key: "tiff", label: "TIFF image", extensions: ["tif", "tiff"], mimeTypes: ["image/tiff"], maxBytes: 200 * MB, preview: "none", check: (b) => at(b, [0x49, 0x49, 0x2a, 0x00]) || at(b, [0x4d, 0x4d, 0x00, 0x2a]) },
  { key: "dicom", label: "DICOM file", extensions: ["dcm", "dicom"], mimeTypes: ["application/dicom"], maxBytes: 500 * MB, preview: "none", check: (b) => ascii(b, "DICM", 128) },
  { key: "mp4", label: "MP4 video", extensions: ["mp4", "m4v"], mimeTypes: ["video/mp4"], maxBytes: 500 * MB, preview: "video", check: (b) => ascii(b, "ftyp", 4) },
  { key: "mov", label: "QuickTime video", extensions: ["mov"], mimeTypes: ["video/quicktime"], maxBytes: 500 * MB, preview: "video", check: (b) => ascii(b, "ftypqt", 4) || ascii(b, "moov", 4) || ascii(b, "wide", 4) || ascii(b, "mdat", 4) },
  { key: "wav", label: "WAV audio", extensions: ["wav"], mimeTypes: ["audio/wav", "audio/x-wav"], maxBytes: 100 * MB, preview: "audio", check: (b) => ascii(b, "RIFF") && ascii(b, "WAVE", 8) },
  { key: "mp3", label: "MP3 audio", extensions: ["mp3"], mimeTypes: ["audio/mpeg"], maxBytes: 100 * MB, preview: "audio", check: (b) => ascii(b, "ID3") || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) },
  { key: "scp-ecg", label: "ECG waveform (SCP-ECG / XML / CSV export)", extensions: ["scp", "ecg"], mimeTypes: ["application/octet-stream"], maxBytes: 50 * MB, preview: "none", check: (b) => b.length >= 6 },
  { key: "hl7v2", label: "HL7 v2 message", extensions: ["hl7"], mimeTypes: ["application/hl7-v2", "text/plain"], maxBytes: 5 * MB, preview: "text", check: (b) => looksLikeText(b) && textStart(b).startsWith("MSH|") },
  { key: "fhir-json", label: "FHIR resource (JSON)", extensions: ["json"], mimeTypes: ["application/fhir+json", "application/json"], maxBytes: 10 * MB, preview: "text", check: (b) => looksLikeText(b) && textStart(b).startsWith("{") && textStart(b).includes('"resourceType"') },
  { key: "fhir-xml", label: "FHIR resource (XML) / ECG XML", extensions: ["xml"], mimeTypes: ["application/fhir+xml", "application/xml", "text/xml"], maxBytes: 10 * MB, preview: "text", check: (b) => looksLikeText(b) && textStart(b).startsWith("<") },
];

/** Explicitly refused even if a client asks: archives and executables. */
const REFUSED_EXTENSIONS = new Set(["zip", "rar", "7z", "gz", "tar", "exe", "dll", "bat", "cmd", "sh", "js", "msi", "apk", "html", "htm", "svg"]);

export function extensionOf(fileName: string): string {
  const m = /\.([a-z0-9]{1,10})$/i.exec(fileName.trim());
  return m ? m[1].toLowerCase() : "";
}

/** Resolve a declared upload to a registered format, or explain why it is refused. */
export function resolveFormat(fileName: string, mimeType: string): { format: MediaFormat } | { error: string } {
  const ext = extensionOf(fileName);
  if (!ext) return { error: "The file needs an extension" };
  if (REFUSED_EXTENSIONS.has(ext)) return { error: `.${ext} files are not permitted` };
  const format = MEDIA_FORMATS.find((f) => f.extensions.includes(ext) && f.mimeTypes.includes(mimeType));
  if (!format) return { error: `Unsupported file type (.${ext}, ${mimeType || "unknown type"})` };
  return { format };
}

export function formatByKey(key: string): MediaFormat | undefined {
  return MEDIA_FORMATS.find((f) => f.key === key);
}

export const MEDIA_CATEGORY_LABEL: Record<MediaCategory, string> = {
  XRAY: "X-ray", CT: "CT", MRI: "MRI", ULTRASOUND: "Ultrasound", ECHOCARDIOGRAPHY: "Echocardiography", ECG_HOLTER: "ECG and Holter monitoring",
  EEG: "EEG", ENDOSCOPY: "Endoscopy", GASTROSCOPY: "Gastroscopy", COLONOSCOPY: "Colonoscopy", ANGIOGRAPHY: "Angiography",
  MAMMOGRAPHY: "Mammography", DOPPLER: "Doppler studies", FLUOROSCOPY: "Fluoroscopy", NUCLEAR_MEDICINE: "Nuclear medicine",
  PULMONARY_FUNCTION: "Pulmonary function tests", LABORATORY_REPORT: "Laboratory reports", PATHOLOGY_HISTOLOGY: "Pathology and histology",
  MICROBIOLOGY: "Microbiology", AUDIOLOGY: "Audiology", OPHTHALMIC: "Ophthalmic investigations", PRESSURE_THERAPY: "Pressure-related therapy and diagnostic records",
  REHABILITATION: "Physiotherapy and rehabilitation records", OTHER: "Other diagnostic examinations",
};

/** Categories that are treatment/therapy documentation rather than diagnostic results. */
export const THERAPY_CATEGORIES: readonly MediaCategory[] = ["PRESSURE_THERAPY", "REHABILITATION"];

export const ACCEPT_ATTRIBUTE = MEDIA_FORMATS.flatMap((f) => f.extensions.map((e) => `.${e}`)).join(",");
