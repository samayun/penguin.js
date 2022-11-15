#!/usr/bin/env node

const { execSync } = require('child_process');

const RunCommand = (command) => {
  try {
    execSync(`${command}`, { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error(`Failed to execute ${command}`, error);
    return false;
  }
};

const boilerplate = process.argv[2] || 'penguin';
const gitCheckoutCommand = `git clone --depth 1 https://github.com/samayun/penguin.js.git ${boilerplate}`;

console.log(`\n\n${'\033[32m'} Creating a new Node app in ${__dirname}.\n\n`);
const CheckedOut = RunCommand(gitCheckoutCommand);
if (!CheckedOut) process.exit(-1);

console.log(`\n${'\033[32m'} Congratulations! You are ready.`);
console.log(`\n${'\033[33m'} This node.js template maintained by Samayun Chowdhury`);

console.log(`\n${'\033[35m'} $ cd ${boilerplate}/api && cp .env.example .env`);

console.log(`\n${'\033[35m'} $ make build && make logs`);
