import { Barcode } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "barcode-generator",
  name: "Barcode Generator",
  tagline: "Make Code 128, EAN-13, UPC-A, Code 39 and other barcodes as SVG or PNG.",
  description:
    "Type a number or text and get a barcode you can download as a sharp SVG or a PNG: Code 128, EAN-13, EAN-8, UPC-A, Code 39, Interleaved 2 of 5 and ITF-14. Check digits are worked out for you. It runs in your browser, so nothing is uploaded.",
  category: "generators",
  keywords: ["barcode generator", "code 128 generator", "ean 13 barcode", "upc a barcode", "code 39 barcode", "itf 14 barcode", "make barcode online", "ean 8", "check digit calculator"],
  icon: Barcode,
  howTo: [
    "Choose the barcode type and type the number or text.",
    "Adjust the bar width and height if you need to, and check the notes.",
    "Download the SVG or PNG.",
  ],
  faq: [
    {
      question: "Is what I type sent anywhere?",
      answer: "No. The barcode is drawn in your browser from the text you type, and nothing is uploaded. The text is not put in the page address either.",
    },
    {
      question: "Which type should I use?",
      answer: "Use EAN-13 (worldwide) or UPC-A (North America) for products sold in shops, and ITF-14 for the cartons they ship in. For shipping labels, inventory and anything else, Code 128 holds any plain text and is the usual choice. Code 39 is older and holds capital letters and digits only.",
    },
    {
      question: "What is the check digit?",
      answer: "The last digit of EAN, UPC and ITF-14 numbers is worked out from the others so scanners can catch a misread. Type the number without it and it is added; type it with the check digit and it is checked, with an error if it is wrong.",
    },
    {
      question: "Will it scan?",
      answer: "The bars follow the standards, and pictures of them were read back by a separate decoder during testing. Still, print a sample and try it with your real scanner before you print a lot. Keep dark bars on a light background, leave the blank margin at the sides, and do not make it smaller than your scanner can read.",
    },
    {
      question: "Can I use these on products I sell?",
      answer: "The tool draws any number you give it, but EAN and UPC product numbers must be issued to your company through GS1 for them to be unique in shops. A made-up number may clash with someone else's product.",
    },
    {
      question: "Why does it refuse accented letters?",
      answer: "Code 128 and Code 39 hold plain ASCII characters only. For other characters, such as accents or other alphabets, use a QR code.",
    },
  ],
  related: ["qr-code-generator", "unique-id-generator", "image-to-base64", "svg-to-png", "hash-generator"],
});
