import * as core from '@actions/core'
import B2 from 'backblaze-b2';
import axios from 'axios';
import * as fs from 'fs';
import { resolve } from 'path';
import tar from 'tar';

async function run(): Promise<void> {

  try {

    const name = core.getInput('name', {required: false}) || 'artifact-upload-file';

    const path = core.getInput('path', {required: false}) || './dump/';

    const key = core.getInput('key', {required: false}) || 'K003biq6LWSel4z+ku9C/zO5eBIrulI';

    const id = core.getInput('id', {required: false}) || '003b705a4cfb3c5000000001b';

    const bucket = core.getInput('bucket', {required: false}) || 'github-artifacts';

    const tmp = process.env['RUNNER_TEMP'] ?? process.env['TEMP'] ?? process.env['TMP'] ?? process.env['TMPDIR'];

    const date = new Date();

    const runId = process.env['GITHUB_RUN_ID'] ?? `${date.getFullYear()}${date.getMonth()}${date.getHours()}`;

    const artifactFileName = `${name}-${runId}`;

    const artifactFile = resolve(`${tmp}/${artifactFileName}-download`);

    core.info(`Start of download`);

    const b2 = new B2({axios: axios, retry: {retries: 5}, applicationKey: key, applicationKeyId: id});

    await b2.authorize();

    const stream = (await b2.downloadFileByName({ bucketName: bucket, fileName: artifactFileName, responseType: 'stream' })).data;

    const writer = fs.createWriteStream(artifactFile);

    await new Promise((resolve, reject) => {

      stream.pipe(writer);

      let error = null as unknown;

      writer.on('error', err => {

        error = err;

        writer.close();

        reject(err);

      });

      writer.on('close', () => {

        if (!error) {

          resolve(true);
        }
      });
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

  } catch (error) {

    if (error instanceof Error) core.setFailed(error.message);
  }
}

run()
