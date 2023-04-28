import fs from "fs";
import zlib from "zlib";
import tar from "tar";

export async function decompressTarGz(filePath: string, targetPath: string) {

    const readStream = fs.createReadStream(filePath);

    const unzipStream = zlib.createGunzip();

    const untarStream = tar.extract({ cwd: targetPath, strip: 0 });

    readStream.pipe(unzipStream).pipe(untarStream);

    await new Promise((resolve, reject) => {

        untarStream.on("error", reject);

        untarStream.on("end", resolve);
    });
}