import SandboxService from '../SandboxService';
import type { SandboxResult } from '../SandboxService';
import type { Tool } from './types';

async function ensureSandbox() {
  const ok = await SandboxService.ensureAvailable();
  if (!ok) throw new Error('No sandbox available — neither the remote sandbox server (node server/sandbox-server.cjs) nor the on-device Alpine terminal could be reached.');
}

/**
 * Dependency-free document generators (stdlib-only, no pip installs needed
 * inside the sandbox) so generate_file works on both the remote sandbox
 * server and the on-device proot/Alpine terminal. Each script reads one JSON
 * object on stdin ({ filename, title, content[, slides, subtitle] }), writes
 * the finished file to the same directory, and prints a JSON result.
 *
 * The scripts are embedded here and self-provisioned to /workspace before
 * each run — a fresh rootfs/container has none of them (they never existed
 * as files anywhere in the repo), so writing them via SandboxService is the
 * only way they exist at runtime on either backend.
 */
const GEN_PDF_SCRIPT = `#!/usr/bin/env python3
import sys, json, os

def esc(s):
    s = s.replace('\\\\', '\\\\\\\\')
    s = s.replace('(', '\\\\(')
    s = s.replace(')', '\\\\\\\\)')
    return s

def wrap(text, width=95):
    out = []
    for para in (text or '').split('\\n'):
        if not para.strip():
            out.append('')
            continue
        words = para.split()
        cur = ''
        for w in words:
            t = (cur + ' ' + w).strip()
            if len(t) > width:
                if cur:
                    out.append(cur)
                cur = w
            else:
                cur = t
        out.append(cur)
    return out

def main():
    data = json.load(sys.stdin)
    filename = data.get('filename') or 'output.pdf'
    title = data.get('title') or ''
    body = wrap(data.get('content') or '')
    if not body:
        body = ['']
    out_path = filename if filename.startswith('/') else os.path.join('/workspace', filename)
    d = os.path.dirname(out_path)
    if d:
        os.makedirs(d, exist_ok=True)

    cap = 45
    streams = []
    idx = 0
    first = True
    while idx < len(body):
        chunk = body[idx:idx + cap]
        idx += len(chunk)
        lines = ['BT', '72 720 Td']
        if first and title:
            lines.append('16 Tf')
            lines.append('(' + esc(title) + ') Tj')
            lines.append('0 -22 Td')
            lines.append('11 Tf')
        for ln in chunk:
            lines.append('(' + esc(ln) + ') Tj')
            lines.append('0 -14 Td')
        lines.append('ET')
        streams.append(('\\n'.join(lines) + '\\n').encode('latin-1', 'replace'))
        first = False

    n = len(streams)
    font_obj_id = 3 + 2 * n
    out = bytearray()
    out += b'%PDF-1.4\\n'
    offsets = []

    def add(blob):
        offsets.append(len(out))
        out += blob

    add(('1 0 obj\\n<< /Type /Catalog /Pages 2 0 R >>\\nendobj\\n').encode('latin-1'))
    kids = ' '.join('%d 0 R' % (3 + 2 * i) for i in range(n))
    add(('2 0 obj\\n<< /Type /Pages /Kids [%s] /Count %d >>\\nendobj\\n' % (kids, n)).encode('latin-1'))
    for i in range(n):
        content_id = 4 + 2 * i
        add(('%d 0 obj\\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 %d 0 R >> >> /Contents %d 0 R >>\\nendobj\\n' % (3 + 2 * i, font_obj_id, content_id)).encode('latin-1'))
        blob = streams[i]
        add(('%d 0 obj\\n<< /Length %d >>\\nstream\\n' % (content_id, len(blob))).encode('latin-1') + blob + b'endstream\\nendobj\\n')
    add(('%d 0 obj\\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\\nendobj\\n' % font_obj_id).encode('latin-1'))

    xref = len(out)
    total = 3 + 2 * n + 1
    out += ('xref\\n0 %d\\n0000000000 65535 f \\n' % total).encode('latin-1')
    for off in offsets:
        out += ('%010d 00000 n \\n' % off).encode('latin-1')
    out += ('trailer\\n<< /Size %d /Root 1 0 R >>\\nstartxref\\n%d\\n' % (total, xref)).encode('latin-1')
    out += b'%%EOF\\n'

    with open(out_path, 'wb') as f:
        f.write(bytes(out))
    print(json.dumps({'ok': True, 'filename': filename, 'size': os.path.getsize(out_path)}))

if __name__ == '__main__':
    main()
`;

