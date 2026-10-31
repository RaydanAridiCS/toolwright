/**
 * Guides: longer answers to the questions people type, each linking to the tool that does the job.
 * Written and checked by the Toolwright team against how the tools actually behave; `updated` is the date of the
 * last real edit. To add one, see docs/seo.md.
 */
export type GuideBlock =
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "table"; caption: string; head: string[]; rows: string[][] }
  | { type: "tool"; slug: string; text: string };

export interface GuideSection {
  heading: string;
  blocks: GuideBlock[];
}

export interface Guide {
  slug: string;
  /** Search title without the brand, 25-47 characters. */
  seoTitle: string;
  h1: string;
  /** Meta description, 110-160 characters. */
  seoDescription: string;
  /** Answer-first summary shown under the H1. */
  answer: string;
  /** ISO dates (YYYY-MM-DD). `updated` must change only when the content really does. */
  published: string;
  updated: string;
  /** Slugs of the tools this guide uses, in the order they are introduced. */
  tools: string[];
  sections: GuideSection[];
  faq: { question: string; answer: string }[];
}

export const GUIDES: Guide[] = [
  {
    slug: "compress-pdf-without-uploading",
    seoTitle: "How to Compress a PDF Without Uploading It",
    h1: "How to compress a PDF without uploading it",
    seoDescription: "Shrink a PDF on your own device in three steps. Learn what makes PDFs big and when to keep text or use the smallest file. Nothing is uploaded.",
    answer: "To compress a PDF without uploading it, use a tool that runs in your browser: your file is read from your disk, shrunk inside the page and saved back, and no copy goes to a server. In Toolwright's Compress PDF, choose Keep text to recompress the photos inside, or Smallest file to turn each page into a picture for the biggest saving.",
    published: "2026-10-31",
    updated: "2026-10-31",
    tools: ["compress-pdf", "split-pdf", "merge-pdf"],
    sections: [
      {
        heading: "Why most PDFs are large",
        blocks: [
          { type: "p", text: "A PDF is a container. Text and drawings take very little room, so when a PDF is large the cause is nearly always pictures: photos from a phone, scanned pages (each page is one big picture) and images pasted in from other programs. Embedded fonts add a little more." },
          { type: "p", text: "That tells you where the saving is. Making the pictures smaller shrinks the file a lot, while the text barely changes the size." },
        ],
      },
      {
        heading: "Why compressing in the browser matters",
        blocks: [
          { type: "p", text: "PDFs are often the documents you least want to hand over: contracts, tax forms, ID scans, medical letters. Many compression sites work by uploading the file to a server, shrinking it there and sending it back, which means a copy of your document exists on a machine you do not control." },
          { type: "p", text: "A browser-based tool does the work on your own device. The file never travels, so there is nothing to be stored, leaked or kept. You can check this yourself: open your browser's developer tools, switch to the Network tab and compress a file. No request carries your PDF." },
        ],
      },
      {
        heading: "How to compress a PDF in three steps",
        blocks: [
          { type: "ol", items: ["Open Compress PDF and drop your file into the box. The tool lists how much of the PDF is images.", "Choose a mode: Keep text recompresses the photos and leaves text, links and forms alone; Smallest file turns each page into a picture. Then choose Light, Balanced or Strong.", "Compress and download. If the result would not be smaller, you are given your original back instead of a bigger file."] },
          { type: "tool", slug: "compress-pdf", text: "Compress a PDF now. Nothing is uploaded, and there is no sign-up or watermark." },
        ],
      },
      {
        heading: "Keep text or Smallest file?",
        blocks: [
          { type: "table", caption: "The two modes of Compress PDF", head: ["", "Keep text", "Smallest file"], rows: [["What it does", "Recompresses the JPEG photos inside the PDF", "Draws every page and saves it as a picture"], ["Text stays selectable and searchable", "Yes", "No"], ["Links, forms, bookmarks", "Kept", "Lost"], ["Typical saving", "Large if the file is photo-heavy, little if not", "Usually the largest"], ["Best for", "Documents you still need to read or fill in", "Files you only need to look at or print"]] },
          { type: "p", text: "Start with Keep text. If it saves little, the PDF probably has few JPEG photos (screenshots and exports from office programs often store images without loss, which Keep text cannot shrink), and Smallest file is the next thing to try, knowing that you give up selectable text." },
        ],
      },
      {
        heading: "Limits worth knowing",
        blocks: [
          { type: "ul", items: ["Password-protected PDFs are refused. Remove the password first.", "A digitally signed PDF can be compressed, but any change makes its signature invalid.", "Files up to 200 MB are accepted, and up to 1,000 pages for Smallest file, because a browser tab has limited memory.", "Compression is not magic: a PDF that is already small or has no images may not shrink at all."] },
          { type: "p", text: "If a file is too large to handle, split it into parts, compress each part and merge them again." },
          { type: "tool", slug: "split-pdf", text: "Split a large PDF into parts first." },
        ],
      },
    ],
    faq: [
      { question: "Is it safe to compress a PDF online?", answer: "It is as safe as the tool is private. A tool that uploads your file puts a copy on someone else's server. A tool that runs in your browser does not, and you can confirm that in your browser's Network tab." },
      { question: "Will compressing a PDF reduce its quality?", answer: "Recompressing photos lowers their quality a little, more at the Strong setting. Text and vector drawings are untouched in Keep text mode. In Smallest file mode the text becomes part of a picture." },
      { question: "Why did my PDF not get smaller?", answer: "Keep text can only recompress JPEG photos. A PDF with no photos, or with images stored without loss, has nothing for it to shrink. The tool lists what it skipped, and Smallest file can still help." },
    ],
  },
  {
    slug: "reduce-pdf-size-under-1-mb",
    seoTitle: "How to Reduce a PDF to Under 1 MB",
    h1: "How to reduce a PDF's size to under 1 MB",
    seoDescription: "Get a PDF under 1 MB by working through the options in order: compress photos, remove pages, split the file. Honest about what is and is not possible.",
    answer: "To get a PDF under 1 MB, first compress it with Keep text, then try the Strong setting, then delete pages you do not need, and if it is still too large use Smallest file or split the document. No tool can promise an exact size, because it depends on what the PDF contains, but this order gets most files there with the least loss.",
    published: "2026-10-31",
    updated: "2026-10-31",
    tools: ["compress-pdf", "delete-pdf-pages", "split-pdf", "pdf-to-images"],
    sections: [
      {
        heading: "Be realistic about the target",
        blocks: [
          { type: "p", text: "Email systems and upload forms often cap attachments at 1 MB, 2 MB or 5 MB. Whether a particular PDF can get under 1 MB depends on its content: a ten-page text document is already small, while fifty pages of high-resolution scans will need heavy compression, and may not fit at all without becoming hard to read." },
          { type: "p", text: "Toolwright's Compress PDF has no 'target size' setting. It gives you three strengths and tells you the result, so you can try again with a stronger one." },
        ],
      },
      {
        heading: "The order to try things in",
        blocks: [
          { type: "ol", items: ["Compress with Keep text at Balanced. Text, links and forms stay as they are.", "If it is still too large, try Strong. Photos lose more detail, so check the result is still readable.", "Remove pages you do not need, such as blank pages, cover sheets or duplicates, with Delete PDF Pages.", "Try Smallest file. This turns every page into a picture, which usually saves the most, but the text can no longer be selected, searched or copied.", "If it still does not fit, split the document into parts and send them separately."] },
          { type: "tool", slug: "compress-pdf", text: "Start with Compress PDF. Your file stays on your device." },
        ],
      },
      {
        heading: "What each step costs you",
        blocks: [
          { type: "table", caption: "Ways to make a PDF smaller", head: ["Step", "What you give up"], rows: [["Keep text, Balanced", "A little photo detail"], ["Keep text, Strong", "More photo detail"], ["Delete pages", "The pages you delete"], ["Smallest file", "Selectable text, links, forms, bookmarks"], ["Split into parts", "One file becomes several"]] },
          { type: "p", text: "Scanned documents are the hard case. A scan is a picture of each page, so there is no text to keep, and Keep text has little to work with. For scans, Smallest file is the usual route, and a lower setting is worth trying before the Strong one." },
        ],
      },
      {
        heading: "Aim a little below the limit",
        blocks: [
          { type: "p", text: "Email attaches files as text, which makes them about a third bigger than they are on your disk. A 1 MB limit on an email can therefore mean a file of roughly 700 to 750 KB. If a form or a mail system rejects a file that Toolwright shows as just under the limit, compress it once more at a stronger setting." },
          { type: "p", text: "After each run the tool shows the new size next to the original, so you can see whether another pass is worth it before you download anything." },
        ],
      },
      {
        heading: "If the file is just too big",
        blocks: [
          { type: "p", text: "Split the PDF into two or three parts and compress each one. Or, if a recipient only needs to look at some pages, extract those pages into a new file. Both keep every page sharp and each part may fit on its own." },
          { type: "tool", slug: "split-pdf", text: "Split the PDF into parts that each fit." },
        ],
      },
    ],
    faq: [
      { question: "Can I compress a PDF to exactly 100 KB or 1 MB?", answer: "There is no setting that aims for an exact size. Choose a strength, check the size shown after compressing and try a stronger setting or Smallest file if you need more." },
      { question: "Why is my PDF so big?", answer: "Almost always because of pictures: phone photos, scanned pages or images pasted from other programs. Text and drawings take very little space." },
      { question: "Does compressing remove text from the PDF?", answer: "Keep text does not. Smallest file does, in the sense that each page becomes a picture, so the text can no longer be selected or searched." },
    ],
  },
  {
    slug: "merge-pdf-without-uploading",
    seoTitle: "How to Merge PDF Files Without Uploading",
    h1: "How to merge PDF files without uploading them",
    seoDescription: "Combine PDFs into one file on your own device. Step by step, with tips on ordering pages, mixing in pictures and keeping the result small.",
    answer: "To merge PDFs without uploading them, open a browser-based merge tool, add your files, put them in order and download the combined document. In Toolwright's Merge PDF the files are combined on your device, so nothing is uploaded, and there is no sign-up and no watermark.",
    published: "2026-10-31",
    updated: "2026-10-31",
    tools: ["merge-pdf", "images-to-pdf", "extract-pdf-pages", "pdf-organizer", "compress-pdf", "pdf-page-numbers"],
    sections: [
      {
        heading: "Merge PDFs in three steps",
        blocks: [
          { type: "ol", items: ["Open Merge PDF and add two or more PDF files, by dropping them in or choosing them from your disk.", "Use the arrows to put the files in the order you want them to appear.", "Click Merge and download the combined PDF."] },
          { type: "tool", slug: "merge-pdf", text: "Merge your PDFs now. They never leave your device." },
        ],
      },
      {
        heading: "Why do it in the browser",
        blocks: [
          { type: "p", text: "Documents you merge are often the ones you would rather not hand to a stranger: an application with ID scans, a set of invoices, a contract and its appendices. When the work happens in your browser, the files are read from your disk into the page and the result is saved back, so no copy is made elsewhere. You can verify it by watching the Network tab of your developer tools while you merge." },
        ],
      },
      {
        heading: "Mixing in pictures and scans",
        blocks: [
          { type: "p", text: "Merge PDF takes PDF files. If part of your document is a set of photos or scans saved as JPG, PNG or WebP, first turn them into a PDF with Images to PDF, which lets you choose the page size and margins, and then merge that PDF with the others." },
          { type: "tool", slug: "images-to-pdf", text: "Turn pictures into a PDF before you merge." },
        ],
      },
      {
        heading: "Merge, combine, join, append: the same job",
        blocks: [
          { type: "p", text: "People search for this under several names, but the result is the same: several PDF files become one file, with the pages of the first followed by the pages of the second, and so on. If you want only some pages from a file, extract them first and merge the new file; if you want to cut a PDF apart instead, that is splitting." },
          { type: "tool", slug: "extract-pdf-pages", text: "Pull just the pages you need out of a PDF before you merge." },
        ],
      },
      {
        heading: "Check the order before you send it",
        blocks: [
          { type: "p", text: "The most common mistake is a wrong order, such as a cover letter that ended up last. The merge tool lists the files with arrows so you can reorder them before you merge, and the PDF Page Organizer shows a preview of every page afterwards, so you can move a single page that is out of place." },
          { type: "p", text: "Scanned pages are pictures, so a merged file of scans can be large even when each part is small. If the result is too big for an email, compress it as the last step." },
        ],
      },
      {
        heading: "Before and after you merge",
        blocks: [
          { type: "ul", items: ["To reorder single pages after merging, or remove some, use the PDF Page Organizer, which shows each page.", "If the merged file is too large to email, compress it afterwards.", "If the merged document needs page numbers, add them after merging so they run through the whole file."] },
          { type: "tool", slug: "compress-pdf", text: "Compress the merged file to make it easier to send." },
        ],
      },
    ],
    faq: [
      { question: "Is there a limit on how many PDFs I can merge?", answer: "Toolwright sets no limit on the number of files or pages. The practical limit is your device's memory, and merging a few hundred megabytes is usually fine on a modern computer." },
      { question: "Does merging PDFs add a watermark?", answer: "No. The merged file contains your pages and nothing else." },
      { question: "Can I merge PDFs on my phone?", answer: "Yes, in a modern mobile browser. Very large files may be slower or run out of memory on a phone." },
    ],
  },
  {
    slug: "what-is-exif-data",
    seoTitle: "What Is EXIF Data and How to Remove It",
    h1: "What EXIF data is, and how to remove it from your photos",
    seoDescription: "EXIF data is the hidden information in a photo: camera, date and often GPS location. See what yours reveals and remove it before you share.",
    answer: "EXIF data is information a camera or phone writes into a photo file: the camera and lens, exposure settings, the date and time, and often the GPS location where you took it. You can see it with an EXIF viewer and remove it with an EXIF remover before you share a photo.",
    published: "2026-10-31",
    updated: "2026-10-31",
    tools: ["exif-viewer", "exif-remover", "image-compressor"],
    sections: [
      {
        heading: "What is stored in a photo",
        blocks: [
          { type: "p", text: "Almost every photo from a phone or a digital camera carries a block of metadata called EXIF. It typically includes:" },
          { type: "ul", items: ["The camera or phone model and the lens.", "Exposure settings: shutter speed, aperture, ISO, focal length.", "The date and time the picture was taken.", "The GPS coordinates, if location tagging was on.", "The software that edited the file, and sometimes a comment or a copyright line."] },
          { type: "p", text: "Other metadata formats such as XMP can carry more, for example editing history and keywords." },
        ],
      },
      {
        heading: "Why it matters for privacy",
        blocks: [
          { type: "p", text: "The GPS coordinates are the part that matters most. A photo taken at home and posted somewhere that keeps its metadata can reveal where you live. The timestamp and the device model can also say more about you than you meant to share." },
          { type: "p", text: "Many apps and websites remove metadata when you upload a picture, but not all do, and you cannot tell which from the outside. Photos you send as files, attach to emails or post on small sites are the ones most likely to arrive intact." },
        ],
      },
      {
        heading: "See what a photo reveals",
        blocks: [
          { type: "p", text: "Drop a photo into the EXIF Viewer to read the camera, settings, date and GPS fields. The file is read in your browser and never uploaded." },
          { type: "tool", slug: "exif-viewer", text: "Check what a photo reveals before you share it." },
        ],
      },
      {
        heading: "Remove it",
        blocks: [
          { type: "p", text: "The EXIF & Metadata Remover strips EXIF, GPS, XMP and comment data from JPEG, PNG and WebP files. It copies the picture's pixels byte for byte, so the image quality does not change and the file is not recompressed. By default it keeps the embedded color profile so colors look identical; you can turn that off to remove it too." },
          { type: "tool", slug: "exif-remover", text: "Remove the metadata from your photos." },
          { type: "p", text: "Re-saving a picture by drawing it on a canvas, which is what the Image Compressor does, also leaves the metadata behind, but it recompresses the picture. If you only want to remove metadata, use the remover so the pixels stay exactly as they are." },
        ],
      },
      {
        heading: "What removing EXIF data does not hide",
        blocks: [
          { type: "p", text: "Removing metadata only removes what is stored in the file. It cannot hide what the picture shows: a street sign, a house number, a car registration, a recognizable view from your window or a face. Look at the picture itself before you share it, as well as at its metadata." },
          { type: "p", text: "It also does not change the file name, which can carry a date or a place if you named it that way, and it does not affect copies of the photo that already exist elsewhere, such as the original on your phone or a version you posted earlier." },
          { type: "ol", items: ["Open the photo in the EXIF Viewer to see what it carries.", "Remove the metadata, and keep the cleaned copy for sharing.", "Check the picture itself for anything you would rather not show, and rename the file if its name gives something away."] },
        ],
      },
    ],
    faq: [
      { question: "Does a screenshot have EXIF data?", answer: "Screenshots usually carry far less than photos, with no camera settings and no GPS location, though they can contain a date and the software that made them." },
      { question: "Does removing EXIF data reduce image quality?", answer: "Not with a lossless remover. The EXIF & Metadata Remover copies the picture data unchanged and only drops the metadata, so quality is the same." },
      { question: "Can I stop my phone adding GPS to photos?", answer: "Yes. Turn off location tagging for the camera in your phone's settings. Photos taken afterwards will not carry coordinates, but photos already taken keep theirs until you remove them." },
    ],
  },
  {
    slug: "jpg-vs-png-vs-webp",
    seoTitle: "JPG vs PNG vs WebP: Which to Use",
    h1: "JPG vs PNG vs WebP: which image format should you use?",
    seoDescription: "Compare JPG, PNG and WebP for photos, logos, screenshots and web pages. A plain table, when each wins and how to convert between them privately.",
    answer: "Use JPG for photos when file size matters and you do not need transparency, PNG for screenshots, logos and graphics that need sharp edges or transparency, and WebP when you want smaller files than either for the web and your audience uses current browsers. JPG and WebP are lossy; PNG is lossless.",
    published: "2026-10-31",
    updated: "2026-10-31",
    tools: ["image-converter", "image-compressor", "image-resizer"],
    sections: [
      {
        heading: "The short comparison",
        blocks: [
          { type: "table", caption: "JPG, PNG and WebP compared", head: ["", "JPG", "PNG", "WebP"], rows: [["Compression", "Lossy", "Lossless", "Lossy or lossless"], ["Transparency", "No", "Yes", "Yes"], ["Best for", "Photos", "Screenshots, logos, line art, text", "Photos and graphics on the web"], ["File size for a photo", "Small", "Large", "Usually the smallest"], ["Support", "Everywhere", "Everywhere", "Current browsers and most apps"]] },
          { type: "p", text: "Lossy means some detail is thrown away to save space, and every re-save at a lower quality throws away a little more. Lossless means the picture can be restored exactly." },
        ],
      },
      {
        heading: "Which one for which job",
        blocks: [
          { type: "ul", items: ["A photograph to email or upload: JPG, or WebP if the place accepts it.", "A screenshot with text: PNG, because lossy compression smears small text.", "A logo or icon with a transparent background: PNG or WebP.", "A picture on a web page where speed matters: WebP, with JPG as the safe fallback.", "A file you will edit again: keep a PNG or the original, and export JPG or WebP copies, because each lossy save costs detail."] },
        ],
      },
      {
        heading: "Converting between them",
        blocks: [
          { type: "p", text: "Changing a PNG to JPG fills transparent areas with a background color, because JPG has no transparency. Changing a JPG to PNG makes the file larger without making the picture better, since the detail the JPG already lost does not come back." },
          { type: "tool", slug: "image-converter", text: "Convert images between JPG, PNG, WebP and AVIF in your browser." },
          { type: "p", text: "AVIF is a newer format that can be smaller still. Whether your browser can create it depends on the browser, so the converter lists it as depending on your browser." },
        ],
      },
      {
        heading: "Common mistakes",
        blocks: [
          { type: "ul", items: ["Saving a JPG as PNG to improve it. The detail the JPG already lost does not come back, so the file only gets bigger.", "Saving the same JPG again and again at a lower quality. Each save costs a little more detail, so keep an original and export copies from it.", "Using JPG for a screenshot with small text. The compression smears the edges of letters; PNG keeps them sharp.", "Sending a 12-megapixel phone photo where a page shows 1,600 pixels across. Resizing first often saves more than any quality setting."] },
          { type: "p", text: "A photo that is several megabytes as a PNG is often several times smaller as a JPG or WebP, which is why photos on the web are rarely PNG." },
        ],
      },
      {
        heading: "Making files smaller",
        blocks: [
          { type: "p", text: "A PNG is lossless, so lowering a quality setting does not shrink it; resizing the picture or switching to WebP or JPG does. For JPG and WebP, a quality around 75 to 85 percent is a common starting point that keeps files much smaller with little visible loss, but look at the result." },
          { type: "tool", slug: "image-compressor", text: "Compress JPG, PNG and WebP images and compare the sizes before and after." },
          { type: "tool", slug: "image-resizer", text: "Resize large photos to the dimensions you actually need." },
        ],
      },
    ],
    faq: [
      { question: "Is WebP better than JPG?", answer: "For most photos WebP gives a smaller file at similar quality, and it supports transparency. JPG is still the safest choice when a place may not accept WebP." },
      { question: "Does converting PNG to JPG lose quality?", answer: "Yes. JPG is lossy, so some detail is discarded, and transparent areas are filled with a color." },
      { question: "Why is my PNG so large?", answer: "PNG stores every pixel without loss, which suits graphics but makes photos large. Resize the picture or save it as WebP or JPG to shrink it." },
    ],
  },
  {
    slug: "does-this-tool-upload-my-files",
    seoTitle: "How to Tell If an Online Tool Uploads Files",
    h1: "How to tell whether an online tool uploads your files",
    seoDescription: "A 60-second check anyone can do with the browser's Network tab, plus what it proves and what it cannot. Works for any website, not just ours.",
    answer: "To tell whether a website uploads your file, open your browser's developer tools, switch to the Network tab, clear it, use the tool, and look for requests that send data out. If a tool really runs in your browser, no request carries your file, and it keeps working when you go offline after the page has loaded.",
    published: "2026-10-31",
    updated: "2026-10-31",
    tools: ["compress-pdf", "exif-remover"],
    sections: [
      {
        heading: "The 60-second Network tab check",
        blocks: [
          { type: "ol", items: ["Open the tool's page and wait for it to load.", "Press F12 (or Ctrl or Cmd plus Shift plus I) to open the developer tools and choose the Network tab.", "Click the clear button so the list is empty.", "Use the tool with a file or some text.", "Look at the list. Requests to the site's own address that fetch scripts or fonts are normal. A request with a method of POST or PUT, or one whose size is about the size of your file, is the sign of an upload."] },
          { type: "p", text: "If the list stays empty or shows nothing that carries your data, the work was done on your device." },
        ],
      },
      {
        heading: "The offline test",
        blocks: [
          { type: "p", text: "After the page has loaded, turn on airplane mode, or choose Offline in the Network tab, and use the tool again. A tool that depends on a server stops working. One that runs in your browser carries on, because everything it needs is already in the page." },
        ],
      },
      {
        heading: "Signs a tool uploads your file",
        blocks: [
          { type: "ul", items: ["The page says it will delete your files after an hour or a day. If it can delete them, it received them.", "A progress bar labelled uploading, or one that moves at the speed of your internet connection rather than your computer.", "It stops working when you go offline after the page has loaded.", "It asks you to sign up before it processes a file, or limits the size of file you may use to something a server would have to handle."] },
          { type: "p", text: "None of these is proof on its own, and a tool that shows none of them is not automatically private, which is why the Network tab check above is worth doing." },
        ],
      },
      {
        heading: "What these checks prove, and what they do not",
        blocks: [
          { type: "ul", items: ["They show what this page did on this visit. They cannot show what a different version of the page, or another visitor's session, might do.", "They cannot see inside browser extensions, which may read what you type on any page.", "A Content Security Policy that only allows connections to the site's own address makes the browser itself refuse requests to anywhere else. You can see a site's policy in the response headers of its page in the Network tab.", "An open-source project lets you read the code and check that nothing is sent, which is the strongest check of all."] },
        ],
      },
      {
        heading: "How Toolwright does it",
        blocks: [
          { type: "p", text: "Toolwright's tools run in your browser, the page's policy allows connections only to its own site, and it has no analytics or third-party scripts. Each tool page shows a live count of requests made to other sites, which should read zero. You can try the check on a file tool such as Compress PDF or the EXIF Remover." },
          { type: "tool", slug: "compress-pdf", text: "Try the Network tab check on Compress PDF." },
        ],
      },
    ],
    faq: [
      { question: "Is a tool that says it is private really private?", answer: "Not necessarily. A claim is only as good as what you can check. The Network tab test and the offline test are quick ways to check it yourself." },
      { question: "Can a website read my files without me choosing them?", answer: "No. A web page can only read files you pick or drop onto it. It cannot browse your disk." },
      { question: "Does HTTPS mean my file is not uploaded?", answer: "No. HTTPS encrypts what is sent so others cannot read it on the way. It says nothing about whether the site receives it." },
    ],
  },
  {
    slug: "cidr-notation-and-subnet-masks",
    seoTitle: "CIDR Notation and Subnet Masks Explained",
    h1: "CIDR notation and subnet masks explained, with a table",
    seoDescription: "What /24 means, how many hosts a subnet holds and how masks map to prefixes. A reference table for IPv4, plus a calculator that does the sums.",
    answer: "CIDR notation writes a network as an address and a prefix length, such as 192.168.1.0/24, where the number after the slash is how many leading bits identify the network. A /24 has 256 addresses, of which 254 can be given to hosts, and its subnet mask is 255.255.255.0.",
    published: "2026-10-31",
    updated: "2026-10-31",
    tools: ["subnet-calculator", "port-numbers"],
    sections: [
      {
        heading: "What the number after the slash means",
        blocks: [
          { type: "p", text: "An IPv4 address has 32 bits. The prefix length says how many of them, counted from the left, name the network. The rest name the host inside it. In 192.168.1.0/24 the first 24 bits (192.168.1) name the network and the last 8 bits can be any of 256 values." },
          { type: "p", text: "The subnet mask is the same idea written as an address: 24 one-bits followed by 8 zero-bits is 255.255.255.0. The wildcard mask, used in some router configurations, is the mask turned inside out: 0.0.0.255." },
        ],
      },
      {
        heading: "Reference table for common prefixes",
        blocks: [
          { type: "table", caption: "IPv4 prefix lengths", head: ["Prefix", "Subnet mask", "Addresses", "Usable hosts"], rows: [["/8", "255.0.0.0", "16,777,216", "16,777,214"], ["/16", "255.255.0.0", "65,536", "65,534"], ["/24", "255.255.255.0", "256", "254"], ["/25", "255.255.255.128", "128", "126"], ["/26", "255.255.255.192", "64", "62"], ["/27", "255.255.255.224", "32", "30"], ["/28", "255.255.255.240", "16", "14"], ["/29", "255.255.255.248", "8", "6"], ["/30", "255.255.255.252", "4", "2"], ["/31", "255.255.255.254", "2", "2 (point-to-point links)"], ["/32", "255.255.255.255", "1", "1 (a single host)"]] },
          { type: "p", text: "Usable hosts are two fewer than the addresses because the first address names the network and the last is the broadcast address. A /31 is the exception, defined for links between two routers (RFC 3021), and a /32 is one address." },
        ],
      },
      {
        heading: "Two worked examples",
        blocks: [
          { type: "p", text: "Which network is 192.168.10.77/26 in? A /26 has 64 addresses, so networks start at multiples of 64 in the last number: 0, 64, 128 and 192. The address 77 sits between 64 and 127, so the network is 192.168.10.64/26. Its broadcast address is 192.168.10.127, and the usable hosts run from 192.168.10.65 to 192.168.10.126." },
          { type: "p", text: "How do you split 192.168.10.0/24 into four equal subnets? Four subnets need two more bits, so the prefix grows from /24 to /26, and each subnet holds 64 addresses." },
          { type: "ul", items: ["192.168.10.0/26 covers .0 to .63", "192.168.10.64/26 covers .64 to .127", "192.168.10.128/26 covers .128 to .191", "192.168.10.192/26 covers .192 to .255"] },
        ],
      },
      {
        heading: "IPv6 uses the same idea",
        blocks: [
          { type: "p", text: "An IPv6 address has 128 bits, and the prefix length counts leading bits in the same way. A /64 is the usual size for a single local network, and 2001:db8::/32 is a block set aside for documentation and examples (RFC 3849). IPv6 has no broadcast address and no dotted subnet mask, so only the prefix length is used." },
        ],
      },
      {
        heading: "Private ranges",
        blocks: [
          { type: "ul", items: ["10.0.0.0/8 (10.0.0.0 to 10.255.255.255)", "172.16.0.0/12 (172.16.0.0 to 172.31.255.255)", "192.168.0.0/16 (192.168.0.0 to 192.168.255.255)"] },
          { type: "p", text: "These three blocks are reserved for private networks (RFC 1918) and are not routed on the public internet." },
        ],
      },
      {
        heading: "Let a calculator do the sums",
        blocks: [
          { type: "p", text: "For anything beyond a table, such as splitting a /24 into four /26 subnets, turning an address range into the fewest CIDR blocks or merging a list of networks, the IP & Subnet Calculator does the arithmetic for IPv4 and IPv6, in your browser, with nothing sent anywhere." },
          { type: "tool", slug: "subnet-calculator", text: "Work out a network's mask, range and host count." },
          { type: "p", text: "Writing firewall rules as well? The list of common port numbers is one search away." },
          { type: "tool", slug: "port-numbers", text: "Look up which service uses which port." },
        ],
      },
    ],
    faq: [
      { question: "How many hosts are in a /24?", answer: "A /24 has 256 addresses and 254 usable host addresses, because the first is the network address and the last is the broadcast address." },
      { question: "What is the difference between a subnet mask and a prefix length?", answer: "They say the same thing. 255.255.255.0 and /24 both mean that the first 24 bits identify the network." },
      { question: "Does IPv6 use subnet masks?", answer: "IPv6 uses the same prefix-length notation, such as 2001:db8::/32, and has no broadcast address or dotted mask." },
    ],
  },
];

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}
