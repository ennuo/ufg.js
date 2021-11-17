const Data = require('./data')

const DDS_HEADER_FLAGS_TEXTURE = 0x00001007;
const DDS_HEADER_FLAGS_MIPMAP = 0x00020000;
const DDS_SURFACE_FLAGS_TEXTURE = 0x00001000;
const DDS_SURFACE_FLAGS_MIPMAP = 0x00400008;
const DDS_SURFACE_FLAGS_CUBEMAP = 0x00000008;

const DDS_CUBEMAP_ALLFACES = 0xFE00;

const DDS_FOURCC = 0x4;
const DDS_RGB = 0x40;
const DDS_RGBA = 0x41;
const DDS_LUMINANCE = 0x00020000;
const DDS_LUMINANCEA = 0x00020001;

const DDSPF_DXT1 = [ 0x20, DDS_FOURCC, 0x31545844, 0, 0, 0, 0, 0 ];
const DDSPF_DXT3 = [ 0x20, DDS_FOURCC, 0x33545844, 0, 0, 0, 0, 0 ];
const DDSPF_DXT5 = [ 0x20, DDS_FOURCC, 0x35545844, 0, 0, 0, 0, 0 ];
const DDSPF_A8R8G8B8 = [ 0x20, DDS_RGBA, 0, 32, 0x00ff0000, 0x0000ff00, 0x000000ff, 0xff000000 ];
const DDSPF_R5G6B5 = [ 0x20, DDS_RGB, 0, 16, 0x0000f800, 0x000007e0, 0x0000001f, 0x00000000 ];
const DDSPF_A4R4G4B4 = [ 0x20, DDS_RGBA, 0, 16, 0x00000f00, 0x000000f0, 0x0000000f, 0x0000f000 ];
const DDSPF_A16B16G16R16F = [ 0x20, DDS_FOURCC, 113, 0, 0, 0, 0, 0 ];
const DDSPF_A8L8 = [ 0x20, DDS_LUMINANCEA, 0, 16, 0xff, 0, 0, 0xff00 ];
const DDSPF_L8 = [ 0x20, DDS_LUMINANCE, 0, 8, 0xff, 0, 0, 0 ];


module.exports = class Texture {
    static getDDSHeader = (format, width, height, mips) => {
        const header = new Data(0x80);

        header.str('DDS ');
        header.u32le(124 /* dwSize */);
        header.u32le(DDS_HEADER_FLAGS_TEXTURE | ((mips !== 0) ? DDS_HEADER_FLAGS_MIPMAP : 0));
        header.u32le(height);
        header.u32le(width);
        header.u32le(0 /* dwPitchOrLinearSize */); header.u32le(0 /*dwDepth */);
        header.u32le(mips + 1);
        for (let i = 0; i < 11; ++i)
            header.u32le(0 /* dwReserved[11] */);

        /* DDS_PIXELFORMAT */
        switch (format) {
            case 'DXT5': DDSPF_DXT5.forEach(x => header.u32le(x)); break;
            case 'DXT1': DDSPF_DXT1.forEach(x => header.u32le(x)); break;
            case 'DXT3': DDSPF_DXT3.forEach(x => header.u32le(x)); break;
            case 'ARGB': DDSPF_A8R8G8B8.forEach(x => header.u32le(x)); break;
            /*
            case 0x4: DDSPF_R5G6B5.forEach(x => header.u32le(x)); break;
            case 0x5: DDSPF_A4R4G4B4.forEach(x => header.u32le(x)); break;
            case 0x17: DDSPF_DXT3.forEach(x => header.u32le(x)); break;
            case 0x18: DDSPF_A8R8G8B8.forEach(x => header.u32le(x)); break;
            case 0x2b: DDSPF_DXT1.forEach(x => header.u32le(x)); break;
            case 0x2e: DDSPF_A16B16G16R16F.forEach(x => header.u32le(x)); break;
            case 0x2f: DDSPF_A8L8.forEach(x => header.u32le(x)); break;
            case 0x32: DDSPF_DXT5.forEach(x => header.u32le(x)); break;
            case 0x37: DDSPF_L8.forEach(x => header.u32le(x)); break;
            */
            default: throw new Error(`Unknown DDS Type: ${format}`);
        }

        let surfaceFlags = DDS_SURFACE_FLAGS_TEXTURE | ((format === 0x18) ? DDS_SURFACE_FLAGS_CUBEMAP : 0);
        if (mips !== 0) surfaceFlags |= DDS_SURFACE_FLAGS_MIPMAP;
        header.u32le(surfaceFlags);

        header.u32le((format === 0x18) ? DDS_CUBEMAP_ALLFACES : 0);

        [0, 0, 0].forEach(x => header.u32le(x));

        return header.buffer;
    }
}