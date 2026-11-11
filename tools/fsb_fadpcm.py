"""Decode Bedrock .fsb (FSB5, FADPCM codec) to WAV."""
import struct, sys, wave
FREQ = {1: 8000, 2: 11000, 3: 11025, 4: 16000, 5: 22050, 6: 24000, 7: 32000, 8: 44100, 9: 48000}
COEF = [(0, 0), (60, 0), (122, 60), (115, 52), (98, 55), (0, 0), (0, 0), (0, 0), (0, 0), (0, 0), (0, 0), (0, 0), (0, 0), (0, 0), (0, 0), (0, 0)]
def decode(path):
    d = open(path, 'rb').read(); assert d[:4] == b'FSB5'
    ver, ns, shs, nts, ds, mode = struct.unpack('<IIIIII', d[4:28]); hdr = 0x3C if ver == 1 else 0x40
    raw, = struct.unpack('<Q', d[hdr:hdr + 8]); extra = raw & 1; fi = (raw >> 1) & 0xF; ch = ((raw >> 5) & 1) + 1; doff = ((raw >> 7) & 0x7FFFFFF) * 16; nsamp = raw >> 34
    rate = FREQ.get(fi, 44100); base = hdr + shs + nts + doff; data = d[base:base + ds]
    out = [[] for _ in range(ch)]
    hist = [[0, 0] for _ in range(ch)]
    pos = 0; c = 0
    while pos + 0x8C <= len(data):
        f = data[pos:pos + 0x8C]; coefs, shifts = struct.unpack('<II', f[:8]); h1, h2 = struct.unpack('<hh', f[8:12])
        for i in range(8):
            k = (coefs >> (i * 4)) & 0xF; sh = 22 - ((shifts >> (i * 4)) & 0xF); c1, c2 = COEF[k]
            for w in range(4):
                word, = struct.unpack('<I', f[12 + i * 16 + w * 4:16 + i * 16 + w * 4])
                for j in range(8):
                    n = (word >> (j * 4)) & 0xF; s = ((n << 28) & 0xFFFFFFFF); s = s - (1 << 32) if s & 0x80000000 else s; s >>= sh
                    s = (s - h2 * c2 + h1 * c1) >> 6; s = max(-32768, min(32767, s)); h2, h1 = h1, s; out[c].append(s)
        pos += 0x8C; c = (c + 1) % ch
    n = min(len(o) for o in out); n = min(n, nsamp) if nsamp else n
    return rate, ch, out, n, mode
def to_wav(path, dst):
    rate, ch, out, n, mode = decode(path)
    w = wave.open(dst, 'wb'); w.setnchannels(ch); w.setsampwidth(2); w.setframerate(rate)
    w.writeframes(b''.join(struct.pack('<' + 'h' * ch, *[out[c][i] for c in range(ch)]) for i in range(n))); w.close(); return rate, ch, n, mode
if __name__ == '__main__': print(to_wav(sys.argv[1], sys.argv[2]))
