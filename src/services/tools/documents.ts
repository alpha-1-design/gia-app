import SandboxService from '../SandboxService';
import { triggerDownload } from './helpers';
import type { Tool } from './types';

async function ensureSandbox() {
  const ok = await SandboxService.ensureAvailable();
  if (!ok) throw new Error('Alpine sandbox not available. Start: node server/sandbox-server.cjs');
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
      else if (parsed.results) content = parsed.results.map(r => `${r.title}: ${r.url}\n${r.snippet}`).join('\n\n');
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
      passThrough: {
        type: 'boolean',
        description: 'If true, return the raw content as-is instead of JSON metadata. Useful when GIA needs to edit the file.',
      },
    },
    required: ['path'],
  },
  execute: async (args) => {
    const filePath = String(args.path || '');
    if (!filePath) return { success: false, content: '', error: 'path is required' };

    await ensureSandbox();

    try {
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
      const format = parsed.format || 'text';

      if (args.passThrough) {
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
