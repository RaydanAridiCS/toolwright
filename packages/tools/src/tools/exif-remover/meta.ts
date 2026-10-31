import { EyeOff } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "exif-remover",
  name: "EXIF & Metadata Remover",
  tagline: "Strip GPS location and camera data from photos, losslessly.",
  description:
    "Remove EXIF, GPS, XMP and comment metadata from JPEG, PNG and WebP images before you share them. The pixel data is copied byte-for-byte, so quality never changes. Files stay on your device.",
  primaryKeyword: "remove exif data",
  seoTitle: "Remove EXIF Data from Photos Online, Free",
  seoDescription:
    "Strip GPS location, camera details and other metadata from JPEG, PNG and WebP photos without recompressing them. Private: nothing is uploaded.",
  answer:
    "EXIF & Metadata Remover helps you remove EXIF data: it strips GPS, XMP and comment metadata from JPEG, PNG and WebP images before you share them. The pixels are copied byte for byte, so quality does not change. Your files stay on your device.",
  category: "image",
  keywords: ["remove exif", "strip metadata", "remove gps from photo", "exif remover", "photo privacy", "delete image metadata"],
  icon: EyeOff,
  popular: true,
  howTo: ["Drop one or more photos.", "See what was removed from each photo.", "Download the cleaned copies."],
  faq: [
    { question: "Does removing metadata reduce image quality?", answer: "No. Unlike re-saving an image, this tool deletes only the metadata segments and copies the image data unchanged, so the picture is identical." },
    { question: "What gets removed?", answer: "EXIF (camera, date and GPS location), XMP, IPTC/Photoshop data and comments. By default the embedded color profile is kept so colors still look right; you can remove it too." },
  ],
  nextStep: { slug: "exif-viewer", text: "Want to see what a photo reveals first? Open it in the EXIF Viewer." },
  related: ["exif-viewer", "image-compressor", "pdf-metadata-editor", "image-crop"],
});
