import { Scale } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "bmi-calculator",
  name: "BMI Calculator",
  tagline: "Work out your BMI, with the healthy weight range for your height.",
  description:
    "Calculate body mass index in metric or imperial units, see where it falls on the WHO adult scale and what weight range is healthy for your height. It says plainly what BMI cannot tell you. Calculated in your browser; your height and weight are never uploaded or put in the link.",
  primaryKeyword: "bmi calculator",
  seoTitle: "BMI Calculator: Metric and Imperial Units",
  seoDescription:
    "Work out your BMI from kg and cm or pounds and feet, see the WHO adult category and a healthy weight range. Nothing is uploaded or saved.",
  answer:
    "BMI Calculator works out body mass index from your height and weight in metric or imperial units, shows the WHO adult category and the weight range for your height, and says plainly what BMI cannot tell you. Nothing is uploaded or put in the link.",
  category: "calculators",
  keywords: ["bmi calculator", "body mass index", "bmi chart", "healthy weight calculator", "bmi in kg and cm", "bmi pounds and feet"],
  icon: Scale,
  howTo: ["Choose metric or imperial units.", "Enter your height and weight. Age is optional and only used to refuse under-18s.", "Read your BMI and the healthy weight range for your height, then read the notes on what BMI misses."],
  faq: [
    {
      question: "Is my height and weight uploaded or saved?",
      answer: "No. The sum is done in your browser. This tool also keeps your numbers out of the page address, so they never end up in a shared link or your history.",
    },
    {
      question: "Is BMI accurate?",
      answer: "It is a quick screening number, not a diagnosis. It cannot tell muscle from fat, ignores age, sex and body shape, and the cut-offs come from mostly white populations. Waist size and other measures often say more about health risk.",
    },
    {
      question: "Why does it not work for children?",
      answer: "For children and teenagers, doctors compare BMI with growth charts for their age and sex, and the adult categories do not apply. The tool refuses ages under 18 rather than give a misleading answer.",
    },
    {
      question: "How is BMI calculated?",
      answer: "BMI is weight in kilograms divided by height in metres squared. In pounds and inches it is 703 times weight divided by height squared, which gives the same result.",
    },
    {
      question: "Where does the healthy weight range come from?",
      answer: "It is the weights that give a BMI of 18.5 to 24.9 at your height, the WHO healthy range for adults. It is a guide, and a healthy weight for you depends on much more than this.",
    },
  ],
  related: ["percentage-calculator", "unit-converter", "tip-calculator", "date-calculator", "word-counter"],
});