const GEN_PPTX_SCRIPT = `#!/usr/bin/env python3
import sys, json, zipfile, html, os

def esc(s):
    return html.escape(str(s), quote=True)

P_NS = 'http://schemas.openxmlformats.org/presentationml/2006/main'
A_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main'
R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

def slide_xml(index, title, subtitle, paragraphs):
    paras = []
    if subtitle:
        paras.append('<a:p><a:r><a:rPr lang="en-US" sz="2200"/><a:t>' + esc(subtitle) + '</a:t></a:r></a:p>')
    for line in paragraphs:
        if not line.strip():
            paras.append('<a:p/>')
            continue
        paras.append('<a:p><a:r><a:rPr lang="en-US"/><a:t>' + esc(line) + '</a:t></a:r></a:p>')
    body = '\\n'.join(paras)
    return '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="''' + A_NS + '''" xmlns:r="''' + R_NS + '''" xmlns:p="''' + P_NS + '''">
<p:cSld><p:spTree>
<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
<p:grpSpPr/>
<p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" dirty="0"/><a:t>''' + esc(title) + '''</a:t></a:r></a:p></p:txBody></p:sp>
<p:sp><p:nvSpPr><p:cNvPr id="3" name="Content"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/>''' + body + '''</p:txBody></p:sp>
</p:spTree></p:cSld>
<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>
'''

def main():
    data = json.load(sys.stdin)
    filename = data.get('filename') or 'output.pptx'
    title = data.get('title') or ''
    subtitle = data.get('subtitle') or ''
    slides = data.get('slides') or []
    if not slides:
        slides = [{'title': title or 'Slide', 'content': data.get('content') or ''}]
    out_path = filename if filename.startswith('/') else os.path.join('/workspace', filename)
    d = os.path.dirname(out_path)
    if d:
        os.makedirs(d, exist_ok=True)

    slide_parts = []
    slide_ctypes = []
    slide_rels = []
    for i, sl in enumerate(slides, 1):
        paragraphs = (sl.get('content') or '').split('\\n')
        slide_parts.append(('ppt/slides/slide%d.xml' % i, slide_xml(i, sl.get('title') or '', subtitle if i == 1 else '', paragraphs)))
        slide_ctypes.append('<Override PartName="/ppt/slides/slide%d.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>' % i)
        slide_rels.append('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\\n<Relationship Id="rId1" Type="' + R_NS + '/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>\\n</Relationships>')

    presentation = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="''' + A_NS + '''" xmlns:r="''' + R_NS + '''" xmlns:p="''' + P_NS + '''">
<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
<p:sldIdLst>''' + '\\n'.join('<p:sldId id="%d" r:id="rId%d"/>' % (256 + i, i + 2) for i in range(len(slides))) + '''
</p:sldIdLst>
<p:sldSz cx="12192000" cy="6858000" type="wide"/>
<p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>'''

    pres_rels = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
                 '<Relationship Id="rId1" Type="' + R_NS + '/slideMaster" Target="slideMasters/slideMaster1.xml"/>']
    for i in range(len(slides)):
        pres_rels.append('<Relationship Id="rId%d" Type="' + R_NS + '/slide" Target="slides/slide%d.xml"/>' % (i + 2, i + 1))
    pres_rels.append('</Relationships>')

    master = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="''' + A_NS + '''" xmlns:r="''' + R_NS + '''" xmlns:p="''' + P_NS + '''">
<p:cSld><p:spTree>
<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
<p:grpSpPr/>
<p:sp><p:nvSpPr><p:cNvPr id="2" name=""/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" dirty="0"/><a:t>Title</a:t></a:r><a:endParaRPr lang="en-US" dirty="0"/></a:p></p:txBody></p:sp>
<p:sp><p:nvSpPr><p:cNvPr id="3" name=""/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" dirty="0"/><a:t>Content</a:t></a:r><a:endParaRPr lang="en-US" dirty="0"/></a:p></p:txBody></p:sp>
</p:spTree></p:cSld>
<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
<p:txStyles><p:titleStyle><a:defPPr/></p:titleStyle><p:bodyStyle><a:defPPr/></p:bodyStyle><p:otherStyle><a:defPPr/></p:otherStyle></p:txStyles>
</p:sldMaster>'''

    master_rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="''' + R_NS + '''/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
<Relationship Id="rId2" Type="''' + R_NS + '''/theme" Target="../theme/theme1.xml"/>
</Relationships>'''

    layout = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="''' + A_NS + '''" xmlns:r="''' + R_NS + '''" xmlns:p="''' + P_NS + '''" type="title" preserve="1">
<p:cSld name="Title Layout"><p:spTree>
<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
<p:grpSpPr/>
<p:sp><p:nvSpPr><p:cNvPr id="2" name=""/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/></p:txBody></p:sp>
<p:sp><p:nvSpPr><p:cNvPr id="3" name=""/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/></p:txBody></p:sp>
</p:spTree></p:cSld>
<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>'''

    layout_rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="''' + R_NS + '''/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>'''

    theme = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="''' + A_NS + '''" name="GIA">
<a:themeElements>
<a:clrScheme name="GIA">
<a:dk1><a:srgbClr val="000000"/></a:dk1>
<a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>
<a:dk2><a:srgbClr val="1F1F1F"/></a:dk2>
<a:lt2><a:srgbClr val="F2F2F2"/></a:lt2>
<a:accent1><a:srgbClr val="7C3AED"/></a:accent1>
<a:accent2><a:srgbClr val="06B6D4"/></a:accent2>
<a:accent3><a:srgbClr val="F43F5E"/></a:accent3>
<a:accent4><a:srgbClr val="F59E0B"/></a:accent4>
<a:accent5><a:srgbClr val="22C55E"/></a:accent5>
<a:accent6><a:srgbClr val="8B5CF6"/></a:accent6>
<a:hlink><a:srgbClr val="0E7490"/></a:hlink>
<a:folHlink><a:srgbClr val="831843"/></a:folHlink>
</a:clrScheme>
<a:fontScheme name="GIA">
<a:majorFont><a:latin typeface="Calibri Light"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>
<a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont>
</a:fontScheme>
<a:fmtScheme name="GIA">
<a:fillStyleLst>
<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
<a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"><a:lumMod val="100000"/><a:satMod val="103000"/><a:tint val="50000"/></a:schemeClr></a:gs><a:gs pos="100000"><a:schemeClr val="phClr"><a:lumMod val="100000"/><a:satMod val="105000"/><a:shade val="50000"/></a:schemeClr></a:gs></a:gsLst><a:lin ang="5400000" scaled="0"/></a:gradFill>
<a:noFill/>
</a:fillStyleLst>
<a:lnStyleLst>
<a:ln w="6350" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/><a:miter lim="800000"/></a:ln>
<a:ln w="12700" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/><a:miter lim="800000"/></a:ln>
<a:ln w="19050" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/><a:miter lim="800000"/></a:ln>
</a:lnStyleLst>
<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>
<a:bgFillStyleLst>
<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
<a:solidFill><a:schemeClr val="phClr"><a:lumMod val="95000"/></a:schemeClr></a:solidFill>
<a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"><a:lumMod val="100000"/><a:satMod val="103000"/><a:tint val="50000"/></a:schemeClr></a:gs><a:gs pos="100000"><a:schemeClr val="phClr"><a:lumMod val="100000"/><a:satMod val="105000"/><a:shade val="50000"/></a:schemeClr></a:gs></a:gsLst><a:lin ang="5400000" scaled="0"/></a:gradFill>
</a:bgFillStyleLst>
</a:fmtScheme>
</a:themeElements>
</a:theme>'''

    content_types = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
                     '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
                     '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
                     '<Default Extension="xml" ContentType="application/xml"/>',
                     '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>',
                     '<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>',
                     '<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>',
                     '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>']
    content_types += slide_ctypes
    content_types.append('</Types>')

    rels = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
            '<Relationship Id="rId1" Type="' + R_NS + '/officeDocument" Target="ppt/presentation.xml"/>',
            '</Relationships>']

    with zipfile.ZipFile(out_path, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', '\\n'.join(content_types))
        z.writestr('_rels/.rels', '\\n'.join(rels))
        z.writestr('ppt/presentation.xml', presentation)
        z.writestr('ppt/_rels/presentation.xml.rels', '\\n'.join(pres_rels))
        z.writestr('ppt/slideMasters/slideMaster1.xml', master)
        z.writestr('ppt/slideMasters/_rels/slideMaster1.xml.rels', master_rels)
        z.writestr('ppt/slideLayouts/slideLayout1.xml', layout)
        z.writestr('ppt/slideLayouts/_rels/slideLayout1.xml.rels', layout_rels)
        z.writestr('ppt/theme/theme1.xml', theme)
        for name, content in slide_parts:
            z.writestr(name, content)
            z.writestr(name.replace('.xml', '.xml.rels'), slide_rels[int(name.split('slide')[1].split('.')[0]) - 1])
    print(json.dumps({'ok': True, 'filename': filename, 'slides': len(slides), 'size': os.path.getsize(out_path)}))

if __name__ == '__main__':
    main()
`;

