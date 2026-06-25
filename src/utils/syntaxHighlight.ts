import React from 'react';

const KEYWORDS_PY = /\b(and|as|assert|async|await|break|class|continue|def|del|elif|else|except|finally|for|from|global|if|import|in|is|lambda|nonlocal|not|or|pass|raise|return|try|while|with|yield|True|False|None)\b/;

const KEYWORDS_TS = /\b(as|async|await|break|case|catch|class|const|continue|debugger|declare|default|delete|do|else|enum|export|extends|finally|for|from|function|if|implements|import|in|instanceof|interface|let|new|of|return|static|switch|this|throw|try|type|typeof|var|void|while|with|yield)\b/;

const STRING = /(?:"[^"\\]*(?:\\.[^"\\]*)*")|(?:'[^'\\]*(?:\\.[^'\\]*)*')|(?:`[^`\\]*(?:\\.[^`\\]*)*`)/g;

const COMMENT_JS = /\/\/[^\n]*|\/\*[\s\S]*?\*\//g;
const COMMENT_PY = /#[^\n]*|'''[\s\S]*?'''|"""[\s\S]*?"""/g;

const NUMBER = /\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/g;

const BUILTIN_JS = /\b(console|Math|JSON|Promise|Array|Object|Map|Set|String|Number|Boolean|Symbol|Error|Date|RegExp|parseInt|parseFloat|setTimeout|setInterval|fetch|require|module|exports|process|Buffer|global)\b/;
const BUILTIN_PY = /\b(print|len|range|type|str|int|float|list|dict|set|tuple|bool|enumerate|zip|map|filter|sorted|reversed|open|input|super|isinstance|hasattr|getattr|setattr|__init__|__str__|__repr__|__name__|ValueError|TypeError|KeyError|IndexError|Exception)\b/;

type Token = { type: string; text: string };

function tokenize(code: string, lang: string): Token[] {
  const lower = lang.toLowerCase();
  const isJsLike = ['javascript', 'js', 'typescript', 'ts', 'jsx', 'tsx'].includes(lower);
  const isPy = ['python', 'py'].includes(lower);
  const isHtml = ['html', 'htm', 'xml', 'svg'].includes(lower);
  const isCss = ['css', 'scss', 'less'].includes(lower);

  if (isHtml) return tokenizeHtml(code);
  if (isCss) return tokenizeCss(code);

  const tokens: Token[] = [];
  let i = 0;

  while (i < code.length) {
    const remaining = code.slice(i);
    let matched = false;

    const patterns: { regex: RegExp; type: string; skip?: boolean }[] = [];

    if (isJsLike || isPy) {
      patterns.push({ regex: isJsLike ? COMMENT_JS : COMMENT_PY, type: 'comment' });
    }

    patterns.push({ regex: STRING, type: 'string' });
    patterns.push({ regex: NUMBER, type: 'number' });

    if (isJsLike) {
      patterns.push({ regex: KEYWORDS_TS, type: 'keyword' });
      patterns.push({ regex: BUILTIN_JS, type: 'builtin' });
    }
    if (isPy) {
      patterns.push({ regex: KEYWORDS_PY, type: 'keyword' });
      patterns.push({ regex: BUILTIN_PY, type: 'builtin' });
    }

    for (const p of patterns) {
      p.regex.lastIndex = 0;
      const m = p.regex.exec(remaining);
      if (m && m.index === 0) {
        tokens.push({ type: p.type, text: m[0] });
        i += m[0].length;
        matched = true;
        break;
      }
    }

    if (!matched) {
      const next = remaining[0];
      if (/[{}[\]()]/.test(next)) tokens.push({ type: 'punctuation', text: next });
      else if (/[+\-*/=<>!&|^~?:]/.test(next)) tokens.push({ type: 'operator', text: next });
      else tokens.push({ type: 'text', text: next });
      i++;
    }
  }

  return tokens;
}

function tokenizeHtml(code: string): Token[] {
  const tokens: Token[] = [];
  const tagRe = /(<\/?)([\w-]+)([\s\S]*?)(\/?>)/g;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = tagRe.exec(code)) !== null) {
    if (m.index > last) tokens.push({ type: 'text', text: code.slice(last, m.index) });
    tokens.push({ type: 'punctuation', text: m[1] });
    tokens.push({ type: 'tag', text: m[2] });
    const attrs = m[3];
    const attrRe = /([\w-]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s>]+))?/g;
    let am: RegExpExecArray | null;
    let aLast = 0;
    while ((am = attrRe.exec(attrs)) !== null) {
      if (am.index > aLast) tokens.push({ type: 'text', text: attrs.slice(aLast, am.index) });
      tokens.push({ type: 'attr', text: am[1] });
      if (am[2]) tokens.push({ type: 'punctuation', text: '=' });
      if (am[2]) tokens.push({ type: 'attr-value', text: am[2] });
      aLast = attrRe.lastIndex;
    }
    if (aLast < attrs.length) tokens.push({ type: 'text', text: attrs.slice(aLast) });
    tokens.push({ type: 'punctuation', text: m[4] });
    last = tagRe.lastIndex;
  }
  if (last < code.length) tokens.push({ type: 'text', text: code.slice(last) });
  return tokens;
}

function tokenizeCss(code: string): Token[] {
  const tokens: Token[] = [];
  let last = 0;
  let m: RegExpExecArray | null;

  const combined = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("[^"]*"|'[^']*')|(\d+(?:\.\d+)?(?:px|em|rem|%|vh|vw|s|ms)?)/g;
  while ((m = combined.exec(code)) !== null) {
    if (m.index > last) tokens.push({ type: 'text', text: code.slice(last, m.index) });
    if (m[1]) tokens.push({ type: 'comment', text: m[1] });
    else if (m[2]) tokens.push({ type: 'string', text: m[2] });
    else if (m[3]) tokens.push({ type: 'number', text: m[3] });
    last = combined.lastIndex;
  }
  if (last < code.length) tokens.push({ type: 'text', text: code.slice(last) });
  return tokens;
}

export function highlightSyntax(code: string, language: string): React.ReactNode[] {
  const tokens = tokenize(code, language || '');
  const result: React.ReactNode[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type === 'text' || t.type === 'punctuation') {
      result.push(t.text);
    } else {
      result.push(
        React.createElement('span', { key: i, className: `hl-${t.type}` }, t.text)
      );
    }
  }
  return result;
}
