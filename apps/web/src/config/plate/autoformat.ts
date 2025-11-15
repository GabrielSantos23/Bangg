import { AutoformatPlugin } from "@platejs/autoformat";
import { toggleList } from "@platejs/list";

export const autoformatConfig = AutoformatPlugin.configure({
  options: {
    rules: [
      // Headings
      {
        match: "# ",
        mode: "block",
        type: "h1",
      },
      {
        match: "## ",
        mode: "block",
        type: "h2",
      },
      {
        match: "### ",
        mode: "block",
        type: "h3",
      },
      {
        match: "#### ",
        mode: "block",
        type: "h4",
      },
      {
        match: "##### ",
        mode: "block",
        type: "h5",
      },
      {
        match: "###### ",
        mode: "block",
        type: "h6",
      },

      // Blockquote
      {
        match: "> ",
        mode: "block",
        type: "blockquote",
      },

      // Lists - Bulleted list (usa `-` ou `*`)
      {
        match: ["- ", "* "],
        mode: "block",
        type: "ul",
        format: (editor) => {
          toggleList(editor, {
            listStyleType: "disc",
          });
        },
      },

      // Lists - Numbered list (usa `1. `, `2. `, etc.)
      {
        match: [String.raw`^\d+\. `],
        matchByRegex: true,
        mode: "block",
        type: "ol",
        format: (editor, { matchString }) => {
          const number = Number(matchString.match(/\d+/)?.[0]) || 1;
          toggleList(editor, {
            listRestartPolite: number,
            listStyleType: "decimal",
          });
        },
      },

      // Marks - Bold (**texto**)
      // Deve vir antes do italic para evitar conflito
      {
        match: "**",
        mode: "mark",
        type: "bold",
      },

      // Marks - Italic (*texto*)
      // Usa * mas só quando não é **
      {
        match: "*",
        mode: "mark",
        type: "italic",
      },

      // Marks - Underline (__texto__)
      {
        match: "__",
        mode: "mark",
        type: "underline",
      },
    ],
    enableUndoOnDelete: true,
  },
});