const GEN_DOCX_SCRIPT = `#!/usr/bin/env python3
import sys, json, zipfile, html, os

def esc(s):
    return html.escape(str(s), quote=True)

def main():
    data = json.load(sys.stdin)
    filename = data.get('filename') or 'output.docx'
    title = data.get('title') or ''
    content = data.get('content') or ''
    out_path = filename if filename.startswith('/') else os.path.join('/workspace', filename)
    d = os.path.dirname(out_path)
    if d:
        os.makedirs(d, exist_ok=True)

    body = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
            '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">',
            '<w:body>']
    if title:
        body.append('<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="36"/></w:rPr><w:t xml:space="preserve">' + esc(title) + '</w:t></w:r></w:p>')
    body.append('<w:p/>')
    for p in (content or '').split('\\n'):
        if not p.strip():
            body.append('<w:p/>')
            continue
        body.append('<w:p><w:r><w:t xml:space="preserve">' + esc(p) + '</w:t></w:r></w:p>')
    body.append('<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>')
    body.append('</w:body></w:document>')
    document_xml = '\\n'.join(body)

    content_types = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
                     '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
                     '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
                     '<Default Extension="xml" ContentType="application/xml"/>',
                     '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>',
                     '</Types>']
    rels = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>',
            '</Relationships>']
    doc_rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>'

    with zipfile.ZipFile(out_path, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', '\\n'.join(content_types))
        z.writestr('_rels/.rels', '\\n'.join(rels))
        z.writestr('word/document.xml', document_xml)
        z.writestr('word/_rels/document.xml.rels', doc_rels)
    print(json.dumps({'ok': True, 'filename': filename, 'size': os.path.getsize(out_path)}))

if __name__ == '__main__':
    main()
`;

