import SandboxService from '../SandboxService';
import { isPyodideAvailable, runPython } from '../PyodideRunner';
import { triggerDownload } from './helpers';
import type { Tool } from './types';
import ToolRegistry from '../ToolRegistry';

let sandboxChecked = false;
async function ensureSandbox() {
  if (sandboxChecked) return;
  const ok = await SandboxService.ensureAvailable();
  if (!ok) throw new Error('No sandbox available — neither the remote sandbox server (node server/sandbox-server.cjs) nor the on-device Alpine terminal could be reached.');
  sandboxChecked = true;
}

const OFFICE_FORMATS = new Set(['docx', 'xlsx', 'pptx', 'odt', 'ods', 'epub']);
const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'markdown', 'log', 'env', 'cfg', 'ini', 'conf',
  'py', 'js', 'ts', 'jsx', 'tsx', 'css', 'scss', 'sh', 'bat', 'ps1', 'sql',
  'java', 'c', 'cpp', 'h', 'hpp', 'go', 'rs', 'rb', 'php', 'swift', 'kt',
  'dart', 'lua', 'r', 'toml', 'dockerfile', 'gitignore', 'svg', 'tex',
]);

function ext(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot > 0 ? filename.slice(dot + 1).toLowerCase() : '';
}

function detectFormat(filename: string): string {
  const e = ext(filename);
  if (TEXT_EXTENSIONS.has(e)) return 'text';
  if (e === 'csv') return 'csv';
  if (e === 'json') return 'json';
  if (['xml', 'xsd', 'xslt'].includes(e)) return 'xml';
  if (['html', 'htm'].includes(e)) return 'html';
  if (['yaml', 'yml'].includes(e)) return 'yaml';
  if (e === 'rtf') return 'rtf';
  if (OFFICE_FORMATS.has(e)) return e;
  if (e === 'pdf') return 'pdf';
  return 'text';
}

function parseTextContent(content: string, format: string): string {
  switch (format) {
    case 'csv': {
      const lines: string[] = [];
      for (const row of content.split('\n')) {
        const cells = row.split(',').map(c => c.trim());
        lines.push(cells.join(', '));
      }
      return lines.join('\n');
    }
    case 'json': {
      try { return JSON.stringify(JSON.parse(content), null, 2); } catch { return content; }
    }
    case 'xml': {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'text/xml');
        const serializer = new XMLSerializer();
        return serializer.serializeToString(doc.documentElement);
      } catch { return content; }
    }
    case 'html': {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'text/html');
        for (const tag of doc.querySelectorAll('script, style, nav, footer, header')) {
          tag.remove();
        }
        return (doc.body?.textContent || doc.documentElement.textContent || '').replace(/\s+/g, ' ').trim();
      } catch { return content; }
    }
    case 'yaml':
    case 'text':
    default:
      return content;
  }
}

