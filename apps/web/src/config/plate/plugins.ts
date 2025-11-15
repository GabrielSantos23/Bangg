import {
  BlockquotePlugin,
  BoldPlugin,
  H1Plugin,
  H2Plugin,
  H3Plugin,
  ItalicPlugin,
  UnderlinePlugin,
} from "@platejs/basic-nodes/react";
import { IndentPlugin } from "@platejs/indent/react";
import { ListPlugin } from "@platejs/list/react";
import { ParagraphPlugin } from "platejs/react";

// Code Block plugins
import {
  CodeBlockPlugin,
  CodeLinePlugin,
  CodeSyntaxPlugin,
} from "@platejs/code-block/react";

// Link plugin
import { LinkPlugin } from "@platejs/link/react";

// Date plugin
import { DatePlugin } from "@platejs/date/react";

// Equation plugin (custom)
import { EquationPlugin } from "./equation-plugin";

// Media plugins
import {
  ImagePlugin,
  VideoPlugin,
  AudioPlugin,
  FilePlugin,
  MediaEmbedPlugin,
} from "@platejs/media/react";

// Table plugins
import {
  TablePlugin,
  TableRowPlugin,
  TableCellPlugin,
} from "@platejs/table/react";

import { BlockquoteElement } from "@/components/ui/blockquote-node";
import { H1Element, H2Element, H3Element } from "@/components/ui/heading-node";
import { ParagraphElement } from "@/components/ui/paragraph-node";
import {
  CodeBlockElement,
  CodeLineElement,
  CodeSyntaxLeaf,
} from "@/components/ui/code-block-node";
import { LinkElement } from "@/components/ui/link-node";
import { DateElement } from "@/components/ui/date-node";
import { EquationElement } from "@/components/ui/equation-node";
import {
  ImageElement,
  VideoElement,
  AudioElement,
  FileElement,
  MediaEmbedElement,
} from "@/components/ui/media-node";
import {
  TableElement,
  TableRowElement,
  TableCellElement,
} from "@/components/ui/table-node";
import { autoformatConfig } from "./autoformat";
import { createLowlight, all } from "lowlight";

// Create lowlight instance for code syntax highlighting
const lowlight = createLowlight(all);

/**
 * Configuração de plugins do Plate
 * Define quais plugins estão disponíveis no editor
 */
export const platePlugins = [
  // Paragraph plugin (padrão para texto normal)
  ParagraphPlugin.withComponent(ParagraphElement),

  // Heading plugins (H1, H2, H3)
  H1Plugin.withComponent(H1Element),
  H2Plugin.withComponent(H2Element),
  H3Plugin.withComponent(H3Element),

  // Blockquote plugin
  BlockquotePlugin.withComponent(BlockquoteElement),

  // Mark plugins (formatação de texto)
  BoldPlugin,
  ItalicPlugin,
  UnderlinePlugin,

  // Indent plugin (necessário para listas)
  IndentPlugin,

  // List plugin (listas com marcadores e numeradas)
  ListPlugin,

  // Code Block plugins
  CodeBlockPlugin.configure({
    node: { component: CodeBlockElement },
    options: { lowlight },
    shortcuts: { toggle: { keys: "mod+alt+8" } },
  }),
  CodeLinePlugin.withComponent(CodeLineElement),
  CodeSyntaxPlugin.withComponent(CodeSyntaxLeaf),

  // Link plugin
  LinkPlugin.withComponent(LinkElement),

  // Date plugin
  DatePlugin.withComponent(DateElement),

  // Equation plugin (component already defined in plugin)
  EquationPlugin,

  // Media plugins
  ImagePlugin.withComponent(ImageElement),
  VideoPlugin.withComponent(VideoElement),
  AudioPlugin.withComponent(AudioElement),
  FilePlugin.withComponent(FileElement),
  MediaEmbedPlugin.withComponent(MediaEmbedElement),

  // Table plugins
  TablePlugin.withComponent(TableElement),
  TableRowPlugin.withComponent(TableRowElement),
  TableCellPlugin.withComponent(TableCellElement),

  // Autoformat plugin (formatação automática ao digitar)
  autoformatConfig,
];
