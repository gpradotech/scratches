import {deflateRawSync} from 'node:zlib';

const crcTable = Array.from({length: 256}, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  return value >>> 0;
});
function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = (value >>> 8) ^ crcTable[(value ^ byte) & 0xff];
  return (value ^ 0xffffffff) >>> 0;
}

// ZIP padrão, sem dependências de desenvolvimento na instalação distribuída.
// Recebe exclusivamente os arquivos já validados por decodePackage.
export function releaseZip(files, version) {
  const entries = [], directory = []; let offset = 0;
  for (const file of files) {
    const name = Buffer.from(`scratches-${version}/${file.path}`, 'utf8');
    const bytes = Buffer.from(file.content, 'base64'), compressed = deflateRawSync(bytes);
    const checksum = crc32(bytes), header = Buffer.alloc(30), central = Buffer.alloc(46);
    header.writeUInt32LE(0x04034b50, 0); header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x800, 6); header.writeUInt16LE(8, 8);
    header.writeUInt16LE(33, 12); // 1980-01-01: saída reproduzível.
    header.writeUInt32LE(checksum, 14); header.writeUInt32LE(compressed.length, 18);
    header.writeUInt32LE(bytes.length, 22); header.writeUInt16LE(name.length, 26);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(0x314, 4);
    central.writeUInt16LE(20, 6); central.writeUInt16LE(0x800, 8);
    central.writeUInt16LE(8, 10); central.writeUInt16LE(33, 14);
    central.writeUInt32LE(checksum, 16); central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(bytes.length, 24); central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(((0o100000 | file.mode) << 16) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    entries.push(header, name, compressed); directory.push(central, name);
    offset += header.length + name.length + compressed.length;
  }
  const index = Buffer.concat(directory), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10); end.writeUInt32LE(index.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...entries, index, end]);
}
