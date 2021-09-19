module.exports = {
    Types: require('./src/globals/types'),
    Data: require('./src/memory/data'),
    Bin: require('./src/types/bin'),
    IO: {
        GLB: require('./src/io/glb')
    },
    Tools: {
        Decompress: require('./src/memory/qcmp'),
        DDS: require('./src/memory/dds')
    }
}