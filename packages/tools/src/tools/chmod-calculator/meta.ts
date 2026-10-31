import { FolderLock } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "chmod-calculator",
  name: "Chmod Calculator",
  tagline: "Convert Linux file permissions between octal and rwx notation.",
  description: "Tick read, write and execute boxes for owner, group and others to get the octal mode (like 755) and the symbolic form (rwxr-xr-x), or type either one. Includes a ready-to-copy chmod command.",
  primaryKeyword: "chmod calculator",
  seoTitle: "Chmod Calculator: Octal and rwx Permissions",
  seoDescription:
    "Convert Linux file permissions between octal (755) and symbolic (rwxr-xr-x) with checkboxes, and copy the chmod command. Free, in your browser.",
  answer:
    "Chmod Calculator converts Linux and Unix file permissions between octal numbers such as 755 and symbolic form such as rwxr-xr-x. Tick read, write and execute for owner, group and others, or type either form, and copy the chmod command.",
  category: "developer",
  keywords: ["chmod calculator", "linux permissions", "file permissions", "chmod 755", "octal permissions", "rwx"],
  icon: FolderLock,
  howTo: ["Tick the permissions for owner, group and others, or type an octal mode such as 755.", "Read the octal and symbolic forms, which update together.", "Copy the ready-made chmod command."],
  faq: [
    { question: "What does chmod 755 mean?", answer: "The owner can read, write and execute (7). The group and everyone else can read and execute (5). In symbolic form that is rwxr-xr-x." },
    { question: "What does chmod 644 mean?", answer: "The owner can read and write (6). The group and everyone else can only read (4). In symbolic form that is rw-r--r--, a common setting for ordinary files." },
    { question: "Is chmod 777 safe?", answer: "It lets every user read, write and execute the file, so it is rarely a good idea, especially on a shared server. Give the least access that works." },
  ],
  related: ["port-numbers", "number-base-converter", "http-status-codes"],
});
