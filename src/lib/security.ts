/**
 * Camada de proteção da aplicação (complementa o firewall da Vercel):
 * - caminhos de varredura de vulnerabilidades respondem 404 na borda (middleware);
 * - formulários de compra recusam clientes de script (curl, python…), honeypot e envio rápido demais;
 * - limites persistentes de criação de pedidos (ver orders.ts).
 * Robôs legítimos (Google, Meta, WhatsApp) não são afetados: eles só leem páginas, não enviam formulários.
 */

/** Caminhos que só robôs de ataque acessam (WordPress, arquivos de configuração, painéis). */
export const SCANNER_PATH =
  /^\/(wp-admin|wp-login\.php|wp-content|wp-includes|wp-json|xmlrpc\.php|\.env|\.git|\.svn|\.hg|\.aws|\.ssh|\.DS_Store|\.vscode|\.idea|phpmyadmin|pma|myadmin|mysql|administrator|vendor\/phpunit|cgi-bin|server-status|server-info|config\.(php|json|yml|yaml)|backup|backups|db\.sql|dump\.sql|.*\.(php|asp|aspx|jsp|cgi|env|sql|bak|old|swp)$)/i;

/** Clientes HTTP de script — não são navegadores e não devem enviar pedidos/consultas. */
const SCRIPT_UA = /(curl|wget|python|httpx|aiohttp|go-http-client|libwww|scrapy|java\/|okhttp|node-fetch|undici|axios|postman|insomnia|headless|phantomjs|selenium|puppeteer|playwright)/i;

export function isScriptClient(userAgent: string | null | undefined): boolean {
  if (!userAgent || userAgent.length < 20) return true; // navegadores sempre enviam um user-agent completo
  return SCRIPT_UA.test(userAgent);
}

/**
 * Sinais de robô no envio do checkout: campo isca preenchido (invisível para pessoas)
 * ou formulário enviado rápido demais depois de aberto.
 */
export function looksLikeBotSubmission(input: { hp?: string | null; elapsedMs?: number | null }, minMs = 2500): boolean {
  if (input.hp && input.hp.trim() !== "") return true;
  if (typeof input.elapsedMs === "number" && input.elapsedMs >= 0 && input.elapsedMs < minMs) return true;
  return false;
}
