const ufg = require('./index');
const fs = require('fs');
const path = require('path');


if (process.argv.length < 3 || process.argv.length > 4) {
    console.log('Usage: node run.js <.bin>');
    return console.log('Usage: node run.js <.perm.bin> <.temp.bin>')
}

if (!fs.existsSync('./output'))
    fs.mkdirSync('./output');

const binName = path.basename(process.argv[2], path.extname(process.argv[2]));
const bin = new ufg.Bin(process.argv[2])
const tempBin = process.argv[3] ? new ufg.Bin(process.argv[3]) : null;

const test_texture_export = () => {
    if (!bin.sections[ufg.Types.TEXTURE_METADATA]) return;
    if (!fs.existsSync(`./output/textures/${binName}`))
        fs.mkdirSync(`./output/textures/${binName}`, { recursive: true });
    for (let i = 0; i < Object.keys(bin.sections[ufg.Types.TEXTURE_METADATA]).length; ++i) {
        let index = i;
        const key = Object.keys(bin.sections[ufg.Types.TEXTURE_METADATA])[index];
        const descriptor = bin.sections[ufg.Types.TEXTURE_METADATA][key];
        let texture = Buffer.alloc(0);
        
        {
            const data = new ufg.Data(ufg.Tools.Decompress(bin.sections[ufg.Types.TEXTURE_DATA][descriptor.index]));
            const UID = data.u32(); 
            let chunkSize = data.u32(), 
                dataSize = data.u32(), 
                dataOffset = data.u32();
            if (dataOffset < 0 || dataOffset == 0xFFFFFFFF)
                dataOffset = 0;
            data.offset += dataOffset;
            texture = data.bytes(chunkSize - dataOffset);
        }

        console.log('Writing %s', descriptor.name);
        fs.writeFileSync(`output/textures/${binName}/${descriptor.name}.dds`, 
        Buffer.concat([ 
            ufg.Tools.DDS.getDDSHeader(descriptor.type, descriptor.width, descriptor.height, descriptor.mipmaps), 
            texture ]
    ));
    
    }
}

