#!/usr/bin/env python3
"""Re-encodes the PNG textures inside a .glb as WebP (lossy, alpha kept), rewriting the binary chunk and the json to match. Geometry is
untouched. three's GLTFLoader decodes any mime type the browser can, so no loader change is needed.

  .scratch/cb/bin/python tools/shrink_glb_textures.py public/models/tree-oak-a.glb [--quality 88] [--max 2048]
"""
import io, json, struct, sys
from PIL import Image

path = sys.argv[1]
quality = int(sys.argv[sys.argv.index('--quality') + 1]) if '--quality' in sys.argv else 88
max_side = int(sys.argv[sys.argv.index('--max') + 1]) if '--max' in sys.argv else 4096

raw = open(path, 'rb').read()
jlen, _ = struct.unpack_from('<II', raw, 12)
doc = json.loads(raw[20:20 + jlen])
blen, _ = struct.unpack_from('<II', raw, 20 + jlen)
bin_start = 28 + jlen
blob = raw[bin_start:bin_start + blen]

views = doc['bufferViews']
new_views = {}
for img in doc.get('images', []):
    v = views[img['bufferView']]
    src = blob[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']]
    im = Image.open(io.BytesIO(src))
    if max(im.size) > max_side:
        im.thumbnail((max_side, max_side), Image.LANCZOS)
    out = io.BytesIO()
    im.save(out, 'WEBP', quality=quality, method=6, exact=True)  # exact: keep the colour under clear pixels, or mip-mapped leaf edges go dark
    new_views[img['bufferView']] = out.getvalue()
    img['mimeType'] = 'image/webp'
    print(img.get('name'), im.size, len(src), '->', len(out.getvalue()))

# Rebuild the blob with the images swapped, every view 4-byte aligned.
out = bytearray()
for i, v in enumerate(views):
    off = v.get('byteOffset', 0)
    data = new_views.get(i, blob[off:off + v['byteLength']])
    while len(out) % 4:
        out.append(0)
    v['byteOffset'] = len(out)
    v['byteLength'] = len(data)
    out += data
while len(out) % 4:
    out.append(0)
doc['buffers'][0]['byteLength'] = len(out)
j = json.dumps(doc, separators=(',', ':')).encode()
j += b' ' * (-len(j) % 4)
glb = struct.pack('<4sII', b'glTF', 2, 12 + 8 + len(j) + 8 + len(out))
glb += struct.pack('<I4s', len(j), b'JSON') + j + struct.pack('<I4s', len(out), b'BIN\0') + bytes(out)
open(path, 'wb').write(glb)
print(path, len(raw), '->', len(glb))
