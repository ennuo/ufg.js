const fs = require('fs');
const { getFloat16, setFloat16 } = require('@petamoriken/float16');

module.exports = class Data {
    isWriting = false;
    buffer;
    offset = 0;
    length = 0;

    static SHA1 = data => {
        const hash = crypto.createHash('sha1');
        hash.update(data);
        return hash.digest('hex');
    }

    constructor(input) {
        switch (typeof(input)) {
            case 'string': {
                if (fs.existsSync(input))
                    this.setData(fs.readFileSync(input));
                else throw new Error(`File with path '${input}' either does not exist, or we don't have access!`);
                break;
            }
            case 'number': {
                this.isWriting = true;
                this.setData(Buffer.alloc(input));
                break;
            }
            case 'object': {
                if (Array.isArray(input))
                    this.setData(Buffer.from(input));
                else if (!Buffer.isBuffer(input))
                    throw new Error('Specified object is not a buffer!');
                else this.setData(input);
                break;
            }
        }
    }

    setData = buffer => {
        this.buffer = buffer;
        this.length = buffer?.length || 0;
        this.offset = 0;
        return this;
    }

    bytes = input => {
        if (this.isWriting)
            for (let i = 0; i < input.length; ++i, this.offset++)
                this.buffer[this.offset] = input[i];
        else 
            return this.buffer.slice(this.offset, this.offset += input);
    }

    str = (input, padding = 0) => {
        if (this.isWriting) {
            let padded = ((input) || '').padEnd(padding, '\0');
            this.buffer.write(padded, this.offset, 'utf8');
            this.offset += padded.length;
        }
        else return this.bytes(input).toString('utf8').replace(/\0/g, '');
    }

    bool = input => this.u8(input) == 1;
    
    u8 = input => 
        (this.isWriting) ? this.bytes([input]) : this.buffer[this.offset++];

    u16 = input => {
        if (input === -1) input = 0xFFFF;
        if (this.isWriting) 
            this.buffer.writeUInt16BE(input, (this.offset += 2) - 2);
        else 
            return this.buffer.readUInt16BE((this.offset += 2) - 2);
    }

    u16le = input => {
        if (input === -1) input = 0xFFFF;
        if (this.isWriting) 
            this.buffer.writeUInt16LE(input, (this.offset += 2) - 2);
        else 
            return this.buffer.readUInt16LE((this.offset += 2) - 2);
    }

    s16 = input => {
        if (this.isWriting) 
            this.buffer.writeInt16BE(input, (this.offset += 2) - 2);
        else 
            return this.buffer.readInt16BE((this.offset += 2) - 2);
    }

    u32 = input => {
        if (input === -1) input = 0xFFFFFFFF;
        if (this.isWriting) this.buffer.writeUInt32BE(input, (this.offset += 4) - 4);
        else return this.buffer.readUInt32BE((this.offset += 4) - 4);
    }

    u32le = input => {
        if (input === -1) input = 0xFFFFFFFF;
        if (this.isWriting) this.buffer.writeUInt32LE(input, (this.offset += 4) - 4);
        else return this.buffer.readUInt32LE((this.offset += 4) - 4);
    }

    u64 = input => {
        if (input === -1) input = 0xFFFFFFFFFFFFFFFFn;
        if (this.isWriting) this.buffer.writeBigUInt64BE(BigInt(input), (this.offset += 8) - 8);
        else return Number(this.buffer.readBigUInt64BE((this.offset += 8) - 8));
    }

    u64le = input => {
        if (input === -1) input = 0xFFFFFFFFFFFFFFFFn;
        if (this.isWriting) this.buffer.writeBigUInt64LE(BigInt(input), (this.offset += 8) - 8);
        else return Number(this.buffer.readBigUInt64LE((this.offset += 8) - 8));
    }

    f32 = input => {
        if (!input) input = 0;
        if (this.isWriting) 
            this.buffer.writeFloatBE(input, (this.offset += 4) - 4);
        else
            return this.buffer.readFloatBE((this.offset += 4) - 4);
    }

    f16 = input => {
        if (!input) input = 0;
        const buffer = new ArrayBuffer(2);
        const view = new DataView(buffer);
        if (this.isWriting) {
            setFloat16(view, 0, input, false);
            this.u16(view.getUint16(0, false));
        } else {
            view.setUint16(0, this.u16(), false);
            return getFloat16(view, 0, false);
        }
    }

    #vector = (input, count, call = 'f32') => {
        const out = [];
        for (let i = 0; i < count; ++i)
            if (this.isWriting) this[call](input[i]);
            else out.push(this[call]());
        return out;
    }

    s2 = input => this.#vector(input, 2, 's16');
    s3 = input => this.#vector(input, 3, 's16');

    hf2 = input => this.#vector(input, 2, 'f16');
    hf3 = input => this.#vector(input, 3, 'f16');

    f2 = input => this.#vector(input, 2, 'f32');
    f3 = input => this.#vector(input, 3, 'f32');

    array = (type, input) => {
        const call = this[type].bind(this);
        const out = [];
        let count = (this.isWriting) ? input.length : input;
        for (let i = 0; i < count; ++i) {
            if (this.isWriting) call(input[i])
            else out.push(call(input));
        }
        return out;
    }

    shrink = () => this.buffer = this.buffer.slice(0, this.offset);
    write = path => {
        if (this.isWriting)
            this.shrink();
        fs.writeFileSync(path, this.buffer);
    }
}