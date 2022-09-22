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
            case Types.INDEX: {
                const indexCount = readU32(0x44);
                chunk.entries = [];
                for (let i = 0; i < indexCount; ++i) {
                    chunk.entries.push({
                        UID: handle.u32(),
                        size: handle.u32(),
                        unk1: handle.u32(),
                        offset: handle.u32(),
                        unk2: handle.u32()
                    });
                }
                delete chunk.handle;
                break;
            }
            case Types.BONE_DATA: {
                const boneCount = readU32(0x44);
                handle.offset = 0x100;
                chunk.bones = [];
                for (let i = 0; i < boneCount; ++i)
                    chunk.bones.push({ name: handle.str(0x40) });
                if (process.IS_LBP_KARTING === true)
                    for (let i = 0; i < boneCount; ++i)
                        chunk.bones[i].data = handle.bytes(0x8);
                delete chunk.handle;
                break;
            }
            case Types.TEXTURE_METADATA: {
                if (this.sections[Types.TEXTURE_DATA])
                    chunk.index = this.sections[Types.TEXTURE_DATA].length - 1;
                chunk.width = readU16(0x4c);
                chunk.height = readU16(0x4e);
                chunk.mipmaps = handle.buffer[0x50];

                chunk.textureUID = readU32(0x64);

                switch (handle.buffer[0x44]) {
                    case 0: chunk.type = 'ARGB'; break;
                    case 1: chunk.type = 'DXT1'; break;
                    case 2: chunk.type = 'DXT3'; break;
                    case 3: chunk.type = 'DXT5'; break;
                    default: {
                        console.log(handle.buffer[0x44]);
                        chunk.type = 'UNKNOWN';
                    }
                }

                chunk.offset = readU32(0x70);
                chunk.size = readU32(0x74);

                delete chunk.handle;

                break;
            }
            case Types.VERTEX_DATA: {

                // JOINT DATA
                // u8[4] boneIndices
                // u8[4] boneWeights

                // VERTEX DATA
                // u16[3] xyz
                // u8[13] unkData

                // UV DATA
                // f16[2] x0y0
                // f16[2] x1y1

                chunk.elementSize = readU32(0x4c);
                chunk.elementCount = readU32(0x50);
                handle.offset = 0xC0;
                handle.setData(handle.bytes(chunk.elementSize * chunk.elementCount));
                break;
            }
            case Types.MORPH_TARGETS: {
                const count = readU32(0x40);
                chunk.morphVertices = readU32(0x50);
                handle.offset = 0x60;
                chunk.morphs = [];
                for (let i = 0; i < count; ++i)
                    chunk.morphs.push({ ID: handle.u32() });
                for (let i = 0; i < count; ++i)
                    chunk.morphs[i].name = handle.str(0x40);
                delete chunk.handle;
                break;
            }
            case Types.MODEL_DEFINITION: { 
                chunk['PRIMITIVES'] = [];
                const primitiveCount = readU32(0xB0);
                chunk['JOINTS'] = readU32(0x78);
                chunk['TARGETS'] = readU32(0x88);
                //chunk['SELECTIONS'] = readU32(0xE0 + (primitiveCount * 0xA0) + 0x8);
                for (let i = 0; i < 1; ++i) {
                    const BASE = ((process.IS_LBP_KARTING === true) ? 0xE0 : 0xB0) + (i * 0xA0);

                    const PRIMITIVE_BASE = BASE + 0x10 + readU32(BASE + 0x10) + 0xC;

                    const primitive = {
                        attributes: {
                            TEXCOORDS: readU32(PRIMITIVE_BASE + 0x50),
                        },
                        material: readU32(PRIMITIVE_BASE),
                        type: readU32(PRIMITIVE_BASE + 0x10), // C3 09 2F 93 = SkinnedMesh, 28 1C C2 B5 = StaticMesh
                        indices: readU32(PRIMITIVE_BASE + 0x20),
                    }

                    console.log(primitive.type);
                    if (primitive.type == Types.SKINNED_MESH) {
                        primitive.attributes['WEIGHTS'] = readU32(PRIMITIVE_BASE + 0x40);
                        primitive.attributes['VERTICES'] = readU32(PRIMITIVE_BASE + 0x30);
                    } else if (primitive.type == Types.STATIC_MESH_F16 || primitive.type == Types.KART_MESH || primitive.type == Types.STATIC_MESH_F32)
                        primitive.attributes['VERTICES'] = readU32(PRIMITIVE_BASE + 0x40);

                    chunk['PRIMITIVES'].push(primitive);
                }
                delete chunk.handle;
                break;
            }
        }

        return chunk;
    }
}