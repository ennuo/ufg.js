const Data = require('../memory/data');
const Types = require('../globals/types');
const decompressLZ = require('../memory/qcmp');

module.exports = class Bin {
    sections = {};

    constructor(data) {
        if (!(data instanceof Data)) data = new Data(data);
        while (data.offset < data.length) {
            let UID;
            const getHandle = data => {
                UID = data.u32(); 
                let chunkSize = data.u32(), 
                    dataSize = data.u32(), 
                    dataOffset = data.u32();

                if (dataOffset < 0 || dataOffset == 0xFFFFFFFF)
                    dataOffset = 0;
                data.offset += dataOffset;

                const handle = new Data(data.bytes(chunkSize - dataOffset));

                if (handle.buffer.length > 4 && handle.str(4) === 'PMCQ') {
                    handle.offset = 0x41;
                    UID = handle.u32(); // We can still find the section type in compressed data
                    handle.offset = 0;
                    if (UID == Types.TEXTURE_METADATA)
                        return getHandle(handle.setData(decompressLZ(handle)));
                }
                else handle.offset = 0;

                return handle;
            }

            const handle = getHandle(data);
            if (handle.length == 0) continue;
            if (UID == Types.DEADBEEF) continue;

            if (UID == Types.TEXTURE_DATA || UID == Types.COMPRESSED) {
                if (!this.sections[UID])
                    this.sections[UID] = [];
                this.sections[UID].push(handle);
                continue;
            }

            if (!this.sections[UID]) this.sections[UID] = {};
            const section = this.#processHandle(UID, handle);
            this.sections[UID][section.ID] = section;
        }
    }

    #processHandle = (UID, handle) => {
        const chunk = { handle };

        const readU16 = offset => {
            handle.offset = offset;
            return handle.u16();
        }

        const readU32 = offset => {
            handle.offset = offset;
            return handle.u32();
        }

        handle.offset = 0x1C;
        chunk.name = handle.str(0x23);
        chunk.ID = readU32(0xC);

        switch (UID) {
            case Types.TEXTURE_METADATA: {
                chunk.index = this.sections[Types.TEXTURE_DATA].length - 1;
                chunk.width = readU16(0x4c);
                chunk.height = readU16(0x4e);
                chunk.mipmaps = handle.buffer[0x50];

                switch (readU32(0x54)) {
                    case 0x2782CCE6: chunk.type = 'DXT1'; break;
                    case 0x2B068C0A: chunk.type = 'DXT3'; break;
                    case 0xA3833FDE: chunk.type = 'DXT5'; break;
                    default: chunk.type = 'UNKNOWN';
                }

                //delete chunk.handle;
                break;
            }
            case Types.VERTEX_DATA: {
                chunk.elementSize = readU32(0x4c);
                chunk.elementCount = readU32(0x50);
                handle.offset = 0xC0;
                handle.setData(handle.bytes(chunk.elementSize * chunk.elementCount));
                break;
            }
            case Types.MODEL_DEFINITION: { 
                chunk['PRIMITIVES'] = [];
                const primitiveCount = readU32(0xB0);
                chunk['JOINTS'] = readU32(0x78);
                chunk['TARGETS'] = readU32(0x88);
                chunk['SELECTIONS'] = readU32(0xE0 + (primitiveCount * 0xA0) + 0x8);
                for (let i = 0; i < primitiveCount; ++i) {
                    const BASE = 0xE0 + (i * 0xA0);
                    chunk['PRIMITIVES'].push({
                        attributes: {
                            VERTICES: readU32(BASE + 0x5c),
                            WEIGHTS: readU32(BASE + 0x6c),
                            TEXCOORDS: readU32(BASE + 0x7c),
                        },
                        material: readU32(BASE + 0x2c),
                        indices: readU32(BASE + 0x4c),
                    }); 
                }
                delete chunk.handle;
                break;
            }
        }

        return chunk;
    }
}