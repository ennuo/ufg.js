const Data = require('../memory/data');

module.exports = class GLB {
    static ComponentType = {
        BYTE: 5120,
        UNSIGNED_BYTE: 5121,
        SHORT: 5122,
        UNSIGNED_SHORT: 5123,
        UNSIGNED_INT: 5125,
        FLOAT: 5126
    }

    #bin;

    asset = {
        generator: "UFG.JS v1.0",
        version: "2.0"
    }

    scene = 0
    scenes = [{
        name: "Scene",
        nodes: [0]
    }];

    nodes = [];
    materials = [];
    meshes = [];
    accessors = [];
    
    #bufferViewLookup = {};
    bufferViews = [];

    buffers = [{
        byteLength: 0
    }];

    animations = [];
    textures = [];
    images = [];

    createMesh = name => {
        const mesh = {
            name,
            primitives: []
        }
        this.meshes.push(mesh);
        return mesh;
    }

    getNamedBufferView = nameOrIndex => {
        if (typeof nameOrIndex === 'number')
            return nameOrIndex;
        return this.#bufferViewLookup[nameOrIndex];
    }

    createAccessor = (view, componentType, count, type) => {
        const accessor = {
            bufferView: this.getNamedBufferView(view),
            componentType,
            count,
            type
        }
        let index = this.accessors.length;
        this.accessors.push(accessor);
        return index;
    }

    createBufferView = (name, offset, length) => {
        const view = {
            buffer: 0,
            byteLength: length,
            byteOffset: offset
        }
        let index = this.bufferViews.length;
        this.#bufferViewLookup[name] = index;
        this.bufferViews.push(view);
        return index;
    }

    setBuffer = buffer => {
        this.#bin = buffer;
        this.buffers[0].byteLength = buffer.length;
    }

    save = path => {
        const json = JSON.stringify(this);
        const size = 0x14 + json.length + this.#bin.length + 0x8;
        const output = new Data(size);
        output.str('glTF');
        output.u32le(2); // glTF version
        output.u32le(size);
        output.u32le(json.length);
        output.str('JSON')
        output.str(json);
        output.u32le(this.#bin.length);
        output.str('BIN\0');
        output.bytes(this.#bin);
        output.write(path);
    }



}