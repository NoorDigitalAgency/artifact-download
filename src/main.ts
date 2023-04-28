import * as core from '@actions/core'
import B2 from 'backblaze-b2';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import * as fs from 'fs';
import { resolve } from 'path';
import { decompressTarGz } from "./functions";

async function run(): Promise<void> {

  try {

    const name = core.getInput('name');

    const path = core.getInput('path');

    const key = core.getInput('key');

    const id = core.getInput('id');

    const bucket = core.getInput('bucket');

    const compressed = core.getBooleanInput('compressed');

    const tmp = process.env['RUNNER_TEMP'] ?? process.env['TEMP'] ?? process.env['TMP'] ?? process.env['TMPDIR'];

    const runId = `${process.env['GITHUB_REPOSITORY']!.replace('/', '-')}-${process.env['GITHUB_RUN_ID']}`;

    const artifactFileName = `${name}-${runId}`;

    const artifactFile = resolve(`${tmp}/${artifactFileName}-download`);

    core.info(`Start of download`);

    axiosRetry(axios, { retries: 5, retryDelay: (retryCount) => retryCount * 1250, retryCondition: (error) => error.response?.status === 503 });

    const b2 = new B2({axios: axios, applicationKey: key, applicationKeyId: id});

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

    core.info(`Extraction path ${extractionPath}`);

    if (!fs.existsSync(extractionPath)) fs.mkdirSync(extractionPath);

    await decompressTarGz(artifactFile, extractionPath, compressed);

    core.info(`End of extraction`);

    core.setOutput('download-path', extractionPath);

  } catch (error) {

    if (error instanceof Error) core.setFailed(error.message);
  }
}

run()