function parseRtf(content: string): string {
  return content
    .replace(/\\([a-z]+)[-0-9]*/g, ' ')
    .replace(/[{}]/g, ' ')
    .replace(/\\'[0-9a-f]{2}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const PYODIDE_OFFICE_SCRIPT = `
import sys, json, base64, zipfile, xml.etree.ElementTree as ET, io, re

NS_W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
NS_S = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
NS_P = 'http://schemas.openxmlformats.org/presentationml/2006/main'
NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
NS_OFFICE = 'urn:oasis:names:tc:opendocument:xmlns:office:1.0'
NS_TEXT = 'urn:oasis:names:tc:opendocument:xmlns:text:1.0'
NS_TABLE = 'urn:oasis:names:tc:opendocument:xmlns:table:1.0'

def parse_docx(data):
    z = zipfile.ZipFile(io.BytesIO(data))
    tree = ET.parse(z.open('word/document.xml'))
    root = tree.getroot()
    lines = []
    for para in root.iter(f'{{{NS_W}}}p'):
        texts = [t.text or '' for t in para.iter(f'{{{NS_W}}}t')]
        lines.append(''.join(texts))
    return '\\n'.join(lines)

def parse_xlsx(data):
    z = zipfile.ZipFile(io.BytesIO(data))
    ss = {}
    if 'xl/sharedStrings.xml' in z.namelist():
        stree = ET.parse(z.open('xl/sharedStrings.xml'))
        for i, si in enumerate(stree.getroot().findall(f'.//{{{NS_S}}}si')):
            texts = [t.text or '' for t in si.iter(f'{{{NS_S}}}t')]
            ss[i] = ''.join(texts)
    lines = []
    for name in sorted(z.namelist()):
        if name.startswith('xl/worksheets/sheet') and name.endswith('.xml'):
            sheet_num = name.replace('xl/worksheets/sheet', '').replace('.xml', '')
            lines.append(f'=== Sheet {sheet_num} ===')
            tree = ET.parse(z.open(name))
            root = tree.getroot()
            for row in root.findall(f'.//{{{NS_S}}}row'):
                cells = []
                for c in row.findall(f'{{{NS_S}}}c'):
                    v = c.find(f'{{{NS_S}}}v')
                    t = c.get('t', '')
                    val = v.text if v is not None else ''
                    if t == 's' and val and val.isdigit():
                        val = ss.get(int(val), val)
                    cells.append(str(val))
                lines.append('\\t'.join(cells))
    return '\\n'.join(lines)

def parse_pptx(data):
    z = zipfile.ZipFile(io.BytesIO(data))
    lines = []
    for name in sorted(z.namelist()):
        if name.startswith('ppt/slides/slide') and name.endswith('.xml'):
            slide_num = name.split('slide')[1].split('.')[0]
            lines.append(f'--- Slide {slide_num} ---')
            tree = ET.parse(z.open(name))
            root = tree.getroot()
            for t_elem in root.iter(f'{{{NS_A}}}t'):
                if t_elem.text:
                    lines.append(t_elem.text.strip())
            for tbl in root.iter(f'{{{NS_P}}}tbl'):
                for tr in tbl.iter(f'{{{NS_A}}}tr'):
                    cells = []
                    for tc in tr.iter(f'{{{NS_A}}}tc'):
                        t = tc.find(f'.//{{{NS_A}}}t')
                        cells.append(t.text.strip() if t is not None else '')
                    lines.append(' | '.join(cells))
    return '\\n'.join(lines)

def parse_odt(data):
    z = zipfile.ZipFile(io.BytesIO(data))
    tree = ET.parse(z.open('content.xml'))
    root = tree.getroot()
    lines = []
    for p in root.iter(f'{{{NS_TEXT}}}p'):
        t = ''.join(p.itertext()).strip()
        if t:
            lines.append(t)
    return '\\n'.join(lines)

def parse_ods(data):
    z = zipfile.ZipFile(io.BytesIO(data))
    tree = ET.parse(z.open('content.xml'))
    root = tree.getroot()
    lines = []
    for table in root.iter(f'{{{NS_TABLE}}}table'):
        name = table.get(f'{{{NS_TABLE}}}name') or 'Sheet'
        lines.append(f'=== {name} ===')
        for row in table.iter(f'{{{NS_TABLE}}}table-row'):
            cells = []
            for cell in row.iter(f'{{{NS_TABLE}}}table-cell'):
                p = cell.find(f'.//{{{NS_TEXT}}}p')
                cells.append(''.join(p.itertext()).strip() if p is not None else '')
            lines.append('\\t'.join(cells))
    return '\\n'.join(lines)

def parse_epub(data):
    z = zipfile.ZipFile(io.BytesIO(data))
    import html.parser
    class TextExtractor(html.parser.HTMLParser):
        def __init__(self):
            super().__init__()
            self.lines = []
            self._tag_stack = []
        def handle_starttag(self, tag, attrs):
            self._tag_stack.append(tag)
            if tag in ('p', 'br', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li'):
                self.lines.append('')
        def handle_endtag(self, tag):
            if self._tag_stack and self._tag_stack[-1] == tag:
                self._tag_stack.pop()
            if tag in ('p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'td', 'th'):
                self.lines.append('')
        def handle_data(self, data):
            t = data.strip()
            if t and not any(s in self._tag_stack for s in ('script', 'style', 'nav')):
                if self.lines and self.lines[-1]:
                    self.lines[-1] += ' ' + t
                else:
                    self.lines.append(t)
    lines = []
    for name in z.namelist():
        if any(name.endswith(e) for e in ('.xhtml', '.html', '.htm')):
            raw = z.read(name)
            try: text = raw.decode('utf-8')
            except: continue
            ex = TextExtractor()
            ex.feed(text)
            lines.extend(ex.lines)
    return '\\n'.join(line for line in lines if line.strip())

def parse_rtf_py(data):
    text = data.decode('utf-8', errors='replace')
    text = re.sub(r'\\\\[a-z]+[-0-9]*', ' ', text)
    text = re.sub(r'[{}]', ' ', text)
    text = re.sub(r"\\\\'[0-9a-f]{2}", ' ', text)
    text = re.sub(r'\\s+', ' ', text).strip()
    return text

FORMATS = {
    'docx': ('docx', 'Microsoft Word Document', parse_docx),
    'xlsx': ('xlsx', 'Microsoft Excel Spreadsheet', parse_xlsx),
    'pptx': ('pptx', 'Microsoft PowerPoint Presentation', parse_pptx),
    'odt': ('odt', 'OpenDocument Text', parse_odt),
    'ods': ('ods', 'OpenDocument Spreadsheet', parse_ods),
    'epub': ('epub', 'EPUB eBook', parse_epub),
}

def main():
    input_data = json.loads(sys.argv[1])
    fmt_id = input_data['format']
    b64_data = input_data['data']
    raw = base64.b64decode(b64_data)
    
    fmt = FORMATS.get(fmt_id)
    if not fmt:
        print(json.dumps({'error': f'Unsupported format: {fmt_id}'}))
        return
    
    fmt_id, fmt_name, parser = fmt
    try:
        text = parser(raw)
        print(json.dumps({'format': fmt_id, 'format_name': fmt_name, 'content': text, 'size': len(text)}, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({'error': f'Error parsing {fmt_name}: {e}'}))

main()
`;

async function parseWithPyodide(data: string, filename: string): Promise<{ success: boolean; content: string; format_name?: string; size?: number; error?: string }> {
  const fmt = detectFormat(filename);
  if (!OFFICE_FORMATS.has(fmt)) {
    return { success: false, content: '', error: `Pyodide parser does not support ${fmt}` };
  }

  const available = await isPyodideAvailable();
  if (!available) {
    return { success: false, content: '', error: 'Pyodide not available' };
  }

  const payload = JSON.stringify({ format: fmt, data });
  const result = await runPython(`import json; ${PYODIDE_OFFICE_SCRIPT}\nimport sys; sys.argv = ["py", ${JSON.stringify(payload)}]; main()`);

  if (result.error) {
    return { success: false, content: '', error: result.error };
  }

  try {
    const parsed = JSON.parse(result.output);
    if (parsed.error) {
      return { success: false, content: '', error: parsed.error };
    }
    return {
      success: true,
      content: parsed.content || '',
      format_name: parsed.format_name,
      size: parsed.size,
    };
  } catch (e) {
    return { success: false, content: '', error: `Failed to parse output: ${e}` };
  }
}

const browse_web: Tool = {
  id: 'browse_web',
  name: 'browse_web',
  description: 'Browse the web: fetch pages, search, extract content, submit forms. Uses HTTP (requests+BS4) for reliable operation in sandbox. Supports GET, POST, search, extract, form submission.',
  schema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['get', 'post', 'search', 'extract', 'submit_form'], description: 'Action to perform' },
      url: { type: 'string', description: 'Target URL' },
      query: { type: 'string', description: 'Search query (for search action)' },
      selector: { type: 'string', description: 'CSS selector for extraction' },
      data: { type: 'object', description: 'Form data or POST body' },
      options: { type: 'object', description: 'Options: timeout, wait' },
    },
    required: ['action', 'url'],
  },
  execute: async (args) => {
    const action = String(args.action || 'get');
    const url = String(args.url || '');
    if (!url) return { success: false, content: '', error: 'url required' };

    sandboxChecked = false;
    await ensureSandbox();

    try {
      const payload = JSON.stringify({
        action,
        url,
        query: args.query ? String(args.query) : undefined,
        selector: args.selector ? String(args.selector) : undefined,
        data: args.data || {},
        options: args.options || { timeout: 20000 },
      });

      const result = await SandboxService.exec(`python3 /workspace/browse_web.py '${payload.replace(/'/g, "'\\''")}'`);
      if (result.exitCode !== 0) {
        return { success: false, content: '', error: result.stderr || `Exit ${result.exitCode}` };
      }

      const parsed = JSON.parse(result.stdout);
      if (!parsed.success) return { success: false, content: '', error: parsed.error };

      let content = '';
      if (parsed.text) content = parsed.text;
      else if (parsed.results) content = parsed.results.map((r: { title: string; url: string; snippet: string }) => `${r.title}: ${r.url}\n${r.snippet}`).join('\n\n');
      else if (parsed.elements) content = parsed.elements.join('\n---\n');

      return { success: true, content: content || JSON.stringify(parsed, null, 2) };
    } catch (e) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

const read_document: Tool = {
  id: 'read_document',
  name: 'read_document',
  description: 'Read any document file and extract its text content. Supports DOCX, XLSX, PPTX, ODT, ODS, EPUB, HTML, Markdown, RTF, CSV, JSON, XML, YAML, and plain text files. Rich formatted documents return their readable text.',
  schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the document in the sandbox workspace (e.g. "report.docx", "data.xlsx", "book.epub")',
      },
      data: {
        type: 'string',
        description: 'Base64-encoded file content. Use instead of path when the file data is available directly. Requires filename.',
      },
      filename: {
        type: 'string',
        description: 'Original filename with extension for format detection. Required when using data param.',
      },
      passThrough: {
        type: 'boolean',
        description: 'If true, return the raw content as-is instead of JSON metadata. Useful when GIA needs to edit the file.',
      },
    },
  },
  execute: async (args) => {
    const filePath = String(args.path || '');
    const data = args.data ? String(args.data) : '';
    const filename = args.filename ? String(args.filename) : (filePath.split('/').pop() || 'document.bin');
    const passThrough = !!args.passThrough;

    if (!filePath && !data) {
      return { success: false, content: '', error: 'Either path or data is required' };
    }

    if (data && !args.filename && !filePath) {
      return { success: false, content: '', error: 'filename is required when using data param' };
    }

    try {
      // If data is provided, try native TS parsing first, then Pyodide
      if (data) {
        const fmt = detectFormat(filename);

        // Native TypeScript path for text-based formats
        if (fmt !== 'pdf' && !OFFICE_FORMATS.has(fmt)) {
          const isRtf = fmt === 'rtf';
          const decoded = isRtf
            ? parseRtf(atob(data))
            : parseTextContent(atob(data), fmt);

          const preview = decoded.length > 10000
            ? decoded.slice(0, 10000) + '\n\n... (truncated, full content available)'
            : decoded;

          const formatLabel = fmt.charAt(0).toUpperCase() + fmt.slice(1);
          const sizeKb = (new Blob([decoded]).size / 1024).toFixed(1);

          if (passThrough) return { success: true, content: decoded };

          return {
            success: true,
            content: [
              `**${formatLabel}:** \`${filename}\` (${sizeKb} KB text)`,
              '',
              '```',
              preview,
              '```',
              '',
              `The full document text is available. Tell me what changes you want and I'll edit it.`,
            ].join('\n'),
          };
        }

        // Office formats: try Pyodide (in-browser Python, no server)
        if (OFFICE_FORMATS.has(fmt)) {
          const pyodideResult = await parseWithPyodide(data, filename);
          if (pyodideResult.success) {
            const content = pyodideResult.content;
            const formatName = pyodideResult.format_name || fmt.toUpperCase();
            const sizeKb = ((pyodideResult.size || content.length) / 1024).toFixed(1);
            const preview = content.length > 10000
              ? content.slice(0, 10000) + '\n\n... (truncated, full content available)'
              : content;

            if (passThrough) return { success: true, content };

            return {
              success: true,
              content: [
                `**${formatName}:** \`${filename}\` (${sizeKb} KB text)`,
                '',
                '```',
                preview,
                '```',
                '',
                `The full document text is available. Tell me what changes you want and I'll edit it.`,
              ].join('\n'),
            };
          }

          // Pyodide failed, fall back to sandbox
          if (data && filePath) {
            sandboxChecked = false;
            await ensureSandbox();
            await SandboxService.writeFile(filePath, atob(data));
          }
        }

        if (fmt === 'pdf') {
          return { success: false, content: '', error: 'PDF files are not supported yet. Try converting to DOCX or text.' };
        }
      }

      // Sandbox path (file must be in workspace)
      if (filePath) {
        sandboxChecked = false;
        await ensureSandbox();

        const scriptName = 'read_doc.py';
        const remoteScriptPath = `/workspace/${scriptName}`;

        await SandboxService.writeFile(remoteScriptPath, READ_DOC_SCRIPT);

        const execResult = await SandboxService.exec(`python3 ${remoteScriptPath} "${filePath}"`);
        await SandboxService.delete(remoteScriptPath);

        if (execResult.exitCode !== 0) {
          return { success: false, content: '', error: execResult.stderr || `Exit code ${execResult.exitCode}` };
        }

        const parsed = JSON.parse(execResult.stdout);
        const formatName = parsed.format_name || 'Document';
        const content = parsed.content || '';

        if (passThrough) {
          return { success: true, content };
        }

        const preview = content.length > 10000 ? content.slice(0, 10000) + '\n\n... (truncated, full content available)' : content;

        return {
          success: true,
          content: [
            `**${formatName}:** \`${filePath}\` (${(parsed.size / 1024).toFixed(1)} KB text)`,
            '',
            '```',
            preview,
            '```',
            '',
            `The full document text is available. Tell me what changes you want and I'll edit it.`,
          ].join('\n'),
        };
      }

      return { success: false, content: '', error: 'Could not parse document with any available backend' };
    } catch (e) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

const download_url: Tool = {
  id: 'download_url',
  name: 'download_url',
  description: 'Download any file from a URL directly to the user\'s device. Supports wallpapers, images, videos, music, PDFs, documents, or any downloadable content. Fetches the URL and triggers a device download dialog.',
  schema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The full URL of the file to download (e.g. "https://example.com/wallpaper.jpg", "https://example.com/song.mp3", "https://example.com/video.mp4")',
      },
      filename: {
        type: 'string',
        description: 'Optional custom filename. If omitted, extracted from the URL.',
      },
    },
    required: ['url'],
  },
  execute: async (args) => {
    const url = String(args.url || '');
    if (!url) return { success: false, content: '', error: 'url is required' };

    try {
      const response = await fetch(url);
      if (!response.ok) {
        return { success: false, content: '', error: `Failed to fetch URL: HTTP ${response.status} ${response.statusText}` };
      }

      const contentType = response.headers.get('content-type') || 'application/octet-stream';
      const contentDisposition = response.headers.get('content-disposition') || '';
      const blob = await response.blob();

      let filename = args.filename ? String(args.filename) : '';
      if (!filename) {
        const cdMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (cdMatch) {
          filename = cdMatch[1].replace(/['"]/g, '');
        } else {
          const urlPath = new URL(url).pathname;
          filename = urlPath.split('/').pop() || 'download';
          const ext = filename.includes('.') ? '' : '.' + (contentType.split('/')[1] || 'bin');
          filename += ext;
        }
      }

      triggerDownload(blob, filename);

      const typeLabel = contentType.includes('video') ? '🎬 Video' :
        contentType.includes('audio') ? '🎵 Audio' :
        contentType.includes('image') ? '🖼️ Image' :
        contentType.includes('pdf') ? '📄 Document' : '📁 File';

      return {
        success: true,
        content: `${typeLabel} downloaded: \`${filename}\` (${(blob.size / 1024 / 1024).toFixed(1)} MB)`,
      };
    } catch (e) {
      return { success: false, content: '', error: e instanceof Error ? e.message : `Failed to download: ${String(e)}` };
    }
  },
};

const READ_DOC_SCRIPT = `#!/usr/bin/env python3
import sys, os, json, base64, re, csv, zipfile, xml.etree.ElementTree as ET
from pathlib import Path

def die(msg):
    print(json.dumps({"error": msg}), file=sys.stderr)
    sys.exit(1)

def safe_text(elem, sep=" "):
    parts = []
    if elem.text: parts.append(elem.text.strip())
    for child in elem:
        parts.append(safe_text(child, sep))
        if child.tail: parts.append(child.tail.strip())
    return sep.join(filter(None, parts))

def parse_docx(path):
    from docx import Document
    doc = Document(path)
    lines = []
    for para in doc.paragraphs: lines.append(para.text)
    for table in doc.tables:
        for row in table.rows:
            lines.append(" | ".join(cell.text.strip() for cell in row.cells))
    return "\\n".join(lines)

def parse_xlsx(path):
    from openpyxl import load_workbook
    wb = load_workbook(path, read_only=True, data_only=True)
    lines = []
    for name in wb.sheetnames:
        ws = wb[name]
        lines.append(f"=== Sheet: {name} ===")
        for row in ws.iter_rows(values_only=True):
            lines.append("\\t".join(str(v) if v is not None else "" for v in row))
    return "\\n".join(lines)

def parse_pptx(path):
    from pptx import Presentation
    prs = Presentation(path)
    lines = []
    for i, slide in enumerate(prs.slides, 1):
        lines.append(f"--- Slide {i} ---")
        for shape in slide.shapes:
            if hasattr(shape, "text") and shape.text.strip(): lines.append(shape.text.strip())
            if shape.has_table:
                for row in shape.table.rows:
                    lines.append(" | ".join(cell.text.strip() for cell in row.cells))
    return "\\n".join(lines)

def parse_odt(path):
    from odf.opendocument import load
    from odf.text import P
    doc = load(path)
    lines = []
    for elem in doc.getElementsByType(P):
        t = safe_text(elem)
        if t: lines.append(t)
    return "\\n".join(lines)

def parse_ods(path):
    from odf.opendocument import load
    from odf.table import Table, TableRow, TableCell
    from odf.text import P as TextP
    doc = load(path)
    lines = []
    for table in doc.getElementsByType(Table):
        name = table.getAttribute("name") or "Sheet"
        lines.append(f"=== Sheet: {name} ===")
        for row in table.getElementsByType(TableRow):
            cells = []
            for cell in row.getElementsByType(TableCell):
                texts = [safe_text(p) for p in cell.getElementsByType(TextP) if safe_text(p)]
                cells.append(" ".join(texts))
            lines.append("\\t".join(cells))
    return "\\n".join(lines)

def parse_epub(path):
    import ebooklib
    from ebooklib import epub
    from bs4 import BeautifulSoup
    book = epub.read_epub(path)
    lines = []
    for item in book.get_items():
        if item.get_type() == ebooklib.ITEM_DOCUMENT:
            soup = BeautifulSoup(item.get_content(), "html.parser")
            text = soup.get_text(separator="\\n").strip()
            if text: lines.append(text)
    return "\\n".join(lines)

def parse_html(path):
    from bs4 import BeautifulSoup
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        soup = BeautifulSoup(f.read(), "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header"]):
        tag.decompose()
    return soup.get_text(separator="\\n").strip()

def parse_rtf(path):
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        text = f.read()
    text = re.sub(r"\\\\[a-z]+[-0-9]*", " ", text)
    text = re.sub(r"\\{|\\}", " ", text)
    text = re.sub(r"\\\\'[0-9a-f]{2}", " ", text)
    text = re.sub(r"\\s+", " ", text).strip()
    return text

def parse_txt(path):
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        return f.read()

EXT_MAP = {
    ".docx": ("docx", "Word", parse_docx), ".xlsx": ("xlsx", "Excel", parse_xlsx),
    ".pptx": ("pptx", "PowerPoint", parse_pptx), ".odt": ("odt", "ODF Text", parse_odt),
    ".ods": ("ods", "ODF Spreadsheet", parse_ods), ".epub": ("epub", "EPUB", parse_epub),
    ".html": ("html", "HTML", parse_html), ".htm": ("html", "HTML", parse_html),
}
for e in [".md",".markdown",".csv",".json",".xml",".yaml",".yml",".txt",".log",".env",
           ".cfg",".ini",".conf",".py",".js",".ts",".jsx",".tsx",".css",".scss",
           ".sh",".bat",".ps1",".sql",".java",".c",".cpp",".h",".hpp",".go",".rs",
           ".rb",".php",".swift",".kt",".dart",".lua",".r",".toml",".svg",".tex",
           ".dockerfile",".gitignore"]:
    EXT_MAP[e] = ("txt", "Text", parse_txt)

def main():
    path = sys.argv[1] if len(sys.argv) > 1 else ""
    if not path or not os.path.exists(path):
        die(f"File not found: {path}")
    ext = os.path.splitext(path)[1].lower()
    fmt = EXT_MAP.get(ext)
    if not fmt:
        with open(path, "rb") as f:
            magic = f.read(8)
        if magic[:4] == b"PK\\x03\\x04":
            try:
                with zipfile.ZipFile(path) as z:
                    names = z.namelist()
                    if "word/document.xml" in names: fmt = ("docx","Word",parse_docx)
                    elif "xl/workbook.xml" in names: fmt = ("xlsx","Excel",parse_xlsx)
                    elif "ppt/presentation.xml" in names: fmt = ("pptx","PowerPoint",parse_pptx)
                    elif "META-INF/container.xml" in names: fmt = ("odt","ODF",parse_odt)
                    else: fmt = ("epub","EPUB",parse_epub)
            except: fmt = ("txt","Text",parse_txt)
        elif magic[:4] == b"%PDF": die("PDF files: use python3 -c \\"import PyPDF2; ...\\" or extract via jsPDF")
        elif magic[:2] in (b"\\\\v", b"{\\\\rt"): fmt = ("txt","Text",parse_txt)
        else: fmt = ("txt","Text",parse_txt)
    _, fmt_name, parser = fmt
    try:
        text = parser(path)
        print(json.dumps({"format": fmt[0], "format_name": fmt_name, "content": text, "size": len(text)}, ensure_ascii=False))
    except ImportError as e:
        m = str(e).split("'")[1] if "'" in str(e) else str(e)
        die(f"Missing package {m} for {fmt_name}. Install: pip install {m}")
    except Exception as e:
        die(f"Error: {e}")

if __name__ == "__main__":
    main()
`;

export const documentTools: Tool[] = [read_document, download_url, browse_web];


export function registerDocumentTools() {
  for (const tool of documentTools) ToolRegistry.register(tool);
}