/** The name each format's generator script is provisioned under in /workspace. */
const GEN_SCRIPT_MAP: Record<string, string> = {
  pdf: 'gen_pdf.py',
  pptx: 'gen_pptx.py',
  docx: 'gen_docx.py',
};

/** The embedded body for each generator script, keyed by format. */
const GEN_SCRIPT_BODY: Record<string, string> = {
  pdf: GEN_PDF_SCRIPT,
  pptx: GEN_PPTX_SCRIPT,
  docx: GEN_DOCX_SCRIPT,
};

/** Markdown line describing how to get a generated file, honest about
 *  whether a real clickable download link is available (remote sandbox
 *  server) or not (on-device native fallback — no HTTP server to link to). */
export function describeDownload(filename: string, dlUrl: string | null): string {
  return dlUrl
    ? `[⬇ Download ${filename}](${dlUrl})`
    : `Saved to \`${filename}\` in the on-device sandbox. Ask me to \`download_file\` it to save it to your device.`;
}

/** Gets a file's bytes regardless of which sandbox backend is active. */
export async function getFileBlob(path: string, dlUrl: string | null): Promise<Blob> {
  if (dlUrl) {
    const response = await fetch(dlUrl);
    if (!response.ok) throw new Error(`File not found or inaccessible: ${path} (HTTP ${response.status})`);
    return response.blob();
  }
  // Native fallback has no HTTP server to fetch from — read the file's
  // content directly through the terminal instead.
  const content = await SandboxService.readFile(path);
  return new Blob([content]);
}

