import { Crop } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "image-crop",
  name: "Crop, Rotate & Flip Image",
  tagline: "Crop a picture, turn it, flip it or straighten it, without an upload.",
  description:
    "Crop a JPG, PNG or WebP to any shape or a fixed ratio, turn it in quarter steps, flip it, or straighten a crooked photo. The picture is processed in your browser and never leaves your device.",
  primaryKeyword: "crop image",
  seoTitle: "Crop Image Online: Crop, Rotate and Flip",
  seoDescription:
    "Crop a JPG, PNG or WebP to any shape or ratio, rotate, flip or straighten it. Free, and the picture never leaves your device.",
  answer:
    "Crop, Rotate & Flip Image crops a JPG, PNG or WebP to any shape or a fixed ratio, turns it in quarter steps, flips it or straightens a crooked photo. It runs in your browser, so the picture is never uploaded.",
  category: "image",
  keywords: ["crop image", "rotate image", "flip image", "straighten photo", "image cropper", "crop photo online", "mirror image", "crop to square", "aspect ratio crop"],
  icon: Crop,
  howTo: [
    "Drop a JPG, PNG or WebP picture.",
    "Turn, flip or straighten it, then drag the box or type its size.",
    "Pick the format and download the result.",
  ],
  faq: [
    {
      question: "Is my picture uploaded?",
      answer: "No. The picture is opened, cropped and saved inside this browser tab. Nothing is sent anywhere.",
    },
    {
      question: "Does cropping lose quality?",
      answer: "PNG is lossless, so a crop keeps every pixel. JPEG and WebP are saved again, which loses a little detail each time; raise the quality setting if that matters. Rotating by a quarter turn and flipping move pixels without changing them.",
    },
    {
      question: "What happens to the location and camera data in my photo?",
      answer: "It is not copied. The cropped picture is drawn fresh, so GPS position, camera model and other EXIF data are left behind. The photo is turned the way it was meant to be viewed first, so it does not come out sideways.",
    },
    {
      question: "How do I remove the empty corners after straightening?",
      answer: "Straightening tilts the picture inside a larger frame, which leaves empty corners. Use the button that removes them, and the crop box shrinks to the largest area without gaps. Or fill the corners with a colour.",
    },
    {
      question: "Can I use it without a mouse?",
      answer: "Yes. Type the left, top, width and height of the box, or focus the box and use the arrow keys to move it and Shift with the arrows to resize it.",
    },
  ],
  nextStep: { slug: "image-resizer", text: "Cropped and need an exact size? Resize the image next." },
  related: ["image-resizer", "image-compressor", "image-converter", "favicon-generator", "exif-remover"],
});
