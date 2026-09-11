"""Generate the two solid-colour PNG icons the manifest needs for installability. Run once: python make-icons.py"""
import struct
import zlib


def png(size: int, path: str, rgb=(0x1F, 0x6F, 0x5F)) -> None:
    raw = b"".join(b"\x00" + bytes(rgb) * size for _ in range(size))

    def chunk(tag: bytes, data: bytes) -> bytes:
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)
    out = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(out)


if __name__ == "__main__":
    png(192, "icon-192.png")
    png(512, "icon-512.png")
    print("icons ok")