const generate_file: Tool = {
  id: 'generate_file',
  name: 'generate_file',
  description: 'Generate a formatted document file (PDF, PowerPoint, Word, or ZIP) from content. Files are stored in the sandbox workspace and a preview link is provided.',
  schema: {
    type: 'object',
    properties: {
      format: {
        type: 'string',
        enum: ['pdf', 'pptx', 'docx', 'zip'],
        description: 'Output file format',
      },
      filename: {
        type: 'string',
        description: 'Output filename (e.g. "report.pdf", "slides.pptx", "doc.docx", "archive.zip"). Extension must match format.',
      },
      title: {
        type: 'string',
        description: 'Document title (used in PDF headers, PPTX title slide, DOCX title)',
      },
      content: {
        type: 'string',
        description: 'Document content in markdown format (used for PDF, DOCX). For PDF/DOCX this is the body text. Required for pdf/docx.',
      },
      slides: {
        type: 'string',
        description: 'JSON array of slide objects. Each: { "title": "...", "content": "..." }. Required for pptx format.',
      },
      subtitle: {
        type: 'string',
        description: 'Subtitle for PPTX title slide (only for pptx format)',
      },
    },
    required: ['format', 'filename'],
  },
  execute: async (args) => {
    const format = String(args.format || '');
    const filename = String(args.filename || '');
    const title = args.title ? String(args.title) : '';

    if (!format || !['pdf', 'pptx', 'docx', 'zip'].includes(format)) {
      return { success: false, content: '', error: `Unsupported format: ${format}. Use pdf, pptx, docx, or zip.` };
    }

    await ensureSandbox();

    try {
      const script = GEN_SCRIPT_MAP[format];

      if (format === 'zip') {
        const filesArg = args.files ? String(args.files) : '';
        if (!filesArg) {
          return { success: false, content: '', error: 'files is required for zip format (space-separated file paths)' };
        }
        const files = filesArg.split(/\s+/).filter(Boolean);
        filename.replace(/\.zip$/i, '');
        const cmds = [`cd /workspace`, `zip -r "${filename}" ${files.map(f => `"${f}"`).join(' ')}`];
        const result = await SandboxService.exec(cmds.join(' && '));
        if (result.exitCode !== 0) {
          return { success: false, content: result.stdout || '', error: result.stderr || `Zip failed (exit ${result.exitCode})` };
        }
        const dlUrl = SandboxService.downloadUrl(filename);
        return {
          success: true,
          content: [``, describeDownload(filename, dlUrl), '', '```visual', JSON.stringify({ type: 'file_preview', data: { url: dlUrl, name: filename, format: 'zip', files: files } }), '```', ''].join('\n'),
        };
      }

      const input: Record<string, unknown> = { filename, title, content: args.content };

      if (format === 'pptx') {
        let slides: unknown[];
        try {
          slides = JSON.parse(String(args.slides || '[]'));
        } catch {
          return { success: false, content: '', error: 'slides must be a valid JSON array of { title, content } objects' };
        }
        input.slides = slides;
        if (args.subtitle) input.subtitle = String(args.subtitle);
      }

      const inputJson = JSON.stringify(input);
      const scriptPath = `/workspace/${script}`;
      const inputPath = `/workspace/_gen_${Date.now()}_input.json`;

      // The generator scripts never existed anywhere else in the repo, so a
      // fresh sandbox (remote container or on-device rootfs) has none of them.
      // Self-provision them here, run, then clean up script + input on both
      // backends (absolute /workspace paths so native fallback matches remote).
      await SandboxService.writeFile(scriptPath, GEN_SCRIPT_BODY[format]);
      await SandboxService.writeFile(inputPath, inputJson);

      let execResult: SandboxResult;
      try {
        execResult = await SandboxService.exec(`python3 ${scriptPath} < ${inputPath}`);
      } finally {
        await Promise.allSettled([SandboxService.delete(scriptPath), SandboxService.delete(inputPath)]);
      }

      if (execResult.exitCode !== 0) {
        return { success: false, content: execResult.stdout || '', error: execResult.stderr || `Generation failed (exit ${execResult.exitCode})` };
      }

      const dlUrl = SandboxService.downloadUrl(filename);
      const visualBlock = JSON.stringify({ type: 'file_preview', data: { url: dlUrl, name: filename, format } });

      return {
        success: true,
        content: [
          `Generated **${filename}**`,
          describeDownload(filename, dlUrl),
          '',
          '```visual',
          visualBlock,
          '```',
          '',
          `To open in-app, click the download link above. The file is also available in the sandbox workspace.`,
        ].join('\n'),
      };
    } catch (e) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

const edit_document: Tool = {
  id: 'edit_document',
  name: 'edit_document',
  description: 'Edit an existing document in the sandbox workspace. Reads the file, applies user-specified changes, and saves. Supports plain text, markdown, code files, and JSON.',
  schema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Path to the file in the sandbox workspace (e.g. "report.md", "data.json")' },
      changes: { type: 'string', description: 'Description of the changes to apply (e.g. "change the title to New Title", "add a line after line 5")' },
      newContent: { type: 'string', description: 'If provided, replaces the entire file content with this value. Use for full rewrites.' },
    },
    required: ['path'],
  },
  execute: async (args) => {
    const filePath = String(args.path || '');
    const changes = args.changes ? String(args.changes) : '';
    const newContent = args.newContent !== undefined ? String(args.newContent) : undefined;

    if (!filePath) return { success: false, content: '', error: 'path is required' };

    await ensureSandbox();

    try {
      if (newContent !== undefined) {
        await SandboxService.writeFile(filePath, newContent);
        return {
          success: true,
          content: `Updated \`${filePath}\` (full content replacement).\n\n${describeDownload(filePath, SandboxService.downloadUrl(filePath))}`,
        };
      }

      const currentContent = await SandboxService.readFile(filePath);
      return {
        success: true,
        content: [
          `**File:** \`${filePath}\``,
          '',
          '```',
          currentContent.slice(0, 5000) + (currentContent.length > 5000 ? '\n... (truncated)' : ''),
          '```',
          '',
          changes ? `**Requested changes:** ${changes}` : '',
          '',
          'To edit, use `newContent` with the complete updated file content, or describe specific changes and I will apply them.',
        ].join('\n'),
      };
    } catch (e) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

const download_file: Tool = {
  id: 'download_file',
  name: 'download_file',
  description: 'Download a file from the sandbox workspace to the user\'s device. Triggers a browser/device download dialog for any file in the sandbox workspace.',
  schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the file in the sandbox workspace (e.g. "report.pdf", "slides.pptx", "data/results.json")',
      },
      filename: {
        type: 'string',
        description: 'Optional custom filename for the downloaded file. Defaults to the basename of path.',
      },
    },
    required: ['path'],
  },
  execute: async (args) => {
    const path = String(args.path || '');
    if (!path) return { success: false, content: '', error: 'path is required' };

    await ensureSandbox();

    try {
      const dlUrl = SandboxService.downloadUrl(path);
      const filename = args.filename ? String(args.filename) : path.split('/').pop() || 'file';

      const blob = await getFileBlob(path, dlUrl);
      const { triggerDownload } = await import('./helpers');
      triggerDownload(blob, filename);

      return {
        success: true,
        content: `Downloaded \`${path}\` as \`${filename}\` (${(blob.size / 1024).toFixed(1)} KB) successfully.`,
      };
    } catch (e) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

export const filegenTools: Tool[] = [generate_file, edit_document, download_file];
