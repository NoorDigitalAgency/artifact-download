import * as core from '@actions/core'
import B2 from 'backblaze-b2';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import * as fs from 'fs';
import { resolve } from 'path';
import tar from 'tar';
import {delay, promiser} from "./functions";

async function run(): Promise<void> {

  try {

    const name = core.getInput('name');

    const path = core.getInput('path');

    const key = core.getInput('key');

    const id = core.getInput('id');

    const bucket = core.getInput('bucket');

    const chunkSize = parseFloat(core.getInput('chunk-size')) * 1024 * 1024;

    const threads = parseInt(core.getInput('threads'));

    const tmp = process.env['RUNNER_TEMP'] ?? process.env['TEMP'] ?? process.env['TMP'] ?? process.env['TMPDIR'];

    const runId = `${process.env['GITHUB_REPOSITORY']!.replace('/', '-')}-${process.env['GITHUB_RUN_ID']}`;

    const artifactFileName = `${name}-${runId}`;

    const artifactFile = resolve(`${tmp}/${artifactFileName}-download`);

    core.info(`Start of download`);

    axiosRetry(axios, { retries: 5, retryDelay: (retryCount) => retryCount * 1250, retryCondition: (error) => error.response?.status === 503 });

    const b2 = new B2({axios: axios, applicationKey: key, applicationKeyId: id});

    await b2.authorize();

    const bucketId = (await b2.getBucket({bucketName: bucket})).data.bucketId;

    const fileInfo = ((await b2.listFileNames({ bucketId, maxFileCount: 1, startFileName: artifactFileName, prefix: '', delimiter: '' })).data as {files: {fileId: string, contentLength: number}[]}).files.pop()!;

    core.debug(`File info: ${JSON.stringify(fileInfo)}`);

    const fileSize = fileInfo.contentLength;

    const chunkCount = Math.ceil(fileSize / chunkSize);

    core.info(`Downloading ${chunkCount} chunks...`);

    let currentThreads = 0;

    const chunksPromiser = promiser<void>();

    for (let i = 0; i < chunkCount; i++) {

      const startByte = i * chunkSize;

      const endByte = Math.min((i + 1) * chunkSize, fileSize) - 1;

      currentThreads++;

      b2.downloadFileById({ fileId: fileInfo.fileId, responseType: 'stream', axiosOverride: {headers: {Range: `bytes=${startByte}-${endByte}`}} }).then(value => {

        const writer = fs.createWriteStream(`${artifactFile}-${i}`);

        value.data.pipe(writer, { end: false });

        value.data.on('end', () => {

          currentThreads--;

          if (currentThreads === 0) chunksPromiser.resolve();

        });
      });

      while (currentThreads >= threads) await delay(1000);
    }

    await chunksPromiser.promise;

    await new Promise((resolve, reject) => {

      const outputStream = fs.createWriteStream(artifactFile);

      let error = null as unknown;

      outputStream.on('error', err => {

        error = err;

        outputStream.close();

        reject(err);

      });

      outputStream.on('close', () => {

        if (!error) {

          resolve(true);
        }
      });

      try {

        for (let i = 0; i < chunkCount; i++) {

          const inputStream = fs.createReadStream(`${artifactFile}-${i}`);

          inputStream.pipe(outputStream, {end: false});

          inputStream.on('end', () => {

            fs.rmSync(`${artifactFile}-${i}`);

            if (i === chunkCount - 1) {

              outputStream.end();
            }
          });
        }
      } catch (err) {

            error = err;

            outputStream.close();

            reject(err);
      }
    });

    core.info(`End of download`);

    core.info(`Start of extraction`);

    const extractionPath = resolve(path);

    if (!fs.existsSync(extractionPath)) fs.mkdirSync(extractionPath);

    await new Promise((resolve, reject) => {

      fs.createReadStream(artifactFile)

          .on('error', reject)

          .on('end', resolve)

          .pipe(tar.extract({

            cwd: extractionPath,

            strip: 0
          }));
    });

    core.info(`End of extraction`);

    fs.rmSync(artifactFile);

    core.setOutput('download-path', extractionPath);

  } catch (error) {

    console.log(error);

    if (error instanceof Error) core.setFailed(error.message);
  }
}

run()
