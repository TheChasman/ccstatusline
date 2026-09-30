#!/usr/bin/env bun

import { deployStatic } from '../src/utils/static-deploy';

const result = await deployStatic();
if (result.error) {
    console.error(`Deploy failed: ${result.error}`);
    process.exitCode = 1;
} else {
    console.log(`Deployed ccstatusline to ${result.staticPath}`);
}
