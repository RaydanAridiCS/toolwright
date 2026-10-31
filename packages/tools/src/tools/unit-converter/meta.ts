import { Ruler } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "unit-converter",
  name: "Unit Converter",
  tagline: "Length, weight, temperature, volume, speed, data size and more.",
  description:
    "Convert between metric and imperial units across length, mass, temperature, volume, area, speed, time, digital storage, energy, pressure and angle. Instant results with a full conversion table. Works offline.",
  primaryKeyword: "unit converter",
  seoTitle: "Unit Converter: Length, Weight, Temperature",
  seoDescription:
    "Convert metric and imperial units across length, mass, temperature, volume, speed, data size and more, with a full table. Free.",
  answer:
    "Unit Converter converts between metric and imperial units across length, mass, temperature, volume, area, speed, time, digital storage, energy, pressure and angle, with a full conversion table. It works offline once the page has loaded.",
  category: "calculators",
  keywords: ["unit converter", "metric to imperial", "cm to inches", "kg to lbs", "celsius to fahrenheit", "mb to gb", "mph to kph"],
  icon: Ruler,
  popular: true,
  howTo: ["Choose a category such as length or temperature.", "Enter a value and pick the units.", "Read the result and the table of other units."],
  faq: [
    { question: "How do I convert cm to inches?", answer: "Choose length, enter the value in centimeters and read the result in inches. One inch is exactly 2.54 centimeters." },
    { question: "How do I convert Celsius to Fahrenheit?", answer: "Choose temperature, enter the Celsius value and read Fahrenheit. The formula is multiply by 9/5 and add 32." },
    { question: "Which units are covered?", answer: "Length, mass, temperature, volume, area, speed, time, digital storage, energy, pressure and angle." },
  ],
  nextStep: { slug: "number-base-converter", text: "Converting numbers between bases? Use the Number Base Converter." },
  related: ["percentage-calculator", "number-base-converter", "date-calculator"],
});
