import QRCode from "qrcode";

/** Quiet zone around the code, in modules (scanners need ~4). */
const MARGIN = 4;

/** QR modules for a text; error correction M survives some wear on a printed table card. */
function matrix(text: string) {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: "M" });
  return modules;
}

/** One SVG path for all dark modules: crisp at any size, also in print. */
function svgPath(text: string): { path: string; size: number } {
  const modules = matrix(text);
  let path = "";
  for (let row = 0; row < modules.size; row++) {
    for (let col = 0; col < modules.size; col++) {
      if (modules.get(row, col))
        path += `M${col + MARGIN} ${row + MARGIN}h1v1h-1z`;
    }
  }
  return { path, size: modules.size + MARGIN * 2 };
}

export function QrCode({
  value,
  label,
  className,
}: {
  value: string;
  /** Read out by screen readers. */
  label: string;
  className?: string;
}) {
  const { path, size } = svgPath(value);
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={label}
      className={className}
      shapeRendering="crispEdges"
    >
      <rect width={size} height={size} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  );
}

/** A PNG table card: restaurant name, the code and the table name, ready to print. */
export async function qrPng(
  value: string,
  title: string,
  caption: string | null,
): Promise<Blob> {
  const modules = matrix(value);
  const scale = 16;
  const codeSize = (modules.size + MARGIN * 2) * scale;
  const header = 120;
  const footer = caption ? 120 : 40;
  const canvas = document.createElement("canvas");
  canvas.width = codeSize;
  canvas.height = header + codeSize + footer;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000";
  for (let row = 0; row < modules.size; row++) {
    for (let col = 0; col < modules.size; col++) {
      if (modules.get(row, col))
        ctx.fillRect(
          (col + MARGIN) * scale,
          header + (row + MARGIN) * scale,
          scale,
          scale,
        );
    }
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "600 56px Georgia, serif";
  ctx.fillText(title, codeSize / 2, header / 2 + 20, codeSize - 80);
  if (caption) {
    ctx.font = "700 64px system-ui, sans-serif";
    ctx.fillText(caption, codeSize / 2, header + codeSize + 40, codeSize - 80);
  }
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("png"))),
      "image/png",
    ),
  );
}
