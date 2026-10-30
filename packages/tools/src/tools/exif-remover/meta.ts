import { EyeOff } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "exif-remover",
  name: "EXIF & Metadata Remover",
  tagline: "Strip GPS location and camera data from photos, losslessly.",
  description:
    "Remove EXIF, GPS, XMP and comment metadata from JPEG, PNG and WebP images before you share them. The pixel data is copied byte-for-byte, so quality never changes. Files stay on your device.",
  category: "image",
  keywords: ["remove exif", "strip metadata", "remove gps from photo", "exif remover", "photo privacy", "delete image metadata"],
  icon: EyeOff,
  popular: true,
  faq: [
    { question: "Does removing metadata reduce image quality?", answer: "No. Unlike re-saving an image, this tool deletes only the metadata segments and copies the image data unchanged, so the picture is identical." },
    { question: "What gets removed?", answer: "EXIF (camera, date and GPS location), XMP, IPTC/Photoshop data and comments. By default the embedded color profile is kept so colors still look right; you can remove it too." },
  ],
  related: ["exif-viewer", "image-compressor", "pdf-metadata-editor", "image-crop"],
});
