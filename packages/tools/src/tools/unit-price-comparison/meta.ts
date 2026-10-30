import { Tags } from "lucide-react";
import { defineTool } from "../../define";

export default defineTool({
  slug: "unit-price-comparison",
  name: "Unit Price Comparison",
  tagline: "Find the cheapest buy per gram, litre, item or metre, whatever the pack size.",
  description:
    "Enter the price and size of two or more products, in any mix of metric and US units, and see which is cheapest per 100 g, litre, item or metre. Handles multipacks and shows how much more the others cost. Calculated in your browser.",
  category: "calculators",
  keywords: ["unit price calculator", "price per ounce", "price per 100g", "compare prices", "cheapest per unit", "grocery price comparison", "which is cheaper"],
  icon: Tags,
  howTo: ["Enter each product's price and size, and choose its unit.", "For a multipack, enter the size of one item and how many items are in the pack.", "The cheapest product is highlighted, with how much more the others cost per unit."],
  faq: [
    {
      question: "Can I compare grams with ounces, or litres with gallons?",
      answer: "Yes, within the same kind of measure: weight (g, kg, oz, lb), volume (ml, cl, l, US fl oz, cup, pint, quart, gallon), count (items, dozen) or length (m, cm, ft, yd). Weight cannot be compared with volume, and the tool tells you when you try.",
    },
    {
      question: "Are fluid ounces and gallons US or UK?",
      answer: "US. A US gallon is 3.785 litres and a US fluid ounce is 29.57 ml. UK (imperial) volumes are about 20% larger, so use ml or litres for UK products.",
    },
    {
      question: "How do I enter a multipack?",
      answer: "Enter the price on the tag, the size of one item and the number of items in the pack. For a 6-pack of 330 ml cans at 5.40, enter price 5.40, size 330 ml, items 6. The tool works out 1,980 ml for 5.40.",
    },
    {
      question: "Is the cheapest per unit always the best buy?",
      answer: "No. A bigger pack only saves money if you use it all before it spoils, and if you have room to store it. Quality, shelf life and waste matter too. This tool compares price only.",
    },
    {
      question: "Is my shopping list uploaded?",
      answer: "No. Everything is calculated in your browser. The numbers are saved in the page address only if you copy the link to share.",
    },
  ],
  related: ["percentage-calculator", "unit-converter", "tip-calculator", "bmi-calculator", "compound-interest-calculator"],
});
