import katex from "katex";
import "katex/dist/katex.min.css";

const mathPart = /^(\$\$[\s\S]+\$\$|\$[\s\S]+\$)$/;
const parts = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g;

export default function MathText({ text = "" }) {
  return String(text).split(parts).map((part, index) => {
    if (!mathPart.test(part)) return part;
    const displayMode = part.startsWith("$$");
    const expression = part.slice(displayMode ? 2 : 1, displayMode ? -2 : -1);
    const html = katex.renderToString(expression, { displayMode, throwOnError: false, trust: false, maxExpand: 1000 });
    return <span key={index} className={displayMode ? "block overflow-x-auto" : "inline"} dangerouslySetInnerHTML={{ __html: html }} />;
  });
}
