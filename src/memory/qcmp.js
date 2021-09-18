const Data = require('./data');

const readHeader = data => {
    data.offset = 0;
    const magic = data.str(4);
    let endian = '';
    if (magic == 'PMCQ') endian = 'le';
    else if (magic != 'QCMP') return null;
    const int = data[`u32${endian}`].bind(data);
    const short = data[`u16${endian}`].bind(data);
    const long = data[`u64${endian}`].bind(data);
    return {
        type: short(),
        version: short(),
        offset: int(),
        extraSize: int(),
        compressedSize: long(),
        uncompressedSize: long(),
        hash: data.bytes(0x20)
    }
}

module.exports = decompress = data => {
    if (Buffer.isBuffer(data) || typeof data === 'string')
        data = new Data(data);
    const header = readHeader(data);
    if (!header) return data.buffer;
    const { compressedSize, uncompressedSize } = header;
    const buffer = [...data.bytes(compressedSize), new Array(uncompressedSize).fill(0) ];

    const cache = {
        mCache: new Uint32Array(32),
        mCurrent: 0
    }

    for (let i = 0; i < 32; ++i)
        cache.mCache[i] = 0;


    let desOffset = compressedSize;
    let offset = 0, dOffset = 0, byte;
    let a, b, c, d, e, f;

    while (offset < compressedSize) {
        byte = buffer[offset];
        dOffset = offset + 1;
        if (byte < 0x20) {
            a = byte + 1;
            offset = dOffset;
            if (a != 0) {
                do {
                    a = a + -1;
                    offset = desOffset + 1;
                    buffer[desOffset] = buffer[dOffset];
                    dOffset = dOffset + 1;
                    desOffset = offset;
                    offset = dOffset;
                } while (0 < a);
            }
        } else {
            b = byte >> 5;
            if (b == 1) {
                d = cache.mCache[byte & 0x1f] & 0xFFFF;
                c = cache.mCache[byte & 0x1f] >> 0x10;
            }
            else {
                e = buffer[dOffset];
                dOffset = offset + 2;
                f = (byte & 0x1f) << 8;
                d = f | e;
                if (b == 7) {
                    b = buffer[dOffset];
                    dOffset = offset + 3;
                }
                c = b + 1;

                cache.mCache[cache.mCurrent] = c * 0x10000 | f | e;
                cache.mCurrent = ~((cache.mCurrent + 1 != 0x20) - 1) & cache.mCurrent + 1;
            }
            let fun = desOffset + -d;
            offset = dOffset;
            if (c != 0) {
                do {
                    c = c - 1;
                    dOffset = desOffset + 1;
                    buffer[desOffset] = buffer[fun];
                    fun = fun + 1;
                    desOffset = dOffset;
                } while (0 < c);
            }
        }
    }
    let out = Buffer.alloc(uncompressedSize);
    for (let i = compressedSize; i < compressedSize + uncompressedSize; ++i)
        out[i - compressedSize] = buffer[i] || 0;
    return out;
}