import { spawn } from 'node:child_process';
const processes=[
  spawn(process.execPath,['server/index.mjs'],{stdio:'inherit',env:process.env}),
  spawn(process.execPath,['node_modules/@angular/cli/bin/ng.js','serve','--proxy-config','proxy.conf.json'],{stdio:'inherit',env:process.env})
];
const stop=()=>{for(const p of processes)p.kill('SIGTERM')};
process.on('SIGINT',stop);process.on('SIGTERM',stop);
for(const p of processes)p.on('exit',(code)=>{stop();process.exitCode=code||0});