const test_model_export = (tag) => {
    if (!fs.existsSync(`./output/models/${binName}`))
        fs.mkdirSync(`./output/models/${binName}`, { recursive: true });

    const hoarde = bin.sections[ufg.Types.MODEL_DEFINITION][tag];

    try {
        const glb = new ufg.IO.GLB();

        const mesh = glb.createMesh(hoarde.name);
    
        const primitive = hoarde['PRIMITIVES'][0];
    
        let morphs = [];
    
        try {
            if (hoarde['TARGETS']) {
                const morphDefinitions = bin.sections[ufg.Types.MORPH_TARGETS][hoarde['TARGETS']];
                const morphVertices = bin.sections[ufg.Types.VERTEX_DATA][morphDefinitions.morphVertices]
        
                mesh.targets = [];
                mesh.extras = {
                    targetNames: []
                }
        
                for (const morph of morphDefinitions.morphs)
                    mesh.extras.targetNames.push(morph.name);
        
                for (let i = 0; i < morphDefinitions.morphs.length; ++i) {
                    const handle = morphVertices.handle; const morph = [];
                    for (let j = 0; j < morphVertices.elementCount / morphDefinitions.morphs.length; ++j) {
                        morph.push([handle.s16(), handle.s16(), handle.s16()]);
                        handle.offset += (0xC - 6);
                    }
                    morphs.push(morph);
                }
            }
        } catch { console.log('There was an error parsing morphs for %s', hoarde.name); morphs = []; }
    
        const vertexHandle = bin.sections[ufg.Types.VERTEX_DATA][primitive.attributes['VERTICES']];
    
        const texHandle = bin.sections[ufg.Types.VERTEX_DATA][primitive.attributes['TEXCOORDS']];
        const indexHandle = bin.sections[ufg.Types.VERTEX_DATA][primitive.indices];

        const vertexBuffer = new ufg.Data(vertexHandle.elementCount * 0xC);
        if (primitive.type == ufg.Types.SKINNED_MESH) {
            for (let i = 0; i < vertexHandle.elementCount; ++i) {
        
                vertexHandle.handle.offset = i * 0x10;
        
                vertexBuffer.f32le(vertexHandle.handle.s16());
                vertexBuffer.f32le(vertexHandle.handle.s16());
                vertexBuffer.f32le(vertexHandle.handle.s16());
            }
        } else if (primitive.type == ufg.Types.STATIC_MESH) {
            for (let i = 0; i < vertexHandle.elementCount; ++i) {
                vertexHandle.handle.offset = i * 0x6;
                vertexBuffer.f32le(vertexHandle.handle.f16());
                vertexBuffer.f32le(vertexHandle.handle.f16());
                vertexBuffer.f32le(vertexHandle.handle.f16());
            }
        } else throw new Error('Unknown Mesh Type: ' + primitive.type.toString(16));
    
        glb.createBufferView('VERTICES', 0, vertexBuffer.length);
        let buffer = Buffer.concat([vertexBuffer.buffer, indexHandle.handle.buffer.swap16() ]);
    
        glb.createBufferView('INDICES', vertexBuffer.length, indexHandle.handle.buffer.length);
    
        const texCoords = [];
        for (let i = 0; i < texHandle.elementCount; ++i) {
            
            const channels = [];

            let count = texHandle.elementSize / 0x4;
            for (let j = 0; j < count; ++j)
                channels.push([ texHandle.handle.f16(), texHandle.handle.f16() ]);
    
            texCoords.push(channels);
        }


        let channelCount = 0;
        if (texCoords[0])
            for (let i = 0; i < texCoords[0].length; ++i)
                if (!isNaN(texCoords[0][i][0])) channelCount++;

        for (let i = 0; i < channelCount; ++i) {
            const uvStart = buffer.length;
            const channelBuffer = new ufg.Data(0x8 * texHandle.elementCount);

            for (let j = 0; j < texHandle.elementCount; ++j) {
                channelBuffer.f32le(texCoords[j][i][0]);
                channelBuffer.f32le(texCoords[j][i][1]);
            }
    
            glb.createBufferView(`TEXCOORD_${i}`, uvStart, channelBuffer.length);
            buffer = Buffer.concat([buffer, channelBuffer.buffer]);
        }
    
        for (let i = 0; i < morphs.length; ++i) {
            const morphStart = buffer.length;
            const morphBuffer = new ufg.Data(0xC * vertexHandle.elementCount);
    
            for (let j = 0; j < vertexHandle.elementCount; ++j) {
                morphBuffer.f32le(morphs[i][j][0]);
                morphBuffer.f32le(morphs[i][j][1]);
                morphBuffer.f32le(morphs[i][j][2]);
            }
    
            glb.createBufferView(`MORPHS_${i}`, morphStart, morphBuffer.length);
    
            buffer = Buffer.concat([buffer, morphBuffer.buffer]);
        }
    
    
        glb.setBuffer(buffer);
    
        mesh.primitives.push({
            attributes: (() => {
                const object = {
                    POSITION: glb.createAccessor('VERTICES', ufg.IO.GLB.ComponentType.FLOAT, vertexHandle.elementCount, 'VEC3')
                }
                for (let i = 0; i < channelCount; ++i)
                    object[`TEXCOORD_${i}`] = glb.createAccessor(`TEXCOORD_${i}`, ufg.IO.GLB.ComponentType.FLOAT, texHandle.elementCount, 'VEC2');
                return object;
            })(),
            targets: (() => {
                const targets = [];
    
                for (let i = 0; i < morphs.length; ++i) 
                    targets.push({
                        POSITION: glb.createAccessor(`MORPHS_${i}`, ufg.IO.GLB.ComponentType.FLOAT, vertexHandle.elementCount, 'VEC3')
                    });
                return targets;
            })(),
            indices: glb.createAccessor('INDICES', ufg.IO.GLB.ComponentType.UNSIGNED_SHORT, indexHandle.elementCount, 'SCALAR'),
        });
    
        if (hoarde['JOINTS']) {
            const boneHandle = bin.sections[ufg.Types.BONE_DATA][hoarde['JOINTS']];
        }
    
        const node = {
            name: hoarde.name,
            mesh: 0
        }
    
    
        glb.nodes.push(node);
    
        console.log('Writing %s', hoarde.name);
        glb.save(`output/models/${binName}/${hoarde.name}.GLB`);
    } catch (e) { console.log("An error occurred when parsing %s", hoarde.name); console.error(e); }
}

if (tempBin != null) {
    const buffer = tempBin.sections[ufg.Types.TEXTURE_DATA][0].buffer;
    if (!fs.existsSync(`./output/textures/${binName}`))
        fs.mkdirSync(`./output/textures/${binName}`, { recursive: true });
    for (const key of Object.keys(bin.sections[ufg.Types.TEXTURE_METADATA])) {
        const descriptor = bin.sections[ufg.Types.TEXTURE_METADATA][key];
        console.log('Writing %s', descriptor.name);
        fs.writeFileSync(`output/textures/${binName}/${descriptor.name}.dds`, 
            Buffer.concat([ 
            ufg.Tools.DDS.getDDSHeader(descriptor.type, descriptor.width, descriptor.height, descriptor.mipmaps), 
            buffer.slice(descriptor.offset, descriptor.offset + descriptor.size) ]
        ));
    }

    return;
}

test_texture_export();
if (bin.sections[ufg.Types.MODEL_DEFINITION])
    for (const tag of Object.keys(bin.sections[ufg.Types.MODEL_DEFINITION]))
        test_model_export(tag);