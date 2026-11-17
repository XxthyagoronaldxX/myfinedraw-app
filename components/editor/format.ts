/**
 * Formatador do bloco de código.
 * - Prettier (carregado sob demanda) para JS/TS, CSS/SCSS/Less, HTML, JSON, YAML, Markdown e GraphQL.
 * - sql-formatter para SQL.
 * - Reindentação por chaves para linguagens de sintaxe C (Java, C#, Go, Rust, PHP, Kotlin…).
 * - Nas demais, só limpa espaços no fim das linhas, tabs e linhas em branco repetidas.
 */

const INDENT = '  ';

type PrettierCfg = { parser: string; plugins: () => Promise<unknown[]> };

const prettierFor: Record<string, PrettierCfg> = {
  javascript: { parser: 'babel', plugins: async () => [await import('prettier/plugins/babel'), await import('prettier/plugins/estree')] },
  typescript: { parser: 'typescript', plugins: async () => [await import('prettier/plugins/typescript'), await import('prettier/plugins/estree')] },
  json: { parser: 'json', plugins: async () => [await import('prettier/plugins/babel'), await import('prettier/plugins/estree')] },
  css: { parser: 'css', plugins: async () => [await import('prettier/plugins/postcss')] },
  scss: { parser: 'scss', plugins: async () => [await import('prettier/plugins/postcss')] },
  less: { parser: 'less', plugins: async () => [await import('prettier/plugins/postcss')] },
  xml: { parser: 'html', plugins: async () => [await import('prettier/plugins/html')] },
  yaml: { parser: 'yaml', plugins: async () => [await import('prettier/plugins/yaml')] },
  markdown: { parser: 'markdown', plugins: async () => [await import('prettier/plugins/markdown')] },
  graphql: { parser: 'graphql', plugins: async () => [await import('prettier/plugins/graphql')] },
};

const C_LIKE = new Set(['java', 'csharp', 'c', 'cpp', 'go', 'rust', 'php', 'kotlin', 'swift', 'dart', 'scala', 'objectivec', 'javascript', 'typescript', 'css', 'scss', 'less', 'json', 'graphql', 'powershell', 'nginx']);

/** Linguagens em que o botão "Formatar" faz algo além de limpar espaços. */
export const canFormat = (lang: string) => lang in prettierFor || C_LIKE.has(lang) || lang === 'sql';

function tidy(code: string) {
  return code
    .replace(/\t/g, INDENT)
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+|\n+$/g, '');
}

/** Reindenta pela profundidade de { ( [ — ignora strings e comentários. */
export function reindentBraces(code: string): string {
  let depth = 0;
  let inBlock = false; // dentro de /* … */
  const out: string[] = [];
  for (const raw of tidy(code).split('\n')) {
    const line = raw.trim();
    if (!line) {
      out.push('');
      continue;
    }
    // conta aberturas/fechamentos fora de strings e comentários
    let open = 0;
    let leadingClose = 0;
    let seenCode = false;
    let quote: string | null = null;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      const n = line[i + 1];
      if (inBlock) {
        if (c === '*' && n === '/') {
          inBlock = false;
          i++;
        }
        continue;
      }
      if (quote) {
        if (c === '\\') i++;
        else if (c === quote) quote = null;
        continue;
      }
      if (c === '/' && n === '/') break;
      if (c === '#' && !seenCode && /^#(?!\[)/.test(line)) break; // diretivas/comentários iniciados por #
      if (c === '/' && n === '*') {
        inBlock = true;
        i++;
        continue;
      }
      if (c === '"' || c === "'" || c === '`') {
        quote = c;
        seenCode = true;
        continue;
      }
      if (c === '{' || c === '(' || c === '[') open++;
      else if (c === '}' || c === ')' || c === ']') {
        if (!seenCode) leadingClose++;
        open--;
      }
      if (!/\s/.test(c) && !'})]'.includes(c)) seenCode = true;
    }
    const level = Math.max(0, depth - leadingClose);
    const isCommentCont = line.startsWith('*');
    out.push(INDENT.repeat(level) + (isCommentCont ? ' ' : '') + line);
    depth = Math.max(0, depth + open);
  }
  return out.join('\n');
}

/** Formata o código conforme a linguagem. Lança erro se o código tiver sintaxe inválida para o Prettier. */
export async function formatCode(code: string, language: string): Promise<string> {
  const cfg = prettierFor[language];
  if (cfg) {
    const prettier = await import('prettier/standalone');
    const out = await prettier.format(code, {
      parser: cfg.parser,
      plugins: (await cfg.plugins()) as never,
      tabWidth: 2,
      printWidth: 90,
      singleQuote: true,
    });
    return out.replace(/\n+$/, '');
  }
  if (language === 'sql') {
    const { format } = await import('sql-formatter');
    return format(code, { language: 'postgresql', tabWidth: 2, keywordCase: 'upper' });
  }
  if (C_LIKE.has(language)) return reindentBraces(code);
  return tidy(code);
}
