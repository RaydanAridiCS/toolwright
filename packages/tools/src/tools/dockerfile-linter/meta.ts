import { FileCheck } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "dockerfile-linter",
  name: "Dockerfile Linter",
  tagline: "Check a Dockerfile for common mistakes and risky habits.",
  description:
    "Paste or drop a Dockerfile and get line-numbered findings with a fix for each: unpinned base images, running as root, apt-get without -y, curl piped into a shell, secrets in ENV, bad COPY destinations and more. It reads the text only and runs in your browser; nothing is uploaded or built.",
  primaryKeyword: "dockerfile linter",
  seoTitle: "Dockerfile Linter: Check Best Practices Online",
  seoDescription:
    "Paste a Dockerfile and get line-numbered findings with a fix for each: unpinned images, root user, secrets in ENV and more. Runs in your browser.",
  answer:
    "Dockerfile Linter checks a Dockerfile for common mistakes and risky habits, such as unpinned base images, running as root, curl piped into a shell and secrets in ENV, and gives each finding a line number and a fix. It reads the text only and runs in your browser.",
  category: "developer",
  keywords: ["dockerfile linter", "lint dockerfile", "dockerfile checker", "dockerfile best practices", "dockerfile validator", "dockerfile security check", "dockerfile online"],
  icon: FileCheck,
  howTo: ["Paste your Dockerfile, or drop the file onto the box.", "Read the findings. Each has a line number, a plain explanation and a suggested fix.", "Fix the errors first, then the warnings. Tips are optional."],
  faq: [
    {
      question: "Is my Dockerfile uploaded or built?",
      answer: "Neither. It is read as text in your browser. Nothing is built, pulled or run, and the text is kept out of the address bar.",
    },
    {
      question: "Which problems does it look for?",
      answer:
        "Base images with no tag or :latest, missing FROM, duplicate stage names and COPY --from to stages that do not exist, running as root, apt-get and yum installs without -y, split apt-get update and install, cd in RUN, sudo, chmod 777, curl or wget piped into a shell, secrets in ENV and ARG, ADD where COPY would do, relative WORKDIR, shell-form CMD, MAINTAINER, and exposing port 22.",
    },
    {
      question: "Is it a replacement for hadolint or a security scanner?",
      answer: "No. It checks a short list of common issues in the Dockerfile text. It does not know what is inside your base image, cannot see your build context, and does not scan for vulnerable packages.",
    },
    {
      question: "Why does it say my image runs as root?",
      answer: "If the last stage never sets USER, processes in the container run as root by default. A bug in your app then has more power than it needs. Create a user and switch to it with USER.",
    },
  ],
  related: ["json-formatter", "yaml-validator", "cron-explainer", "regex-tester", "chmod-calculator"],
});
