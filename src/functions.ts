import fs from "fs";
import zlib from "zlib";
import tar from "tar";

export async function decompressTarGz(filePath: string, targetPath: string, compressed: boolean): Promise<void> {

    const readStream = fs.createReadStream(filePath);

    const untarStream = tar.extract({ cwd: targetPath, strip: 0 });

    if (compressed) {

        const unzipStream = zlib.createGunzip();

        readStream.pipe(unzipStream).pipe(untarStream);

    } else {

        readStream.pipe(untarStream);
    }

    await new Promise((resolve, reject) => {

        untarStream.on("error", reject);

        untarStream.on("end", resolve);
    });
}