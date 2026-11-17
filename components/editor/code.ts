import hljs from 'highlight.js/lib/common';
import dart from 'highlight.js/lib/languages/dart';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import nginx from 'highlight.js/lib/languages/nginx';
import powershell from 'highlight.js/lib/languages/powershell';
import scala from 'highlight.js/lib/languages/scala';

// além do pacote "common" (36 linguagens), algumas muito usadas em projetos
hljs.registerLanguage('dart', dart);
hljs.registerLanguage('dockerfile', dockerfile);
hljs.registerLanguage('nginx', nginx);
hljs.registerLanguage('powershell', powershell);
hljs.registerLanguage('scala', scala);

/** Linguagens oferecidas no seletor (id do highlight.js → rótulo). */
export const CODE_LANGUAGES: [string, string][] = [
  ['auto', 'Detectar automaticamente'],
  ['plaintext', 'Texto simples'],
  ['javascript', 'JavaScript / JSX'],
  ['typescript', 'TypeScript / TSX'],
  ['python', 'Python'],
  ['java', 'Java'],
  ['csharp', 'C#'],
  ['c', 'C'],
  ['cpp', 'C++'],
  ['go', 'Go'],
  ['rust', 'Rust'],
  ['php', 'PHP'],
  ['ruby', 'Ruby'],
  ['kotlin', 'Kotlin'],
  ['swift', 'Swift'],
  ['dart', 'Dart'],
  ['scala', 'Scala'],
  ['sql', 'SQL'],
  ['xml', 'HTML / XML'],
  ['css', 'CSS'],
  ['scss', 'SCSS'],
  ['less', 'Less'],
  ['json', 'JSON'],
  ['yaml', 'YAML'],
  ['ini', 'INI / TOML'],
  ['markdown', 'Markdown'],
  ['bash', 'Bash / Shell'],
  ['powershell', 'PowerShell'],
  ['dockerfile', 'Dockerfile'],
  ['nginx', 'Nginx'],
  ['graphql', 'GraphQL'],
  ['lua', 'Lua'],
  ['r', 'R'],
  ['perl', 'Perl'],
  ['objectivec', 'Objective-C'],
  ['vbnet', 'VB.NET'],
  ['makefile', 'Makefile'],
  ['diff', 'Diff'],
];

const LABEL = Object.fromEntries(CODE_LANGUAGES);
export const languageLabel = (id: string) => LABEL[id] ?? id;

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Devolve o HTML destacado (o highlight.js já escapa o código) e a linguagem efetiva.
 * Em "auto", detecta entre as linguagens oferecidas.
 */
export function highlightCode(code: string, language: string): { html: string; detected?: string } {
  try {
    if (language === 'plaintext') return { html: escapeHtml(code) };
    if (language === 'auto' || !hljs.getLanguage(language)) {
      const r = hljs.highlightAuto(code, CODE_LANGUAGES.map(([id]) => id).filter((id) => id !== 'auto' && id !== 'plaintext'));
      return { html: r.value, detected: r.language };
    }
    return { html: hljs.highlight(code, { language, ignoreIllegals: true }).value };
  } catch {
    return { html: escapeHtml(code) };
  }
}

export const SAMPLE_CODE = `// Exemplo — duplo clique para editar
async function buscarEventos(orgId: string) {
  const res = await fetch(\`/api/orgs/\${orgId}/events\`);
  if (!res.ok) throw new Error('Falha ao carregar');
  return (await res.json()) as Evento[];
}`;
