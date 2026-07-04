#!/usr/bin/env node
/**
 * Parser CLI for Project Zomboid Build 42 SandboxVars.lua
 * Reads the actual lua file and produces config-schema.json:
 * an array of section objects, each with an array of parameter objects.
 *
 * Usage: node parse-config.js [path/to/SandboxVars.lua] [output.json]
 */

const fs = require('fs');
const path = require('path');
const { parseSandboxVars } = require('./lua-parser.js');

const inputPath = process.argv[2] || path.join(__dirname, 'SandboxVars.lua');
const outputPath = process.argv[3] || path.join(__dirname, 'config-schema.json');

const raw = fs.readFileSync(inputPath, 'utf8');
const result = parseSandboxVars(raw);

const output = {
    version: result.version,
    sections: result.sections.map((s) => ({
        name: s.name,
        paramCount: s.params.length,
        params: s.params,
    })),
};

fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');

console.log(`Parsed ${result.totalParams} total parameters across ${result.sections.length} sections.`);
for (const s of result.sections) {
    console.log(`  - ${s.name}: ${s.params.length} parameters`);
}
if (result.noCommentParams.length > 0) {
    console.log(`\nWARNING: ${result.noCommentParams.length} parameter(s) had no comment at all (will need fallback description):`);
    for (const k of result.noCommentParams) {
        console.log(`  - ${k}`);
    }
} else {
    console.log('\nAll parameters have at least some comment text.');
}
console.log(`\nWrote schema to ${outputPath}`);
