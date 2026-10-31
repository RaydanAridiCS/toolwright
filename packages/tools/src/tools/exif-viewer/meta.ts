import { Camera } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "exif-viewer",
  name: "EXIF Viewer",
  tagline: "See the camera settings, date and GPS location hidden in a photo.",
  description:
    "Inspect the EXIF metadata embedded in your photos: camera and lens, exposure settings, capture date and GPS coordinates. Find out what you would be sharing before you post an image. Read locally in your browser.",
  primaryKeyword: "exif viewer",
  seoTitle: "EXIF Viewer: See Photo Metadata and GPS",
  seoDescription:
    "See the camera, lens, settings, date and GPS location hidden in a photo before you share it. Free, and the image is read in your browser.",
  answer:
    "EXIF Viewer shows the metadata inside a photo: camera and lens, exposure settings, capture date and GPS coordinates. It reads the file in your browser, so you can see what you would be sharing before you post it.",
  category: "image",
  keywords: ["exif viewer", "photo metadata", "image metadata viewer", "gps from photo", "camera settings", "exif data reader"],
  icon: Camera,
  howTo: ["Drop a photo into the box.", "Read the camera, settings, date and GPS fields.", "If you do not want to share them, use the EXIF Remover."],
  faq: [
    { question: "What is EXIF data?", answer: "Information a camera or phone writes into a photo file: when and with what it was taken, the settings, and sometimes the GPS location." },
    { question: "Does every photo have GPS data?", answer: "No. Many cameras do not record it, and many apps remove it when you share. A photo straight from a phone usually has it unless location tagging is off." },
    { question: "Is my photo uploaded?", answer: "No. The metadata is read in your browser and the image never leaves your device." },
  ],
  nextStep: { slug: "exif-remover", text: "Found something you do not want to share? Remove the metadata." },
  related: ["exif-remover", "image-compressor", "image-color-picker"],
});
